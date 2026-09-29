import { requestNotifications } from "./alerts.ts";
import type { Settings } from "./settings.ts";

export function SettingsPanel({ settings: s, onChange, onTestSound }: { settings: Settings; onChange: (s: Settings) => void; onTestSound: () => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...s, [k]: v });
  const sensLabel = s.sensitivity < 0.85 ? "Relaxed" : s.sensitivity > 1.2 ? "Strict" : "Balanced";
  return (
    <details className="settings">
      <summary>Settings</summary>
      <label className="field">
        <span>Sensitivity <em>{sensLabel}</em></span>
        <input type="range" min={0.6} max={1.6} step={0.1} value={s.sensitivity} onChange={(e) => set("sensitivity", +e.target.value)} />
      </label>
      <label className="field">
        <span>Alert after <em>{s.alertDelay} s of slouching</em></span>
        <input type="range" min={3} max={60} step={1} value={s.alertDelay} onChange={(e) => set("alertDelay", +e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={s.sound} onChange={(e) => set("sound", e.target.checked)} /> Play a chime
      </label>
      <label className="field" aria-disabled={!s.sound}>
        <span>Volume <em>{Math.round(s.volume * 100)}%</em></span>
        <input type="range" min={0} max={1} step={0.05} value={s.volume} disabled={!s.sound} onChange={(e) => set("volume", +e.target.value)} />
      </label>
      <button className="link" onClick={onTestSound} disabled={!s.sound}>Play the chime</button>
      <label className="check">
        <input
          type="checkbox"
          checked={s.notify}
          onChange={async (e) => {
            const on = e.target.checked;
            set("notify", on ? await requestNotifications() : false);
          }}
        />
        Notify me when this tab is in the background
      </label>
      <label className="field">
        <span>Break reminder</span>
        <select value={s.breakEvery} onChange={(e) => set("breakEvery", +e.target.value)}>
          <option value={0}>Off</option>
          <option value={20}>Every 20 minutes</option>
          <option value={30}>Every 30 minutes</option>
          <option value={45}>Every 45 minutes</option>
          <option value={60}>Every hour</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={s.skeleton} onChange={(e) => set("skeleton", e.target.checked)} /> Draw the skeleton over the video
      </label>
    </details>
  );
}
