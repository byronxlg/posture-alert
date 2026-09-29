// Session numbers for the summary, derived from the engine's stats and the per-second timeline.
import type { Stats } from "./engine.ts";

export interface SessionSummary {
  /** Share of the time in view that was upright, 0..100, or null before anything was seen. */
  uprightPct: number | null;
  uprightMs: number;
  slouchMs: number;
  awayMs: number;
  totalMs: number;
  alerts: number;
  /** Longest unbroken upright stretch in the timeline (the last hour), in ms. */
  longestUprightMs: number;
}

/** Length of the longest run of `ch` in the timeline, in entries (seconds). */
export function longestRun(timeline: string, ch: string): number {
  let best = 0, cur = 0;
  for (const c of timeline) {
    cur = c === ch ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

export function summarise(stats: Pick<Stats, "goodMs" | "badMs" | "awayMs" | "alerts">, timeline: string): SessionSummary {
  const seen = stats.goodMs + stats.badMs;
  return {
    uprightPct: seen >= 1000 ? Math.round((100 * stats.goodMs) / seen) : null,
    uprightMs: stats.goodMs,
    slouchMs: stats.badMs,
    awayMs: stats.awayMs,
    totalMs: seen + stats.awayMs,
    alerts: stats.alerts,
    // Timeline seconds round up; never claim a stretch longer than the upright total.
    longestUprightMs: Math.min(longestRun(timeline, "g") * 1000, stats.goodMs),
  };
}

/** "0 s", "42 s", "12 min", "1 h 5 min". */
export function formatSpan(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** How long ago a point on the timeline was: "30 s ago", "12 min ago". */
export function ago(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

/** Axis labels for a timeline of `seconds` entries: start, middle, now. */
export function timelineAxis(seconds: number): [string, string, string] {
  return [ago(seconds), ago(seconds / 2), "Now"];
}
