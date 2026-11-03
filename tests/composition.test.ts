import test from "node:test";
import assert from "node:assert/strict";
import { captionImage } from "../src/server/frame.js";
import {
  scenePlan,
  sourceTimeAt,
  outputTimeAt,
  cameraAt,
  cameraPlan,
} from "../src/shared/composition.js";
import { exampleRecipe } from "../src/shared/example.js";
import type { Scene } from "../src/shared/schema.js";

test("caption shaping keeps long CJK text and its ending inside the frame", async () => {
  const prefix = "中".repeat(128);
  const full = await captionImage(
    prefix + "文".repeat(28) + "完整结尾",
    "#273147",
  );
  const truncated = await captionImage(prefix, "#273147");
  assert.ok(full && truncated);
  assert.ok(full.info.width <= 1152 && full.info.height <= 80);
  assert.ok(full.fontSize >= 18);
  assert.notDeepEqual(full.data, truncated.data);
  assert.ok(await captionImage('中文 & <markup> "quote" 🧑‍💻 é', "#273147"));
  assert.equal(await captionImage("\n  ", "#273147"), null);
  await assert.rejects(
    captionImage(Array(20).fill("Line").join("\n"), "#273147"),
    /no text has been discarded/,
  );
});

const scene: Scene = {
  stepId: "create",
  file: "0.webm",
  poster: "0.png",
  duration: 9,
  actionEnd: 1,
  readyAt: 7,
  preWaitMs: 20,
  focus: { x: 0.88, y: 0.85 },
  targetBox: { x: 0.82, y: 0.8, width: 0.12, height: 0.1 },
  result: { at: 7, box: { x: 0.1, y: 0.15, width: 0.3, height: 0.3 } },
};

test("edit timeline maps across removed waits, trims and frozen result holds", () => {
  const step = {
    ...exampleRecipe().steps[0],
    holdMs: 4000,
    trimStart: 0.1,
    trimEnd: 0.2,
  };
  const plan = scenePlan(scene, step, true);
  assert.equal(sourceTimeAt(plan, 0), 0.1);
  assert.ok(
    sourceTimeAt(plan, 1.3) >= 6.75,
    "seeking beyond the first segment skips the removed wait",
  );
  assert.ok(Math.abs(outputTimeAt(plan, 7) - 1.5) < 0.0001);
  assert.ok(
    sourceTimeAt(plan, plan.duration) < 9,
    "extended holds repeat an existing frame",
  );
  assert.equal(plan.frames / 30, plan.duration);
  assert.ok(plan.disclosure);
});

test("result framing follows recorded readiness after the cut and stays within the viewport", () => {
  const step = { ...exampleRecipe().steps[0], zoom: 1.8 };
  const plan = scenePlan(scene, step, true);
  const move = cameraPlan(scene, step, plan);
  assert.ok(
    move.followAt! < 2,
    "result movement uses edited time, not the original seven-second wait",
  );
  const before = cameraAt(scene, step, plan, 1),
    after = cameraAt(scene, step, plan, 3);
  assert.ok(before.x > after.x && before.y > after.y);
  const box = scene.result!.box;
  assert.ok(after.x <= box.x && after.y <= box.y);
  assert.ok(
    after.x + after.width >= box.x + box.width &&
      after.y + after.height >= box.y + box.height,
  );
  for (let time = 0; time <= plan.duration; time += 1 / 30) {
    const crop = cameraAt(scene, step, plan, time);
    assert.ok(
      crop.x >= 0 &&
        crop.y >= 0 &&
        crop.x + crop.width <= 1.00001 &&
        crop.y + crop.height <= 1.00001,
    );
  }
  const manual = cameraAt(scene, { ...step, focusMode: "target" }, plan, 3);
  assert.ok(
    manual.x > after.x,
    "manual target override survives after the result",
  );
  const legacy = { ...scene, targetBox: undefined, result: undefined };
  assert.equal(cameraPlan(legacy, step, plan).followAt, null);
  assert.equal(cameraAt(legacy, step, plan, 3).zoom, step.zoom);
});
