# Script and screening room

Design revision, 2026-11-03. The user rejected the previous interface's repeated rectangular containers. v0.1.2 reduced clutter but retained the composition of a property editor. This revision makes the script and footage the visual subjects.

## Two directions considered before implementation

```text
A — Script and screening room (chosen)
   DemoPilot                                  record / export
   editable title              final cut / source
   script / appearance         uninterrupted footage
   01 editable caption         playback
      action + timing          captured scene strip
   02 caption
   03 caption                  files

B — Dark cutting desk
   tools        footage        properties
   full-width multi-track timeline
```

A gives short demonstrations the scale of a small publication: readable captions, an asymmetric composition, generous space and controls that unfold at the point of use. B suits long editing sessions but implies multi-track capabilities we do not provide. The tradeoff is an extra disclosure click for selectors and timing. Capture, rendering, recipe schema and workspace recovery remain unchanged.

## Visual system

- Canvas `#f8f9fa`, text `#20292d`, secondary `#647278`, selection `#20766d`, playback surface `#e9eef0`, recording/error `#ba493c`. No decorative gradients or outlined region cards.
- Segoe UI Variable / Segoe UI / system sans / Noto Sans / Microsoft YaHei. Project title 30 px, script captions 19 px, controls 13 px, supporting labels 12 px. No external fonts or artwork.
- Spacing 6/12/20/32/48 px. Continuous light surface; a single physical-looking shadow belongs to the footage, not every control. Captions are directly editable text; details have quiet underlines, not permanent input boxes.
- The scene numbers describe a real ordered recording. Selected text and a short colored marker relate the script to its footage. Movement is limited to status feedback; no entrance choreography.
- At narrow widths, script and footage stack; controls wrap, text remains readable and keyboard focus stays visible. The same recipe state backs every view.

## Actual references inspected

Public pages were viewed on 2026-11-03; no third-party assets are redistributed.

| Reference | Specific observation | Translation and boundary |
| --- | --- | --- |
| [Things features](https://culturedcode.com/things/features/) | The expanded to-do demo gives the task text room and leaves dates/tags subordinate. Detail fields appear within the task rather than a permanent inspector. | Put captions in the script, disclose action/timing beside the selected scene. Its task-completion checkboxes and date model do not fit a recorder. This is a visual reference, not a claim of measured superiority. |
| [Craft homepage](https://www.craft.do/) | The viewed homepage uses a large typographic subject, tactile paper composition and clearly subordinate navigation; the embedded product shows content-specific surfaces. | Use scale and a coherent composition, with one footage surface. Do not copy the paper collage, photos, typeface or marketing layout into a working editor. The homepage was inspected, not a paid workspace. |
| [Paper](https://paper.design/) and the product/award references in [the previous review](UI-DESIGN.md) | Real visual pages were inspected previously. Their canvas hierarchy remains useful; transplanting multiple permanent rails was not successful for this product. | Keep the work visually dominant and remove the right inspector. Award status does not establish suitability. |

## Technical choice

The existing pinned React 19.3.1 and CSS are sufficient. [React's current state guidance](https://react.dev/learn/preserving-and-resetting-state) explains identity when conditional UI changes; editable values stay in the parent recipe, with stable step IDs. [Native details/summary](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) is an established disclosure widget, avoiding a new component dependency. No model, cloud call or additional runtime cost is introduced. The expected reduction in visual interruption is a design hypothesis, not a tested productivity result.

## Acceptance

Inspect empty, recorded, edited, exported, expanded detail and narrow states. Run the real recipe repeatedly, modify captions and trims, verify source footage is unchanged and open the resulting video. Publish only claims supported by the resulting evidence. User preference, full accessibility compliance and competitor advantage remain unverified.
