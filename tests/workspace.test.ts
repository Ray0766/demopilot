import assert from "node:assert/strict";
import test from "node:test";
import { readWorkspace, saveWorkspace } from "../src/client/workspace";
import { exampleRecipe } from "../src/shared/example";

test("invalid workspace data falls back to a legacy draft instead of crashing", () => {
  const recipe = exampleRecipe();
  recipe.steps[0].caption = "Keep my legacy edit";
  const storage = new Map([
    ["demopilot.workspace", "{broken"],
    ["demopilot.recipe", JSON.stringify(recipe)],
  ]);
  const restored = readWorkspace({
    getItem: (key) => storage.get(key) || null,
  });
  assert.equal(restored?.recipe.steps[0].caption, "Keep my legacy edit");
  assert.equal(restored?.legacy, true);
  assert.equal(
    readWorkspace({
      getItem: () => {
        throw new Error("Storage blocked");
      },
    }),
    null,
  );
});

test("workspace preserves incomplete edits and reports storage failures", () => {
  const recipe = exampleRecipe();
  recipe.title = "";
  recipe.url = "http://";
  recipe.steps[0].target = "";
  const storage = new Map<string, string>();
  saveWorkspace(
    {
      setItem: (key, value) => {
        storage.set(key, value);
      },
    },
    recipe,
    null,
    null,
    {},
  );
  const restored = readWorkspace({
    getItem: (key) => storage.get(key) || null,
  });
  assert.deepEqual(restored?.recipe, recipe);
  assert.equal(restored?.legacy, undefined);
  assert.throws(
    () =>
      saveWorkspace(
        {
          setItem: () => {
            throw new Error("Quota exceeded");
          },
        },
        recipe,
        null,
        null,
        {},
      ),
    /Quota exceeded/,
  );
});
