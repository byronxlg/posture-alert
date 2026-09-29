// Everything that reaches the user when posture has been bad for a while:
// a short two-tone chime, a system notification when the tab is hidden, and
// the tab title and favicon, which stay visible from other tabs.

let ctx: AudioContext | null = null;

/** Must first be called from a user gesture so the browser allows audio. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

export function chime(volume: number) {
  if (!ctx || volume <= 0) return;
  const t = ctx.currentTime;
  for (const [i, f] of [660, 440].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const start = t + i * 0.22;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35 * volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  }
}

export async function requestNotifications(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "posture-alert", icon: favicon("bad") });
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}

const COLORS = { good: "#1f8a70", bad: "#d1344b", idle: "#5b7075" } as const;
const iconCache = new Map<string, string>();

function favicon(state: keyof typeof COLORS): string {
  const hit = iconCache.get(state);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = COLORS[state];
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  // A plumb line: straight when good, bent when bad.
  g.strokeStyle = "#fff";
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(32, 14);
  if (state === "bad") g.quadraticCurveTo(48, 30, 38, 50);
  else g.lineTo(32, 50);
  g.stroke();
  const url = c.toDataURL("image/png");
  iconCache.set(state, url);
  return url;
}

export function setTabState(state: keyof typeof COLORS, title: string) {
  document.title = title;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = favicon(state);
}
