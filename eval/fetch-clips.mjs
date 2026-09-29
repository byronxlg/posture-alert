// Downloads the eval clips listed in eval/clips.json and transcodes each to a
// small VP9 webm (max 640 px, no audio) in eval/videos/, which is gitignored:
// the stock licenses allow use but not redistribution as standalone files.
// Needs ffmpeg on PATH. Existing files are skipped, so reruns are cheap.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dir = path.resolve("eval/videos");
const rawDir = path.join(dir, "raw");
fs.mkdirSync(rawDir, { recursive: true });
const { clips } = JSON.parse(fs.readFileSync("eval/clips.json", "utf8"));

const url = (c) => {
  const n = c.id.slice(2);
  return c.source === "pexels"
    ? `https://www.pexels.com/download/video/${n}/`
    : `https://assets.mixkit.co/videos/${n}/${n}-720.mp4`;
};

for (const c of clips) {
  const out = path.join(dir, `${c.id}.webm`);
  if (fs.existsSync(out)) continue;
  const raw = path.join(rawDir, `${c.id}.mp4`);
  if (!fs.existsSync(raw)) {
    const res = await fetch(url(c), { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`${c.id}: HTTP ${res.status}`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-an",
    "-vf", "scale='if(gt(iw,ih),640,-2)':'if(gt(iw,ih),-2,640)'",
    "-c:v", "libvpx-vp9", "-b:v", "600k", "-deadline", "realtime", "-cpu-used", "8", out]);
  console.log(`fetched ${c.id}`);
}
console.log(`${clips.length} clips ready in eval/videos`);
