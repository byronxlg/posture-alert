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
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  alertDelay: 10,
  sound: true,
  volume: 0.5,
  notify: true,
  breakEvery: 0,
  skeleton: true,
};

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
