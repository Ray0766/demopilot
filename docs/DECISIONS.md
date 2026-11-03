# Decisions and evidence

Checked 2026-11-03. This is a local browser recording tool for developers preparing a release, not a hosted browser service.

## Scope and differentiator

The core demonstration is **record again, keep the edit**: stable step IDs connect a JSON workflow to captured scenes, captions, focus, holds and trims. Source clips remain unchanged. Editing presentation rerenders the existing footage; changing actions, URL or viewport requires a new recording. The source recipe fingerprint prevents silently pairing new instructions with old footage.

This is a differentiation hypothesis until compared with another tool on the same task. We do not claim novelty, market leadership or a measured productivity gain. [PR Preview](https://github.com/QwertyBit-Ventures/pr-preview) already provides reusable browser journeys and PR comparison videos. Our scope is release presentation and editing rather than before/after code review. [Screen Studio](https://screen.studio/) is the manual recording/polishing baseline.

## Technical choices

| Choice | Current primary source | Benefit and tradeoff |
| --- | --- | --- |
| Playwright 1.64.1 + Chromium | [Release notes](https://playwright.dev/docs/release-notes), [screencast API](https://playwright.dev/docs/api/class-screencast), [locators](https://playwright.dev/docs/locators) | Official per-page start/stop recording, 30 fps and styled action overlays replace custom CDP frame collection and cursor injection. Per-scene files avoid approximate offsets into a whole-session recording. Chromium is a sizable download; fresh sessions cannot reuse an interactive login. |
| FFmpeg + ffprobe external executables | [Filters](https://ffmpeg.org/ffmpeg-filters.html), [legal](https://ffmpeg.org/legal.html) | Mature H.264/GIF encoders, palette generation, cropping and explicit timelines. No paid rendering service or model dependency. CPU rendering and a separate system installation are costs. DemoPilot does not redistribute FFmpeg; its build/license remains separate from MIT source. |
| Sharp 0.35.5 for frames | [SVG input](https://sharp.pixelplumbing.com/api-constructor/) | A single deterministic composition produces both previewed MP4 and downloadable MP4. SVG text is escaped; captions are outside the captured viewport. Local fonts affect glyphs; CJK requires an appropriate system font. |
| Remotion evaluated, not adopted | [License and pricing](https://www.remotion.dev/docs/license/pricing) | Powerful composition and interactive timelines, but adds a rendering stack and license eligibility/usage considerations. FFmpeg covers the bounded v0.1 feature set. Not treating Remotion as MIT. |
| Local Express + React/Vite | [Express](https://expressjs.com/), [Vite](https://vite.dev/) | Localhost access is central to the task. Cloud hosting cannot reach a user's local app. Loopback binding, Host/Origin checks and a session mutation token keep the local recording API off the network. No analytics or paid APIs. |

Versions are recorded in package-lock.json. Hardware and actual timings belong in VALIDATION.md after execution, not in marketing claims. Native screencast is newer than whole-context video: core regression coverage is retained in CI.

## Design references actually viewed

The official Remotion screenshot and Screen Studio's live homepage demonstration were opened in a browser on 2026-11-03. Products were not purchased or exhaustively tested. No third-party assets are copied into DemoPilot.

| Reference | Observed method | Translation | Boundary |
| --- | --- | --- | --- |
| [Remotion Studio screenshot](https://www.remotion.dev/docs/your-first-video) | Large preview above labeled clips, a playhead relating time to material; captions readable in the video | A small story strip maps each clip to its original step, and explicit “Recorded scene” / “Final cut” views distinguish source from export | No multi-track editing, audio mixing or claim of feature parity |
| [Screen Studio](https://screen.studio/) | App window surrounded by controlled space; an emphasized pointer and a crop make small controls visible | Three restrained frames; bounded target-centered push-ins; captions outside the website so controls are unobstructed | No webcam, audio, desktop capture or copied purple branding; observed demo quality is not a benchmark |

Compared outline-driven and timeline-driven layouts. Chose outline-driven: a developer can change a selector or caption in the same step, without learning a video editor. Timeline supports selection; the final export is the exact preview. This costs a render to inspect a changed cut; no false real-time preview is shown.

## Initial v0.1.0 design tokens and review

- Colors: slate `#242b3a`, ink `#293348`, canvas `#f4f5f8`, white `#ffffff`, periwinkle `#4f63d8`, sage status `#88b5a8`.
- Type: system Segoe UI Variable / Segoe UI, platform sans, Noto Sans and Microsoft YaHei fallback. 20–24 px identity/headlines, 12–14 px editing controls, secondary metadata at 10–11 px. No external font requests.
- Layout: left workflow, central footage + scene strip + editorial controls, narrow finishing panel. Narrow screens stack these in the same task order.
- Distinctive element: the repeatable step list stays next to the resulting footage. Surrounding UI stays quiet. No unrelated metrics or landing-page card wall.
- Motion: only recording progress and user-triggered video; reduced motion disables CSS transitions/spinners.

Review against the brief removed a generic marketing hero and decorative gradients. The initial sample is an actual synthetic webpage, clearly labeled as a preview, not a pre-generated successful export.

## v0.1.2 design revision

The first UI still overused panel headlines, borders and promotional copy. The user's review prompted a canvas-led layout with a contextual scene inspector, literal sample captions and restrained action hierarchy. See [the reference analysis, alternatives, current tokens and boundaries](UI-DESIGN.md). This supersedes the initial layout/tokens above and keeps the capture/render/recovery architecture.

## v0.1.3 art direction

The user also rejected v0.1.2's boxed property-editor composition. [Script and screening room](UI-ART-DIRECTION.md) supersedes that layout: inline captions, contextual native disclosures and a single footage area. The document records actual Things/Craft page observations, two alternatives, tokens, technical reasons and limits. The backend and pinned dependencies are retained. No improvement in task time or user preference is claimed.

## v0.1.4 composition and typography

The user explicitly chose a bright branded workbench after rejecting the previous composition and type hierarchy. [Release workbench](UI-COMPOSITION.md) records the two alternatives, actual Framer/Frame.io/Tella observations, asymmetric scene/footage layout and horizontal sequence. Bricolage Grotesque and DM Sans are self-hosted OFL assets (Fontsource variable packages 5.3.0; exact hashes and licenses in public/fonts). Their 194,272 bytes buy consistent Latin typography across machines; system CJK and renderer fonts remain unchanged. Existing capture, recovery and rendering architecture is retained. Preference and productivity gains remain unverified.
