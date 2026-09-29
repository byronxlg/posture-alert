import { useState } from "react";
import type { Snapshot } from "./engine.ts";
import { formatSpan, summarise } from "./stats.ts";
import { Timeline } from "./Timeline.tsx";

export function Session({ snap, onReset }: { snap: Snapshot; onReset: () => void }) {
  const s = summarise(snap.stats, snap.timeline);
  const [confirming, setConfirming] = useState(false);
  const pct = s.uprightPct;
  const r = 30, c = 2 * Math.PI * r;
  return (
    <section className="card session" aria-labelledby="session-title">
      <header className="card-head">
        <h2 id="session-title">This session</h2>
        <span className="card-meta">Monitoring for <span className="num">{formatSpan(s.totalMs)}</span></span>
      </header>

      <div className="session-top">
      <div className="score">
        <svg className="score-ring" viewBox="0 0 72 72" aria-hidden="true">
          <circle className="score-track" cx="36" cy="36" r={r} />
          <circle
            className="score-arc" cx="36" cy="36" r={r}
            strokeDasharray={c} strokeDashoffset={c * (1 - (pct ?? 0) / 100)} transform="rotate(-90 36 36)"
          />
        </svg>
        <p className="score-text">
          <span className="score-num num">{pct === null ? "--" : pct}<small>{pct === null ? "" : "%"}</small></span>
          <span className="score-label">of the time upright</span>
        </p>
      </div>

      <dl className="stats">
        <div><dt>Upright</dt><dd className="num">{formatSpan(s.uprightMs)}</dd></div>
        <div><dt>Slouching</dt><dd className="num">{formatSpan(s.slouchMs)}</dd></div>
        <div><dt>Longest upright</dt><dd className="num">{formatSpan(s.longestUprightMs)}</dd></div>
        <div><dt>Alerts</dt><dd className="num">{s.alerts}</dd></div>
      </dl>
      </div>

      <Timeline data={snap.timeline} />

      <footer className="card-foot">
        {confirming ? (
          <span className="confirm" role="group" aria-label="Reset the session">
            <span>Clear these numbers?</span>
            <button type="button" className="text-btn" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="text-btn danger" onClick={() => { onReset(); setConfirming(false); }}>Reset</button>
          </span>
        ) : (
          <button type="button" className="text-btn subtle" onClick={() => setConfirming(true)}>Reset session</button>
        )}
      </footer>
    </section>
  );
}

export function Measurements({ snap }: { snap: Snapshot }) {
  const m = snap.metrics;
  const f = (v: number | null | undefined, d = 0, u = "") => (v === null || v === undefined ? "--" : `${v.toFixed(d)}${u}`);
  const rows: [string, string][] = !m ? [] : m.view === "front"
    ? [["Head pitch", f(m.pitch3d, 0, "°")], ["Head forward", f(m.headForward3d, 2)], ["Head tilt", f(m.headRoll === null ? null : Math.abs(m.headRoll), 0, "°")], ["Shoulder tilt", f(m.shoulderRoll === null ? null : Math.abs(m.shoulderRoll), 0, "°")]]
    : [["Neck angle", f(m.neckIncline, 0, "°")], ["Head pitch", f(m.pitch3d, 0, "°")], ["Head forward", f(m.headForward3d, 2)], ["Torso lean", f(m.torso3d, 0, "°")]];
  const level = snap.smoothed === null ? 0 : Math.min(snap.smoothed / 1.5, 1);
  const line = `${(1 / 1.5) * 100}%`;
  return (
    <section className="card measure" aria-labelledby="measure-title">
      <header className="card-head">
        <h2 id="measure-title">Measurements</h2>
        <span className="card-meta">{m ? (m.view === "front" ? "Front view" : "Side view") : "No pose"}</span>
      </header>
      <div className="level">
        <div className="level-bar" role="meter" aria-label="Slouch score" aria-valuemin={0} aria-valuemax={1.5} aria-valuenow={snap.smoothed ?? 0}>
          <div className="level-fill" style={{ width: `${level * 100}%` }} />
          <div className="level-mark" style={{ left: line }} />
        </div>
        <div className="level-scale" aria-hidden="true"><span>Upright</span><span style={{ left: line }}>Slouch line</span></div>
      </div>
      <dl className="stats compact">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>
    </section>
  );
}
