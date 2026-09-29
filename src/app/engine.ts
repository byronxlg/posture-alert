import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createPoseLandmarker } from "../pose/landmarker.ts";
import {
  PostureMonitor, calibrate, computeMetrics,
  type Baseline, type Metrics, type MonitorOutput, type Point, type Verdict,
} from "../posture/index.ts";
import { chime, notify, setTabState } from "./alerts.ts";
import { drawSkeleton } from "./draw.ts";
import type { Settings } from "./settings.ts";

export type Phase = "idle" | "loading" | "calibrating" | "monitoring" | "error";
export type Source = "camera" | "sample";

export interface Stats {
  goodMs: number;
  badMs: number;
  awayMs: number;
  alerts: number;
  startedAt: number;
}

export interface Snapshot {
  phase: Phase;
  source: Source | null;
  verdict: Verdict;
  smoothed: number | null;
  metrics: Metrics | null;
  reason: string | null;
  badForMs: number;
  alerting: boolean;
  calibrated: boolean;
  calibrationLeftMs: number;
  notice: string | null;
  error: string | null;
  stats: Stats;
  /** One entry per second of monitoring: g good, b bad, u no pose. */
  timeline: string;
  breakDue: boolean;
}

const CALIBRATION_MS = 3000;
/** Calibration also needs this many frames, so a slow first second does not cut it short. */
const CALIBRATION_FRAMES = 15;
const CALIBRATION_MAX_MS = 10000;
const REALERT_MS = 60000;
const AWAY_BREAK_MS = 120000;
const TIMELINE_MAX = 3600;

const freshStats = (): Stats => ({ goodMs: 0, badMs: 0, awayMs: 0, alerts: 0, startedAt: Date.now() });

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/**
 * Owns the camera or sample video, the frame loop and the posture monitor,
 * and pushes a Snapshot to the UI a few times a second. Nothing leaves the
 * browser: frames go from the video element straight into MediaPipe's wasm.
 */
export class Engine {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private emit: (s: Snapshot) => void;
  private settings: Settings;
  private monitor = new PostureMonitor();
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastVideoTime = -1;
  private lastTick = 0;
  private lastEmit = 0;
  private lastSecond = 0;
  private secondMs = { g: 0, b: 0, u: 0 };
  private lastAlertAt = 0;
  private lastBreakAt = 0;
  private awaySince: number | null = null;
  private calStart = 0;
  private calSamples: (Metrics | null)[] = [];
  private lastOut: MonitorOutput | null = null;
  private lastLm: Point[] | null = null;
  private posesSeen = 0;
  private runId = 0;
  private ticker: { stop(): void } | null = null;
  snap: Snapshot;

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, settings: Settings, emit: (s: Snapshot) => void) {
    this.video = video;
    this.canvas = canvas;
    this.settings = settings;
    this.emit = emit;
    this.snap = this.blank("idle", null);
    this.applySettings(settings);
  }

  private blank(phase: Phase, source: Source | null): Snapshot {
    return {
      phase, source, verdict: "unknown", smoothed: null, metrics: null, reason: null, badForMs: 0,
      alerting: false, calibrated: false, calibrationLeftMs: 0, notice: null, error: null,
      stats: freshStats(), timeline: "", breakDue: false,
    };
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.monitor.setOptions({ sensitivity: s.sensitivity, alertAfterMs: s.alertDelay * 1000 });
  }

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.emit(this.snap);
  }

  private async loadModel() {
    landmarkerPromise ??= createPoseLandmarker("full");
    try {
      this.landmarker = await landmarkerPromise;
    } catch (e) {
      landmarkerPromise = null;
      throw new Error("model", { cause: e });
    }
  }

  async startCamera() {
    const id = ++this.runId;
    this.stopMedia();
    this.snap = this.blank("loading", "camera");
    this.emit(this.snap);
    if (!navigator.mediaDevices?.getUserMedia) {
      return this.fail("This browser cannot use a camera here. Open the page over https in a current browser, or try the sample video.");
    }
    try {
      const [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false }),
        this.loadModel(),
      ]);
      if (id !== this.runId) return stream.getTracks().forEach((t) => t.stop());
      this.stream = stream;
      this.video.srcObject = stream;
      this.video.loop = false;
      await this.video.play();
      this.beginCalibration();
      this.loop();
    } catch (e) {
      if (id !== this.runId) return;
      this.fail(describeError(e));
    }
  }

  async startSample(url: string) {
    const id = ++this.runId;
    this.stopMedia();
    this.snap = this.blank("loading", "sample");
    this.emit(this.snap);
    try {
      await this.loadModel();
      if (id !== this.runId) return;
      this.video.srcObject = null;
      this.video.src = url;
      this.video.loop = true;
      this.video.muted = true;
      await this.video.play();
      // The sample is a stranger: no calibration, absolute thresholds.
      this.monitor.setBaseline(null);
      this.set({ phase: "monitoring", calibrated: false, notice: null, stats: freshStats() });
      this.lastBreakAt = performance.now();
      this.loop();
    } catch (e) {
      if (id !== this.runId) return;
      this.fail(describeError(e));
    }
  }

  beginCalibration() {
    this.calStart = 0; // set on the first processed frame
    this.calSamples = [];
    this.set({ phase: "calibrating", calibrationLeftMs: CALIBRATION_MS, notice: null });
  }

  skipCalibration() {
    this.monitor.setBaseline(null);
    this.startMonitoring(false, "Calibration skipped, so typical upright posture is the baseline. Calibrate again for a closer fit to how you sit.");
  }

  private startMonitoring(calibrated: boolean, notice: string | null) {
    this.lastBreakAt = performance.now();
    this.set({ phase: "monitoring", calibrated, notice, stats: freshStats(), timeline: "", breakDue: false });
  }

  private finishCalibration() {
    const b: Baseline | null = calibrate(this.calSamples);
    if (b) {
      this.monitor.setBaseline(b);
      this.startMonitoring(true, null);
    } else {
      this.monitor.setBaseline(null);
      this.startMonitoring(false, "Your head and shoulders were not clearly in view, so typical upright posture is the baseline. Sit so both shoulders show and calibrate again.");
    }
  }

  dismissBreak() {
    this.lastBreakAt = performance.now();
    this.set({ breakDue: false });
  }

  resetStats() {
    this.secondMs = { g: 0, b: 0, u: 0 };
    this.set({ stats: freshStats(), timeline: "" });
  }

  stop() {
    this.runId++;
    this.stopMedia();
    setTabState("idle", "Posture Alert");
    this.snap = this.blank("idle", null);
    this.emit(this.snap);
  }

  private stopMedia() {
    cancelAnimationFrame(this.raf);
    this.ticker?.stop();
    this.ticker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.srcObject = null;
    this.lastVideoTime = -1;
    this.lastOut = null;
    this.lastLm = null;
    this.lastTick = 0;
    this.secondMs = { g: 0, b: 0, u: 0 };
    this.monitor.reset();
    this.canvas.getContext("2d")?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private fail(message: string) {
    this.stopMedia();
    this.set({ phase: "error", error: message });
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.ticker ??= startBackgroundTicker(() => { if (document.hidden) this.step(); });
    this.step();
  };

  /** One frame: detect, score, draw, account. Driven by rAF, or by the ticker while the tab is hidden. */
  private step() {
    const v = this.video;
    if (!this.landmarker || v.readyState < 2 || v.videoWidth === 0) return;
    if (v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const now = performance.now();
    const dt = this.lastTick ? Math.min(now - this.lastTick, 1000) : 0;
    this.lastTick = now;

    const res = this.landmarker.detectForVideo(v, now);
    const lm = (res.landmarks[0] as Point[] | undefined) ?? null;
    const world = (res.worldLandmarks[0] as Point[] | undefined) ?? undefined;
    const frame = lm ? { landmarks: lm, world, aspect: v.videoWidth / v.videoHeight } : null;
    this.lastLm = lm;
    if (lm) this.posesSeen++;

    if (this.canvas.width !== v.videoWidth) {
      this.canvas.width = v.videoWidth;
      this.canvas.height = v.videoHeight;
    }

    if (this.snap.phase === "calibrating") {
      if (!this.calStart) this.calStart = now;
      this.calSamples.push(frame ? computeMetrics(frame) : null);
      const elapsed = now - this.calStart;
      const enough = this.calSamples.length >= CALIBRATION_FRAMES || elapsed > CALIBRATION_MAX_MS;
      const left = enough ? CALIBRATION_MS - elapsed : Math.max(CALIBRATION_MS - elapsed, 500);
      const g = this.canvas.getContext("2d");
      if (g) drawSkeleton(g, this.settings.skeleton ? lm : null, "unknown", false);
      if (left <= 0) this.finishCalibration();
      else if (now - this.lastEmit > 100) {
        this.lastEmit = now;
        this.set({ calibrationLeftMs: left, metrics: frame ? computeMetrics(frame) : null });
      }
      return;
    }
    if (this.snap.phase !== "monitoring") return;

    const out = this.monitor.update(frame, now);
    this.lastOut = out;
    const g = this.canvas.getContext("2d");
    if (g) drawSkeleton(g, this.settings.skeleton ? lm : null, out.verdict, false);
    this.account(out, dt, now);
    if (now - this.lastEmit > 120) {
      this.lastEmit = now;
      this.set({
        verdict: out.verdict, smoothed: out.smoothed, metrics: out.metrics,
        reason: out.verdict === "bad" ? (out.reasons[0]?.label ?? null) : null,
        badForMs: out.badForMs, alerting: out.alerting,
      });
    }
  }

  private account(out: MonitorOutput, dt: number, now: number) {
    const st = { ...this.snap.stats };
    if (out.verdict === "good") st.goodMs += dt;
    else if (out.verdict === "bad") st.badMs += dt;
    else st.awayMs += dt;

    // Alerts: once when bad posture has lasted the delay, then every minute it continues.
    if (out.alertStarted || (out.alerting && now - this.lastAlertAt > REALERT_MS)) {
      this.lastAlertAt = now;
      if (out.alertStarted) st.alerts++;
      const why = out.reasons[0]?.label ?? "Posture";
      if (this.settings.sound) chime(this.settings.volume);
      if (this.settings.notify && document.hidden) notify("Sit up", `${why}. Straighten up and relax your shoulders.`);
    }
    setTabState(out.alerting ? "bad" : out.verdict === "unknown" ? "idle" : "good", out.alerting ? "Sit up - Posture Alert" : "Posture Alert");

    // Stepping away counts as a break.
    if (out.verdict === "unknown") {
      this.awaySince ??= now;
      if (now - this.awaySince > AWAY_BREAK_MS) this.lastBreakAt = now;
    } else this.awaySince = null;
    let breakDue = this.snap.breakDue;
    if (this.settings.breakEvery > 0 && !breakDue && now - this.lastBreakAt > this.settings.breakEvery * 60000) {
      breakDue = true;
      if (this.settings.sound) chime(this.settings.volume);
      if (this.settings.notify && document.hidden) notify("Time for a break", "Stand up, look away from the screen, move for a minute.");
    }

    // One timeline entry per second, for whichever state held most of that second.
    const key = out.verdict === "good" ? "g" : out.verdict === "bad" ? "b" : "u";
    this.secondMs[key] += dt;
    let timeline = this.snap.timeline;
    if (now - this.lastSecond >= 1000) {
      this.lastSecond = now;
      const t = this.secondMs;
      const top = t.g >= t.b && t.g >= t.u ? "g" : t.b >= t.u ? "b" : "u";
      if (t.g + t.b + t.u > 0) timeline = (timeline + top).slice(-TIMELINE_MAX);
      this.secondMs = { g: 0, b: 0, u: 0 };
    }
    this.snap = { ...this.snap, stats: st, timeline, breakDue };
  }

  /** For the headless checks: the last monitor output and landmarks. */
  debug() {
    return { out: this.lastOut, landmarks: this.lastLm?.length ?? 0, posesSeen: this.posesSeen, phase: this.snap.phase, calibrationFrames: this.calSamples.length, calibrationUsable: this.calSamples.filter(Boolean).length };
  }
}

/**
 * Browsers pause requestAnimationFrame in a hidden tab, which would stop the
 * monitoring exactly when the alerts matter most. A worker's timer keeps
 * ticking in the background (main-thread timers are throttled much harder),
 * so while the tab is hidden it drives the loop at about 2 frames a second.
 * The monitor is time-based, so the lower frame rate does not change verdicts.
 */
const BACKGROUND_TICK_MS = 500;
function startBackgroundTicker(tick: () => void): { stop(): void } {
  try {
    const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${BACKGROUND_TICK_MS});`], { type: "text/javascript" }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = tick;
    return { stop: () => w.terminate() };
  } catch {
    const id = setInterval(tick, BACKGROUND_TICK_MS);
    return { stop: () => clearInterval(id) };
  }
}

function describeError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  const msg = (e as Error)?.message;
  if (msg === "model") return "The pose model did not load. Check your connection and reload the page.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is blocked. Allow the camera for this site in your browser's address bar, then start again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera found. Connect a webcam, or try the sample video instead.";
  if (name === "NotReadableError" || name === "AbortError")
    return "The camera is in use by another app. Close it there, then start again.";
  if (name === "NotSupportedError")
    return "This browser cannot open a camera on this page. Try a current version of Chrome, Edge, Firefox or Safari, or try the sample video.";
  console.warn("Posture Alert could not start:", e);
  return "Something went wrong starting the camera or video. Reload the page and try again.";
}
