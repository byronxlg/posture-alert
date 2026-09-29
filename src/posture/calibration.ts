import type { Baseline } from "./score.ts";
import type { Metrics } from "./types.ts";

const KEYS: (keyof Metrics)[] = [
  "earRise", "noseRise", "headPitch", "headRoll", "shoulderRoll", "headOffset",
  "headScale", "headYaw", "shoulderWidth", "neckIncline", "torsoIncline", "neck3d",
  "pitch3d", "headForward3d", "earRise3d", "torso3d",
];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Baseline from frames recorded while the user sat up straight. Medians keep
 * one bad frame from skewing it. Needs most frames usable and one view.
 */
export function calibrate(samples: (Metrics | null)[], minFrames = 10): Baseline | null {
  const ok = samples.filter((m): m is Metrics => m !== null);
  if (ok.length < minFrames || ok.length < samples.length * 0.6) return null;
  const front = ok.filter((m) => m.view === "front").length;
  const view = front >= ok.length / 2 ? "front" : "side";
  const same = ok.filter((m) => m.view === view);
  const b: Baseline = { view };
  for (const k of KEYS) {
    const vals = same.map((m) => m[k]).filter((v): v is number => typeof v === "number");
    if (vals.length >= same.length * 0.5) (b as Record<string, unknown>)[k] = median(vals);
  }
  return b;
}
