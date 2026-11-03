# DemoPilot v0.1.3

Studio now puts an editable script beside the footage. Captions form the main text of each scene; browser selectors and timing controls unfold where they are needed. The permanent right inspector and second toolbar are gone.

- Continuous surfaces, larger script typography and an asymmetric composition replace the previous property-panel layout.
- **Action & target** edits executable steps. **Timing & zoom** controls hold, crop timing and emphasis. Both work with the keyboard.
- **Frame & export** shares the script area; completed downloads stay beneath the footage. A compact captured-scene strip leaves more room for video in short windows.
- The synthetic sample uses a project list with concrete project names. Existing recipes, source footage and saved drafts remain compatible.
- No new dependency, remote font, model call or upload.

[Design references and tradeoffs](https://github.com/Ray0766/demopilot/blob/main/docs/UI-ART-DIRECTION.md) · [Validation and limits](https://github.com/Ray0766/demopilot/blob/main/docs/VALIDATION-v0.1.3.md)

The attached showcase is a real recording of recording, editing, exporting, playback and a second take with retained edits. The package is a GitHub release asset, not an npm registry publication. Install the `.tgz` with npm, install Chromium and make FFmpeg/ffprobe available on PATH; `demopilot doctor` checks prerequisites.

Still explicit steps, one Chromium tab and no audio or personal login-session reuse. Usability preference and full accessibility compliance have not been established.
