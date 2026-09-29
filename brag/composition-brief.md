# Hyperframes Composition Brief: Posture Alert

- Composition: `brag/composition/`, render `brag/brag.mp4`, 1920x1080, 20 s, 30 fps.
- Source: `src/app/App.tsx`, `src/app/styles.css`, `README.md`; footage recorded from the real app
  in sample mode (`?sample`) with Playwright, cropped to 16:9 into `assets/app.mp4`.
- Verbatim copy: "A nudge when you start to slouch.", "Posture Alert", the README one-liner.
- Tone: polished; no generic SaaS language; no redesign of the product.
- Visual identity and storyboard: see `brag-plan.md`.
- Audio: `assets/music/bed.mp3` (vol-10, 20 s trim) at 0.30, RMS from `assets/audio-rms.js`
  on the vignette only; SFX `impactSoft_medium_001.ogg` at 3.55, `bong_001.ogg` at 16.93.
- Gate: `npx hyperframes check` with zero errors.
