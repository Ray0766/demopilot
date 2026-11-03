# Recipes, capture and exports

## Recipe reference

JSON recipes are versioned (`version: 1`). Unknown keys are ignored; invalid values are rejected before recording. Defaults are applied at import.

| Field | Default | Meaning |
| --- | --- | --- |
| `title` | required | 1–80 characters, printed in the frame |
| `url` | required | http(s), no embedded username/password |
| `viewport` | `{"width":1280,"height":800}` | Width 640–1920, height 480–1080 |
| `template` | `studio` | `studio`, `paper`, `midnight` |
| `trimWaiting` | `true` | Cut the middle of explicit post-action result waits longer than 1.2 seconds |
| `timeoutMs` | `15000` | Per-action/navigation timeout, 1000–60000 |
| `steps` | required | 1–40 steps with unique stable IDs |

| Step field | Default | Meaning |
| --- | --- | --- |
| `id` | required | 1–64 letters, digits, `_`, `-`; stable across recordings |
| `action` | required | See actions below |
| `target` | empty | Semantic target or Playwright CSS selector |
| `value` | empty | Fill text, keyboard key, scroll delta, URL or select value |
| `waitFor` | empty | Target that must become visible after the action |
| `caption` | empty | Up to 160 characters; wrapping supports CJK with installed fonts |
| `holdMs` | `1800` | Result hold 500–8000 ms; footage retains 2 seconds after readiness, longer holds repeat the final frame |
| `zoom` | `1` | 1–1.8× smooth push-in centered on the target, clamped to frame bounds |
| `trimStart`, `trimEnd` | `0` | Seconds removed from the composed scene; must leave at least 0.3 s |

Actions:

- `click`, `hover`: require a target. Playwright checks readiness; ambiguous targets fail.
- `fill`: target plus value. Uses Playwright fill (not simulated human typing). Password inputs are rejected.
- `press`: target plus key, such as `Enter`, `Control+A` or `Meta+A`.
- `select`: target plus an HTML `<select>` option value.
- `scroll`: value is vertical pixels from -5000 to 5000. No target needed.
- `navigate`: value is a full http(s) URL in the same tab. No target needed.
- `wait`: waits for a visible target before its scene begins. It does not assert business success by itself.

Target forms:

```text
role:button:New project
role:link:Settings
label:Project name
text:Project created
testid:save-button
#save
button[data-action="save"]
```

Role, label and text matching is exact. Add a `waitFor` condition that demonstrates the expected result. Visibility is the supported condition; regex, arbitrary JavaScript assertions and iframe targeting are not part of the recipe format. Accessible names containing a colon are supported (`role:button:Save: draft`). Prefer stable accessible labels or test IDs over CSS position selectors.

## What happens during recording

1. Launch fresh Chromium with fixed viewport, light mode, English locale and UTC timezone.
2. Load the app and briefly wait for fonts. For each step, wait for the unique target and scroll it into view.
3. Record the real page at 30 fps with Playwright's cursor and action emphasis. Perform the action and await the optional visible result.
4. Capture two seconds of the result, a poster and timing/focus metadata. Keep the source WebM and recipe together.
5. If any step fails, report its ID and remove the unfinished recording. There are no automatic click retries that might duplicate an external action.

The recorder uses Playwright's actionability waiting. It does not force-click, invent a successful result, reuse personal sessions or disable TLS verification. The target site remains live and may have side effects. Operate only authorized apps with synthetic/shareable data.

## Editing without replay

In Studio, select a step or a scene thumbnail. Edit the caption directly in the **Script**. Open **Action & target** to change the browser operation, or **Timing & zoom** for focus zoom, result hold and start/end trims. **Frame & export** contains the three templates and automatic wait trimming. The top toolbar records or exports; completed downloads remain below the footage. Narrow windows place the footage below the script.

Each recording has an action fingerprint: URL, viewport and the ordered step IDs/actions/targets/values/result conditions. Those must match for rendering. Caption, zoom, trim, title, template, timeout and hold changes preserve identity. Changing a workflow requires **Record again**.

Source clips include result waiting. Automatic trimming retains the action plus 350 ms, cuts the middle of a sufficiently long wait, and retains 250 ms before the result and its hold. Capture target preparation is always outside the clips and is recorded as `preWaitMs`. Automatic cut time is reported in `export.json` as `trimmedSeconds` (includes preparation); manual trims remain in the saved recipe. Labels disclose edited pacing; use source material for timing analysis.

FFmpeg composes each scene, joins the clips, normalizes to constant 30 fps, and creates the GIF from that final MP4. The player's final cut is the actual downloaded file. There is no live approximation of an unrendered edit. A new export gets a new directory; prior source material stays intact.

## Resume an editing session

Studio saves each recording's editable recipe and last export ID in browser storage. Reloading the page or restarting Studio at the same address restores the current draft and footage. Switching **Previous recordings** restores that take's edits, rather than resetting captions to the recipe captured with it. Unexported edits remain pending; restored downloads still refer to the last actual export.

If an export was removed, the draft stays available for another export. If source footage was removed, record again; Studio does not silently substitute another take. A draft from v0.1.0 can reconnect to the latest recording with matching actions. Saved drafts can contain incomplete text edits, but recording and exporting still require a valid recipe.

This recovery uses the same browser profile and exact Studio address (including port). Clearing browser storage removes drafts, so use **Save recipe** for a portable backup. Source media and completed exports remain on disk. Running jobs and undo history are not resumed after a reload.

## CLI commands

Use `node dist/server/cli.js` from a source checkout. A release package installed via `npm install -g ./ray0766-demopilot-0.1.3.tgz` also exposes `demopilot`.

```text
demopilot studio [--port 4310]
demopilot init [--output demo.recipe.json]
demopilot record <recipe.json> [--output output/my-demo]
demopilot render <recording-id> <recipe.json> [--output output/revised]
demopilot demo [--port 4311] [--output output/demo]
demopilot doctor
```

Run commands in the directory where you want `.demopilot/` to live. `init` refuses to overwrite existing recipes. `--output` copies the four final artifacts (`demo.mp4`, `demo.gif`, `poster.png`, `export.json`); files with those names in that destination are replaced. Studio listens only on `127.0.0.1`; it is not a server to expose to the internet.

Ctrl+C cancels a CLI recording/render and removes its partial data. The Studio **Cancel** button does the same for a job. A process crash or forced OS termination can leave temporary directories without metadata; close Studio before deleting them. Successful source material is retained until you remove it.

## Troubleshooting

- **Chromium missing:** run `npx playwright install chromium` in the checkout with the same user that runs Studio. Linux may need `npx playwright install --with-deps chromium`.
- **FFmpeg/ffprobe not found:** install both on PATH, reopen the terminal, and run `npm run doctor`. Or set `FFMPEG_PATH` and `FFPROBE_PATH` to the executable paths.
- **Address already in use:** `npm start -- --port 4315` or stop the other instance. The example URL follows the chosen port.
- **Target missing or ambiguous:** inspect the accessible label/test ID in your app. The exact failed step ID is reported. Don't increase a timeout to hide an incorrect selector.
- **Async result is missing from the video:** add `waitFor` to the action. Generic network-idle waits are deliberately not used, since many apps keep long-lived requests open.
- **Cannot export after an edit:** a URL, viewport or action changed. Record again, or undo that change. Presentation changes do not need a new capture.
- **CJK glyphs missing:** install an appropriate system font, such as Noto Sans CJK, then render again. System font rasterization varies by OS.
- **Unsupported browser/media:** try current Chromium/Chrome/Edge. Download the MP4 to verify it in a media player. Some embedded app browsers cannot stream localhost media.
- **Long GIF:** GIF contains only the first 30 s at 800 px / 12 fps. Use MP4 for longer flows. No audio is captured or exported.
- **Disk full or encoder error:** the job fails and cleanup is attempted; clear space and retry. Do not delete source folders while a render is running. Abrupt power loss and actual disk-full recovery are not certified.
- **Source and edited durations differ:** source recording includes waiting and encoder tail frames; exported result holds and trims are editorial choices. The final duration is not an app performance measurement.
