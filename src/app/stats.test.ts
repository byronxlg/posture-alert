import { describe, expect, it } from "vitest";
import { ago, formatSpan, longestRun, summarise, timelineAxis } from "./stats.ts";
import { DELAY_PRESETS, SENSITIVITY_PRESETS, matchPreset, sensitivityWord } from "./settings.ts";

describe("longestRun", () => {
  it("finds the longest stretch of one state", () => {
    expect(longestRun("", "g")).toBe(0);
    expect(longestRun("gggbgguggggb", "g")).toBe(4);
    expect(longestRun("bbb", "g")).toBe(0);
  });
});

describe("summarise", () => {
  it("gives the upright share of the time in view, not of time away", () => {
    const s = summarise({ goodMs: 30_000, badMs: 10_000, awayMs: 60_000, alerts: 2 }, "ggggbbgg");
    expect(s.uprightPct).toBe(75);
    expect(s.totalMs).toBe(100_000);
    expect(s.longestUprightMs).toBe(4000);
    expect(s.alerts).toBe(2);
  });
  it("never has a longest stretch above the upright total", () => {
    expect(summarise({ goodMs: 4200, badMs: 0, awayMs: 0, alerts: 0 }, "ggggg").longestUprightMs).toBe(4200);
  });
  it("has no share before a second has been seen", () => {
    expect(summarise({ goodMs: 0, badMs: 0, awayMs: 5000, alerts: 0 }, "").uprightPct).toBeNull();
  });
});

describe("formatSpan", () => {
  it("uses seconds, then minutes, then hours", () => {
    expect(formatSpan(0)).toBe("0 s");
    expect(formatSpan(42_500)).toBe("42 s");
    expect(formatSpan(12 * 60_000 + 5000)).toBe("12 min");
    expect(formatSpan(60 * 60_000)).toBe("1 h");
    expect(formatSpan(65 * 60_000)).toBe("1 h 5 min");
  });
});

describe("timeline axis", () => {
  it("labels start, middle and now", () => {
    expect(ago(30)).toBe("30 s ago");
    expect(ago(600)).toBe("10 min ago");
    expect(timelineAxis(1200)).toEqual(["20 min ago", "10 min ago", "Now"]);
  });
});

describe("setting presets", () => {
  it("maps saved numbers onto the simple choices", () => {
    expect(matchPreset(SENSITIVITY_PRESETS, 1)?.label).toBe("Balanced");
    expect(matchPreset(SENSITIVITY_PRESETS, 1.1)).toBeNull();
    expect(matchPreset(DELAY_PRESETS, 10)?.label).toBe("10 s");
    expect(matchPreset(DELAY_PRESETS, 12)).toBeNull();
  });
  it("describes custom sensitivity in words", () => {
    expect(sensitivityWord(0.8)).toBe("Relaxed");
    expect(sensitivityWord(0.6)).toBe("Custom, relaxed");
    expect(sensitivityWord(1.5)).toBe("Custom, strict");
  });
});
