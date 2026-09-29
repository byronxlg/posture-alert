# Posture Alert

A webcam posture monitor that chimes when you slouch. Live at
**https://byronxlg.com/posture-alert/**.

[![Posture Alert in 20 seconds](https://byronxlg.com/posture-alert/assets/brag.jpg)](https://byronxlg.com/posture-alert/assets/brag.mp4)

Pose tracking runs in the browser with MediaPipe Pose Landmarker; the video never leaves your
device, and nothing is stored except your settings.

## What it does

- Tracks your head and shoulders from a laptop webcam (front view) or a side-on camera.
- Calibration: sit up straight for three seconds and that becomes your baseline.
- When bad posture lasts past the alert delay: a chime (with volume), a system notification if
  the tab is in the background, and the tab title and icon change. Monitoring keeps running
  in a background tab: browsers pause animation frames there, so a worker timer drives the
  loop at about 2 frames a second until the tab is visible again.
- One status you can read from across the desk: Upright, Slouching (with a countdown ring to the
  alert), Sit up, or Not in view.
- A session summary: share of the time upright, time upright and slouching, longest upright
  stretch, alerts, and a timeline of the last hour with a time axis.
- Settings (kept in localStorage) in a sheet: sensitivity (Relaxed, Balanced, Strict) and alert
  delay (5, 10, 30 s) as simple choices, with a fine-tune slider once you pick one; chime,
  notifications and break reminders as switches, with volume and interval under them. Advanced:
  skeleton on the video, and the measurements behind each verdict.
- "Try the sample video" shows it working without a webcam.

## How detection works

`src/posture/` is pure TypeScript: landmarks in, verdict out. It measures 3D head pitch and how
far the ears sit ahead of the shoulders (from MediaPipe's world landmarks, so camera distance
does not matter), ear height above the shoulder line, head and shoulder roll, and in side view
the neck and torso angles. Each is scored against thresholds, either absolute or relative to
your calibrated posture, then smoothed, with hysteresis, and an alert only fires when bad
posture persists. Details and thresholds: [eval/REPORT.md](eval/REPORT.md).

## Accuracy

Measured on 24 labelled stock clips (Pexels, Mixkit) through the same browser pipeline, without
calibration, alert after 5 s:

| set | accuracy | precision (bad) | recall (bad) | false alerts |
| --- | ---: | ---: | ---: | ---: |
| all clips | 83% | 92% | 70% | 0 |
| held out (6 clips, never used for tuning) | 90% | 100% | 80% | 0 |

Its weak spot is a mild slouch seen from the front without calibration: head dropped toward a
laptop looks much like looking at a low screen. Calibrating fixes most of that. Close-ups
without shoulders are not judged. Full discussion in the report.

## Develop

```sh
npm install
npm run dev          # http://localhost:5173/posture-alert/
npm test             # unit tests (vitest)
npm run typecheck
npm run build
npm run check:ui     # headless Chromium with a fake camera; screenshots in tmp/
npm run eval         # accuracy eval (Node 22.18+ and ffmpeg; downloads ~400 MB of clips)
```

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`. Runbook: [runbook/](runbook/).

The sample clip is a shortened copy of [a Pexels video](https://www.pexels.com/video/5125886/)
under the Pexels License. The eval clips are downloaded, not committed.
