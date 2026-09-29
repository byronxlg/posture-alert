// Headless check of the app with a fake webcam fed from the sample clip.
// Starts the camera flow and the sample flow, waits for landmarks, saves
// desktop and mobile screenshots to tmp/, checks the loop keeps running in a
// hidden tab, and fails on any console error.
// Usage: node scripts/check-ui.mjs [url]   (default: vite preview of dist/)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { preview } from "vite";
import { chromium } from "playwright";

fs.mkdirSync("tmp", { recursive: true });
const y4m = "tmp/fake-camera.y4m";
if (!fs.existsSync(y4m)) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-t", "8", "-i", "public/sample/slouch-then-sit-up.mp4",
    "-vf", "scale=640:360,fps=15", "-pix_fmt", "yuv420p", y4m]);
}

let server = null;
let url = process.argv[2];
if (!url) {
  server = await preview({ preview: { port: 4199, strictPort: true }, logLevel: "error" });
  url = "http://localhost:4199/posture-alert/";
}

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${y4m}`],
});
const errors = [];
let failed = false;

async function run(name, viewport, flow) {
  const ctx = await browser.newContext({ viewport, permissions: ["camera"] });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  await page.goto(flow === "sample" ? `${url}?sample` : url);
  if (flow === "camera") {
    await page.screenshot({ path: `tmp/${name}-intro.png` });
    await page.getByRole("button", { name: "Start with my camera" }).click();
  }
  const t0 = Date.now();
  let state = null;
  while (Date.now() - t0 < 60000) {
    state = await page.evaluate(() => window.postureEngine?.debug());
    if (state?.phase === "monitoring" && state.out && state.posesSeen > 0) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(4000);
  state = await page.evaluate(() => ({ ...window.postureEngine.debug(), snap: window.postureEngine.snap }));
  const ok = state.phase === "monitoring" && state.posesSeen > 20 && (flow === "sample" || state.snap.calibrated);
  if (!ok) failed = true;
  console.log(`${name}: phase ${state.phase}, frames with a pose ${state.posesSeen}, verdict ${state.snap.verdict}, calibrated ${state.snap.calibrated} (${state.calibrationUsable}/${state.calibrationFrames} frames)${ok ? "" : "  FAILED"}`);
  await page.screenshot({ path: `tmp/${name}.png` });
  await ctx.close();
}

await run("desktop-camera", { width: 1366, height: 820 }, "camera");
await run("mobile-camera", { width: 390, height: 844 }, "camera");
await run("desktop-sample", { width: 1366, height: 820 }, "sample");

// A background tab: browsers pause requestAnimationFrame there, and the alerts
// must keep working. Simulated by forcing document.hidden and stopping rAF.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${url}?sample`);
  await page.waitForFunction(() => window.postureEngine?.debug().posesSeen > 5, null, { timeout: 60000 });
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(1000);
  const n0 = await page.evaluate(() => window.postureEngine.debug().posesSeen);
  await page.waitForTimeout(4000);
  const n = (await page.evaluate(() => window.postureEngine.debug().posesSeen)) - n0;
  const ok = n >= 3;
  if (!ok) failed = true;
  console.log(`hidden-tab: ${n} frames with a pose in 4 s${ok ? "" : "  FAILED"}`);
  await ctx.close();
}
await browser.close();
await server?.close();
if (errors.length) { console.log("console errors:\n" + errors.join("\n")); failed = true; }
process.exit(failed ? 1 : 0);
