import { describe, expect, it } from "vitest";
import { statusView } from "./Status.tsx";
import type { Snapshot } from "./engine.ts";

const base: Snapshot = {
  phase: "monitoring", source: "camera", verdict: "good", smoothed: 0.2, metrics: null, reason: null, badForMs: 0,
  alerting: false, calibrated: true, calibrationLeftMs: 0, notice: null, error: null,
  stats: { goodMs: 0, badMs: 0, awayMs: 0, alerts: 0, startedAt: 0 }, timeline: "", breakDue: false,
};

describe("statusView", () => {
  it("reads Upright with a full ring", () => {
    expect(statusView(base, 10)).toMatchObject({ tone: "good", head: "Upright", progress: 1, centre: null });
  });
  it("counts down to the alert while slouching", () => {
    const v = statusView({ ...base, verdict: "bad", reason: "Head forward", badForMs: 4000 }, 10);
    expect(v).toMatchObject({ tone: "warn", head: "Slouching", centre: "6" });
    expect(v.progress).toBeCloseTo(0.4);
    expect(v.sub).toBe("Head forward. Alert in 6 s unless you sit up.");
  });
  it("says Sit up once alerting", () => {
    expect(statusView({ ...base, verdict: "bad", alerting: true, badForMs: 20000 }, 10)).toMatchObject({ tone: "bad", head: "Sit up" });
  });
  it("says Not in view without a pose", () => {
    expect(statusView({ ...base, verdict: "unknown" }, 10)).toMatchObject({ tone: "away", head: "Not in view" });
  });
  it("fills the ring during calibration", () => {
    const v = statusView({ ...base, phase: "calibrating", calibrationLeftMs: 1500 }, 10);
    expect(v).toMatchObject({ head: "Hold still", centre: "2" });
    expect(v.progress).toBeCloseTo(0.5);
  });
});
