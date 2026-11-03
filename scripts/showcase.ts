/** Produce a real DemoPilot-on-DemoPilot release demonstration. Run after npm run build. */
import path from "node:path";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { createApp } from "../src/server/app.js";
import { capture } from "../src/server/capture.js";
import { render } from "../src/server/render.js";
import { recipeSchema } from "../src/shared/schema.js";
import { itemPath } from "../src/server/store.js";

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
      value: "Make room for your next release.",
      caption: "Change the story without recording again.",
      holdMs: 2200,
      zoom: 1.2,
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
      caption: "Save the recipe. Your next release already has a head start.",
      holdMs: 4000,
    },
  ],
});
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
try {
  const recording = await capture(recipe, root, controller.signal, console.log);
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
