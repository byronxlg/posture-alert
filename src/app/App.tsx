import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Engine, type Snapshot } from "./engine.ts";
import { loadSettings, saveSettings, type Settings } from "./settings.ts";
import { chime, requestNotifications, unlockAudio } from "./alerts.ts";
import { Timeline } from "./Timeline.tsx";
import { SettingsPanel } from "./SettingsPanel.tsx";
import { Plumb } from "./Plumb.tsx";
import { formatDuration } from "./format.ts";

const SAMPLE = `${import.meta.env.BASE_URL}sample/slouch-then-sit-up.mp4`;

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  // The stage takes the video's own shape once it is known, so there are no letterbox bars.
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    const e = new Engine(videoRef.current!, canvasRef.current!, settings, setSnap);
    engineRef.current = e;
    (window as unknown as { postureEngine: Engine }).postureEngine = e;
    setSnap(e.snap);
    // ?sample starts the sample video straight away (used by the headless checks).
    if (new URLSearchParams(location.search).has("sample")) void e.startSample(SAMPLE);
    return () => e.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
    engineRef.current?.applySettings(s);
  };

  const start = (kind: "camera" | "sample") => {
    unlockAudio();
    if (settings.notify) void requestNotifications();
    const e = engineRef.current!;
    void (kind === "camera" ? e.startCamera() : e.startSample(SAMPLE));
  };

  const phase = snap?.phase ?? "idle";
  const live = phase !== "idle" && phase !== "error";

  return (
    <div className={`app phase-${phase} verdict-${snap?.verdict ?? "unknown"}${snap?.alerting ? " alerting" : ""}`}>
      <header className="top">
        <a className="mark" href={import.meta.env.BASE_URL} aria-label="Posture Alert home">
          <Plumb bent={snap?.alerting ?? false} size={26} />
          <span>Posture Alert</span>
        </a>
        <p className="privacy-pill">Video stays on this device</p>
      </header>

      <main className={live ? "work" : "intro"}>
        {!live && <Intro phase={phase} error={snap?.error ?? null} onStart={start} />}

        <div className="stage-col" hidden={!live} style={{ "--ar": aspect } as CSSProperties}>
        <section
          className={`stage${snap?.source === "camera" ? " mirror" : ""}`}
          aria-label={snap?.source === "sample" ? "Sample video" : "Camera view"}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
            }}
          />
          <canvas ref={canvasRef} />
          {snap?.source === "sample" && phase !== "loading" && <p className="stage-tag">Sample video</p>}
          {phase === "loading" && (
            <div className="stage-note" role="status">
              <span className="spinner" aria-hidden="true" />
              <p>{snap?.source === "camera" ? "Starting the camera and loading the pose model" : "Loading the pose model"}</p>
              <p className="stage-note-sub">About 9 MB the first time, cached after that</p>
            </div>
          )}
          {phase === "calibrating" && snap && (
            <div className="calibrate">
              <p className="calibrate-count">{Math.ceil(snap.calibrationLeftMs / 1000)}</p>
              <p>Sit up straight, shoulders relaxed, eyes on the screen. Hold it.</p>
            </div>
          )}
        </section>
        {phase === "monitoring" && snap?.metrics && <Readout snap={snap} />}
        </div>

        {live && snap && (
          <aside className="panel">
            <Status snap={snap} alertDelay={settings.alertDelay} />
            {snap.notice && <p className="notice">{snap.notice}</p>}
            {snap.breakDue && (
              <div className="break" role="status">
                <p><strong>Time for a break.</strong> Stand up and look at something far away for a minute.</p>
                <button onClick={() => engineRef.current?.dismissBreak()}>Done, back to work</button>
              </div>
            )}
            {phase === "monitoring" && <Session snap={snap} onReset={() => engineRef.current?.resetStats()} />}
            <div className="actions">
              {phase === "calibrating" ? (
                <button className="quiet" onClick={() => engineRef.current?.skipCalibration()}>Skip calibration</button>
              ) : snap.source === "camera" && phase === "monitoring" ? (
                <button className="quiet" onClick={() => engineRef.current?.beginCalibration()}>Calibrate again</button>
              ) : null}
              <button className="quiet" onClick={() => engineRef.current?.stop()}>{phase === "loading" ? "Cancel" : snap.source === "sample" ? "Stop the sample" : "Stop monitoring"}</button>
            </div>
            <SettingsPanel settings={settings} onChange={update} onTestSound={() => { unlockAudio(); chime(settings.volume); }} />
          </aside>
        )}
      </main>

      <footer className="foot">
        <p>
          Pose tracking by <a href="https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker">MediaPipe Pose Landmarker</a>, running in your browser.
          Nothing is uploaded or stored except your settings. <a href="https://github.com/byronxlg/posture-alert">Source and accuracy report</a>.
          Sample video from <a href="https://www.pexels.com/video/5125886/">Pexels</a>.
        </p>
      </footer>
    </div>
  );
}

function Intro({ phase, error, onStart }: { phase: string; error: string | null; onStart: (k: "camera" | "sample") => void }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>A nudge when you start to slouch.</h1>
        <p className="lede">
          Posture Alert watches your head and shoulders through the webcam and chimes when you have been
          hunched for a while. The video is analysed inside this tab and never leaves your device.
        </p>
        {phase === "error" && error && (
          <div className="error" role="alert">
            <p className="error-head">Could not start</p>
            <p>{error}</p>
          </div>
        )}
        <div className="cta">
          <button className="primary" onClick={() => onStart("camera")}>Start with my camera</button>
          <button className="secondary" onClick={() => onStart("sample")}>Try the sample video</button>
        </div>
        <ol className="steps">
          <li><strong>Allow the camera.</strong> Sit so your head and both shoulders are in view.</li>
          <li><strong>Sit up straight for three seconds.</strong> That becomes your baseline.</li>
          <li><strong>Get on with your work.</strong> Keep the tab open; it alerts even when hidden.</li>
        </ol>
      </div>
      <figure className="hero-art" aria-hidden="true">
        <HeroFigure />
      </figure>
    </section>
  );
}

function HeroFigure() {
  // Two profiles on one plumb line: upright in ink, slouched as a red ghost.
  return (
    <svg viewBox="0 0 320 360" className="hero-svg">
      <line x1="170" y1="18" x2="170" y2="330" className="plumb-line" />
      <circle cx="170" cy="336" r="9" className="plumb-bob" />
      <g className="ghost">
        <circle cx="222" cy="112" r="30" />
        <path d="M150 300 C 150 230, 170 180, 205 150" />
      </g>
      <g className="upright">
        <circle cx="176" cy="78" r="30" />
        <path d="M150 300 C 152 230, 160 170, 168 118" />
      </g>
    </svg>
  );
}

function Status({ snap, alertDelay }: { snap: Snapshot; alertDelay: number }) {
  let head = "Looking for you";
  let sub = "Sit so your head and both shoulders are in the frame.";
  if (snap.phase === "loading") { head = "Starting"; sub = snap.source === "camera" ? "Waiting for the camera and the pose model." : "Waiting for the pose model."; }
  else if (snap.phase === "calibrating") { head = "Hold still"; sub = "Measuring your upright posture as the baseline."; }
  else if (snap.verdict === "good") { head = "Upright"; sub = snap.calibrated ? "Close to your calibrated posture." : "Close to typical upright posture."; }
  else if (snap.verdict === "bad") {
    head = snap.alerting ? "Sit up" : "Slouching";
    const left = Math.max(0, Math.ceil(alertDelay - snap.badForMs / 1000));
    sub = `${snap.reason ?? "Posture"}. ${snap.alerting ? "Straighten up and the alert clears." : `Alert in ${left} s if it continues.`}`;
  }
  const level = snap.smoothed === null ? 0 : Math.min(snap.smoothed / 1.5, 1);
  const line = `${(1 / 1.5) * 100}%`;
  return (
    <div className="status">
      <h2 aria-live="polite">{head}</h2>
      <p className="status-sub">{sub}</p>
      {snap.phase === "monitoring" && (
        <>
          <div className="meter" role="meter" aria-label="Slouch level" aria-valuemin={0} aria-valuemax={1.5} aria-valuenow={snap.smoothed ?? 0}>
            <div className="meter-fill" style={{ width: `${level * 100}%` }} />
            <div className="meter-mark" style={{ left: line }} />
          </div>
          <div className="meter-scale" aria-hidden="true">
            <span>Upright</span>
            <span className="meter-scale-line" style={{ left: line }}>Alert line</span>
          </div>
        </>
      )}
    </div>
  );
}

function Readout({ snap }: { snap: Snapshot }) {
  const m = snap.metrics!;
  const f = (v: number | null, d = 0, u = "") => (v === null ? "--" : `${v.toFixed(d)}${u}`);
  const rows = m.view === "front"
    ? [["Head pitch", f(m.pitch3d, 0, "°")], ["Head forward", f(m.headForward3d, 2)], ["Head tilt", f(m.headRoll === null ? null : Math.abs(m.headRoll), 0, "°")], ["Shoulders", f(m.shoulderRoll === null ? null : Math.abs(m.shoulderRoll), 0, "°")]]
    : [["Neck angle", f(m.neckIncline, 0, "°")], ["Head pitch", f(m.pitch3d, 0, "°")], ["Head forward", f(m.headForward3d, 2)], ["Torso lean", f(m.torso3d, 0, "°")]];
  return (
    <dl className="readout" aria-label="Measurements">
      <div><dt>View</dt><dd>{m.view === "front" ? "Front" : "Side"}</dd></div>
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

function Session({ snap, onReset }: { snap: Snapshot; onReset: () => void }) {
  const { goodMs, badMs, awayMs, alerts } = snap.stats;
  const seen = goodMs + badMs;
  const pct = seen > 0 ? Math.round((100 * goodMs) / seen) : null;
  const total = useMemo(() => formatDuration(goodMs + badMs + awayMs), [goodMs, badMs, awayMs]);
  return (
    <div className="session">
      <div className="session-head">
        <h3>This session</h3>
        <button className="link" onClick={onReset}>Reset</button>
      </div>
      <p className="session-line">
        <span className="big">{pct === null ? "--" : `${pct}%`}</span> of the time upright
      </p>
      <p className="session-meta">
        {total} monitored, {alerts === 0 ? "no alerts" : `${alerts} ${alerts === 1 ? "alert" : "alerts"}`}
      </p>
      <Timeline data={snap.timeline} />
    </div>
  );
}
