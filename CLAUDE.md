# posture-alert

A webcam posture monitor: Vite + React + TypeScript, MediaPipe Pose Landmarker in the browser,
a static site on GitHub Pages at https://byronxlg.com/posture-alert/.

- `src/posture/` is the detection model, pure TypeScript with no DOM: landmarks in, metrics
  and a verdict out. Unit tests in `src/posture/posture.test.ts` (`npm test`).
- `src/app/` is the UI and the frame loop (`engine.ts`).
- `eval/` is the accuracy harness over real stock footage; results in `eval/REPORT.md`. Run
  `npm run eval` before merging any change to `src/posture/` or `src/pose/`.

Operational docs live in `runbook/` (`README.md` for what healthy means, `updates.md` for how
change ships, how to run the eval, and how to roll back). Changes land through PRs with CI
green; the deploy happens only in GitHub Actions.
