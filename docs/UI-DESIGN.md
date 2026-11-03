# Studio design review — v0.1.2

Reviewed on 2026-11-03. The task is to record and revise a short browser demonstration. The preview, its source steps and the selected scene should explain the product; the interface does not need a second layer of promotional copy.

## What the earlier UI got wrong

The first version gave almost every region a headline, a border and blue-purple emphasis. Caption cards duplicated the scene strip while selectors lived further down the page. Editing controls below the preview made the page taller than a typical laptop viewport. Template descriptions such as “After-hours premiere” did not explain the output. These are design judgments based on the running interface, not user-study findings.

## References and the parts actually inspected

Public pages were opened in a browser. Research captures stay in ignored `test-results/design-research`; third-party screenshots, fonts and artwork are not redistributed. “Paper” was interpreted as the Paper design tool. No paid products were purchased or fully tested.

| Reference | Observed method | Adaptation in DemoPilot | Boundary |
| --- | --- | --- | --- |
| [Paper](https://paper.design/) | The homepage's actual editor demonstration separates compact tool rails from the large central canvas. Neutral chrome lets the designed object carry most of the color. | A neutral canvas holds the real video; a narrow action list and a contextual inspector surround it. | DemoPilot is a linear recording workflow, not an infinite canvas or design application. No Paper assets or layout code were copied. |
| [ChatGPT overview](https://chatgpt.com/overview/) | The page contrasts a large marketing headline with a much quieter product screenshot: restrained navigation, a dominant content region and limited primary emphasis. | Borrow the product screenshot's hierarchy: one dark primary action, secondary file operations and little ornamental labeling. | The marketing headline scale and chat composer are inappropriate for a video editing workspace. |
| [Gemini](https://gemini.google.com/) | The observed home interface keeps a slim navigation rail and a single obvious input. Secondary tools are less prominent. | Scene editing is the default inspector. Frame and export settings are available in a separate view instead of competing with every caption. | DemoPilot needs explicit selectors and traceable steps; a single prompt box would misrepresent its capabilities. No account or conversation content was used. |
| [Claude](https://claude.com/) | The observed public entry page pairs strong typography with a single image and a clearly grouped entry action. Large differences in emphasis matter more than many outlined boxes. | Use literal headings and a clear action hierarchy. Leave whitespace between different editing tasks instead of enclosing every task in a card. | Its editorial serif treatment, photography and brand colors belong to a different purpose. They are not a theme to reskin this tool with. |
| [Moonlitt App Store screenshots](https://apps.apple.com/us/app/moonlitt-moon-phase-tracker/id6444718902) | The product screenshots place the moon/path visualization at the center, with compact controls around it. The calendar is a separate task view. | Keep footage central; move scene edits and frame choices into separate inspector views. | A phone astronomy app is not a desktop editor. Its dark sky, glass and motion are not adopted. Screenshot review is not a hands-on usability evaluation. |

Apple identifies **Moonlitt as the 2026 Interaction winner** in the [official award announcement](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/). **Play is the 2025 Innovation winner**, verified on [Apple's 2025 page](https://developer.apple.com/design/awards/2025/). Play's website did not resolve and its linked App Store page was unavailable during this review; we do not claim to have visually evaluated Play. Awards establish recognition, not suitability or measured superiority for DemoPilot.

## Direction chosen

Two plausible directions were compared:

```text
A. Canvas-led workspace (chosen)
   project / file actions                       record / export
   workflow steps       footage                 scene | frame
   action details       scene strip             selected controls

B. Timeline-led dark editor
   source / tools       footage                 properties
   multi-track-style timeline across the window
```

A preserves the user's mental model of a repeatable recipe. B offers more space for long timelines, but implies editing capabilities outside this small tool's scope and gives a three-step demo unnecessary machinery. The change is limited to React markup, CSS, sample wording and the showcase recipe. Capture, rendering, recipe format and saved-workspace recovery stay on the existing architecture.

The cost is one additional **Frame & export** click to select a template. The expected benefit is less simultaneous control clutter and scene editing beside the footage. This is a design hypothesis; no comparative user study or task-time improvement is claimed.

## Tokens and behavior

- Native system sans: Segoe UI Variable / Segoe UI, platform sans, Noto Sans and Microsoft YaHei. No external font requests. 17 px wordmark, 15 px section titles, 13 px fields, 12 px labels, 11 px supporting metadata. Tabular numbers only for time and step indices.
- White controls, `#fafafa` workflow rail, `#eeeff1` canvas, `#242629` ink, `#686b70` secondary text. Dark primary button; blue `#315cc5` only for selection/focus/links; muted red for recording, amber for pending or mismatched work.
- 4/8/12/16/24 px spacing rhythm. Small radii on interactive targets; no repeated outer cards. A shadow separates the video from its canvas.
- The recognizable element is the relationship between executable steps and the resulting scene strip. Steps show actions/targets; scenes show captions/footage. They no longer repeat the same text.
- On desktop, the canvas and scenes fit the workspace height; long steps and inspectors scroll independently. At 1150 px, the inspector moves below the preview. At 700 px, the recipe, preview and inspector stack in task order.
- Captions and trims are in **Scene**. Template, wait trimming and output dimensions are in **Frame & export**. Download links remain available in both views. The last rendered file remains the final preview; pending edits are labeled outside the video.
- Playback and keyboard-seek controls sit below the video, so browser playback chrome cannot cover the exported caption. Preview media requests explicit preloading and reports loading/playback failure. The play/pause button and focused video's Space/Enter key operate the same player.
- Motion is limited to job status and user-triggered video. Reduced-motion preference disables CSS animation. Native buttons/fields remain keyboard-operable; help traps focus and restores it to the trigger.

## Implementation choice and evidence

The existing pinned React/Vite stack and native CSS Grid/Flexbox remain sufficient. No UI framework, font service, model call or rendering library was added. The browser's [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) scales the synthetic sample iframe to its container instead of relying on hard-coded breakpoint zoom factors. CSS [container-relative length units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#container_query_length_units) fit the video to both available width and height. These are established browser features, not novel technology. Chromium is the tested Studio baseline; a framework would add dependency and migration cost without a demonstrated benefit here.

Validation covers the actual record/edit/export flow, repeat recording, restored drafts, frame switching without losing captions, keyboard focus, short desktop heights and narrow layouts. Final evidence and limits are recorded in [v0.1.2 validation](VALIDATION-v0.1.2.md). These checks are not a full WCAG audit or proof that users prefer this direction.
