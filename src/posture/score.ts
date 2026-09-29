import type { Metrics, Reason } from "./types.ts";

/** Medians of the metrics while the user sat up straight during calibration. */
export type Baseline = { view: Metrics["view"] } & Partial<Record<Exclude<keyof Metrics, "view">, number>>;

/**
 * One rule: a metric, the value that is clearly fine, and the value that is
 * bad. Severity is linear between them (0 at good, 1 at bad), so a rule can
 * point either way. `abs` compares magnitudes (roll angles); `view` limits a
 * rule to front or side views, since some metrics are only reliable in one.
 */
export interface Rule {
  key: keyof Metrics;
  label: string;
  good: number;
  bad: number;
  abs?: boolean;
  view?: Metrics["view"];
}

/**
 * Absolute rules, used without calibration. Chosen on the tuning clips in
 * eval/ (see eval/REPORT.md); the 3D metrics come from MediaPipe's world
 * landmarks and do not depend on how far the camera is or how it is turned.
 */
export const ABSOLUTE_RULES: Rule[] = [
  { key: "earRise", label: "Head dropped", good: 0.45, bad: 0.2, view: "front" },
  { key: "pitch3d", label: "Looking down", good: 14, bad: 26, view: "front" },
  { key: "headForward3d", label: "Head forward", good: 0.2, bad: 0.32, view: "front" },
  { key: "headRoll", label: "Head tilted", good: 8, bad: 22, abs: true, view: "front" },
  { key: "shoulderRoll", label: "Shoulders uneven", good: 5, bad: 16, abs: true, view: "front" },
  { key: "neckIncline", label: "Head forward", good: 20, bad: 36, view: "side" },
  { key: "pitch3d", label: "Looking down", good: 15, bad: 30, view: "side" },
  { key: "headForward3d", label: "Head forward", good: 0.15, bad: 0.3, view: "side" },
  { key: "torso3d", label: "Leaning forward", good: 5, bad: 18, view: "side" },
];

/**
 * Rules relative to the calibrated baseline: `good` and `bad` are offsets from
 * the user's own upright value (for shoulderWidth, a ratio).
 */
export const RELATIVE_RULES: Rule[] = [
  { key: "earRise", label: "Head dropped", good: -0.05, bad: -0.15, view: "front" },
  { key: "headPitch", label: "Looking down", good: 0.05, bad: 0.25, view: "front" },
  { key: "pitch3d", label: "Looking down", good: 6, bad: 16 },
  { key: "headForward3d", label: "Head forward", good: 0.05, bad: 0.15 },
  { key: "headRoll", label: "Head tilted", good: 4, bad: 14, abs: true, view: "front" },
  { key: "shoulderRoll", label: "Shoulders uneven", good: 3, bad: 10, abs: true, view: "front" },
  { key: "shoulderWidth", label: "Leaning in", good: 1.05, bad: 1.2, view: "front" },
  { key: "neckIncline", label: "Head forward", good: 5, bad: 15, view: "side" },
  { key: "torso3d", label: "Leaning forward", good: 4, bad: 12, view: "side" },
];

export const PAIR_WEIGHT = 0.6;

export interface ScoreOptions {
  /** 1 = default; above 1 is stricter (bad thresholds move toward good). */
  sensitivity?: number;
  absolute?: Rule[];
  relative?: Rule[];
  /**
   * Weight for two problems at once: the score is the larger of the worst
   * severity and pairWeight * (worst + second worst, capped at 1). At 0.5 the
   * pair never outscores the worst rule alone; above 0.5 two moderate
   * problems together can cross the threshold.
   */
  pairWeight?: number;
}

function severity(value: number, good: number, bad: number, sens: number): number {
  const span = (bad - good) / sens;
  if (span === 0) return 0;
  return Math.max(0, (value - good) / span);
}

/**
 * Badness of one frame: the worst rule wins, so one clear problem is enough.
 * Returns score (>= 1 means past a bad threshold) and every rule's severity.
 */
export function scoreMetrics(m: Metrics, baseline: Baseline | null, opts: ScoreOptions = {}): { score: number; reasons: Reason[] } {
  const sens = opts.sensitivity ?? 1;
  const useBase = baseline && baseline.view === m.view;
  const rules = useBase ? (opts.relative ?? RELATIVE_RULES) : (opts.absolute ?? ABSOLUTE_RULES);
  const reasons: Reason[] = [];
  for (const r of rules) {
    if (r.view && r.view !== m.view) continue;
    const v = m[r.key];
    if (typeof v !== "number") continue;
    let x = v;
    if (useBase) {
      const b = baseline[r.key];
      if (typeof b !== "number") continue;
      x = r.key === "shoulderWidth" ? v / b : v - b;
    }
    if (r.abs) x = Math.abs(x);
    reasons.push({ key: r.key, label: r.label, severity: severity(x, r.good, r.bad, sens) });
  }
  reasons.sort((a, b) => b.severity - a.severity);
  const s1 = reasons[0]?.severity ?? 0;
  const s2 = Math.min(reasons[1]?.severity ?? 0, 1);
  const w = opts.pairWeight ?? PAIR_WEIGHT;
  return { score: Math.max(s1, w * (s1 + s2)), reasons };
}
