# v0.2.0 validation

Validated on 2026-11-03, Windows x64, Intel Core Ultra 9 285K, Node 24.18.0, Playwright 1.64.1 / Chromium 156.0.8078.4 and FFmpeg 8.1. GitHub Linux verification and publication are pending; the Windows results below are measured, not projected.

## Reproducible checks

- `npm run check`, `npm test` (10 behavior tests) and `npm run build` passed. No runtime dependency was added or upgraded.
- `npm run test:e2e`: `test-results/e2e-1793708355494/results.json`. The same three-step synthetic Littleboard workflow recorded successfully 3/3 times with zero retries (11.384, 11.397 and 11.402 seconds). Stable step IDs and edits survive re-recording, including a changed application. Original footage hashes remain unchanged when editing offline.
- Caption validation uses 160 Chinese characters ending in `完整结尾`; the ending is present in both the preview and exported frame. XML-sensitive text, emoji, whitespace and excessive explicit line breaks are covered. Text that cannot fit is rejected without silently dropping lines. Actual screenshots exposed and prompted a Windows font-fallback fix before this final run.
- Eight warmed caption edits, measured from the browser update to a ready canvas at 1600 × 1120, took 99.6–116.2 ms; nearest-rank p95 is 116.2 ms. This small sample **does not meet the research target of p95 below 100 ms** and excludes initial font initialization. It is evidence of interactive editing on this machine, not a general latency guarantee.
- At the same 1.8-second composition time, preview versus decoded H.264 frame mean absolute channel error was 2.556/255 in the caption region and 3.449/255 over the full frame. These are alignment checks for this fixture, not a perceptual-quality score. Both final images were opened and inspected.
- Three-scene cache: unchanged export = 3 hits / 0 misses; one-caption edit = 2 / 1; same-size corrupted cache clip = 2 / 1, rebuilding the damaged scene. A template change rebuilds all scenes. A separate smoke run rendered an actual v0.1.4 recording, confirming the fallback for missing result metadata.
- Edited playback sampled 251 real browser frames over a 7.3-second scene: removed wait skipped, extended hold frozen, invalid trims recovered, latest caption won competing updates, and a failed preview request could be retried. Camera action/result metadata, transition timing, fitting and manual overrides are checked. This does not prove better audience comprehension.
- Studio, Paper and Midnight exports fully decoded as MP4/GIF; MP4 output is 1280 × 900, H.264, 30 fps. Missing targets, capture cancellation, action mismatches and export cancellation failed explicitly without partial final output.
- UI checks covered widths 390, 768, 1280, 1366 and 1600, playback/keyboard seeking, focus return, long-caption keyboard access, fonts, downloads and no external design requests. Actual screenshots and output frames were reviewed.
- `npm run test:recovery`: `test-results/recovery-1793707880490/results.json`, all 13 conditions passed, including reload, process restart, disconnected draft retention, missing files and legacy draft migration. There were no page errors.
- The 354,297-byte production package installed into an isolated directory with production dependencies only. Its CLI reports 0.2.0, `doctor` reports ready, and `demo --port 4345 --output output/demo` produced real MP4/GIF files (`test-results/package-smoke-v020`). Chromium and FFmpeg were already installed as documented prerequisites.
- `npm run showcase`: `test-results/showcase-1793708650327`, a 31.467-second film of the actual Studio. Two real inner recordings retain the edited bilingual caption, selected frame and step IDs; both contain result positions. The final MP4 (904,214 bytes) and GIF (3,714,390 bytes), plus isolated-package outputs, fully decoded. Eight sampled final-film frames were inspected. Shortened waits are labeled **Edited pacing**.

A portable numeric receipt is committed at [evidence/editable-composition-v0.2.0.json](evidence/editable-composition-v0.2.0.json). Raw Windows screenshots, source takes and detailed logs remain under the ignored `test-results/` paths above. Public demo media is regenerated and checked by Linux release CI, so its bytes and timings can differ from the Windows receipt.

The synthetic workflow and targeted failure cases validate retained edits, caption completeness, scene preview/export agreement, content-addressed caching and recorded-result camera motion. They do not establish reliability across arbitrary websites or a productivity advantage over another product.

## Boundaries

- Immediate preview is for the selected scene. Whole-sequence playback uses the final export. Browser frame selection/scaling and encoded H.264 pixels can differ; review the actual final cut before publishing.
- Captions share a server-rendered raster between preview and export. Initial font initialization can be slower. System font availability and CJK shaping differ across platforms; restart Studio after installing a font. Text that cannot fit at 18 px is rejected explicitly.
- Result framing follows the visible rectangle observed for the explicit `waitFor` locator. It does not infer success, follow arbitrary moving elements or scroll an off-screen result into view. Older recordings fall back to action focus; capture again to get result positions.
- Cache reuse avoids scene encoding only. Hashing, joining and GIF generation still run. Cache entries are local private media, pruned after export attempts; a killed process can leave temporary files. Disk exhaustion, power loss and concurrent CLI processes sharing a data root are not fully certified.
- No new model, cloud service, GPU requirement or runtime dependency. Full accessibility, screen-reader, Firefox/Safari and low-memory/laptop audits remain outside these checks. No competitor, viewer-comprehension or general speed advantage is claimed.
