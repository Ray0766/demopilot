# Changelog

## 0.1.1 — 2026-11-03

- Fix draft recovery after reload: keep the recording association, unexported edits and the last completed export.
- Keep independent editing drafts when switching recordings; retain edits when recording another take.
- Preserve incomplete text edits and migrate v0.1.0 drafts. Missing exports/recordings and failed connections do not silently discard edits or substitute footage.
- Add real-browser regression coverage for reloads, process restart, switching takes and missing media.

## 0.1.0 — 2026-11-03

First runnable release of DemoPilot.

- Local Studio and CLI share a real Chromium recording and FFmpeg rendering pipeline.
- Versioned JSON recipes with stable scene IDs, exact semantic targets, explicit result waits and action fingerprints.
- Editable captions, target focus, result holds, first/last trims and three visual styles.
- Constant 30 fps H.264 MP4 and 800 px / 12 fps GIF export; GIF limited to the first 30 seconds.
- Honest wait trimming, progress/cancellation, failure cleanup, recipe import/export and previous recording selection.
- Synthetic sample, English/Chinese guides, automated repeatability and browser/export tests.

Scope: one browser tab, no audio/login automation, no model API or telemetry. Manual workflow/competitor productivity comparison is not yet measured.
