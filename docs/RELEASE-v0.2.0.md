# DemoPilot v0.2.0

Edit the selected scene before exporting: captions, holds, trims, templates and camera focus now appear in **Edit preview**. The same caption/frame PNG and composition plan drive the preview and FFmpeg export.

- Long Chinese captions no longer lose their final lines. Actual font shaping fits text at a readable size; excessive line breaks produce an actionable error.
- Scene caching reuses unchanged clips. A one-caption change rebuilds that scene, with content hashes detecting damaged cache entries. Final joining and GIF generation still run.
- **Action → result** framing eases toward the explicitly recorded `waitFor` result, adapting to its size and edited timing. Action-target and page-center overrides remain available.
- Existing recipes, drafts and source recordings remain usable. Older takes without result rectangles keep action focus; record again to capture result framing.
- The bright workbench, local processing and existing Playwright/Sharp/FFmpeg stack are retained. No new runtime dependency, model API, account, telemetry or cloud rendering.

Edit preview covers the selected scene, while **Final cut** plays the actual whole exported MP4. Native browser frame selection/scaling can differ slightly from encoded pixels. Result framing uses a recorded rectangle, not continuous object tracking. System CJK fonts are still required.

[Usage and cache behavior](https://github.com/Ray0766/demopilot/blob/main/docs/USAGE.md) · [Validation and limits](https://github.com/Ray0766/demopilot/blob/main/docs/VALIDATION-v0.2.0.md)

Install the attached package with npm, install Chromium and supply FFmpeg/ffprobe on PATH. The package is distributed through GitHub Releases, not the npm registry.
