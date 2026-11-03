DemoPilot is now a runnable local recording and editing studio. Give it a website and explicit steps; get real Chromium footage, an editable final cut, and MP4/GIF exports.

### Record again, keep the edit

- Stable step IDs link recipes, footage, captions and focus. Presentation edits render from saved clips without visiting the website again.
- Cursor emphasis, bounded smooth zooms, result holds and start/end trims; Studio, Paper and Midnight templates.
- MP4 at 1280 × 900 / 30 fps, GIF at 800 px / 12 fps (first 30 seconds).
- Local Studio, CLI, synthetic sample, recipe import/export, previous recordings and cancellation.
- Source is MIT licensed. No account, model API, telemetry or cloud upload.

### Install

Use the [README source instructions](https://github.com/Ray0766/demopilot#try-it), or download the package asset:

```bash
npm install -g ./ray0766-demopilot-0.1.0.tgz
npx --yes --package=playwright@1.64.1 playwright install chromium
demopilot doctor
demopilot studio
```

Node.js 22+, FFmpeg with libx264, and ffprobe must be installed. Open http://127.0.0.1:4310 and click **Record demo** to try the synthetic sample.

The attached showcase is DemoPilot recording its own record/edit/export workflow. The GIF is an actual sample export. Generated release media may differ slightly in duration/font rasterization across operating systems.

### Verified and bounded

Three consecutive recordings without retries, unchanged source hashes after offline re-editing, slow-result waiting, missing targets, cancellation, three template exports, complete MP4/GIF decode, browser playback/download and responsive Studio layouts. See [validation evidence](https://github.com/Ray0766/demopilot/blob/main/docs/VALIDATION.md) and the [CI run](https://github.com/Ray0766/demopilot/actions/workflows/ci.yml).

This first release records one Chromium tab without audio or personal login sessions. No automatic secret redaction, iframe workflow, multi-tab recording or natural-language planning. The final cut uses edited pacing and is not a performance benchmark. macOS, actual disk exhaustion, forced OS crashes and manual productivity comparisons remain unverified.
