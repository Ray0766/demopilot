/** Produce a real DemoPilot-on-DemoPilot release demonstration. Run after npm run build. */
import path from "node:path";
import assert from "node:assert/strict";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { createApp } from "../src/server/app.js";
import { capture } from "../src/server/capture.js";
import { render } from "../src/server/render.js";
import { recipeSchema } from "../src/shared/schema.js";
import { itemPath, listRecordings } from "../src/server/store.js";

const root = path.resolve("test-results", `showcase-${Date.now()}`);
const inner = await createApp({ root: path.join(root, "studio"), port: 4330 });
const server = await new Promise<ReturnType<typeof inner.app.listen>>(
  (resolve) => {
    const listener = inner.app.listen(4330, "127.0.0.1", () =>
      resolve(listener),
    );
  },
);
const recipe = recipeSchema.parse({
  version: 1,
  title: "DemoPilot — from steps to a release-ready demo",
  url: "http://127.0.0.1:4330",
  viewport: { width: 1440, height: 1000 },
  template: "studio",
  timeoutMs: 60000,
  trimWaiting: true,
  steps: [
    {
      id: "recipe",
      action: "wait",
      target: ".steps",
      caption: "Start with a website and three clear steps.",
      holdMs: 2200,
    },
    {
      id: "record",
      action: "click",
      target: "role:button:Record demo",
      waitFor: "role:button:Record again",
      caption: "Record the real app. Every step stays connected.",
      holdMs: 1800,
    },
    {
      id: "caption",
      action: "fill",
      target: "role:textbox:Caption for scene 1",
      value: "Open a project form. 新建项目。",
      caption: "Edit the caption while keeping the original footage.",
      holdMs: 2200,
      zoom: 1.2,
    },
    {
      id: "frame-panel",
      action: "click",
      target: "role:button:Frame & export",
      caption: "Frame settings stay separate from scene edits.",
      holdMs: 1000,
    },
    {
      id: "style",
      action: "click",
      target: "text:Midnight",
      caption: "Choose a frame that suits your project.",
      holdMs: 1800,
    },
    {
      id: "export",
      action: "click",
      target: "role:button:Export MP4 + GIF",
      waitFor: ".downloads",
      caption: "One cut. A release video and a README GIF.",
      holdMs: 2200,
    },
    {
      id: "play",
      action: "press",
      target: "video",
      value: "Space",
      caption: "Play the actual MP4. The captions stay readable.",
      holdMs: 4000,
    },
    {
      id: "return-to-scene",
      action: "click",
      target: "role:button:Scene",
      caption: "The edited caption stays attached to its step.",
      holdMs: 1000,
    },
    {
      id: "record-again",
      action: "click",
      target: "role:button:Record again",
      waitFor: "text:Recording saved. Adjust the cut, then export your demo.",
      caption: "Record again: fresh footage, the same edited recipe.",
      holdMs: 3000,
    },
  ],
});
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
try {
  const recording = await capture(recipe, root, controller.signal, console.log);
  const takes = await listRecordings(path.join(root, "studio"));
  assert.equal(takes.length, 2, "The showcase must finish two real recordings");
  assert.deepEqual(
    takes[0].scenes.map((scene) => scene.stepId),
    takes[1].scenes.map((scene) => scene.stepId),
  );
  assert.equal(
    takes[0].recipe.steps[0].caption,
    "Open a project form. 新建项目。",
  );
  assert.equal(takes[0].recipe.template, "midnight");
  await writeFile(
    path.join(root, "repeatability.json"),
    JSON.stringify(
      {
        recordingIds: takes.map((take) => take.id),
        stableStepIds: true,
        editedCaptionRetained: true,
        selectedFrameRetained: true,
      },
      null,
      2,
    ),
  );
  const result = await render(
    recording,
    recipe,
    root,
    controller.signal,
    console.log,
  );
  const destination = path.resolve("docs/media");
  await mkdir(destination, { recursive: true });
  const source = itemPath(root, "exports", result.id);
  await copyFile(
    path.join(source, "demo.mp4"),
    path.join(destination, "showcase.mp4"),
  );
  await copyFile(
    path.join(source, "demo.gif"),
    path.join(destination, "showcase.gif"),
  );
  await copyFile(
    path.join(source, "poster.png"),
    path.join(destination, "showcase-poster.png"),
  );
  await writeFile(
    path.join(root, "showcase.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      duration: result.duration,
      bytes: result.bytes,
      trimmedSeconds: result.trimmedSeconds,
      evidence: root,
    }),
  );
} finally {
  await inner.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
