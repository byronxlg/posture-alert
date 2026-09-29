/** One MediaPipe landmark: x, y normalized to the frame (0..1), z relative depth. */
export interface Point {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** What the posture model needs from one video frame. */
export interface PoseFrame {
  /** 33 normalized image landmarks. */
  landmarks: Point[];
  /** 33 world landmarks in metres, hip-centred; optional. */
  world?: Point[];
  /** Frame width / height, to turn normalized x and y into the same units. */
  aspect: number;
}

export type View = "front" | "side";

/** Geometry of one frame. Angles are degrees; ratios are in shoulder widths. */
export interface Metrics {
  view: View;
  /** Ear line height above the shoulder line, in shoulder widths (front). */
  earRise: number | null;
  /** Nose height above the shoulder line, in shoulder widths (front). */
  noseRise: number | null;
  /** Nose below the ear line, in ear-to-ear widths: grows as the head pitches down (front). */
  headPitch: number | null;
  /** Ear-line roll from horizontal (front), signed. */
  headRoll: number | null;
  /** Shoulder-line roll from horizontal (front), signed. */
  shoulderRoll: number | null;
  /** Nose sideways offset from the shoulder midpoint, in shoulder widths (front). */
  headOffset: number | null;
  /** Ear-to-ear width over shoulder width: the head nears the camera faster than the shoulders when it juts forward (front). */
  headScale: number | null;
  /** Nose sideways from the ear midpoint, in ear widths: head turned away (front). */
  headYaw: number | null;
  /** Shoulder width as a fraction of frame height: grows when leaning in (front). */
  shoulderWidth: number | null;
  /** Ear-to-shoulder line from vertical in the image (side view). */
  neckIncline: number | null;
  /** Shoulder-to-hip line from vertical in the image (side view, hips visible). */
  torsoIncline: number | null;
  /** 3D neck angle from the torso axis using world landmarks (any view). */
  neck3d: number | null;
  /** 3D head pitch: nose below the ear midpoint, degrees from level (world, any view, yaw-invariant). */
  pitch3d: number | null;
  /** 3D ear midpoint ahead of the shoulder midpoint along the body's facing direction, in shoulder widths (world). */
  headForward3d: number | null;
  /** 3D ear midpoint height above the shoulder midpoint, in shoulder widths (world). */
  earRise3d: number | null;
  /** 3D shoulder midpoint ahead of the hip midpoint, degrees from vertical (world). */
  torso3d: number | null;
}

export type Verdict = "good" | "bad" | "unknown";

export interface Reason {
  key: keyof Metrics;
  label: string;
  /** 0 = at the good end, 1 = at the bad threshold, >1 = past it. */
  severity: number;
}
