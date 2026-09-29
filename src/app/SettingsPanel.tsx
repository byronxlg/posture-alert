import { useEffect, useRef, useState } from "react";
import { requestNotifications } from "./alerts.ts";
import { Group, Reveal, Row, Segmented, Switch } from "./controls.tsx";
import {
  BREAK_PRESETS, DEFAULT_BREAK, DELAY_PRESETS, DELAY_RANGE, SENSITIVITY_PRESETS, SENSITIVITY_RANGE,
  matchPreset, sensitivityWord, type Settings,
} from "./settings.ts";

/**
 * Settings as a sheet. The simple choice is always visible; the finer control
 * behind it appears once that choice is touched or turned on.
 */
export function SettingsSheet({
  open, onClose, settings: s, onChange, onTestSound,
}: { open: boolean; onClose: () => void; settings: Settings; onChange: (s: Settings) => void; onTestSound: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tunedSens, setTunedSens] = useState(false);
  const [tunedDelay, setTunedDelay] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...s, [k]: v });

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const sensPreset = matchPreset(SENSITIVITY_PRESETS, s.sensitivity);
  const delayPreset = matchPreset(DELAY_PRESETS, s.alertDelay);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sheet-body">
        <header className="sheet-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="text-btn strong" onClick={onClose}>Done</button>
        </header>

        <Group
          title="Detection"
          footnote={<>Strict flags smaller slouches. The alert waits until a slouch has lasted this long.</>}
        >
          <div className="row stack">
            <span className="row-label" id="sens-label">Sensitivity</span>
            <Segmented
              label="Sensitivity"
              options={SENSITIVITY_PRESETS}
              value={sensPreset?.value ?? null}
              onChange={(v) => { set("sensitivity", v); setTunedSens(true); }}
            />
          </div>
          <Reveal open={tunedSens || !sensPreset}>
            <label className="row stack">
              <span className="row-line">
                <span className="row-label">Fine-tune</span>
                <span className="row-detail">{sensitivityWord(s.sensitivity)}</span>
              </span>
              <input
                type="range" {...SENSITIVITY_RANGE} value={s.sensitivity}
                aria-valuetext={sensitivityWord(s.sensitivity)}
                onChange={(e) => set("sensitivity", Math.round(+e.target.value * 10) / 10)}
              />
              <span className="range-ends" aria-hidden="true"><span>Relaxed</span><span>Strict</span></span>
            </label>
          </Reveal>
          <div className="row stack">
            <span className="row-label">Alert after</span>
            <Segmented
              label="Alert after"
              options={DELAY_PRESETS}
              value={delayPreset?.value ?? null}
              onChange={(v) => { set("alertDelay", v); setTunedDelay(true); }}
            />
          </div>
          <Reveal open={tunedDelay || !delayPreset}>
            <label className="row stack">
              <span className="row-line">
                <span className="row-label">Exact delay</span>
                <span className="row-detail">{s.alertDelay} seconds</span>
              </span>
              <input type="range" {...DELAY_RANGE} value={s.alertDelay} aria-valuetext={`${s.alertDelay} seconds`} onChange={(e) => set("alertDelay", +e.target.value)} />
            </label>
          </Reveal>
        </Group>

        <Group title="Alerts" footnote="Notifications only appear while this tab is in the background.">
          <Row label="Chime"><Switch checked={s.sound} onChange={(on) => set("sound", on)} /></Row>
          <Reveal open={s.sound}>
            <label className="row">
              <span className="row-label">Volume</span>
              <input
                className="grow" type="range" min={0} max={1} step={0.05} value={s.volume}
                aria-valuetext={`${Math.round(s.volume * 100)}%`}
                onChange={(e) => set("volume", +e.target.value)}
              />
              <span className="row-detail num">{Math.round(s.volume * 100)}%</span>
            </label>
            <div className="row">
              <span className="row-label">Preview</span>
              <button type="button" className="text-btn" onClick={onTestSound}>Play chime</button>
            </div>
          </Reveal>
          <Row label="Notifications">
            <Switch checked={s.notify} onChange={async (on) => set("notify", on ? await requestNotifications() : false)} />
          </Row>
        </Group>

        <Group title="Breaks" footnote="Stepping away from the camera for two minutes counts as a break.">
          <Row label="Remind me to take breaks">
            <Switch checked={s.breakEvery > 0} onChange={(on) => set("breakEvery", on ? DEFAULT_BREAK : 0)} />
          </Row>
          <Reveal open={s.breakEvery > 0}>
            <div className="row stack">
              <span className="row-label">Every</span>
              <Segmented label="Break every" options={BREAK_PRESETS} value={s.breakEvery > 0 ? s.breakEvery : null} onChange={(v) => set("breakEvery", v)} />
            </div>
          </Reveal>
        </Group>

        <Group title="Advanced" footnote="Measurements show the head and shoulder angles behind each verdict.">
          <Row label="Draw skeleton on video"><Switch checked={s.skeleton} onChange={(on) => set("skeleton", on)} /></Row>
          <Row label="Show measurements"><Switch checked={s.details} onChange={(on) => set("details", on)} /></Row>
        </Group>
      </div>
    </dialog>
  );
}
