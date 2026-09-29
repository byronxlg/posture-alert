import type { PoseFrame, Point } from "./types.ts";
import { LM } from "./metrics.ts";

/** Knobs for a synthetic seated pose. Lengths in metres, angles in degrees. */
export interface SynthPose {
  /** 0 = facing the camera, 90 = right side to the camera. */
  yaw?: number;
  /** Ear height above the shoulder line (upright about 0.2). */
  earUp?: number;
  /** Ears ahead of the shoulders along the facing direction (upright about 0.03). */
  headForward?: number;
  /** Head pitch, positive looking down. */
  pitch?: number;
  /** Head roll; positive raises the left ear. */
  roll?: number;
  /** Shoulder line tilt. */
  shoulderTilt?: number;
  /** Shoulders ahead of the hips, degrees from vertical. */
  torsoLean?: number;
  /** Image scale: larger is closer to the camera. */
  scale?: number;
  /** Visibility given to every landmark. */
  visibility?: number;
  aspect?: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * A plausible 33-landmark pose built from body-frame geometry, rotated by yaw
 * into camera space (x right, y down, z away from the camera, as MediaPipe
 * world landmarks) and projected orthographically for the image landmarks.
 * Used by the unit tests; not a model of any real person.
 */
export function synthPose(o: SynthPose = {}): PoseFrame {
  const yaw = rad(o.yaw ?? 0), aspect = o.aspect ?? 16 / 9, scale = o.scale ?? 1;
  const earUp = o.earUp ?? 0.2, fwd = o.headForward ?? 0.03, pitch = rad(o.pitch ?? 5);
  const roll = rad(o.roll ?? 0), tilt = rad(o.shoulderTilt ?? 0), lean = rad(o.torsoLean ?? 0);
  const vis = o.visibility ?? 0.99;
  // Body frame: l = to the person's left, u = up, f = forward (toward the camera at yaw 0).
  const torso = 0.5;
  const sm = { l: 0, u: torso * Math.cos(lean), f: torso * Math.sin(lean) };
  const sh = (side: 1 | -1) => ({ l: side * 0.18, u: sm.u + side * 0.18 * Math.sin(tilt), f: sm.f });
  const em = { l: 0, u: sm.u + earUp, f: sm.f + fwd };
  const ear = (side: 1 | -1) => ({ l: em.l + side * 0.07 * Math.cos(roll), u: em.u + side * 0.07 * Math.sin(roll), f: em.f });
  const nose = { l: em.l, u: em.u - 0.1 * Math.sin(pitch), f: em.f + 0.1 * Math.cos(pitch) };
  const eye = (side: 1 | -1) => ({ l: side * 0.03, u: nose.u + 0.03, f: nose.f - 0.02 });
  const hip = (side: 1 | -1) => ({ l: side * 0.1, u: 0, f: 0 });
  const elbow = (side: 1 | -1) => ({ l: side * 0.2, u: sm.u - 0.28, f: sm.f + 0.1 });
  const wrist = (side: 1 | -1) => ({ l: side * 0.15, u: sm.u - 0.35, f: sm.f + 0.35 });

  const body: { l: number; u: number; f: number }[] = Array.from({ length: 33 }, () => ({ l: 0, u: 0, f: 0 }));
  body[LM.nose] = nose;
  body[LM.leftEye] = eye(1); body[LM.rightEye] = eye(-1);
  body[LM.leftEar] = ear(1); body[LM.rightEar] = ear(-1);
  body[LM.leftShoulder] = sh(1); body[LM.rightShoulder] = sh(-1);
  body[LM.leftElbow] = elbow(1); body[LM.rightElbow] = elbow(-1);
  body[LM.leftWrist] = wrist(1); body[LM.rightWrist] = wrist(-1);
  body[LM.leftHip] = hip(1); body[LM.rightHip] = hip(-1);
  for (const i of [1, 3, 4, 6]) body[i] = { ...nose, u: nose.u + 0.03 };
  for (const i of [9, 10]) body[i] = { ...nose, u: nose.u - 0.04 };

  // Camera frame. Facing the camera, the person's left is image right.
  const world: Point[] = body.map((b) => ({
    x: b.l * Math.cos(yaw) + b.f * Math.sin(yaw),
    y: -(b.u - 0.25),
    z: -b.f * Math.cos(yaw) + b.l * Math.sin(yaw),
    visibility: vis,
  }));
  const k = 0.9 * scale;
  const landmarks: Point[] = world.map((w) => ({
    x: 0.5 + (w.x * k) / aspect,
    y: 0.62 + w.y * k,
    z: w.z * k,
    visibility: vis,
  }));
  return { landmarks, world, aspect };
}
