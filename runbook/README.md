---
project: posture-alert
tier: 3
owner: byron
lifecycle: production
reviewed: 2026-09-29
---

# posture-alert runbook

A webcam posture monitor: MediaPipe Pose Landmarker runs in the browser, `src/posture/` turns
the landmarks into a verdict, and the page chimes, notifies and changes the tab when bad
posture lasts. Tier 3: a static page with no backend and no data; nothing to keep alive.
"Live" means https://byronxlg.com/posture-alert/ and its model and wasm return 200 and the
last `deploy.yml` run is green. If all hold, the project is healthy.

## Where it runs

GitHub Pages, project site for `byronxlg/posture-alert`, published from the `dist/` artifact by
`deploy.yml` on every push to `main`, served at `byronxlg.com/posture-alert/` through the user
site's custom domain. No server, no secrets, no host on this Mac. The pose model
(`public/models/pose_landmarker_full.task`) and the sample clip are committed; the wasm runtime
is copied from `node_modules` at build time (`scripts/copy-wasm.mjs`). The page uses the
system font stack; there are no third-party requests at runtime.

## Objectives

| Indicator | Target | Window | Measured by |
| --- | --- | --- | --- |
| Page, model and wasm return 200 | 99% of checks | 30 days | the `curl` loop in [updates.md](updates.md) "Post-deploy smoke test" |
| A push to `main` is live within 10 min | every push | per push | `gh run list --workflow deploy.yml --limit 1` is `success` |

Recovery targets: RTO 14 days (the `restore` SLA in `projects.yaml`). RPO not applicable: the
repo is the source of truth and the app stores nothing but settings in the visitor's browser.

## Who is watching

| Watcher | Where it runs | Cadence | Checks | Alerts to | Run history |
| --- | --- | --- | --- | --- | --- |
| `deploy.yml` | GitHub Actions | on push to `main` | build and Pages deploy | GitHub's workflow failure email | [actions](https://github.com/byronxlg/posture-alert/actions) |
| `ci.yml` | GitHub Actions | on PR and push | typecheck, unit tests, build | PR checks, failure email | [actions](https://github.com/byronxlg/posture-alert/actions) |

No off-host monitor and none is required at tier 3. The weekly fleet review runs the objective
checks above.

## Files

| Question | File |
| --- | --- |
| How do changes reach the site, how do I roll back? | [updates.md](updates.md) |
| How accurate is the detection, and where does it fail? | [../eval/REPORT.md](../eval/REPORT.md) |

Tier 3 does not carry `health.md`, `recovery.md`, `dependencies.md` or `incidents/`; the
objectives table is the whole health check, and rollback lives in `updates.md`.

## Schedules

| What | Where it runs | When | Notes |
| --- | --- | --- | --- |
| Deploy (`deploy.yml`) | github-actions | push to `main`, manual dispatch | `npm ci`, `npm run build`, upload `dist/`, deploy to Pages |
| CI (`ci.yml`) | github-actions | PR, push to `main` | typecheck, vitest, build |

## Dashboards and logs

- Actions runs: https://github.com/byronxlg/posture-alert/actions ; `gh run list --workflow deploy.yml --limit 5`.
- Pages: `gh api repos/byronxlg/posture-alert/pages -q .status`.
- Behaviour in a browser: `node scripts/check-ui.mjs [url]` (fake webcam from the sample clip, headless).
