# Technology research: reliable capture and editable release videos

Checked **2026-11-03**, against DemoPilot **0.1.4**, commit `a8d6ace77095dad86e19703ca3e9074044dafbc1`.

**Recommendation:** retain Playwright, FFmpeg and the existing recipe/recording boundary. Extend deterministic capture evidence and result-aware framing first. Build a shared composition plan and immediate editing preview. Keep WebCodecs/Mediabunny as a bounded frame-access candidate, rather than replacing the export pipeline. The local experiments do not justify default GPU encoding or an AI browser agent.

This is research with isolated prototypes, not an implemented upgrade or a release. Production source and dependencies are unchanged. No model API was called. Package downloads and documentation lookup used the network; experimental pages and media stayed local.

## Baseline and actual gaps

The supported job is a developer recording an explicit browser workflow, editing its presentation and repeating it after an application update. The existing fingerprint and stable step IDs remain the basis of **record again, keep the edit**. We have not measured a productivity advantage over another product.

| Existing behavior | Consequence | First improvement to compare with newer technology |
| --- | --- | --- |
| Visible/unique locator checks, then Playwright's actual click auto-waits inside the recording | Disabled or covered controls can add waiting to a scene; visibility alone does not prove the intended result | Action-specific readiness before recording, explicit postconditions, failure evidence |
| A single target center is captured before the action | Zoom may follow the old button while the result appears elsewhere | Record target and result rectangles; allow a manual focus override |
| Zoom ramps linearly over 18 frames to a fixed point | Motion has limited control over acceleration, context and results | Deterministic eased paths with viewport bounds and a minimum readable context |
| Caption width is estimated from characters; only the first four wrapped lines are emitted | Allowed long Chinese captions can silently lose text | Actual font shaping/measurement, shared caption layout, overflow feedback |
| Preview shows a completed export; every export recomposes every scene | A caption edit waits for all scenes, concatenation and GIF | Immediate composition preview plus per-scene cache |

Relevant code: [capture](../src/server/capture.ts), [composition and caption layout](../src/server/render.ts), [editor](../src/client/App.tsx). These are observed implementation gaps, not shortcomings that require a new framework.

## Ranked candidates

### 1. Adopt newer Playwright observations, retain deterministic actions

Playwright 1.64.1 is already installed. The per-page screencast API arrived in 1.59; cursor options in 1.61, and configurable frame rate/action styling in 1.64. DemoPilot already uses these recording features, so they are not a proposed new upgrade. [Official screencast API](https://playwright.dev/docs/api/class-screencast), [release notes](https://playwright.dev/docs/release-notes).

The useful additional API is **`ariaSnapshotJSON({boxes:true, depth:…})`**, added in 1.63. It exposes semantic state and element rectangles together. In a local synthetic page we observed a button become disabled and a new result status appear, with their boxes. This is evidence that the API works in our pinned browser; it does not establish reliable result inference on arbitrary applications. [Official locator API](https://playwright.dev/docs/api/class-locator#locator-ariasnapshotjson).

Use a bounded relevant subtree before/after a step for diagnosis and suggested framing. Keep an explicit result locator/postcondition authoritative. Do not use ephemeral snapshot references as stable recipe IDs. Canvas-heavy sites, inaccessible widgets, irrelevant live regions and overlapping UI need fallbacks. For one known result element, the existing `boundingBox()` is simpler; the JSON snapshot earns its cost only when multiple semantic states or candidate regions matter.

Pair this with mature mechanisms: `click({trial:true})` checks click readiness without the click, while actual execution still performs its own checks. Other actions need their own readiness rules. Never retry a potentially successful mutation blindly. Capture a failure screenshot and small state record before cleanup; offer bounded, opt-in traces for harder failures. Traces can contain private page/network data. Concurrent tracing and screencast settings/performance require validation before enabling both. [Click API](https://playwright.dev/docs/api/class-locator#locator-click), [trace viewer](https://playwright.dev/docs/trace-viewer).

**Cost and fallback:** small capture/schema changes for evidence, medium work for a useful focus editor. No additional runtime package, model bill or cloud requirement. Keep ordinary locator checks and manual framing. Snapshot storage must be bounded. This would make captured state inspectable; recording success-rate improvement remains unmeasured.

### 2. Build immediate preview; evaluate WebCodecs/Mediabunny behind it

WebCodecs provides access to encoded/decoded media frames. Its current published specification is a **2 November 2026 Working Draft**, not a guarantee of codec or hardware availability. Probe the actual decoder configuration and retain a native-video fallback. [W3C specification](https://www.w3.org/TR/2026/WD-webcodecs-20261102/).

**Mediabunny 1.65.0**, published 30 October 2026, is the version installed in the isolated prototype. Its release page advertised 1.65.1, but npm returned `ETARGET` for that version during this investigation; the prototype uses the registry's available version. It supplies demuxing and timestamp-based frame access, avoiding a custom parser/decoder lifecycle. `CanvasSink` supports pooled canvases. It is not a timeline editor or automatic compositor. [Media sinks](https://mediabunny.dev/guide/media-sinks), [releases](https://github.com/Vanilagy/mediabunny/releases), [npm version](https://www.npmjs.com/package/mediabunny/v/1.65.0).

The baseline is **native video + `requestVideoFrameCallback` + Canvas 2D**, driven by the same edit plan as FFmpeg. Our short-file trial found similar high-percentile seek latency for this baseline and Mediabunny. Timestamp selection was more explicit with Mediabunny, but no long-file, integrated-editor or general speed advantage has been demonstrated.

First share timing, crop, caption placement and template parameters between preview/export. Then consider Mediabunny for exact thumbnail extraction, frame stepping and a bounded worker decode queue. Cancel superseded requests, close frames and limit cache memory. Keep FFmpeg for MP4/GIF exports. Do not assume moving all encoding into the browser improves responsiveness or reliability.

**Cost and fallback:** medium-to-large editor work, mostly the shared composition model rather than library installation. MPL-2.0 license; preserve notices and review distribution obligations. ES2021 and TypeScript 5.7+ fit this repository. The complete minified ESM bundle is 722,897 bytes before compression; this is not a measured tree-shaken application increment. Codec support, memory pressure and background-tab behavior vary. No required hosted service. Native playback and current FFmpeg remain the fallback. The optional Node server extension adds a native FFmpeg/NodeAV path; it is unnecessary for this first experiment. [Installation/license](https://mediabunny.dev/guide/installation), [codecs](https://mediabunny.dev/guide/supported-formats-and-codecs), [server extension](https://mediabunny.dev/guide/extensions/server).

### 3. Improve film quality through shared layout and framing

This is engineering work with the existing stack, not a claim of new underlying technology. It has a stronger connection to the current defects than adding generative effects.

- **Captions:** use real font shaping/metrics rather than character weights. Sharp already accepts text with a font file, width and word/character wrapping. Share the computed lines or caption raster between preview/export; browser Canvas and server font engines should not independently guess line breaks. Handle overflow explicitly rather than silently dropping content. Pin the chosen fonts and check CJK coverage/licensing. [Sharp text input](https://sharp.pixelplumbing.com/api-constructor/).
- **Camera:** build an eased path from action rectangle to explicit result rectangle, preserve enough context to understand the operation, and let the user correct the framing. This is a differential hypothesis against the current fixed-center zoom; no viewer study has proved clearer output yet.
- **Cache:** key scene renders by source content, timing/edit values, font assets, template/render version and encoder settings. One caption edit should invalidate one scene; global title/template changes may invalidate all. Final joining and GIF generation still take time. Keep the existing constant-frame-rate join until a replacement proves correct at scene boundaries.

No cloud bill or new heavy dependency is required. Changes affect composition, preview and cache management; recipe action identity and original source clips must remain intact. Cache storage/eviction, cancellation and stale-result rejection are part of the cost. Cross-platform text parity and preview/export parity need explicit testing.

### 4. Keep hardware encoding and 60 fps optional

NVIDIA's current Video Codec SDK is **13.1**. Recent AV1/zero-copy features are interesting, but the relevant baseline here is already available **FFmpeg `h264_nvenc` versus `libx264`**. This experiment did not integrate SDK 13.1 or prove its new features; swapping the encoder leaves CPU zoom, scaling, overlays and GIF work in place. [NVIDIA SDK and FFmpeg guidance](https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/index.html).

Our complete 11-second export measured a roughly 0.45-second median saving on an RTX 5090, with materially larger MP4 and GIF files under the trial settings. These settings were not quality-matched. Keep software encoding as default. Revisit an optional GPU setting only after a quality/size-matched comparison on representative long clips and less powerful machines. Detect the actual encoder/driver, fail clearly or retry the local encoding stage on CPU, and never repeat browser actions to recover an encoding failure. NVIDIA hardware/driver availability and redistribution terms remain separate from the project's MIT source.

60 fps capture did produce twice as many distinct decoded frames in a moving-box fixture, at 1.90 times the source file size. Current final composition is 30 fps, so changing capture alone would discard the extra temporal detail. A full 60 fps option requires timing, render, preview and output validation. Keep 30 fps for ordinary UI demonstrations. Neither perceptual smoothness nor resource overhead across real sites was measured.

### 5. Do not migrate to Remotion for this scope

Remotion **4.0.540** was published on 2 November 2026. Its browser renderer is stable from 4.0.491 and uses WebCodecs/Mediabunny. React-based compositions and Player could reduce work if DemoPilot grows complex animated templates. For three bounded templates, a new rendering stack is a substantial integration cost. Browser rendering supports a subset of HTML/CSS; it is not automatically identical to the normal DOM. [Client rendering](https://www.remotion.dev/docs/client-side-rendering), [limitations](https://www.remotion.dev/docs/client-side-rendering/limitations), [Player](https://www.remotion.dev/docs/player).

The current **`@remotion/web-renderer` sends telemetry on each completed or failed render even without a license key**. This conflicts with DemoPilot's existing no-telemetry promise. This statement concerns that renderer, not a claim that merely mounting Player always sends telemetry. Remotion also has license eligibility/commercial usage conditions; it is not an MIT replacement. Do not change the project's privacy or licensing commitments just to get preview. [Telemetry](https://www.remotion.dev/docs/telemetry), [license/pricing](https://www.remotion.dev/docs/license/pricing).

### 6. Defer AI action repair and WebMCP as core execution

**Stagehand 4.3.0**, published 20 October 2026, is a candidate for suggesting a replacement locator when a site changes. Its current v4 guidance favors reviewable generated scripts and separates observation from action. Managed action caching now depends on Browserbase infrastructure; v3's local cache options are not the current model. Do not assume an old v3 example is a current offline solution. [v4 migration](https://docs.stagehand.dev/v4/migrations/v3), [observation](https://docs.stagehand.dev/v4/basics/observe), [npm version](https://www.npmjs.com/package/@browserbasehq/stagehand/v/4.3.0).

If explored later: observe a failed locator, propose a bounded change, verify uniqueness and postconditions, and require review before changing the recipe. Never silently infer a different successful action or repeat a submission after an ambiguous error. Compare against a simple role/name/test-ID repair suggestion first. MIT package licensing does not remove model/hosted-service fees, network latency or page-data exposure. No paid model benchmark was run; reliability and per-repair cost are unknown. Keep manual locator correction available.

**WebMCP** is a 2 November 2026 draft Community Group report, explicitly not a W3C Standard or Standards Track specification. Playwright 1.64 exposes experimental support. Calling an application's business tool may bypass visible UI, which undermines a real product demonstration. A cooperating app could expose fixture reset/readiness, but an explicit local fixture API is a simpler baseline. It is not a reason to replace visible clicks. [WebMCP draft](https://webmachinelearning.github.io/webmcp/), [Playwright API](https://playwright.dev/docs/api/class-webmcp).

## Local experiments and evidence

Portable measurements, versions, source hashes and verification are in [technology-2026-11.json](evidence/technology-2026-11.json). Raw scripts, recordings, screenshots and JSON are retained locally under `test-results/tech-research-20261103/` and are ignored by Git. The portable summary is not a claim that a clean checkout includes those original source clips.

Machine: Windows kernel 10.0.26300, x64, Intel Core Ultra 9 285K, NVIDIA RTX 5090 / driver 610.88, Node 24.18.0, Playwright 1.64.1 / Chromium 156.0.8078.4, FFmpeg 8.1. Benchmarks ran serially. This is one powerful desktop, not a platform support or population study.

### Readiness: three pairs on a synthetic disabled button

Fixture: button becomes enabled after 1,500 ms; actual click updates a result and increments a counter. Compare visible+scroll checks against those checks plus `click({trial:true})` before capture. Both use the same real click and 450 ms recorded lead-in.

| Median | Current-style baseline | Added preflight |
| --- | ---: | ---: |
| Time awaiting the actual click inside capture | 1,377.84 ms | 25.88 ms |
| Preparation before capture | 42.89 ms | 1,934.51 ms |
| Capture start-return to stop-return interval | 2,373.24 ms | 1,018.91 ms |
| Successful runs / clicks per run | 3/3; one | 3/3; one |

This moves preparation waiting out of the clip; **it does not prove faster applications, shorter total execution or a higher success rate**. Logs must retain the omitted preparation time. Encoder padding makes media duration differ from the wall-clock interval. Do not use this editing choice to claim application performance.

### Frame access: 90 seeks per engine

Fixture: the same 4.733-second, 1280×800 VP9 source scene, drawn to 640×400; 30 predefined timestamps per round, three rounds with engine order alternated. Local HTTP supports byte ranges. Native timing waits for `requestVideoFrameCallback` and draws to Canvas; Mediabunny timing waits for `CanvasSink.getCanvas()` and draws to Canvas. Their presentation pipelines differ; this is not an isolated decoder-speed test.

| Round | Native p50 / p95 | Mediabunny p50 / p95 |
| --- | ---: | ---: |
| 1 | 44.2 / 55.7 ms | 37.2 / 60.2 ms |
| 2 | 46.3 / 69.6 ms | 39.1 / 62.0 ms |
| 3 | 48.0 / 62.9 ms | 40.8 / 68.7 ms |

Native presented-frame timestamps differed from requested times by up to 33 ms; Mediabunny returned the requested on-grid timestamps in this fixture. The final screenshot shows the expected open form in both surfaces. This is not a frame-by-frame pixel equivalence check. Cold loads, long GOPs, long clips, memory limits, integrated editing and other browsers remain untested. No clear p95 advantage justifies adoption for speed alone.

An initial pilot lacked range support and only waited for `seeked`; the screenshot exposed a stale frame. Its misleading sub-millisecond native results are **excluded**, retained as `seek-results.json` for audit. Reported data comes only from `seek-results-validated.json`.

### Full export: three alternating pairs

Input: the actual three-step synthetic Littleboard capture from the v0.1.4 core E2E. Output is 10.966667 seconds at 1280×900/30 fps plus the README GIF. Baseline is unchanged rendering. The isolated variant replaces x264 fast/CRF 20 with NVENC p4/VBR/CQ 20 in scene and join encoding; CPU filters, GIF, poster and all other work remain.

| Measurement | x264 | NVENC |
| --- | ---: | ---: |
| Full export times | 3.816, 3.755, 3.744 s | 3.314, 3.302, 3.295 s |
| Median | 3.755 s | 3.302 s |
| MP4 bytes, each trial | 226,913 | 481,074 |
| GIF bytes, each trial | 1,215,248 | 1,864,011 |

The median difference is 0.453 seconds, about 12.1% for **this workload/settings**. MP4 is 2.12× and GIF 1.53× the size. CQ 20 and CRF 20 do not establish equal quality. The first MP4/GIF from each encoder fully decodes; representative 5.5-second MP4 frames were opened and captions/forms are legible. This limited review does not prove perceptual equivalence or superiority. No broad GPU speed claim follows.

### Caption, semantic-state and frame-rate probes

- The current pure caption wrapper turns 160 Chinese characters into five lines. `makeFrame` keeps four, leaving 128 characters. This reproduces the layout/data-loss path; it is not a fix. Repair is higher priority than a codec migration.
- One before/after semantic snapshot correctly includes the changed button state and new result rectangle. Calls took 15.13/2.49 ms on the tiny fixture; these are observations, not page-wide latency expectations.
- Two synthetic motion captures each produce 3.4 seconds of media. At 30/60 fps, FFmpeg reports 102/204 distinct decoded frame hashes and 98,537/187,687 bytes respectively. One clip per setting cannot establish perceptual quality or sustained resource use.

## Bounded implementation sequence and acceptance

These are proposed next-work gates, not achieved outcomes or an approved architectural migration.

1. **Correctness and diagnosis:** fix silent caption loss; add action-specific readiness, explicit result checks and bounded failure evidence. Re-record asynchronous, disabled, covered, duplicate-label, missing-result and cancelled fixtures three times each. Require no false success or duplicate mutation, actionable failure output, and unchanged edit-to-step mapping. Check tracing/screencast interaction separately.
2. **Editing feedback:** share a versioned composition plan. Start with native video/Canvas and shared caption layout; add Mediabunny only if frame stepping or thumbnail workloads demonstrate a benefit. On the named desktop, target p95 under 100 ms for caption/crop preview and short-file scrubbing, then repeat on a non-discrete-GPU laptop. Verify selected timestamps, scene boundaries, cancellation, bilingual long captions and preview/export geometry. These are future targets, not results of the standalone seek trial.
3. **Clear framing and incremental export:** compare fixed-target versus target-to-result framing on modal, dropdown, scroll and validation-error examples. Review whether both action and result remain understandable; retain manual correction. Prove one caption change reuses unaffected scene files, produces valid final media and never mutates original footage. Measure end-to-end cost including joining/GIF, not just cache hits.
4. **Only then optional acceleration:** compare quality/size-matched CPU/GPU outputs on short and longer flows. Test unavailable hardware and CPU fallback. Evaluate 60 fps as a complete output preset only when motion requires it.

The distinctive deliverable remains **the same real workflow can be recorded again, its edit retained, and the resulting film understood**. New snapshots and frame APIs may help; this research supplies bounded evidence and adoption gates, not a claim of novelty, market leadership or proven user preference.
