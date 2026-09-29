import type { Point, Verdict } from "../posture/index.ts";

// Upper-body connections worth drawing for posture: face, shoulders, arms, torso.
const EDGES: [number, number][] = [
  [7, 2], [2, 0], [0, 5], [5, 8], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
];
const JOINTS = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24];
const COLOR: Record<Verdict, string> = { good: "#43d6a8", bad: "#ff5a6e", unknown: "#c9d6d8" };

/** Draws the skeleton over the video; the canvas matches the video's intrinsic size. */
export function drawSkeleton(g: CanvasRenderingContext2D, lm: Point[] | null, verdict: Verdict, mirror: boolean) {
  const { width: w, height: h } = g.canvas;
  g.clearRect(0, 0, w, h);
  if (!lm) return;
  const px = (p: Point) => [(mirror ? 1 - p.x : p.x) * w, p.y * h] as const;
  const ok = (i: number) => (lm[i]?.visibility ?? 0) > 0.5;
  const s = Math.max(2, w / 240);
  g.lineCap = "round";
  g.strokeStyle = COLOR[verdict];
  g.lineWidth = s * 1.6;
  g.globalAlpha = 0.9;
  for (const [a, b] of EDGES) {
    if (!ok(a) || !ok(b)) continue;
    const [x1, y1] = px(lm[a]);
    const [x2, y2] = px(lm[b]);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  // Neck line: shoulder midpoint to ear midpoint, the line posture is judged on.
  if (ok(11) && ok(12) && ok(7) && ok(8)) {
    const [sx1, sy1] = px(lm[11]), [sx2, sy2] = px(lm[12]);
    const [ex1, ey1] = px(lm[7]), [ex2, ey2] = px(lm[8]);
    g.setLineDash([s * 3, s * 3]);
    g.lineWidth = s;
    g.beginPath();
    g.moveTo((sx1 + sx2) / 2, (sy1 + sy2) / 2);
    g.lineTo((ex1 + ex2) / 2, (ey1 + ey2) / 2);
    g.stroke();
    g.setLineDash([]);
  }
  g.fillStyle = "#ffffff";
  for (const i of JOINTS) {
    if (!ok(i)) continue;
    const [x, y] = px(lm[i]);
    g.beginPath();
    g.arc(x, y, s * 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}
