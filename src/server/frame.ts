import sharp from "sharp";
import { templateColors, type Recipe, type Step } from "../shared/schema.js";

const xml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );

/** Shape every glyph with the renderer's real fonts. Never discard overflowing lines. */
export async function captionImage(text: string, color: string) {
  if (!text.trim()) return null;
  for (let size = 29; size >= 18; size--) {
    const result = await sharp({
      text: {
        text: `<span foreground="${color}" weight="semibold">${xml(text)}</span>`,
        font: `Segoe UI, Noto Sans, Noto Sans CJK SC, Arial ${size}`,
        width: 1152,
        wrap: "word-char",
        rgba: true,
        dpi: 72,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (result.info.height <= 80) return { ...result, fontSize: size };
  }
  throw new Error(
    "This caption does not fit at a readable size. Remove extra line breaks or shorten it; no text has been discarded.",
  );
}

/** The exact same frame PNG is used by live editing preview and FFmpeg. */
const frames = new Map<string, Buffer>();
export async function makeFrame(
  recipe: Recipe,
  step: Step,
  index: number,
  disclosure: boolean,
): Promise<Buffer> {
  const key = JSON.stringify([
    recipe.title,
    recipe.template,
    step.caption,
    index,
    recipe.steps.length,
    disclosure,
  ]);
  const cached = frames.get(key);
  if (cached) {
    frames.delete(key);
    frames.set(key, cached);
    return cached;
  }
  const result = await composeFrame(recipe, step, index, disclosure);
  frames.set(key, result);
  while (frames.size > 32) frames.delete(frames.keys().next().value!);
  return result;
}

async function composeFrame(
  recipe: Recipe,
  step: Step,
  index: number,
  disclosure: boolean,
): Promise<Buffer> {
  const c = templateColors[recipe.template];
  const caption = await captionImage(step.caption, c.ink);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900">
    <rect width="1280" height="900" fill="${c.background}"/>
    <rect x="59" y="36" width="1162" height="760" rx="13" fill="${c.ink}" opacity=".08"/>
    <rect x="64" y="32" width="1152" height="758" rx="10" fill="${c.surface}"/>
    <g fill="${c.muted}" opacity=".5"><circle cx="85" cy="50" r="4"/><circle cx="100" cy="50" r="4"/><circle cx="115" cy="50" r="4"/></g>
    <g font-family="Segoe UI, Noto Sans, Noto Sans CJK SC, Arial, sans-serif" fill="${c.ink}">
      <text x="140" y="55" font-size="16">${xml(recipe.title)}</text>
      <text x="1194" y="55" text-anchor="end" fill="${c.muted}" font-size="13">${disclosure ? "Edited pacing" : "DemoPilot"} · ${index + 1}/${recipe.steps.length}</text>
    </g>
    <rect x="0" y="894" width="${(1280 * (index + 1)) / recipe.steps.length}" height="6" fill="${c.accent}"/>
  </svg>`;
  return sharp(Buffer.from(svg))
    .composite(
      caption
        ? [
            {
              input: caption.data,
              left: 64,
              top: 804 + Math.floor((80 - caption.info.height) / 2),
            },
          ]
        : [],
    )
    .png()
    .toBuffer();
}
