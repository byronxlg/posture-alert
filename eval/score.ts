// Scores eval/out/<variant>/*.json against the labels in eval/clips.json.
// By default it scores the verdicts the browser produced; --replay re-runs the
// current src/posture code over the recorded landmarks (fast, for tuning).
// Usage: node eval/score.ts [--variant full] [--replay] [--features] [--md] [--alert-ms 5000]
import fs from "node:fs";
import { PostureMonitor, calibrate, computeMetrics, type Metrics, type MonitorOutput, type PoseFrame } from "../src/posture/index.ts";

type Label = "good" | "bad";
interface Clip { id: string; view: string; holdout: boolean; segments: [number, number, Label][]; notes: string }
interface Frame { t: number; lm: PoseFrame["landmarks"] | null; world: PoseFrame["world"] | null; out: MonitorOutput }

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const variant = opt("--variant", "full");
const alertMs = Number(opt("--alert-ms", "5000"));
const replay = flag("--replay") || flag("--calibrated");
const { clips } = JSON.parse(fs.readFileSync("eval/clips.json", "utf8")) as { clips: Clip[] };

const labelAt = (c: Clip, t: number): Label | null => c.segments.find(([a, b]) => t >= a && t < b)?.[2] ?? null;

interface ClipResult {
  id: string; view: string; holdout: boolean; n: number; covered: number;
  tp: number; fp: number; tn: number; fn: number;
  falseAlerts: number; badSegs: number; alerted: number; timeToAlert: number[];
  calibrated: boolean;
}

function run(c: Clip): ClipResult | null {
  const file = `eval/out/${variant}/${c.id}.json`;
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { aspect: number; frames: Frame[] };
  let outs: MonitorOutput[] = data.frames.map((f) => f.out);
  let calibrated = false;
  let skip: [number, number] = [-1, -1];
  if (replay) {
    // POSTURE_OPTS (JSON MonitorOptions) lets a tuning run try settings without editing src.
    const mon = new PostureMonitor({ alertAfterMs: alertMs, ...JSON.parse(process.env.POSTURE_OPTS ?? "{}") });
    if (flag("--calibrated")) {
      const g = c.segments.find((s) => s[2] === "good");
      if (g) {
        const win = data.frames.filter((f) => f.t >= g[0] && f.t < g[0] + 3);
        const b = calibrate(win.map((f) => (f.lm ? computeMetrics({ landmarks: f.lm, world: f.world ?? undefined, aspect: data.aspect }) : null)));
        if (b) { mon.setBaseline(b); calibrated = true; skip = [g[0], g[0] + 3]; }
      }
    }
    outs = data.frames.map((f) => mon.update(f.lm ? { landmarks: f.lm, world: f.world ?? undefined, aspect: data.aspect } : null, f.t * 1000));
  }
  const r: ClipResult = { id: c.id, view: c.view, holdout: c.holdout, n: 0, covered: 0, tp: 0, fp: 0, tn: 0, fn: 0, falseAlerts: 0, badSegs: 0, alerted: 0, timeToAlert: [], calibrated };
  data.frames.forEach((f, i) => {
    const lab = labelAt(c, f.t);
    if (!lab || (f.t >= skip[0] && f.t < skip[1])) return; // calibration window is not scored
    const o = outs[i];
    r.n++;
    if (o.verdict !== "unknown") r.covered++;
    const predBad = o.verdict === "bad";
    if (lab === "bad") predBad ? r.tp++ : r.fn++;
    else predBad ? r.fp++ : r.tn++;
    if (lab === "good" && o.alertStarted) r.falseAlerts++;
  });
  for (const [a, b, lab] of c.segments) {
    if (lab !== "bad") continue;
    r.badSegs++;
    const i = data.frames.findIndex((f, k) => f.t >= a && f.t < b && outs[k].alerting);
    if (i >= 0) { r.alerted++; r.timeToAlert.push(data.frames[i].t - a); }
  }
  return r;
}

function features() {
  const keys: (keyof Metrics)[] = ["earRise", "noseRise", "headPitch", "headRoll", "shoulderRoll", "headOffset", "headScale", "headYaw", "shoulderWidth", "neckIncline", "torsoIncline", "neck3d", "pitch3d", "headForward3d", "earRise3d", "torso3d"];
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
  console.log(["clip", "lab", "view%", ...keys].join("\t"));
  for (const c of clips) {
    if (c.holdout && !flag("--all")) continue; // held-out clips stay unseen while tuning
    const file = `eval/out/${variant}/${c.id}.json`;
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { aspect: number; frames: Frame[] };
    for (const lab of ["good", "bad"] as Label[]) {
      const ms = data.frames.filter((f) => labelAt(c, f.t) === lab).map((f) => (f.lm ? computeMetrics({ landmarks: f.lm, world: f.world ?? undefined, aspect: data.aspect }) : null));
      if (!ms.length) continue;
      const ok = ms.filter((m): m is Metrics => !!m);
      const front = ok.filter((m) => m.view === "front").length;
      const cells = keys.map((k) => {
        const v = ok.map((m) => m[k]).filter((x): x is number => typeof x === "number");
        return v.length ? `${q(v, 0.1).toFixed(2)}/${q(v, 0.5).toFixed(2)}/${q(v, 0.9).toFixed(2)}` : "-";
      });
      console.log([c.id + (c.holdout ? "*" : ""), lab, `${ok.length}/${ms.length} f${Math.round((100 * front) / Math.max(1, ok.length))}`, ...cells].join("\t"));
    }
  }
}

function sum(rs: ClipResult[]) {
  const s = rs.reduce((a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, tn: a.tn + r.tn, fn: a.fn + r.fn, n: a.n + r.n, cov: a.cov + r.covered, fa: a.fa + r.falseAlerts, bs: a.bs + r.badSegs, al: a.al + r.alerted, tta: [...a.tta, ...r.timeToAlert] }), { tp: 0, fp: 0, tn: 0, fn: 0, n: 0, cov: 0, fa: 0, bs: 0, al: 0, tta: [] as number[] });
  const prec = s.tp / Math.max(1, s.tp + s.fp), rec = s.tp / Math.max(1, s.tp + s.fn);
  const med = s.tta.length ? [...s.tta].sort((a, b) => a - b)[s.tta.length >> 1] : NaN;
  return { frames: s.n, coverage: s.cov / Math.max(1, s.n), accuracy: (s.tp + s.tn) / Math.max(1, s.n), precision: prec, recall: rec, f1: (2 * prec * rec) / Math.max(1e-9, prec + rec), falseAlerts: s.fa, badSegs: s.bs, alerted: s.al, medianTimeToAlert: med };
}

if (flag("--features")) { features(); process.exit(0); }
const results = clips.map(run).filter((r): r is ClipResult => !!r);
const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const row = (name: string, s: ReturnType<typeof sum>) => `| ${name} | ${s.frames} | ${pct(s.coverage)} | ${pct(s.accuracy)} | ${pct(s.precision)} | ${pct(s.recall)} | ${s.f1.toFixed(2)} | ${s.falseAlerts} | ${s.alerted}/${s.badSegs} | ${isNaN(s.medianTimeToAlert) ? "-" : s.medianTimeToAlert.toFixed(1) + " s"} |`;
console.log(`model ${variant}, ${replay ? "replayed in node" : "browser verdicts"}${flag("--calibrated") ? ", calibrated where a good segment exists" : ""}, alert after ${alertMs / 1000} s`);
console.log("| set | frames | pose found | accuracy | precision (bad) | recall (bad) | F1 | false alerts | bad segments alerted | median time to alert |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
const tuningOnly = flag("--tuning");
if (!tuningOnly) console.log(row("all clips", sum(results)));
console.log(row("tuning", sum(results.filter((r) => !r.holdout))));
if (!tuningOnly) console.log(row("held out", sum(results.filter((r) => r.holdout))));
const pool = tuningOnly ? results.filter((r) => !r.holdout) : results;
console.log(row("front / three-quarter", sum(pool.filter((r) => r.view !== "side"))));
console.log(row("side", sum(pool.filter((r) => r.view === "side"))));
if (flag("--clips")) {
  console.log("\n| clip | view | held out | labelled frames | pose found | good frames called good | bad frames called bad | false alerts | alerted |");
  console.log("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const r of pool) {
    const good = r.tn + r.fp, bad = r.tp + r.fn;
    console.log(`| ${r.id} | ${r.view} | ${r.holdout ? "yes" : ""} | ${r.n} | ${pct(r.covered / Math.max(1, r.n))} | ${good ? pct(r.tn / good) : "-"} | ${bad ? pct(r.tp / bad) : "-"} | ${r.falseAlerts} | ${r.badSegs ? `${r.alerted}/${r.badSegs}` + (r.timeToAlert.length ? ` (${r.timeToAlert[0].toFixed(1)} s)` : "") : "-"} |`);
  }
}
