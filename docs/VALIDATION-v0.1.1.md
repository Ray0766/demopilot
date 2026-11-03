# v0.1.1 editing recovery validation

The concrete regression: after a real recording, caption edit and export, refreshing Studio left the recording selector empty. The draft recipe survived, but reopening the recording replaced it with the capture-time recipe. Reproduced before the fix with an assertion failure on the recording ID.

## Scope

The existing local Studio, media format and rendering architecture remain intact. A versioned browser workspace associates each draft with a recording and the ID of its last completed export. Source media is not rewritten. Export metadata is loaded from disk and checked against the selected recording. This is a recovery fix, not a new collaboration or cloud storage system.

## Verification

`npm run test:recovery` uses real Chromium, two captures and real MP4/GIF exports against an isolated synthetic app. It checks:

- Reload keeps an unexported CJK caption, trim, hold, recording ID and previous export; edits remain pending.
- A second recording retains the current recipe; switching takes restores each one's independent draft.
- Rerendering uses the first take's source without recording again; all source WebM SHA-256 hashes remain unchanged.
- Stopping and restarting Studio restores disk media associations and the browser draft.
- Failed bootstrap requests do not overwrite the saved workspace.
- An incomplete target survives reload and cannot be exported against mismatched footage.
- Missing exports allow rebuilding; missing recordings require recapture. Repeated reloads do not silently substitute another matching take.
- v0.1.0 drafts migrate and retain their captions. Browser page errors must be empty.

Unit tests also cover corrupted/unavailable browser storage, legacy fallback, incomplete text edits and write failure propagation. Screenshots and machine-readable results are saved under `test-results/recovery-*`; these directories are local and ignored by Git. GitHub CI uploads the same evidence for Node 22 and 24.

Executed on Windows x64 / Node 24.18.0 on 2026-11-03: type checks, 7 behavior tests, build, full core E2E and the recovery suite all passed. Recovery evidence: `test-results/recovery-1793685920004/results.json`; core E2E: `test-results/e2e-1793685920946/results.json`. Recovery screenshots and the exported CJK-caption poster were inspected. No browser page errors; source hashes unchanged. The screenshot capture now waits for the final video to load before saving the export view.

Linux CI and GitHub release verification follow the publication workflow; consult the actual run and release rather than assuming success from these Windows results.

## Boundaries

Drafts are stored per browser profile and exact Studio origin, including port. Clearing storage removes drafts; downloading the recipe remains the portable backup. Running jobs and undo history are not resumed. Browser storage can fill up, in which case Studio asks the user to download the recipe. No concurrent multi-tab editing or cross-browser synchronization is promised. Broader recording limits remain in [v0.1.0 validation](VALIDATION.md#limits-still-unverified).
