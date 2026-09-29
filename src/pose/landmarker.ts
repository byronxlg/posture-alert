import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export type ModelVariant = "lite" | "full" | "heavy";

// Model and wasm are self-hosted under the site base (see scripts/). GPU is
// tried first; CPU is the fallback for browsers without WebGL2 and for
// headless runs, and gives the same landmarks, only slower.
export async function createPoseLandmarker(
  variant: ModelVariant = "full",
  delegate: "GPU" | "CPU" = "GPU",
): Promise<PoseLandmarker> {
  const base = import.meta.env.BASE_URL;
  const fileset = await FilesetResolver.forVisionTasks(`${base}wasm`);
  const make = (d: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base}models/pose_landmarker_${variant}.task`, delegate: d },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  if (delegate === "CPU") return make("CPU");
  try {
    return await make("GPU");
  } catch {
    return make("CPU");
  }
}
