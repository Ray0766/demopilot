This patch fixes an editing recovery bug: refreshing Studio used to lose the recording association, and reopening a take replaced edited captions with the original capture recipe.

- Reload or restart Studio at the same address to restore the selected recording, draft and last completed export.
- Switch recordings without overwriting each take's captions, trims, holds or style.
- Keep unexported changes visibly pending; restore downloads from the actual previous export.
- Missing media and connection failures retain the draft and explain how to recover. Another take is never silently used for a missing recording.
- Migrate the browser draft saved by v0.1.0 and retain incomplete text edits. Recording/export validation remains strict.

Download the package and install with `npm install -g ./ray0766-demopilot-0.1.1.tgz`, or follow the [source instructions](https://github.com/Ray0766/demopilot#try-it). Requirements remain Node.js 22+, Chromium, FFmpeg with libx264 and ffprobe. Run `demopilot doctor`, then `demopilot studio`.

Draft recovery uses the same browser profile and Studio address/port. Download recipes before clearing browser storage. Running jobs and undo history are not resumed. No new accounts, cloud service or model dependency.

See [recovery validation](https://github.com/Ray0766/demopilot/blob/main/docs/VALIDATION-v0.1.1.md) and [CI](https://github.com/Ray0766/demopilot/actions/workflows/ci.yml). The attached videos are generated from real synthetic sample workflows.
