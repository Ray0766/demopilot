import type { Recipe, Scene, Step, FocusBox } from "./schema.js";

export const FPS = 30;
export const FRAME = {
  width: 1280,
  height: 900,
  x: 64,
  y: 70,
  slotWidth: 1152,
  slotHeight: 720,
};
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** One edit timeline for native preview and FFmpeg; source footage is never mutated. */
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
  const contentDuration = ranges.reduce(
    (total, [start, stop]) => total + stop - start,
    0,
  );
  const requested = contentDuration + extra - step.trimStart - step.trimEnd;
  if (requested < 0.3)
    throw new Error(
      `Step “${step.id}”: trims leave less than 0.3 seconds. Reduce the trims.`,
    );
  const frames = Math.ceil(requested * FPS - 1e-6);
  const trimmed = cutsWait ? cutTo - cutFrom : 0;
  return {
    ranges,
    extra,
    frames,
    duration: frames / FPS,
    trimStart: step.trimStart,
    contentEnd: contentDuration - step.trimStart,
    trimmed,
    disclosure:
      trimmed + scene.preWaitMs / 1000 > 0.6 ||
      step.trimStart + step.trimEnd > 0,
  };
}
export type ScenePlan = ReturnType<typeof scenePlan>;

export function sourceTimeAt(plan: ScenePlan, outputTime: number) {
  let remaining = clamp(outputTime, 0, plan.duration) + plan.trimStart;
  for (const [start, end] of plan.ranges) {
    if (remaining < end - start) return start + remaining;
    remaining -= end - start;
  }
  const last = plan.ranges.at(-1)!;
  return Math.max(last[0], last[1] - 1 / FPS);
}

export function outputTimeAt(plan: ScenePlan, sourceTime: number) {
  let output = 0;
  for (const [start, end] of plan.ranges) {
    output += clamp(sourceTime - start, 0, end - start);
  }
  return output - plan.trimStart;
}

export function fittedSlot(viewport: Recipe["viewport"]) {
  const scale = Math.min(
    FRAME.slotWidth / viewport.width,
    FRAME.slotHeight / viewport.height,
  );
  const width = Math.floor((viewport.width * scale) / 2) * 2;
  const height = Math.floor((viewport.height * scale) / 2) * 2;
  return {
    x: FRAME.x + Math.floor((FRAME.slotWidth - width) / 2),
    y: FRAME.y + Math.floor((FRAME.slotHeight - height) / 2),
    width,
    height,
  };
}

const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
function fittingZoom(box: FocusBox | undefined, requested: number) {
  return box
    ? clamp(1 / Math.max(box.width + 0.08, box.height + 0.08), 1, requested)
    : requested;
}

export function cameraPlan(scene: Scene, step: Step, plan: ScenePlan) {
  const mode = step.focusMode || "follow";
  const result = mode === "follow" ? scene.result : undefined;
  const from = mode === "center" ? { x: 0.5, y: 0.5 } : scene.focus;
  const to = result
    ? {
        x: result.box.x + result.box.width / 2,
        y: result.box.y + result.box.height / 2,
      }
    : from;
  const zoom =
    mode === "center" ? step.zoom : fittingZoom(scene.targetBox, step.zoom);
  return {
    from,
    to,
    zoom,
    resultZoom: result ? fittingZoom(result.box, step.zoom) : zoom,
    followAt: result ? Math.max(0, outputTimeAt(plan, result.at)) : null,
  };
}

export function cameraAt(
  scene: Scene,
  step: Step,
  plan: ScenePlan,
  time: number,
) {
  const c = cameraPlan(scene, step, plan);
  const t = Math.floor(Math.max(0, time) * FPS + 1e-6) / FPS;
  const baseZoom = 1 + (c.zoom - 1) * smooth(t / 0.6);
  const follow = c.followAt === null ? 0 : smooth((t - c.followAt) / 0.65);
  const zoom = baseZoom + (c.resultZoom - baseZoom) * follow;
  const width = 1 / zoom;
  return {
    zoom,
    width,
    height: width,
    x: clamp(c.from.x + (c.to.x - c.from.x) * follow - width / 2, 0, 1 - width),
    y: clamp(c.from.y + (c.to.y - c.from.y) * follow - width / 2, 0, 1 - width),
  };
}

export function cameraExpressions(scene: Scene, step: Step, plan: ScenePlan) {
  const c = cameraPlan(scene, step, plan);
  const ease = (time: string) => {
    const t = `max(0,min(1,${time}))`;
    return `(${t}*${t}*(3-2*${t}))`;
  };
  const base = `(1+${c.zoom - 1}*${ease("on/18")})`;
  const follow = c.followAt === null ? "0" : ease(`(on/30-${c.followAt})/0.65`);
  return {
    zoom: `${base}+(${c.resultZoom}-${base})*${follow}`,
    x: `max(0,min(iw-iw/zoom,iw*(${c.from.x}+${c.to.x - c.from.x}*${follow})-iw/zoom/2))`,
    y: `max(0,min(ih-ih/zoom,ih*(${c.from.y}+${c.to.y - c.from.y}*${follow})-ih/zoom/2))`,
  };
}
