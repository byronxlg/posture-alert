---
project: posture-alert
reviewed: 2026-09-29
deploy_path: push-to-main
rollback_minutes: 10
---

# Updates

Everything reaches the site through `deploy.yml` on push to `main`; `main` is what is live.
Changes land through a PR with `ci.yml` green, so every change has a trail and the previous
state is one revert away. No local deploys.

## How a change reaches production

| Change to | Pipeline | Trigger | Lands in prod when | Evidence |
| --- | --- | --- | --- | --- |
| `src/**`, `index.html`, `public/**`, `vite.config.ts` | `deploy.yml`: `npm ci`, `npm run build`, upload, `deploy-pages` | push to `main` | the deploy step finishes, 1 to 2 min | run green; smoke test below |
| `package*.json` | same | push to `main` | same | run green |
| `eval/**`, `README.md`, `runbook/**` | none (built into nothing) | push to `main` | on GitHub immediately | n/a |
| Launch video (`brag/`, `public/assets/brag.*`) | `deploy.yml` (the copies in `public/assets/`) | push to `main` | the deploy step finishes | `curl -sI https://byronxlg.com/posture-alert/assets/brag.mp4` is 200; the README poster shows the new frame |

## Before merging a detection change

Anything under `src/posture/` or `src/pose/` changes what users are told. Run the eval and
compare with `eval/REPORT.md` before merging:

```sh
npm run eval      # downloads the clips (ffmpeg needed), runs the browser pipeline, scores it
node eval/score.ts --variant full --clips   # per-clip table
```

The eval is not in CI: it downloads about 400 MB of stock footage from Pexels and Mixkit and
takes about 5 minutes. If a clip URL goes away, `eval/fetch-clips.mjs` fails on that clip;
drop it from `eval/clips.json` and say so in the report. Update `eval/REPORT.md` with the new
table. Tune thresholds on the non-held-out clips only (`node eval/score.ts --replay --tuning`).

## Post-deploy smoke test

Not a merge gate. Proves the page and its heavy assets are served.

```sh
gh run list --workflow deploy.yml --limit 1
for u in "" favicon.svg og.jpg models/pose_landmarker_full.task wasm/vision_wasm_internal.wasm sample/slouch-then-sit-up.mp4; do
  curl -s -o /dev/null -w "%{http_code} /posture-alert/$u\n" "https://byronxlg.com/posture-alert/$u"; done
node scripts/check-ui.mjs https://byronxlg.com/posture-alert/
```

Pass: the run is `success`, every URL is 200, and `check-ui.mjs` prints `monitoring` with
frames with a pose for all three runs, a `hidden-tab` line with frames still being processed,
and no console errors.

## Regenerating the share image

`public/og.jpg` (the `og:image` link preview) is a 1200x630 screenshot of the app in sample mode
while it reads Upright. Retake it when the app changes visibly: `npm run dev`, then a Playwright
screenshot of `http://localhost:5173/posture-alert/?sample` at a 1200x630 viewport, JPEG quality
about 88.

## Regenerating the launch video

When the app changes visibly. The footage is the real app in sample mode, recorded with
Playwright against `vite preview`, then composed with Hyperframes (`/brag`).

1. `npm run build`, then record `?sample` at 1440x900 with Playwright `recordVideo` and crop to
   16:9: `ffmpeg -ss 7 -t 11 -i <recording>.webm -vf "crop=1440:810:0:20,scale=1920:1080,fps=30"
   -c:v libx264 -crf 18 -pix_fmt yuv420p -an brag/composition/assets/app.mp4` (monitoring starts
   about 7 s into the recording; check the Upright / Slouching flips land in the first 10 s).
2. Edit `brag/composition/index.html` if the copy changed; `npx hyperframes check` in
   `brag/composition/` must pass, then `npx hyperframes render --quality high --output ../brag.mp4`.
3. Pull the poster (`ffmpeg -ss 8.5 -i brag.mp4 -frames:v 1 -q:v 2 brag.jpg`), bake it as frame 0
   (brag skill, step 4), copy `brag/brag.mp4` and `brag/brag.jpg` to `public/assets/`, commit,
   push, and check the curl in the table above.

## Rollback

`git revert <sha>` on `main` and push; `deploy.yml` republishes the previous build in about
two minutes. Do not re-deploy an old artifact by hand.

## Scheduled maintenance

| What | Cadence | How | Validated by |
| --- | --- | --- | --- |
| npm deps (`vite`, `react`, `@mediapipe/tasks-vision`) | quarterly | PR, `npm test`, `npm run eval`, `check-ui.mjs` | CI and deploy green, eval within a few points of the report |
| Pose model (`public/models/pose_landmarker_full.task`) | with a MediaPipe bump | delete it, `node scripts/fetch-model.mjs full`, rerun the eval | same |
| Node in the workflows (`node-version: 22`) | when 22 is within 6 months of EOL | PR | CI and deploy green |
| GitHub Actions versions | when a major is released | PR | CI and deploy green |

## Things that are risky to change

- `vite.config.ts` `base`: it must stay `/posture-alert/` or every asset 404s on Pages.
- The thresholds in `src/posture/score.ts` are tuned for the `full` model. The `heavy` model's
  world landmarks differ enough that the same thresholds give many false alerts (see the
  report); switching models means retuning.
- `scripts/copy-wasm.mjs`: a MediaPipe bump can rename the wasm files; run `check-ui.mjs`.
