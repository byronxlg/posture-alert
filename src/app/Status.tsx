import type { Snapshot } from "./engine.ts";

export type Tone = "good" | "warn" | "bad" | "away" | "busy";

export interface StatusView { tone: Tone; head: string; sub: string; progress: number; centre: string | null }

const CALIBRATION_MS = 3000;

/** What the status says and how full the ring is, for any snapshot. */
export function statusView(snap: Snapshot, alertDelay: number): StatusView {
  if (snap.phase === "loading")
    return { tone: "busy", head: "Starting", sub: snap.source === "camera" ? "Opening the camera and loading the pose model." : "Loading the pose model.", progress: 0.25, centre: null };
  if (snap.phase === "calibrating") {
    const left = Math.max(0, snap.calibrationLeftMs);
    return { tone: "busy", head: "Hold still", sub: "Sit up straight. This becomes your baseline.", progress: 1 - left / CALIBRATION_MS, centre: String(Math.ceil(left / 1000)) };
  }
  if (snap.verdict === "good")
    return { tone: "good", head: "Upright", sub: snap.calibrated ? "Close to your calibrated posture." : "Close to typical upright posture.", progress: 1, centre: null };
  if (snap.verdict === "bad") {
    const why = snap.reason ?? "Posture";
    if (snap.alerting) return { tone: "bad", head: "Sit up", sub: `${why}. Straighten up and the alert stops.`, progress: 1, centre: null };
    const left = Math.max(0, alertDelay - snap.badForMs / 1000);
    return { tone: "warn", head: "Slouching", sub: `${why}. Alert in ${Math.ceil(left)} s unless you sit up.`, progress: 1 - left / alertDelay, centre: String(Math.ceil(left)) };
  }
  return { tone: "away", head: "Not in view", sub: "Sit so your head and both shoulders are in the frame.", progress: 1, centre: null };
}

/** The one thing to read from across the desk: a ring in the state's colour and a word. */
export function Status({ view }: { view: StatusView }) {
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div className={`status tone-${view.tone}`}>
      <div className="dial" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <circle className="dial-track" cx="50" cy="50" r={r} />
          <circle
            className="dial-arc" cx="50" cy="50" r={r}
            strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(Math.max(view.progress, 0), 1))}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className="dial-centre">{view.centre ?? <Figure tone={view.tone} />}</span>
      </div>
      <div className="status-text">
        <h2 className="status-head" aria-live="polite">{view.head}</h2>
        <p className="status-sub">{view.sub}</p>
      </div>
    </div>
  );
}

function Figure({ tone }: { tone: Tone }) {
  // Upright: a tick. Alerting: an arrow up, the thing to do. Not in view: an empty head and shoulders.
  if (tone === "good") return <svg viewBox="0 0 40 40" className="glyph"><path d="M11 21 L17.5 27.5 L30 14" /></svg>;
  if (tone === "bad") return <svg viewBox="0 0 40 40" className="glyph"><path d="M20 31 V10 M11 18 L20 9 L29 18" /></svg>;
  return <svg viewBox="0 0 40 40" className="glyph thin"><circle cx="20" cy="14" r="6" /><path d="M8 33 C 9 25, 14 22, 20 22 C 26 22, 31 25, 32 33" /></svg>;
}
