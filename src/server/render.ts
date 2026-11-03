import path from "node:path";
import { stat, writeFile, rm } from "node:fs/promises";
import { makeFrame } from "./frame.js";
import {
  templateColors,
  type Recipe,
  type Recording,
  type ExportResult,
} from "../shared/schema.js";
import { fingerprint, type Progress } from "./capture.js";
import { createItem, itemPath, writeJson, removeItem } from "./store.js";
import { ffmpeg, probe, run, throwIfAborted } from "./process.js";
import {
  digest,
  hashFile,
  reuseScene,
  rememberScene,
  pruneSceneCache,
  SCENE_RENDER_VERSION,
} from "./scene-cache.js";

import { scenePlan, cameraExpressions } from "../shared/composition.js";
export { scenePlan } from "../shared/composition.js";
const slotW = 1152,
  slotH = 720;
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
    const toolVersion = await run(ffmpeg(), ["-version"], { signal });
    const cache = {
      hits: 0,
      misses: 0,
      scenes: [] as { stepId: string; key: string; reused: boolean }[],
    };
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
      const frame = await makeFrame(recipe, step, index, plan.disclosure);
      await writeFile(path.join(dir, frameName), frame);
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
      const { zoom, x, y } = cameraExpressions(scene, step, plan);
      filters.push(
        `[cut]fps=30,tpad=stop_mode=clone:stop_duration=${plan.extra},trim=start=${step.trimStart}:duration=${plan.duration.toFixed(3)},setpts=PTS-STARTPTS,zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=${recipe.viewport.width}x${recipe.viewport.height}:fps=30,scale=${slotW}:${slotH}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${slotW}:${slotH}:(ow-iw)/2:(oh-ih)/2:color=${templateColors[recipe.template].surface},setsar=1[content]`,
      );
      filters.push(
        "[1:v][content]overlay=64:70:shortest=1,format=yuv420p[out]",
      );
      const clip = `scene-${index}.mp4`;
      const key = digest(
        JSON.stringify({
          version: SCENE_RENDER_VERSION,
          toolVersion,
          source: await hashFile(path.join(source, scene.file), signal),
          frame: digest(frame),
          filters,
          duration: plan.duration,
          viewport: recipe.viewport,
          encoder: ["libx264", "fast", "crf20", "30fps", "threads2"],
        }),
      );
      const reused = await reuseScene(root, key, path.join(dir, clip), signal);
      cache.scenes.push({ stepId: step.id, key, reused });
      if (reused) {
        cache.hits++;
        progress(
          `Reusing scene ${index + 1}/${recording.scenes.length}…`,
          (index / recording.scenes.length) * 0.75,
          step.id,
        );
      } else {
        cache.misses++;
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
        await rememberScene(root, key, path.join(dir, clip), signal);
      }
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
      cache,
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
  } finally {
    await pruneSceneCache(root).catch(() => {});
  }
}
