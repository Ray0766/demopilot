# v0.1.3 validation

Validated on 2026-11-03, Windows x64, Intel Core Ultra 9 285K, Node 24.18.0. This is a functional validation of a synthetic three-step app, not a reliability benchmark or a comparison against other recorders.

## Evidence

| Check | Result | Local evidence |
| --- | --- | --- |
| Types, build, behavior tests | Pass; 7 behavior tests | `npm run check`, `npm run build`, `npm test` |
| Same recipe recorded three times, including an updated target page | 3 successes, zero retries; 11.448 / 11.389 / 11.325 s | `test-results/e2e-1793696654780/results.json` |
| Offline edits, source preservation, templates and output decoding | Pass; source hashes unchanged; all three templates decode | Same core receipt |
| Studio record / edit / export / playback / re-export / download | Pass; no page errors | Same receipt and `studio-export.png` |
| Keyboard disclosures and trim editing | Action and timing controls expand with Enter; a trim is edited and exported | Same receipt and `studio-timing.png` |
| Long English/Chinese captions | Inline text expands without clipping | Same receipt and `studio-long-caption.png` |
| 390 / 768 / 1280 / 1366 / 1600 px layouts | No horizontal page overflow; footage and scene strip fit the short desktop windows | Same run, `studio-<width>.png` |
| Frame switching, keyboard playback/seek and Help focus | Edits preserved; modal traps and restores focus | Same core receipt |
| Reload, restart, independent takes, incomplete drafts, failed connection, missing media, migration | All 13 conditions pass; no page errors | `test-results/recovery-1793696427072/results.json` |
| Self-recorded showcase | Two real takes; stable step IDs, edited caption and template retained | `test-results/showcase-1793696655105/repeatability.json` |

The full local core run took 89.09 s. These timings describe this machine and workload only. Capture and final-video durations are different measures.

## Visual review

The running interface was inspected before and after export, including action/timing disclosure, frame settings and playback. A title overflow was fixed; the captured-scene strip was compacted after the short-window review showed it taking too much footage space. Final desktop, 390 px and long bilingual caption screenshots were opened and inspected.

The Windows showcase is 30.933 s, 754,291 bytes MP4 and 3,379,377 bytes GIF. Both files fully decode with FFmpeg. Eight final frames were opened for inspection in `test-results/design-research/script-showcase-review.png`; they show the script, actual capture, bilingual edit, frame choice, exported playback and a new take. Public artifacts are regenerated on Linux by CI, so their exact sizes may differ.

Public sample captions use literal action descriptions. The local test screenshots predate the final wording-only change from the old test phrases; the CI flow validates and regenerates those assets. The sample recipe file now uses the same captions as the built-in recipe.

## Release

[GitHub Actions run 41608621926](https://github.com/Ray0766/demopilot/actions/runs/41608621926) passed both Linux Node 22/24 verification jobs and the release job. Those runs exercised the final literal captions, complete core flow, recovery and the two-take showcase.

[v0.1.3](https://github.com/Ray0766/demopilot/releases/tag/v0.1.3) is public. Fetch verified tag `4dd5ff2d371ceb764a026d36fb766c2ca06f749b`. All three downloaded release assets match their published SHA-256 and byte counts: package 144,658 bytes, MP4 760,012 bytes (30.967 s), GIF 1,296,237 bytes. The repository MP4/GIF hashes match the release downloads. Receipt: `test-results/release-v0.1.3-receipt.json`.

The public MP4 fully decodes with FFmpeg. The final Linux Studio screenshot was opened and visually inspected. The downloaded public package installs with production dependencies into `test-results/public-package-v013`; CLI reports 0.1.3 and doctor reports Chromium 156.0.8078.4, FFmpeg/ffprobe 8.1 and readiness. This reuses installed browser/system dependencies. The package is distributed through GitHub Releases, not the npm registry.

## Limits

The visual direction is an authorial choice, not a demonstrated productivity improvement or proof of user preference. No full WCAG audit, screen-reader audit, true browser 200% zoom test or Firefox/Safari validation was completed. Native disclosure and CSS field sizing are exercised in Chromium. On short screens the script scrolls; on mobile it precedes the footage.

Edits require another export to appear in the final cut. Pending edits and previous downloads remain labeled. The existing single-tab, explicit-step, no-audio capture scope and [workspace recovery boundaries](VALIDATION-v0.1.1.md#boundaries) apply. Third-party reference screenshots stay local and are not shipped.
