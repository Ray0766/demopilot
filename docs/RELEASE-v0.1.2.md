# DemoPilot v0.1.2

Studio now gives the footage a dedicated canvas, keeps executable steps on the left and puts caption, zoom, hold and trim controls in a contextual Scene inspector. Frame and export settings have a separate view. Recording and export actions stay in the top toolbar; completed downloads remain available in both inspector views.

- Reduced competing borders, promotional headings and decorative color. Sample captions describe the actual actions and result.
- Fit preview and scene strip to short desktop windows; stack editing below the canvas on narrow screens.
- Fixed keyboard focus return from Help and made each template row a full click target.
- Moved playback and seek controls outside the video so paused previews keep captions readable; templates use native radio controls.
- Kept existing recipes, source footage, export pipeline and saved-draft recovery compatible. No new runtime dependency or external font request.

See [the actual reference analysis](https://github.com/Ray0766/demopilot/blob/main/docs/UI-DESIGN.md) and [validation](https://github.com/Ray0766/demopilot/blob/main/docs/VALIDATION-v0.1.2.md). The attached showcase is a real DemoPilot recording of its own record/edit/frame/export flow using synthetic data.

The package is a GitHub release asset, not an npm registry publication. Install the `.tgz` with npm, install Chromium with `npx playwright install chromium`, and make FFmpeg/ffprobe available on PATH. `demopilot doctor` checks prerequisites.

Still one Chromium tab, explicit steps, no audio or login-session reuse. There is no user-study evidence yet that the revised layout is faster or preferred, and no full accessibility compliance claim.
