# Validation for v0.1.0

This page preserves the first release's measurements. See [v0.1.1 recovery validation](VALIDATION-v0.1.1.md) for the subsequent editing recovery fix and current release verification.

Executed 2026-11-03. The recorded website and product data are synthetic. This is a repeatability smoke test, not a general reliability or performance benchmark.

## Environment and reproducibility

- Windows x64, Intel Core Ultra 9 285K, Node 24.18.0.
- Playwright 1.64.1, Chromium 156.0.8078.4; FFmpeg/ffprobe 8.1, software H.264 encoding.
- `npm run check`, `npm test`, `npm run build`, `npm run test:e2e` completed successfully.
- E2E recipe: 3 actions, 1280 × 800 webpage, fresh session per run. The app delays its save by 450 ms; the slow variant delays it by 2600 ms.
- [Machine-readable results](validation-results.json). Local raw evidence is under ignored `test-results/`.

## Observed results

| Check | Evidence/result |
| --- | --- |
| Three successive recordings | 3/3 successful, 0 retries; 11.439 / 11.342 / 11.294 seconds from browser launch through saved source metadata |
| Changed website, same workflow | Third run changes the app heading; poster hashes differ while step IDs and revised captions remain associated |
| Edit without replay | Target server shut down before render; caption, CJK text, zoom, hold, trims and template edits export successfully; source WebM SHA-256 unchanged |
| Slow response | Explicit visible-result wait observed 2.868 seconds; the Midnight export reports 2.37 seconds cut including target preparation |
| Missing target | Run fails with the step ID and locator error; unfinished recording directory removed |
| Cancellation | Real browser capture and FFmpeg render cancelled; no successful metadata or partial result remains |
| Action mismatch | A changed selector cannot render against old footage; user must record again |
| Export integrity | All 3 templates decoded with FFmpeg for both MP4 and GIF; MP4s are H.264, 1280 × 900, constant 30 fps |
| Studio workflow | Real record → caption edit → export → video playback → download → second edit/export, without a second recording |
| Local exposure | Cross-origin request, wrong Host and missing mutation token rejected |
| UI | 390, 768 and 1600 px screenshots inspected; no horizontal overflow or browser page errors; help keyboard focus handling and reduced-motion mode included |
| Package install | Packed release installed with production dependencies in an isolated directory; doctor and complete demo run succeeded |
| Dependency audit | `npm audit --omit=dev`: 0 known vulnerabilities at time of check; not a security certification |

Windows output measurements from the same suite (public release media is regenerated on Linux):

| Style | MP4 duration | MP4 bytes | GIF bytes |
| --- | ---: | ---: | ---: |
| Studio | 11.033 s | 276,962 | 1,568,180 |
| Paper (edited) | 11.100 s | 288,450 | 1,650,342 |
| Midnight (slow response trimmed) | 10.733 s | 281,470 | 1,651,523 |

The whole E2E suite, including multiple records/renders and UI interaction, took 88.31 seconds on this machine. Timings vary by website, CPU, browser and system load. This is not a manual recording/editing comparison. No speedup percentage is claimed.

## Reviewed artifacts

- v0.1.0 artifacts: [README animation](https://github.com/Ray0766/demopilot/blob/v0.1.0/docs/media/demo.gif), [sample MP4](https://github.com/Ray0766/demopilot/blob/v0.1.0/docs/media/demo.mp4), [Studio screenshot](https://github.com/Ray0766/demopilot/blob/v0.1.0/docs/media/studio.png).
- [DemoPilot recording itself at v0.1.0](https://github.com/Ray0766/demopilot/blob/v0.1.0/docs/media/showcase.mp4): the published Linux MP4 is 21.700 s / 682,026 bytes. The original Windows run was 21.733 s / 656,254 bytes, with a 3,582,130-byte GIF. Six explicit steps: show recipe, record, edit caption, change style, export and play. Recorded at 1440 × 1000, which also exercises a different page layout/aspect ratio.
- Reviewed extracted frames around dialog opening, text entry, result visibility, zoom edges and caption placement. CJK captions render correctly on this Windows font stack. Final video playback is tested in real Chromium. No audio track is expected.
- IAB (the embedded chat browser) did not stream localhost video in this session; standalone Chromium playback passed. This is documented rather than misreported as IAB playback verification.

## GitHub release verification

- [CI run 41568896020](https://github.com/Ray0766/demopilot/actions/runs/41568896020): Node 22 and 24 on Ubuntu both passed dependency installation, type checking, unit tests, build and the complete real-browser E2E suite. The release job also passed E2E and the self-recording showcase.
- [v0.1.0](https://github.com/Ray0766/demopilot/releases/tag/v0.1.0) is public, published 2026-11-03. Its tag and fetched commit both resolve to `3dea89de3ab00099d22c64df432f21852c11af8f`.
- Assets: `ray0766-demopilot-0.1.0.tgz` (142,205 bytes), `showcase.mp4` (682,026 bytes), `demo.gif` (1,612,561 bytes). This is a GitHub package download, not an npm registry publication.
- Fetched MP4/GIF hashes match the public release asset SHA-256 digests. The Linux showcase is H.264, 1280 × 900, constant 30 fps. Linux Studio and poster screenshots were inspected after fetching the published media.
- Windows source, media and test outputs are retained locally; media timing and font rasterization vary across systems.

## Limits still unverified

- No manual task-time baseline or competitor head-to-head comparison. The advantage of reusable editing remains a product hypothesis beyond the behavior demonstrated here.
- Three repeat runs do not establish production reliability across arbitrary sites, animations, slow networks or complex stateful apps.
- Actual disk exhaustion, power loss and forced OS termination were not injected. These may leave incomplete local folders; completed exports are identified by metadata. The job state unit test covers error propagation, not disk-full recovery.
- No full WCAG audit or user study. Mobile layouts are responsive, but the editing workspace is primarily designed for desktop.
- macOS has not been tested. Linux/Node 22 and 24 passed the linked GitHub CI run; Windows/Node 24 was tested locally.
- No sensitive-data redaction, authentication sessions, cross-tab workflows, iframe targets, audio, or native desktop recording.
- FFmpeg and Chromium are external prerequisites; the clean package test reused the installed executables/browser cache. It verified package contents and production dependency installation, not a fresh operating system.
