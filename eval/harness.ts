// Runs the production pose pipeline (src/pose/landmarker.ts in VIDEO mode,
// then src/posture) over a clip, frame by frame at a fixed sample rate, and
// returns raw landmarks plus the monitor's per-frame output. Seeking instead
// of playing keeps the run deterministic and independent of machine speed.
import { createPoseLandmarker, type ModelVariant } from "../src/pose/landmarker.ts";
import { PostureMonitor, type PoseFrame, type Point } from "../src/posture/index.ts";

const video = document.getElementById("v") as HTMLVideoElement;
const round = (p: { x: number; y: number; z: number; visibility?: number }): Point => ({
  x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4), visibility: +(p.visibility ?? 0).toFixed(3),
});

async function seek(t: number) {
  await new Promise<void>((resolve) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.currentTime = t;
  });
}

async function runClip(src: string, variant: ModelVariant, fps: number) {
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(`cannot load ${src}`));
  });
  const landmarker = await createPoseLandmarker(variant, "CPU");
  const monitor = new PostureMonitor();
  const aspect = video.videoWidth / video.videoHeight;
  const frames = [];
  const started = performance.now();
  for (let i = 0; ; i++) {
    const t = i / fps;
    if (t > video.duration - 0.05) break;
    await seek(t);
    const res = landmarker.detectForVideo(video, Math.round(t * 1000) + 1);
    const lm = res.landmarks[0]?.map(round);
    const world = res.worldLandmarks[0]?.map(round);
    const frame: PoseFrame | null = lm ? { landmarks: lm, world, aspect } : null;
    const out = monitor.update(frame, t * 1000);
    frames.push({ t, lm: lm ?? null, world: world ?? null, out });
  }
  landmarker.close();
  return { src, variant, fps, aspect, ms: performance.now() - started, frames };
}

(window as unknown as { runClip: typeof runClip }).runClip = runClip;
(window as unknown as { harnessReady: boolean }).harnessReady = true;
