// Feeds every clip in eval/clips.json through the real browser pipeline in
// headless Chromium and writes eval/out/<variant>/<clip>.json.
// Usage: node eval/run-eval.mjs [variant ...] [--only id,id] [--fps 10]
import fs from "node:fs";
import { createServer } from "vite";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : dflt; };
const fps = Number(opt("--fps", "10"));
const only = opt("--only", "")?.split(",").filter(Boolean);
const variants = args.length ? args : ["full"];
const { clips } = JSON.parse(fs.readFileSync("eval/clips.json", "utf8"));

const server = await createServer({ logLevel: "error", server: { port: 5199, strictPort: true, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5199/posture-alert/eval/index.html");
await page.waitForFunction(() => window.harnessReady, null, { timeout: 60000 });

for (const variant of variants) {
  fs.mkdirSync(`eval/out/${variant}`, { recursive: true });
  for (const c of clips) {
    if (only?.length && !only.includes(c.id)) continue;
    const res = await page.evaluate(
      ([src, v, f]) => window.runClip(src, v, f),
      [`/posture-alert/eval/videos/${c.id}.webm`, variant, fps],
    );
    fs.writeFileSync(`eval/out/${variant}/${c.id}.json`, JSON.stringify(res));
    const seen = res.frames.filter((f) => f.lm).length;
    console.log(`${variant} ${c.id}: ${res.frames.length} frames, pose in ${seen}, ${(res.ms / res.frames.length).toFixed(0)} ms/frame`);
  }
}
if (errors.length) console.log("page errors:", errors);
await browser.close();
await server.close();
