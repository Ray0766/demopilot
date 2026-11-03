import path from "node:path";
import { stat, writeFile, rm } from "node:fs/promises";
import sharp from "sharp";
import {
  templateColors,
  type Recipe,
  type Recording,
  type ExportResult,
  type Scene,
  type Step,
} from "../shared/schema.js";
import { fingerprint, type Progress } from "./capture.js";
import { createItem, itemPath, writeJson, removeItem } from "./store.js";
import { ffmpeg, probe, run, throwIfAborted } from "./process.js";

const W = 1280,
  H = 900,
  slotW = 1152,
  slotH = 720;
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

/** Remove only the middle of explicit post-action waiting. Never speed up the action. */
export function scenePlan(scene: Scene, step: Step, trimWaiting: boolean) {
  const end = Math.min(
    scene.duration,
    scene.readyAt + Math.min(step.holdMs / 1000, 2),
  );
  const cutFrom = Math.min(end, scene.actionEnd + 0.35);
  const cutTo = Math.max(cutFrom, Math.min(end, scene.readyAt - 0.25));
  const cutsWait = trimWaiting && cutTo - cutFrom > 0.6;
  const ranges = cutsWait
    ? [
        [0, cutFrom],
        [cutTo, end],
      ]
    : [[0, end]];
  const extra = Math.max(0, step.holdMs / 1000 - 2);
  const base =
    ranges.reduce((total, [start, stop]) => total + stop - start, 0) + extra;
  const duration = base - step.trimStart - step.trimEnd;
  if (duration < 0.3)
    throw new Error(
      `Step “${step.id}”: trims leave less than 0.3 seconds. Reduce the trims.`,
    );
  return { ranges, extra, duration, trimmed: cutsWait ? cutTo - cutFrom : 0 };
}

function wrapCaption(value: string): string[] {
  // Visual width estimate handles wide CJK glyphs and long words without overflowing.
  const lines: string[] = [];
  let line = "",
    width = 0;
  for (const char of Array.from(value)) {
    const unit = /[\u2e80-\uffff]/.test(char)
      ? 2
      : /[MW@]/.test(char)
        ? 1.4
        : 1;
    if (width + unit > 65 || char === "\n") {
      lines.push(line.trim());
      line = "";
      width = 0;
    }
    if (char !== "\n") {
      line += char;
      width += unit;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

async function makeFrame(
  recipe: Recipe,
  step: Step,
  index: number,
  disclosure: boolean,
  file: string,
) {
  const c = templateColors[recipe.template];
  const lines = wrapCaption(step.caption);
  const fontSize = lines.length > 2 ? 21 : 29;
  const lineHeight = lines.length > 2 ? 24 : 34;
  const caption = lines
    .slice(0, 4)
    .map(
      (line, i) =>
        `<text x="64" y="${lines.length > 2 ? 813 + i * lineHeight : 834 + i * lineHeight}" font-size="${fontSize}" font-weight="600">${xml(line)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="1280" height="900" fill="${c.background}"/>
    <rect x="59" y="36" width="1162" height="760" rx="13" fill="${c.ink}" opacity=".08"/>
    <rect x="64" y="32" width="1152" height="758" rx="10" fill="${c.surface}"/>
    <g fill="${c.muted}" opacity=".5"><circle cx="85" cy="50" r="4"/><circle cx="100" cy="50" r="4"/><circle cx="115" cy="50" r="4"/></g>
    <g font-family="Segoe UI, Noto Sans, Noto Sans CJK SC, Arial, sans-serif" fill="${c.ink}">
      <text x="140" y="55" font-size="16">${xml(recipe.title)}</text>
      <text x="1194" y="55" text-anchor="end" fill="${c.muted}" font-size="13">${disclosure ? "Edited pacing" : "DemoPilot"} · ${index + 1}/${recipe.steps.length}</text>
      ${caption}
    </g>
    <rect x="0" y="894" width="${(W * (index + 1)) / recipe.steps.length}" height="6" fill="${c.accent}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

export async function render(
  recording: Recording,
  recipe: Recipe,
  root: string,
  signal: AbortSignal,
  progress: Progress = () => {},
): Promise<ExportResult> {
  if (fingerprint(recipe) !== recording.fingerprint)
    throw new Error(
      "The URL, viewport or actions changed. Record again to match this recipe; captions and editing controls can be changed without recording.",
    );
  const plans = recording.scenes.map((scene, index) =>
    scenePlan(scene, recipe.steps[index], recipe.trimWaiting),
  );
  const { id, dir } = await createItem(root, "exports");
  const source = itemPath(root, "recordings", recording.id);
  const trimmedSeconds = plans.reduce(
    (sum, plan, index) =>
      sum + plan.trimmed + recording.scenes[index].preWaitMs / 1000,
    0,
  );
  try {
    const clips: string[] = [];
    for (const [index, scene] of recording.scenes.entries()) {
      throwIfAborted(signal);
      const step = recipe.steps[index];
      const plan = plans[index];
      progress(
        `Composing scene ${index + 1}/${recording.scenes.length}…`,
        (index / recording.scenes.length) * 0.75,
        step.id,
      );
      const frameName = `frame-${index}.png`;
      await makeFrame(
        recipe,
        step,
        index,
        trimmedSeconds > 0.6 || step.trimStart + step.trimEnd > 0,
        path.join(dir, frameName),
      );
      const filters: string[] = [];
      if (plan.ranges.length === 2) {
        filters.push("[0:v]split=2[a][b]");
        plan.ranges.forEach(([start, end], part) =>
          filters.push(
            `[${part ? "b" : "a"}]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[p${part}]`,
          ),
        );
        filters.push("[p0][p1]concat=n=2:v=1:a=0[cut]");
      } else
        filters.push(
          `[0:v]trim=end=${plan.ranges[0][1].toFixed(3)},setpts=PTS-STARTPTS[cut]`,
        );
      // Smooth, bounded push-in. Render at source resolution before fitting the frame.
      const zoom = `1+${(step.zoom - 1).toFixed(3)}*min(on/18,1)`;
      const x = `max(0,min(iw-iw/zoom,iw*${scene.focus.x}-iw/zoom/2))`;
      const y = `max(0,min(ih-ih/zoom,ih*${scene.focus.y}-ih/zoom/2))`;
      filters.push(
        `[cut]fps=30,tpad=stop_mode=clone:stop_duration=${plan.extra},trim=start=${step.trimStart}:duration=${plan.duration.toFixed(3)},setpts=PTS-STARTPTS,zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=${recipe.viewport.width}x${recipe.viewport.height}:fps=30,scale=${slotW}:${slotH}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${slotW}:${slotH}:(ow-iw)/2:(oh-ih)/2:color=${templateColors[recipe.template].surface},setsar=1[content]`,
      );
      filters.push(
        "[1:v][content]overlay=64:70:shortest=1,format=yuv420p[out]",
      );
      const clip = `scene-${index}.mp4`;
      await run(
        ffmpeg(),
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          path.join(source, scene.file),
          "-loop",
          "1",
          "-i",
          frameName,
          "-filter_complex",
          filters.join(";"),
          "-map",
          "[out]",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "20",
          "-threads",
          "2",
          "-r",
          "30",
          "-t",
          plan.duration.toFixed(3),
          "-movflags",
          "+faststart",
          clip,
        ],
        { cwd: dir, signal },
      );
      clips.push(clip);
    }
    progress("Joining the final cut…", 0.78);
    await writeFile(
      path.join(dir, "concat.txt"),
      clips.map((clip) => `file '${clip}'`).join("\n"),
    );
    // Normalize the joined stream too: copied fractional scene timestamps can produce VFR boundaries.
    await run(
      ffmpeg(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        "concat.txt",
        "-vf",
        "fps=30",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-threads",
        "2",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "demo.mp4",
      ],
      { cwd: dir, signal },
    );
    progress("Making the README GIF…", 0.85);
    await run(
      ffmpeg(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        "demo.mp4",
        "-t",
        "30",
        "-filter_complex",
        "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a",
        "-loop",
        "0",
        "demo.gif",
      ],
      { cwd: dir, signal },
    );
    await run(
      ffmpeg(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        "0.7",
        "-i",
        "demo.mp4",
        "-frames:v",
        "1",
        "poster.png",
      ],
      { cwd: dir, signal },
    );
    const media = await probe(path.join(dir, "demo.mp4"), signal);
    const gifMedia = await probe(path.join(dir, "demo.gif"), signal);
    if (!gifMedia.duration) throw new Error("GIF encoding failed.");
    const [mp4, gif] = await Promise.all([
      stat(path.join(dir, "demo.mp4")),
      stat(path.join(dir, "demo.gif")),
    ]);
    throwIfAborted(signal);
    const result: ExportResult = {
      id,
      recordingId: recording.id,
      recipe,
      duration: media.duration,
      trimmedSeconds: Math.round(trimmedSeconds * 100) / 100,
      mp4: `/media/exports/${id}/demo.mp4`,
      gif: `/media/exports/${id}/demo.gif`,
      poster: `/media/exports/${id}/poster.png`,
      bytes: { mp4: mp4.size, gif: gif.size },
    };
    await writeJson(path.join(dir, "export.json"), result);
    // Keep final artifacts and editable recipe. Source clips live with the recording.
    for (let index = 0; index < clips.length; index++) {
      await rm(path.join(dir, clips[index]));
      await rm(path.join(dir, `frame-${index}.png`));
    }
    await rm(path.join(dir, "concat.txt"));
    progress("MP4 and GIF are ready.", 1);
    return result;
  } catch (error) {
    await removeItem(root, "exports", id);
    throw error;
  }
}
