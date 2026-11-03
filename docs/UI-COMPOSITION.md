# Composition revision: a release workbench

2026-11-03. The user rejected v0.1.3 because removing boxes had not established a convincing composition, typography or hierarchy. That is the acceptance problem for this revision; functioning exports alone cannot establish that the design is preferred.

## Two compositions, before implementation

```text
A — Bright release workbench (initial direction)
   DemoPilot                               file / help
   PROJECT TITLE, large                    record / export
   website address
   selected scene              blue screening surface
   caption + local controls    actual footage
                               playback
   01 scene       02 scene       03 scene       + step
   previous recordings                         downloads

B — Dark screening room
   project / file                         record / export
   caption rail       near-full-width dark viewer
   sequential thumbnail track across the bottom
```

A uses the actual project title as the typographic subject and makes the executable sequence a horizontal reading path. B supports prolonged media review, but needs careful treatment of bright browser footage and risks looking like a generic video editor. The user explicitly selected A: a bright branded workbench with large type, distinct color blocks and asymmetry. The change is bounded to Studio presentation and its synthetic sample. No multi-track editing, planning agent or new backend is implied.

## Tokens and hierarchy

- Paper white `#fbfcff`, ink navy `#172a46`, cobalt `#3454e8`, pale blue `#e7edfc`, secondary slate `#5f6c84`, recording coral `#d75b49`.
- Bricolage Grotesque for project titles, brand and selected caption; DM Sans for controls and reading. CJK fallback: Noto Sans CJK SC / Microsoft YaHei / sans-serif. Display scale 42–56 px; caption 30–38 px; section 18 px; body 14 px; metadata 12 px. Numbers refer to the real sequence, not decorative metrics.
- One strong colored screening surface. Title, selected-scene content and sequence share alignment anchors. Avoid a frame around each field; retain clear focused/selected states and visible action boundaries.
- 8/16/24/40 px spacing. Compact navigation, wide project masthead, selected-scene/footage middle and a horizontal sequence below. At narrow widths, switch to a single reading column with wrapping controls.
- Motion explains a user selection or job state. Respect reduced motion. Color is not the only selection/status indicator.

## References actually inspected

Public screenshots were viewed on 2026-11-03. No trial account or paid editor was used. Captures stay in ignored `test-results/design-research`.

| Reference | Observed part | Adoption and boundary |
| --- | --- | --- |
| [Framer homepage](https://www.framer.com/) | Large, tightly set geometric heading spans the page, with smaller navigation/actions and a wide product demonstration below. | Establish a real type-scale contrast and let the project title span the workspace. Do not transplant marketing copy, dark glow effects or agent features into Studio. |
| [Frame.io homepage](https://frame.io/) | Oversized left-aligned type and an offset product image create deliberate asymmetry; the dark surround separates bright media from chrome. | Give footage a single strong surrounding surface and clear hierarchy. Do not imitate its asset-management panels or claim review/collaboration capabilities. |
| [Tella homepage](https://www.tella.com/) | Restrained navigation sits above a strong heading/subheading contrast and a wide media demonstration. | Keep interface chrome compact relative to the work. The captured media was transitioning; it is not evidence of having evaluated Tella's editor. No account, artwork or footage is reused. |

## Typeface choice and cost

[Bricolage Grotesque](https://github.com/ateliertriay/bricolage) is an expressive variable font with optical sizing; [DM Sans](https://github.com/googlefonts/dm-fonts) is designed for readable smaller text. Both are distributed under SIL OFL 1.1. Their roles are deliberately separate. Fontsource provides packaged WOFF2 files; exact package versions, hashes and license files are recorded with the vendored assets. This is not a claim that these fonts are new research.

Self-hosted assets make the typography consistent across Windows and Linux without a font-service request. The cost is added static download bytes and license notices; no runtime dependency, account, telemetry or model call is needed. The fallback remains a usable system sans when a font cannot load. Captured external websites retain their own fonts; this does not change the renderer's font handling.

## Verification boundary

The acceptance checks cover actual empty, recorded, edited, parameter and export views at desktop and narrow sizes; keyboard selection, long bilingual text, local font loading, repeated recording, edits, restored drafts and final output review. Results and limitations are recorded in [v0.1.4 validation](VALIDATION-v0.1.4.md). Performance or preference superiority requires comparative evidence and remains a hypothesis.
