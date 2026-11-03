# DemoPilot v0.1.4

Studio has a new bright release-workbench composition: the project title spans the top, the selected scene sits beside a cobalt viewing surface, and a horizontal sequence connects the executable steps to their footage.

- Bricolage Grotesque titles and DM Sans controls establish separate type roles. Both are self-hosted, licensed under SIL OFL, and add 194,272 bytes of font data; no font-service requests.
- Captions remain directly editable in **Script**. **Action & target**, **Timing & zoom** and **Frame & export** retain the existing controls and keyboard behavior.
- Source playback fits its actual captured viewport ratio. The rendered MP4 remains the exact downloadable final cut.
- Long Chinese titles expand in narrow windows. Existing recipes, source footage and saved drafts remain compatible.

[Composition, actual reference observations and boundaries](https://github.com/Ray0766/demopilot/blob/main/docs/UI-COMPOSITION.md) · [Validation and limits](https://github.com/Ray0766/demopilot/blob/main/docs/VALIDATION-v0.1.4.md)

The attached showcase records real editing, export, playback and a second take with retained captions and frame choice. The package is distributed through GitHub Releases. Install its `.tgz` with npm, install Chromium and provide FFmpeg/ffprobe on PATH; `demopilot doctor` checks prerequisites.

The capture scope remains explicit steps in one Chromium tab, without audio or personal login-session reuse. Design preference, productivity improvement and full accessibility compliance have not been established.
