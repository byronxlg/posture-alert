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
for u in "" models/pose_landmarker_full.task wasm/vision_wasm_internal.wasm sample/slouch-then-sit-up.mp4; do
  curl -s -o /dev/null -w "%{http_code} /posture-alert/$u\n" "https://byronxlg.com/posture-alert/$u"; done
node scripts/check-ui.mjs https://byronxlg.com/posture-alert/
```

Pass: the run is `success`, every URL is 200, and `check-ui.mjs` prints `monitoring` with
frames with a pose for all three runs and no console errors.

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
