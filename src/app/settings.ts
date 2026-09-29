export interface Settings {
  /** 0.6 relaxed .. 1.6 strict; scales every bad threshold toward good. */
  sensitivity: number;
  /** Seconds of continuous bad posture before an alert. */
  alertDelay: number;
  sound: boolean;
  volume: number;
  notify: boolean;
  /** Minutes between break reminders; 0 turns them off. */
  breakEvery: number;
  skeleton: boolean;
  /** Show the measurements behind each verdict under the status. */
  details: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  alertDelay: 10,
  sound: true,
  volume: 0.5,
  notify: true,
  breakEvery: 0,
  skeleton: true,
  details: false,
};

// The simple choices in Settings, mapped onto the numeric fields above so saved settings keep working.
export const SENSITIVITY_PRESETS = [
  { label: "Relaxed", value: 0.8 },
  { label: "Balanced", value: 1 },
  { label: "Strict", value: 1.3 },
] as const;
export const SENSITIVITY_RANGE = { min: 0.6, max: 1.6, step: 0.1 } as const;

export const DELAY_PRESETS = [
  { label: "5 s", value: 5 },
  { label: "10 s", value: 10 },
  { label: "30 s", value: 30 },
] as const;
export const DELAY_RANGE = { min: 3, max: 60, step: 1 } as const;

export const BREAK_PRESETS = [
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 h", value: 60 },
] as const;
export const DEFAULT_BREAK = 30;

/** The preset whose value matches, or null when the value is custom. */
export function matchPreset<T extends { value: number }>(presets: readonly T[], value: number): T | null {
  return presets.find((p) => Math.abs(p.value - value) < 1e-6) ?? null;
}

/** Plain words for any sensitivity value, preset or not. */
export function sensitivityWord(value: number): string {
  const p = matchPreset(SENSITIVITY_PRESETS, value);
  if (p) return p.label;
  return value < 0.9 ? "Custom, relaxed" : value > 1.15 ? "Custom, strict" : "Custom, balanced";
}

const KEY = "posture-alert:settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or full storage: settings last for this visit only.
  }
}
