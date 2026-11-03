import test from "node:test";
import assert from "node:assert/strict";
import { exampleRecipe } from "../src/shared/example.js";
import { recipeSchema, type Scene } from "../src/shared/schema.js";
import { fingerprint } from "../src/server/capture.js";
import { scenePlan } from "../src/server/render.js";
import { itemPath } from "../src/server/store.js";
import { Jobs } from "../src/server/jobs.js";
import { pause } from "../src/server/process.js";

test("recipes reject non-web URLs, credentials, duplicate IDs and unbounded workloads", () => {
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://user:secret@localhost/",
  ])
    assert.equal(
      recipeSchema.safeParse({ ...exampleRecipe(), url }).success,
      false,
    );
  const recipe = exampleRecipe();
  assert.equal(
    recipeSchema.safeParse({
      ...recipe,
      steps: [recipe.steps[0], recipe.steps[0]],
    }).success,
    false,
  );
  assert.equal(
    recipeSchema.safeParse({
      ...recipe,
      viewport: { width: 10000, height: 10000 },
    }).success,
    false,
  );
  assert.equal(recipeSchema.safeParse({ ...recipe, steps: [] }).success, false);
});
test("presentation edits preserve capture identity; workflow edits invalidate it", () => {
  const recipe = exampleRecipe();
  const edit = structuredClone(recipe);
  edit.title = "A new title";
  edit.template = "paper";
  edit.trimWaiting = false;
  Object.assign(edit.steps[0], {
    caption: "重新开始",
    zoom: 1.4,
    focusMode: "target",
    holdMs: 4000,
    trimStart: 0.2,
    trimEnd: 0.1,
  });
  assert.equal(fingerprint(recipe), fingerprint(edit));
  edit.steps[0].target = "#changed";
  assert.notEqual(fingerprint(recipe), fingerprint(edit));
});
test("wait trimming keeps the action and result, reports the cut and rejects empty scenes", () => {
  const scene: Scene = {
    stepId: "create",
    file: "0.webm",
    poster: "0.png",
    duration: 9,
    actionEnd: 1,
    readyAt: 7,
    preWaitMs: 30,
    focus: { x: 0.9, y: 0.2 },
  };
  const step = exampleRecipe().steps[0];
  const plan = scenePlan(scene, step, true);
  assert.deepEqual(plan.ranges, [
    [0, 1.35],
    [6.75, 9],
  ]);
  assert.equal(plan.trimmed, 5.4);
  assert.ok(plan.duration > 3);
  assert.equal(scenePlan(scene, step, false).trimmed, 0);
  assert.throws(
    () => scenePlan(scene, { ...step, trimEnd: 30 }, true),
    /less than 0.3/,
  );
});
test("media paths do not accept traversal or arbitrary files", () => {
  for (const id of ["../secrets", "/etc/passwd", "C:\\Users", "x"])
    assert.throws(() => itemPath("data", "recordings", id), /Invalid/);
});
test("jobs reject concurrency, propagate failure and cancel without success artifacts", async () => {
  const jobs = new Jobs();
  const job = jobs.start("record", async (signal) => {
    await pause(10000, signal);
    return undefined;
  });
  assert.throws(
    () => jobs.start("render", async () => undefined),
    /Another job/,
  );
  jobs.cancel(job.id);
  await jobs.settle();
  assert.equal(jobs.get(job.id)?.status, "cancelled");
  assert.equal(jobs.get(job.id)?.result, undefined);
  const failed = jobs.start("render", async () => {
    throw new Error("Disk full");
  });
  await jobs.settle();
  assert.equal(jobs.get(failed.id)?.status, "failed");
  assert.equal(jobs.get(failed.id)?.error, "Disk full");
});
