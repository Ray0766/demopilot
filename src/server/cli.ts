#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createApp } from "./app.js";
import { recipeSchema } from "../shared/schema.js";
import { exampleRecipe } from "../shared/example.js";
import { capture } from "./capture.js";
import { render } from "./render.js";
import { loadRecording, itemPath } from "./store.js";
import { run, ffmpeg, ffprobe } from "./process.js";

const program = new Command()
  .name("demopilot")
  .description("Turn repeatable browser workflows into polished demo videos.")
  .version("0.1.1");
const progress = (message: string) => console.log(message);
const dataRoot = () => path.resolve(".demopilot");
function abortOnExit() {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  return {
    controller,
    dispose: () => {
      process.off("SIGINT", abort);
      process.off("SIGTERM", abort);
    },
  };
}
async function startStudio(port: number, dev = false) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Choose a port between 1024 and 65535.");
  const studio = await createApp({ root: dataRoot(), port, dev });
  const server = await new Promise<ReturnType<typeof studio.app.listen>>(
    (resolve, reject) => {
      const listener = studio.app.listen(port, "127.0.0.1", () =>
        resolve(listener),
      );
      listener.once("error", reject);
    },
  );
  return {
    ...studio,
    stop: async () => {
      await studio.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
async function copyExports(root: string, id: string, output: string) {
  const destination = path.resolve(output);
  await mkdir(destination, { recursive: true });
  for (const file of ["demo.mp4", "demo.gif", "poster.png", "export.json"])
    await copyFile(
      path.join(itemPath(root, "exports", id), file),
      path.join(destination, file),
    );
  console.log(`Saved ${destination}`);
}

program
  .command("studio", { isDefault: true })
  .description("Open the local recording and editing studio")
  .option("-p, --port <port>", "Loopback port", "4310")
  .option("--dev", "Use Vite development middleware")
  .action(async (options) => {
    const studio = await startStudio(Number(options.port), options.dev);
    console.log(
      `\n  DemoPilot Studio  http://127.0.0.1:${options.port}\n  Recordings stay in ${dataRoot()}\n  Press Ctrl+C to stop.\n`,
    );
    const stop = async () => {
      await studio.stop();
      process.exit(0);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
program
  .command("init")
  .description("Write a starter recipe; refuses to overwrite an existing file")
  .option("-o, --output <file>", "Recipe file", "demo.recipe.json")
  .action(async (options) => {
    await writeFile(
      options.output,
      JSON.stringify(exampleRecipe(), null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(
      `Created ${options.output}. Start Studio for the bundled /sample website, or edit the URL and steps.`,
    );
  });
program
  .command("record")
  .argument("<recipe>")
  .option("-o, --output <directory>", "Copy final artifacts here")
  .description("Record a recipe and export MP4 + GIF")
  .action(async (file, options) => {
    const recipe = recipeSchema.parse(JSON.parse(await readFile(file, "utf8")));
    const task = abortOnExit();
    try {
      const recording = await capture(
        recipe,
        dataRoot(),
        task.controller.signal,
        progress,
      );
      console.log(`Recording ID: ${recording.id}`);
      const result = await render(
        recording,
        recipe,
        dataRoot(),
        task.controller.signal,
        progress,
      );
      await copyExports(
        dataRoot(),
        result.id,
        options.output || path.join("output", result.id),
      );
    } finally {
      task.dispose();
    }
  });
program
  .command("render")
  .argument("<recording-id>")
  .argument("<recipe>")
  .option("-o, --output <directory>")
  .description("Re-edit an existing recording without visiting the website")
  .action(async (id, file, options) => {
    const recipe = recipeSchema.parse(JSON.parse(await readFile(file, "utf8")));
    const recording = await loadRecording(dataRoot(), id);
    const task = abortOnExit();
    try {
      const result = await render(
        recording,
        recipe,
        dataRoot(),
        task.controller.signal,
        progress,
      );
      await copyExports(
        dataRoot(),
        result.id,
        options.output || path.join("output", result.id),
      );
    } finally {
      task.dispose();
    }
  });
program
  .command("demo")
  .description(
    "Record and export the synthetic sample, with no setup or account",
  )
  .option("-p, --port <port>", "Sample server port", "4311")
  .option("-o, --output <directory>", "Output folder", "output/demo")
  .action(async (options) => {
    const studio = await startStudio(Number(options.port));
    const task = abortOnExit();
    try {
      const recipe = exampleRecipe(`http://127.0.0.1:${options.port}`);
      const recording = await capture(
        recipe,
        dataRoot(),
        task.controller.signal,
        progress,
      );
      const result = await render(
        recording,
        recipe,
        dataRoot(),
        task.controller.signal,
        progress,
      );
      await copyExports(dataRoot(), result.id, options.output);
      console.log(`Recording ID: ${recording.id}`);
    } finally {
      task.dispose();
      await studio.stop();
    }
  });
program
  .command("doctor")
  .description("Check Chromium, FFmpeg and ffprobe")
  .action(async () => {
    console.log(`Node ${process.version}`);
    console.log((await run(ffmpeg(), ["-version"])).split("\n")[0]);
    console.log((await run(ffprobe(), ["-version"])).split("\n")[0]);
    const browser = await chromium.launch({ headless: true });
    console.log(`Chromium ${browser.version()}`);
    await browser.close();
    console.log("Ready to record.");
  });

await program.parseAsync().catch((error: Error) => {
  console.error(`\nDemoPilot: ${error.message}`);
  process.exitCode = 1;
});
