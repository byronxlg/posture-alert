// The pose model ships with the site (public/models, committed) so the page
// never depends on Google's bucket at runtime. This only downloads a model that
// is missing, e.g. the variant used by the eval but not by the app.
import fs from "node:fs";
import path from "node:path";

const models = process.argv.slice(2).length ? process.argv.slice(2) : ["full"];
const dir = path.resolve("public/models");
fs.mkdirSync(dir, { recursive: true });
for (const v of models) {
  const file = path.join(dir, `pose_landmarker_${v}.task`);
  if (fs.existsSync(file)) continue;
  const url = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`downloaded ${path.relative(".", file)}`);
}
