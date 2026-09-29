import { computeMetrics } from "./metrics.ts";
import { scoreMetrics, type Baseline, type ScoreOptions } from "./score.ts";
import type { Metrics, PoseFrame, Reason, Verdict } from "./types.ts";

export interface MonitorOptions extends ScoreOptions {
  /** Smoothing time constant for the score, ms. */
  smoothMs?: number;
  /** Smoothed score at which posture turns bad. */
  enter?: number;
  /** Smoothed score below which it turns good again (hysteresis). */
  exit?: number;
  /** Bad must last this long before an alert fires, ms. */
  alertAfterMs?: number;
  /** Frames without a usable pose for longer than this reset the state, ms. */
  lostAfterMs?: number;
}

export const DEFAULT_MONITOR: Required<Omit<MonitorOptions, "absolute" | "relative" | "pairWeight">> = {
  sensitivity: 1,
  smoothMs: 800,
  enter: 1,
  exit: 0.8,
  alertAfterMs: 5000,
  lostAfterMs: 3000,
};

export interface MonitorOutput {
  verdict: Verdict;
  /** Raw score of this frame (null when no usable pose). */
  score: number | null;
  smoothed: number | null;
  metrics: Metrics | null;
  reasons: Reason[];
  /** How long posture has been continuously bad, ms. */
  badForMs: number;
  /** True while an alert is active (bad for at least alertAfterMs). */
  alerting: boolean;
  /** True only on the frame an alert starts. */
  alertStarted: boolean;
}

/** Drops undefined keys so a partial options object never erases a default. */
function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Turns per-frame geometry into a stable verdict: smooths the score, applies
 * hysteresis so the state does not flicker at the threshold, and only raises
 * an alert once bad posture has persisted. Brief movements (reaching, a
 * glance down, a stretch) decay out of the smoothed score before they count.
 */
export class PostureMonitor {
  opts: Required<Omit<MonitorOptions, "absolute" | "relative" | "pairWeight">> & ScoreOptions;
  baseline: Baseline | null = null;
  private smoothed: number | null = null;
  private lastT: number | null = null;
  private lastSeen: number | null = null;
  private bad = false;
  private badSince: number | null = null;
  private alerting = false;

  constructor(opts: MonitorOptions = {}, baseline: Baseline | null = null) {
    this.opts = { ...DEFAULT_MONITOR, ...defined(opts) };
    this.baseline = baseline;
  }

  setOptions(opts: MonitorOptions) {
    this.opts = { ...this.opts, ...defined(opts) };
  }

  setBaseline(b: Baseline | null) {
    this.baseline = b;
    this.reset();
  }

  reset() {
    this.smoothed = null;
    this.lastT = null;
    this.bad = false;
    this.badSince = null;
    this.alerting = false;
  }

  update(frame: PoseFrame | null, tMs: number): MonitorOutput {
    const metrics = frame ? computeMetrics(frame) : null;
    const empty = (): MonitorOutput => ({
      verdict: "unknown", score: null, smoothed: this.smoothed, metrics, reasons: [],
      badForMs: this.badSince !== null ? tMs - this.badSince : 0, alerting: this.alerting, alertStarted: false,
    });
    if (!metrics) {
      if (this.lastSeen === null || tMs - this.lastSeen > this.opts.lostAfterMs) this.reset();
      return empty();
    }
    const { score, reasons } = scoreMetrics(metrics, this.baseline, this.opts);
    if (this.smoothed === null || this.lastT === null) this.smoothed = score;
    else {
      const a = 1 - Math.exp(-Math.max(0, tMs - this.lastT) / this.opts.smoothMs);
      this.smoothed += a * (score - this.smoothed);
    }
    this.lastT = tMs;
    this.lastSeen = tMs;

    if (!this.bad && this.smoothed >= this.opts.enter) {
      this.bad = true;
      this.badSince = tMs;
    } else if (this.bad && this.smoothed < this.opts.exit) {
      this.bad = false;
      this.badSince = null;
    }
    const badForMs = this.bad && this.badSince !== null ? tMs - this.badSince : 0;
    const shouldAlert = this.bad && badForMs >= this.opts.alertAfterMs;
    const alertStarted = shouldAlert && !this.alerting;
    this.alerting = shouldAlert;
    return {
      verdict: this.bad ? "bad" : "good", score, smoothed: this.smoothed, metrics, reasons,
      badForMs, alerting: this.alerting, alertStarted,
    };
  }
}
