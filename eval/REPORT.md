# Detection eval

Run on 2026-09-29 with `npm run eval`: 25 stock clips (24 scored), each fed through the real
browser pipeline (headless Chromium, `@mediapipe/tasks-vision` 1.0.1 Pose Landmarker in VIDEO
mode, then `src/posture/` exactly as the app runs it) at 10 frames per second. Labels are mine,
assigned by looking at frames sampled at 1 fps; see `clips.json` for sources, licences and
segments. Unlabelled stretches (transitions, stretching, close-ups, an empty chair) are not
scored.

## Headline (full model, no calibration, alert after 5 s)

| set | frames | pose found | accuracy | precision (bad) | recall (bad) | F1 | false alerts | bad segments alerted | median time to alert |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| all clips | 3262 | 95% | 83% | 92% | 70% | 0.79 | 0 | 8/12 | 5.0 s |
| tuning | 2211 | 93% | 79% | 87% | 64% | 0.74 | 0 | 6/9 | 5.0 s |
| held out | 1051 | 100% | 90% | 100% | 80% | 0.89 | 0 | 2/3 | 5.0 s |
| front / three-quarter | 2225 | 93% | 81% | 97% | 60% | 0.74 | 0 | 5/8 | 5.0 s |
| side | 1037 | 100% | 86% | 87% | 88% | 0.87 | 0 | 3/4 | 5.0 s |

Held-out clips (6 of 25) were chosen before any tuning and were not looked at while choosing
thresholds. A "false alert" is an alert that starts during a segment labelled good. The frame
metrics treat "no usable pose" as not bad, so missing a person counts against recall.

Every labelled frame here is scored against thresholds for a stranger. In the app the user
calibrates first; see "Calibration" below.

## Per clip

| clip | view | held out | labelled frames | pose found | good frames called good | bad frames called bad | false alerts | alerted |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| px8217040 | front |  | 72 | 100% | 100% | - | 0 | - |
| px8102314 | front |  | 210 | 100% | 100% | - | 0 | - |
| mk49927 | front |  | 96 | 100% | 100% | - | 0 | - |
| px7504759 | front |  | 88 | 100% | 100% | - | 0 | - |
| mk48503 | three-quarter |  | 0 | 0% | - | - | 0 | - |
| px4492721 | front |  | 104 | 100% | 100% | - | 0 | - |
| px7223728 | front |  | 116 | 100% | 100% | - | 0 | - |
| px9033091 | three-quarter |  | 56 | 100% | 100% | - | 0 | - |
| px6586298 | front | yes | 120 | 100% | 100% | - | 0 | - |
| px4052826 | front | yes | 282 | 100% | 100% | - | 0 | - |
| px5125886 | front |  | 185 | 99% | 79% | 57% | 0 | 1/1 (5.4 s) |
| mk50767 | front |  | 70 | 100% | - | 0% | 0 | 0/1 |
| mk5416 | front |  | 116 | 100% | - | 84% | 0 | 1/1 (5.0 s) |
| px8901143 | front |  | 170 | 5% | - | 5% | 0 | 0/1 |
| mk24055 | front |  | 122 | 99% | - | 99% | 0 | 1/1 (5.0 s) |
| px8136076 | three-quarter |  | 152 | 100% | - | 100% | 0 | 1/1 (5.0 s) |
| px6322165 | front | yes | 114 | 100% | - | 4% | 0 | 0/1 |
| mk48610 | front | yes | 152 | 100% | - | 100% | 0 | 1/1 (5.0 s) |
| px8512971 | side | yes | 108 | 100% | 100% | - | 0 | - |
| px10374908 | side |  | 68 | 100% | 100% | - | 0 | - |
| px7504607 | side |  | 300 | 100% | 75% | - | 0 | - |
| px8102853 | side | yes | 275 | 100% | - | 100% | 0 | 1/1 (5.0 s) |
| px8102852 | side |  | 105 | 100% | - | 94% | 0 | 1/1 (5.6 s) |
| px7652748 | side |  | 61 | 100% | - | 100% | 0 | 1/1 (5.0 s) |
| mk39854 | side |  | 120 | 100% | - | 47% | 0 | 0/1 |

## Model choice: full

Same thresholds, replayed over each model's landmarks (node replay of the same code):

| model | size | ms/frame (headless CPU) | F1 all | F1 held out | false alerts |
| --- | ---: | ---: | ---: | ---: | ---: |
| lite | 5.5 MB | 31 | 0.74 | 0.90 | 0 |
| full | 9.0 MB | 38 | 0.79 | 0.89 | 0 |
| heavy | 29 MB | 93 | 0.65 | 0.73 | 9 |

Full was best on the tuning clips (F1 0.74 against 0.65 for lite) and caught the mild
front-view slouches lite missed (px5125886: 57% of bad frames against 2%). Heavy's world
landmarks sit on a different scale, so these thresholds give it 9 false alerts; it would need
its own tuning and is too large for a web page anyway. Full costs 9 MB once (then cached).

## How the verdict is made

Per frame (`src/posture/metrics.ts`): the view (front or side) comes from the yaw of the
shoulder line in MediaPipe's world landmarks. Front metrics: 3D head pitch (nose below the ear
midpoint, degrees), 3D head-forward distance (ears ahead of shoulders along the facing
direction, in shoulder widths), ear height above the shoulder line, head roll and shoulder
roll. Side metrics: neck angle from vertical in the image, 3D pitch, 3D head-forward and 3D
torso lean. A frame with shoulders not visible (visibility < 0.5 or out of frame) has no
verdict.

Each rule maps its metric linearly from a good value (severity 0) to a bad value (severity 1);
the frame score is the worst severity, or 0.6 x (worst + second worst) when two moderate
problems coincide. The score is smoothed (800 ms time constant), turns bad at 1.0 and back to
good below 0.8 (hysteresis), and an alert fires once it has been bad for the alert delay (5 s
here, 10 s by default in the app). Sensitivity divides every good-to-bad span.

Chosen absolute thresholds (good to bad): front pitch 14 to 26 degrees, head-forward 0.20 to
0.32, ear rise 0.45 to 0.20, head roll 8 to 22 degrees, shoulder roll 5 to 16 degrees; side
neck angle 20 to 36 degrees, pitch 15 to 30, head-forward 0.15 to 0.30, torso lean 5 to 18.
The first front pitch and head-forward thresholds (18 to 32, 0.22 to 0.36) caught 2 of 6 front
bad segments; tightening them to the values above raised tuning F1 from 0.54 to 0.74 with no
false alerts. Smoothing between 400 and 1500 ms and the pair weight made little difference.

## Calibration

With a baseline, rules are offsets from the user's own upright pose, plus a lean-in rule
(shoulder width 1.05 to 1.2 times the baseline) that has no absolute form. Stock footage rarely
shows one person both ways, so this is measured by calibrating on the first 3 s of each clip's
first good segment (not scored) and scoring the rest:

| clip | good frames called good | bad frames called bad |
| --- | ---: | ---: |
| px5125886 (slumped, then sits up) | 13% | 99% |
| px7504607 (side, upright) | 100% (75% without calibration) | - |
| px8217040, px7504759, px6586298, px4052826, px8512971, px10374908 | 100% | - |

Calibrated detection of the slump in px5125886 is near perfect, but its "good" part has him
running both hands through his hair with his head tilting, which a strict baseline calls bad.
The unit tests cover the calibrated path with synthetic poses (lean-in, a low webcam).

## Where it fails

- **Front-view mild slouch without calibration.** mk50767 (head dropped toward a laptop on a
  couch, 0%) and the held-out px6322165 (hunched over a laptop on the knees, 4%) look,
  in front view, much like an upright person looking at a low screen: 3D pitch 14 to 20
  degrees, inside the range of the good clips. Only a baseline separates these; this is the
  main reason the app asks for calibration.
- **Close-ups without shoulders.** px8901143 (head on the desk, then chin on hand, vertical
  close-up): a pose is found in 5% of frames, so it is almost never judged.
- **Rear three-quarter view.** mk39854 (seen from behind, leaning toward the monitor): 47% of
  bad frames caught, no alert. The app is not meant for this camera position.
- **Fidgeting reads as bad.** px5125886's good segment (hands in hair, head tilting) is called
  bad 21% of the time without calibration and 87% with it. Tilt and roll rules fire on
  movement, not only posture; the 800 ms smoothing and the alert delay absorb most of it, and no
  alert fired on any good segment.
- **Side-view clips with close-ups.** px7504607 good frames are 75% good uncalibrated: the
  neck-angle rule fires when he leans in to the screen.
- **Labels are one person's judgement** and ambiguous clips were common. mk48503 was first
  labelled good, then excluded: frames show him looking down at the keyboard with the neck
  flexed about 40 degrees; the detector calls it bad throughout.
- **Small sample.** 24 scored clips, mostly 7 to 30 s, 3 held-out bad segments. The longest
  good stretch is 30 s, so false alerts over an hour of real work are not measured here.

## Reproduce

```sh
npm run eval                                   # fetch clips, run the browser pipeline, score
node eval/score.ts --variant full --clips      # the tables above, from the browser verdicts
node eval/score.ts --variant full --replay --tuning   # tuning set only, current code
node eval/score.ts --variant full --replay --calibrated --clips
node eval/run-eval.mjs lite heavy && node eval/score.ts --variant lite --replay
```
