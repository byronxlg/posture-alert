import { describe, expect, it } from "vitest";
import { PostureMonitor, calibrate, computeMetrics, scoreMetrics, type MonitorOutput } from "./index.ts";
import { synthPose, type SynthPose } from "./synthetic.ts";

const upright: SynthPose = {};
const slumped: SynthPose = { pitch: 38, headForward: 0.13, earUp: 0.14 };

/** Feeds `seconds` of a pose at 10 fps and returns every output. */
function feed(mon: PostureMonitor, pose: SynthPose | null, seconds: number, t0: number) {
  const outs: MonitorOutput[] = [];
  for (let i = 0; i < seconds * 10; i++) outs.push(mon.update(pose ? synthPose(pose) : null, t0 + i * 100));
  return outs;
}

describe("metrics", () => {
  it("reads a front-facing upright pose as front view with level head", () => {
    const m = computeMetrics(synthPose(upright))!;
    expect(m.view).toBe("front");
    expect(m.earRise).toBeGreaterThan(0.45);
    expect(Math.abs(m.headRoll!)).toBeLessThan(1);
    expect(m.pitch3d!).toBeLessThan(10);
    expect(m.headForward3d!).toBeLessThan(0.15);
  });

  it("reads a profile as side view with a small neck incline", () => {
    const m = computeMetrics(synthPose({ yaw: 90 }))!;
    expect(m.view).toBe("side");
    expect(m.neckIncline!).toBeLessThan(15);
  });

  it("measures a forward head in profile", () => {
    const m = computeMetrics(synthPose({ yaw: 90, headForward: 0.14, earUp: 0.15 }))!;
    expect(m.neckIncline!).toBeGreaterThan(36);
  });

  it("measures head roll and pitch", () => {
    expect(Math.abs(computeMetrics(synthPose({ roll: 25 }))!.headRoll!)).toBeCloseTo(25, 0);
    expect(computeMetrics(synthPose({ pitch: 40 }))!.pitch3d!).toBeGreaterThan(30);
  });

  it("returns null when the shoulders are not visible", () => {
    expect(computeMetrics(synthPose({ visibility: 0.2 }))).toBeNull();
  });
});

describe("score", () => {
  it("scores upright below 1 and slumped above 1", () => {
    expect(scoreMetrics(computeMetrics(synthPose(upright))!, null).score).toBeLessThan(0.5);
    expect(scoreMetrics(computeMetrics(synthPose(slumped))!, null).score).toBeGreaterThan(1);
    expect(scoreMetrics(computeMetrics(synthPose({ yaw: 90, headForward: 0.14, earUp: 0.15 }))!, null).score).toBeGreaterThan(1);
  });

  it("names the reason", () => {
    const { reasons } = scoreMetrics(computeMetrics(synthPose({ roll: 30 }))!, null);
    expect(reasons[0].label).toBe("Head tilted");
  });

  it("is stricter at higher sensitivity", () => {
    const m = computeMetrics(synthPose({ pitch: 22 }))!;
    expect(scoreMetrics(m, null, { sensitivity: 1 }).score).toBeLessThan(1);
    expect(scoreMetrics(m, null, { sensitivity: 2 }).score).toBeGreaterThan(1);
  });
});

describe("monitor", () => {
  it("stays good while upright", () => {
    const outs = feed(new PostureMonitor(), upright, 20, 0);
    expect(outs.every((o) => o.verdict === "good" && !o.alerting)).toBe(true);
  });

  it("alerts once bad posture persists for alertAfterMs, and only once", () => {
    const mon = new PostureMonitor({ alertAfterMs: 4000 });
    feed(mon, upright, 3, 0);
    const outs = feed(mon, slumped, 10, 3000);
    const firstBad = outs.findIndex((o) => o.verdict === "bad");
    const firstAlert = outs.findIndex((o) => o.alerting);
    expect(firstBad).toBeGreaterThanOrEqual(0);
    expect(firstBad).toBeLessThan(15);
    expect((firstAlert - firstBad) * 100).toBeGreaterThanOrEqual(4000);
    expect(outs.filter((o) => o.alertStarted)).toHaveLength(1);
  });

  it("ignores a brief glance down", () => {
    const mon = new PostureMonitor({ alertAfterMs: 3000 });
    feed(mon, upright, 3, 0);
    const blip = feed(mon, slumped, 1, 3000);
    const after = feed(mon, upright, 5, 4000);
    expect([...blip, ...after].some((o) => o.alerting)).toBe(false);
  });

  it("recovers to good when the user sits up (hysteresis, no flicker)", () => {
    const mon = new PostureMonitor({ alertAfterMs: 2000 });
    feed(mon, slumped, 5, 0);
    const outs = feed(mon, upright, 5, 5000);
    expect(outs.at(-1)!.verdict).toBe("good");
    expect(outs.at(-1)!.alerting).toBe(false);
    const flips = outs.filter((o, i) => i > 0 && o.verdict !== outs[i - 1].verdict).length;
    expect(flips).toBe(1);
  });

  it("does not flicker when the score hovers at the threshold", () => {
    const mon = new PostureMonitor();
    const outs: MonitorOutput[] = [];
    // Alternate slightly above and slightly below the bad pitch every frame.
    for (let i = 0; i < 100; i++) outs.push(mon.update(synthPose({ pitch: i % 2 ? 33 : 27 }), i * 100));
    const flips = outs.filter((o, i) => i > 0 && o.verdict !== outs[i - 1].verdict).length;
    expect(flips).toBeLessThanOrEqual(1);
  });

  it("reports unknown with no pose and resets after losing the person", () => {
    const mon = new PostureMonitor({ alertAfterMs: 2000, lostAfterMs: 1000 });
    feed(mon, slumped, 4, 0);
    const gone = feed(mon, null, 3, 4000);
    expect(gone.every((o) => o.verdict === "unknown")).toBe(true);
    const back = mon.update(synthPose(upright), 7000);
    expect(back.alerting).toBe(false);
    expect(back.badForMs).toBe(0);
  });
});

describe("calibration", () => {
  const baselineFrom = (p: SynthPose) => calibrate(Array.from({ length: 20 }, () => computeMetrics(synthPose(p))));

  it("builds a baseline from upright frames", () => {
    const b = baselineFrom(upright)!;
    expect(b.view).toBe("front");
    expect(b.earRise).toBeGreaterThan(0.4);
  });

  it("refuses when too few frames have a pose", () => {
    expect(calibrate([null, null, null])).toBeNull();
  });

  it("catches leaning in toward the screen only relative to the user's baseline", () => {
    const leanIn = { scale: 1.35 };
    expect(scoreMetrics(computeMetrics(synthPose(leanIn))!, null).score).toBeLessThan(1);
    expect(scoreMetrics(computeMetrics(synthPose(leanIn))!, baselineFrom(upright)).score).toBeGreaterThan(1);
  });

  it("accepts a user whose upright pose looks off by absolute rules", () => {
    // Webcam below eye level: this user's upright pose reads as looking down.
    const own = { pitch: 26 };
    expect(scoreMetrics(computeMetrics(synthPose(own))!, null).score).toBeGreaterThan(0.9);
    expect(scoreMetrics(computeMetrics(synthPose(own))!, baselineFrom(own)).score).toBeLessThan(0.2);
  });
});
