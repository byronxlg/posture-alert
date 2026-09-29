import type { Metrics, PoseFrame, Point, View } from "./types.ts";

export const LM = {
  nose: 0, leftEye: 2, rightEye: 5, leftEar: 7, rightEar: 8,
  leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24,
} as const;

/** Minimum landmark visibility to trust a point. */
export const MIN_VIS = 0.5;

const vis = (p: Point | undefined) => (p ? (p.visibility ?? 1) : 0);
const deg = (r: number) => (r * 180) / Math.PI;

interface P2 { x: number; y: number }

/** Signed angle of the line a->b from horizontal, folded to [-90, 90]. */
function roll(a: P2, b: P2): number {
  let d = deg(Math.atan2(b.y - a.y, b.x - a.x));
  if (d > 90) d -= 180;
  if (d < -90) d += 180;
  return d;
}

/** Angle between the vector lower->upper and straight up in the image. */
function fromVertical(upper: P2, lower: P2): number {
  return deg(Math.atan2(Math.abs(upper.x - lower.x), lower.y - upper.y));
}

function angle3(a: Point, b: Point): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const n = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z);
  return n === 0 ? 0 : deg(Math.acos(Math.max(-1, Math.min(1, dot / n))));
}

const mid = (a: P2, b: P2): P2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Which way the body faces the camera. World landmarks give the shoulder
 * line's yaw directly; without them the 2D shoulder width relative to the
 * head width stands in (it collapses in profile).
 */
export function detectView(frame: PoseFrame): View {
  const w = frame.world;
  if (w && w.length > LM.rightShoulder) {
    const l = w[LM.leftShoulder], r = w[LM.rightShoulder];
    const yaw = deg(Math.atan2(Math.abs(l.z - r.z), Math.abs(l.x - r.x)));
    return yaw > 50 ? "side" : "front";
  }
  const p = toPixels(frame);
  const sw = dist(p[LM.leftShoulder], p[LM.rightShoulder]);
  const hw = dist(p[LM.leftEar], p[LM.rightEar]);
  return sw < 1.3 * hw ? "side" : "front";
}

/** Normalized landmarks in frame-height units so x and y are comparable. */
function toPixels(frame: PoseFrame): P2[] {
  return frame.landmarks.map((p) => ({ x: p.x * frame.aspect, y: p.y }));
}

/**
 * Posture geometry for one frame, or null when the landmarks needed for any
 * judgement are not visible (no person, shoulders out of frame).
 */
export function computeMetrics(frame: PoseFrame): Metrics | null {
  const lm = frame.landmarks;
  if (!lm || lm.length < 25) return null;
  const view = detectView(frame);
  const p = toPixels(frame);
  const out: Metrics = {
    view, earRise: null, noseRise: null, headPitch: null, headRoll: null, shoulderRoll: null,
    headOffset: null, headScale: null, headYaw: null, shoulderWidth: null, neckIncline: null, torsoIncline: null, neck3d: null,
    pitch3d: null, headForward3d: null, earRise3d: null, torso3d: null,
  };

  const lsV = vis(lm[LM.leftShoulder]), rsV = vis(lm[LM.rightShoulder]);
  const inFrame = (i: number) => lm[i].y < 1.0 && lm[i].y > 0 && lm[i].x > 0 && lm[i].x < 1;

  if (view === "front") {
    if (lsV < MIN_VIS || rsV < MIN_VIS || !inFrame(LM.leftShoulder) || !inFrame(LM.rightShoulder)) return null;
    const ls = p[LM.leftShoulder], rs = p[LM.rightShoulder];
    const sm = mid(ls, rs);
    const sw = dist(ls, rs);
    if (sw < 1e-3) return null;
    out.shoulderWidth = sw;
    out.shoulderRoll = roll(rs, ls);
    const earsOk = vis(lm[LM.leftEar]) >= MIN_VIS && vis(lm[LM.rightEar]) >= MIN_VIS;
    const noseOk = vis(lm[LM.nose]) >= MIN_VIS;
    if (earsOk) {
      const le = p[LM.leftEar], re = p[LM.rightEar];
      const em = mid(le, re);
      out.earRise = (sm.y - em.y) / sw;
      out.headRoll = roll(re, le);
      if (noseOk) {
        const ew = dist(le, re);
        if (ew > 1e-3) {
          out.headPitch = (p[LM.nose].y - em.y) / ew;
          out.headYaw = (p[LM.nose].x - em.x) / ew;
        }
        out.headScale = ew / sw;
      }
    }
    if (noseOk) {
      out.noseRise = (sm.y - p[LM.nose].y) / sw;
      out.headOffset = (p[LM.nose].x - sm.x) / sw;
    }
  } else {
    // Profile: use the side nearer the camera (higher visibility).
    const left = lsV + vis(lm[LM.leftEar]) >= rsV + vis(lm[LM.rightEar]);
    const sh = left ? LM.leftShoulder : LM.rightShoulder;
    const ear = left ? LM.leftEar : LM.rightEar;
    const hip = left ? LM.leftHip : LM.rightHip;
    if (vis(lm[sh]) < MIN_VIS || !inFrame(sh)) return null;
    if (vis(lm[ear]) >= MIN_VIS) out.neckIncline = fromVertical(p[ear], p[sh]);
    if (vis(lm[hip]) >= MIN_VIS && inFrame(hip)) out.torsoIncline = fromVertical(p[sh], p[hip]);
  }

  const w = frame.world;
  if (w && w.length > LM.rightHip) {
    const sm = { x: (w[LM.leftShoulder].x + w[LM.rightShoulder].x) / 2, y: (w[LM.leftShoulder].y + w[LM.rightShoulder].y) / 2, z: (w[LM.leftShoulder].z + w[LM.rightShoulder].z) / 2 };
    const em = { x: (w[LM.leftEar].x + w[LM.rightEar].x) / 2, y: (w[LM.leftEar].y + w[LM.rightEar].y) / 2, z: (w[LM.leftEar].z + w[LM.rightEar].z) / 2 };
    const hm = { x: (w[LM.leftHip].x + w[LM.rightHip].x) / 2, y: (w[LM.leftHip].y + w[LM.rightHip].y) / 2, z: (w[LM.leftHip].z + w[LM.rightHip].z) / 2 };
    const neck = { x: em.x - sm.x, y: em.y - sm.y, z: em.z - sm.z };
    const torso = { x: sm.x - hm.x, y: sm.y - hm.y, z: sm.z - hm.z };
    out.neck3d = angle3(neck, torso);
    const ls = w[LM.leftShoulder], rs = w[LM.rightShoulder], nose = w[LM.nose];
    const sw3 = Math.hypot(ls.x - rs.x, ls.y - rs.y, ls.z - rs.z);
    // Facing direction: horizontal perpendicular to the shoulder line, on the nose's side.
    let fx = -(ls.z - rs.z), fz = ls.x - rs.x;
    const fn = Math.hypot(fx, fz);
    if (sw3 > 1e-3 && fn > 1e-6) {
      fx /= fn; fz /= fn;
      if ((nose.x - sm.x) * fx + (nose.z - sm.z) * fz < 0) { fx = -fx; fz = -fz; }
      out.headForward3d = ((em.x - sm.x) * fx + (em.z - sm.z) * fz) / sw3;
      out.earRise3d = (sm.y - em.y) / sw3;
      const hd = Math.hypot(nose.x - em.x, nose.z - em.z);
      out.pitch3d = deg(Math.atan2(nose.y - em.y, hd));
      out.torso3d = deg(Math.atan2((sm.x - hm.x) * fx + (sm.z - hm.z) * fz, hm.y - sm.y));
    }
  }
  return out;
}
