import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Engine, type Snapshot } from "./engine.ts";
import { loadSettings, saveSettings, type Settings } from "./settings.ts";
import { chime, requestNotifications, unlockAudio } from "./alerts.ts";
import { SettingsSheet } from "./SettingsPanel.tsx";
import { Status, statusView } from "./Status.tsx";
import { Measurements, Session } from "./Session.tsx";
import { Plumb } from "./Plumb.tsx";

const SAMPLE = `${import.meta.env.BASE_URL}sample/slouch-then-sit-up.mp4`;

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const view = snap && live ? statusView(snap, settings.alertDelay) : null;
  const engine = () => engineRef.current!;

  return (
    <div className={`app phase-${phase}${view ? ` tone-${view.tone}` : ""}`}>
      <header className="bar">
        <a className="mark" href={import.meta.env.BASE_URL} aria-label="Posture Alert home">
          <Plumb bent={snap?.alerting ?? false} size={24} />
          <span>Posture Alert</span>
        </a>
        <nav className="bar-actions" aria-label="Session">
          <button type="button" className="text-btn" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" aria-label="Settings">
            <GearIcon /> <span className="label-wide">Settings</span>
          </button>
          {live && (
            <button type="button" className="pill" onClick={() => engine().stop()}>
              {phase === "loading" ? "Cancel" : snap?.source === "sample" ? "Stop sample" : "Stop"}
            </button>
          )}
        </nav>
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
                <p>About 9 MB the first time, cached after that.</p>
              </div>
            )}
          </section>
        </div>

        {live && snap && view && (
          <aside className="panel" aria-label="Posture">
            <section className="card status-card">
              <Status view={view} />
              {(phase === "calibrating" || (snap.source === "camera" && phase === "monitoring")) && (
                <div className="status-actions">
                  {phase === "calibrating" ? (
                    <button type="button" className="text-btn" onClick={() => engine().skipCalibration()}>Skip calibration</button>
                  ) : (
                    <button type="button" className="text-btn" onClick={() => engine().beginCalibration()}>Calibrate again</button>
                  )}
                </div>
              )}
            </section>
            {snap.breakDue && (
              <div className="banner break" role="status">
                <p><strong>Time for a break.</strong> Stand up and look at something far away for a minute.</p>
                <button type="button" className="pill" onClick={() => engine().dismissBreak()}>Back to work</button>
              </div>
            )}
            {snap.notice && <p className="banner note">{snap.notice}</p>}
            {phase === "monitoring" && settings.details && <Measurements snap={snap} />}
          </aside>
        )}
        {live && snap && phase === "monitoring" && <Session snap={snap} onReset={() => engine().resetStats()} />}
      </main>

      <footer className="foot">
        <p>
          Pose tracking by <a href="https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker">MediaPipe</a>, in your browser.
          Nothing is uploaded or stored except your settings.{" "}
          <a href="https://github.com/byronxlg/posture-alert">Source and accuracy report</a>.
          Sample video from <a href="https://www.pexels.com/video/5125886/">Pexels</a>.
        </p>
      </footer>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={update}
        onTestSound={() => { unlockAudio(); chime(settings.volume); }}
      />
    </div>
  );
}

function GearIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function Intro({ phase, error, onStart }: { phase: string; error: string | null; onStart: (k: "camera" | "sample") => void }) {
  return (
    <section className="hero">
      <HeroFigure />
      <h1>A nudge when you start to slouch.</h1>
      <p className="lede">
        Posture Alert watches your head and shoulders through the webcam and chimes when you have been
        slouching for a while. The video stays on this device.
      </p>
      {phase === "error" && error && (
        <div className="banner error" role="alert">
          <p><strong>Could not start.</strong> {error}</p>
        </div>
      )}
      <div className="cta">
        <button type="button" className="primary" onClick={() => onStart("camera")}>Start with my camera</button>
        <button type="button" className="text-btn" onClick={() => onStart("sample")}>Try the sample video</button>
      </div>
      <ol className="steps">
        <li><span className="step-n" aria-hidden="true">1</span><strong>Allow the camera</strong><span>Head and both shoulders in view.</span></li>
        <li><span className="step-n" aria-hidden="true">2</span><strong>Sit up for three seconds</strong><span>That becomes your baseline.</span></li>
        <li><span className="step-n" aria-hidden="true">3</span><strong>Get on with your work</strong><span>It alerts even in a background tab.</span></li>
      </ol>
    </section>
  );
}

function HeroFigure() {
  // Two profiles on one plumb line: upright in ink, slouched as a ghost.
  return (
    <svg viewBox="0 0 320 360" className="hero-svg" aria-hidden="true">
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
