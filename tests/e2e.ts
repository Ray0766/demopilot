import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { capture } from "../src/server/capture.js";
import { render } from "../src/server/render.js";
import { run, ffmpeg, probe, pause } from "../src/server/process.js";
import { exampleRecipe } from "../src/shared/example.js";
import { createApp } from "../src/server/app.js";
import { itemPath } from "../src/server/store.js";

const root = path.resolve("test-results", `e2e-${Date.now()}`);
await mkdir(root, { recursive: true });
const started = performance.now();
const results: Record<string, unknown> = {
  machine: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: os.cpus()[0].model,
  },
  root,
  startedAt: new Date().toISOString(),
};
const sample = await readFile("examples/sample.html", "utf8");
let revision = 1;
const fixture = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    revision === 1
      ? sample
      : sample.replace(
          "A good place to start.",
          "Your next chapter starts here.",
        ),
  );
});
await new Promise<void>((resolve) =>
  fixture.listen(4322, "127.0.0.1", resolve),
);
const studio = await createApp({ root, port: 4323 });
const studioServer = await new Promise<ReturnType<typeof studio.app.listen>>(
  (resolve) => {
    const listener = studio.app.listen(4323, "127.0.0.1", () =>
      resolve(listener),
    );
  },
);
const signal = new AbortController().signal;
const log = (message: string) => console.log(message);
try {
  const recipe = exampleRecipe("http://127.0.0.1:4322");
  const first = await capture(recipe, root, signal, log);
  const edited = structuredClone(recipe);
  edited.steps[0].caption = "Open the new project form. 新建项目。";
  edited.steps[1].zoom = 1.5;
  edited.steps[1].trimStart = 0.1;
  edited.steps[2].holdMs = 3000;
  const second = await capture(edited, root, signal, log);
  revision = 2;
  const third = await capture(edited, root, signal, log);
  assert.deepEqual(
    third.scenes.map((s) => s.stepId),
    first.scenes.map((s) => s.stepId),
  );
  assert.equal(third.recipe.steps[0].caption, edited.steps[0].caption);
  const hash = async (file: string) =>
    createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  assert.notEqual(
    await hash(path.join(itemPath(root, "recordings", first.id), "0.png")),
    await hash(path.join(itemPath(root, "recordings", third.id), "0.png")),
  );
  results.repeatability = {
    successes: 3,
    retries: 0,
    ids: [first.id, second.id, third.id],
    elapsedMs: [first.elapsedMs, second.elapsedMs, third.elapsedMs],
    changedAppSameRecipe: true,
  };
  console.log(
    "PASS three recordings, edits retained, changed website captured",
  );

  const slow = structuredClone(recipe);
  slow.url += "?delay=2600";
  const slowRecording = await capture(slow, root, signal, log);
  const slowScene = slowRecording.scenes[2];
  assert.ok(slowScene.readyAt - slowScene.actionEnd > 2);
  results.slow = { waitSeconds: slowScene.readyAt - slowScene.actionEnd };
  const missing = structuredClone(recipe);
  missing.timeoutMs = 1000;
  missing.steps = [{ ...missing.steps[0], target: "#missing-control" }];
  await assert.rejects(capture(missing, root, signal), /Step.*create/);
  const cancel = new AbortController();
  const pending = capture(slow, root, cancel.signal);
  setTimeout(() => cancel.abort(), 1700);
  await assert.rejects(pending, /Cancelled/);
  const beforeDirs = await readdir(path.join(root, "recordings"));
  assert.equal(
    beforeDirs.length,
    4,
    "failed/cancelled recordings must be removed",
  );
  results.failureHandling = {
    missingTarget: "failed with step ID",
    captureCancellation: "no partial recording",
  };
  console.log("PASS slow response, missing target, cancellation");

  // Close the target website. All presentation edits must work using only captured footage.
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
  const sourceHash = await hash(
    path.join(itemPath(root, "recordings", first.id), "0.webm"),
  );
  const original = await render(first, recipe, root, signal, log);
  edited.template = "paper";
  const updated = await render(first, edited, root, signal, log);
  assert.equal(
    sourceHash,
    await hash(path.join(itemPath(root, "recordings", first.id), "0.webm")),
  );
  assert.notEqual(
    await hash(path.join(itemPath(root, "exports", original.id), "demo.mp4")),
    await hash(path.join(itemPath(root, "exports", updated.id), "demo.mp4")),
  );
  const midnight = await render(
    slowRecording,
    { ...slow, template: "midnight" },
    root,
    signal,
    log,
  );
  assert.ok(midnight.trimmedSeconds > 1.5);
  for (const output of [original, updated, midnight]) {
    const dir = itemPath(root, "exports", output.id);
    const media = await probe(path.join(dir, "demo.mp4"));
    assert.equal(media.width, 1280);
    assert.equal(media.height, 900);
    assert.equal(media.fps, "30/1");
    assert.equal(media.codec, "h264");
    await run(ffmpeg(), [
      "-v",
      "error",
      "-i",
      path.join(dir, "demo.mp4"),
      "-f",
      "null",
      "-",
    ]);
    await run(ffmpeg(), [
      "-v",
      "error",
      "-i",
      path.join(dir, "demo.gif"),
      "-f",
      "null",
      "-",
    ]);
  }
  const invalid = structuredClone(recipe);
  invalid.steps[0].target = "#changed";
  await assert.rejects(render(first, invalid, root, signal), /Record again/);
  const renderCancel = new AbortController();
  const pendingRender = render(first, recipe, root, renderCancel.signal);
  setTimeout(() => renderCancel.abort(), 250);
  await assert.rejects(pendingRender, /Cancelled|abort/i);
  assert.equal((await readdir(path.join(root, "exports"))).length, 3);
  results.editing = {
    offlineRerender: true,
    sourceUnchanged: true,
    actionMismatchRejected: true,
    renderCancellation: "no partial export",
    templates: ["studio", "paper", "midnight"],
  };
  results.exports = [original, updated, midnight].map((item) => ({
    id: item.id,
    template: item.recipe.template,
    duration: item.duration,
    trimmedSeconds: item.trimmedSeconds,
    bytes: item.bytes,
  }));
  console.log(
    "PASS offline editing, all templates, decoded MP4/GIF, mismatch, render cancellation",
  );

  // Local API exposure boundaries and a full UI-driven recording/export.
  const origin = "http://127.0.0.1:4323";
  assert.equal(
    (
      await fetch(`${origin}/api/bootstrap`, {
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipe),
      })
    ).status,
    403,
  );
  const reboundStatus = await new Promise<number | undefined>(
    (resolve, reject) => {
      const request = httpRequest(
        `${origin}/api/bootstrap`,
        { headers: { Host: "evil.example:4323" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      request.on("error", reject);
      request.end();
    },
  );
  assert.equal(reboundStatus, 403);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1120 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Record demo", exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(root, "studio-empty.png"),
      fullPage: true,
    });
    const actionDisclosure = page.locator(".action-disclosure > summary");
    await actionDisclosure.focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page
        .getByRole("textbox", { name: "Target", exact: true })
        .inputValue(),
      "role:button:New project",
    );
    await actionDisclosure.press("Enter");
    const timingDisclosure = page.locator(".timing-disclosure > summary");
    await timingDisclosure.focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Trim start seconds").fill("0.1");
    await page.screenshot({
      path: path.join(root, "studio-timing.png"),
      fullPage: true,
    });
    await timingDisclosure.press("Enter");
    await page
      .getByRole("button", { name: "Record demo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Record again", exact: true })
      .waitFor({ timeout: 90000 });
    await page
      .getByRole("textbox", { name: "Caption for scene 1", exact: true })
      .fill("Open the new project form.");
    await page
      .getByRole("button", { name: "Export MP4 + GIF", exact: true })
      .click();
    await page
      .getByRole("link", { name: /Download MP4/ })
      .waitFor({ timeout: 180000 });
    const video = page.getByLabel("Final demo video");
    await page
      .getByRole("button", { name: "Play preview", exact: true })
      .click();
    await pause(900);
    assert.ok(
      (await video.evaluate((el: HTMLVideoElement) => el.currentTime)) > 0,
    );
    await page
      .getByRole("button", { name: "Pause preview", exact: true })
      .click();
    assert.equal(
      await video.evaluate((el: HTMLVideoElement) => el.controls),
      false,
      "Playback controls must not cover the caption",
    );
    const seek = page.getByRole("slider", {
      name: "Preview position",
      exact: true,
    });
    await seek.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    assert.ok(Number(await seek.inputValue()) > 1);
    await page.keyboard.press("Home");
    await page.screenshot({
      path: path.join(root, "studio-export.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Edit scene 2" }).click();
    await page
      .getByRole("textbox", { name: "Caption for scene 2", exact: true })
      .fill("The title changes, the original footage stays.");
    await page.getByRole("button", { name: "Final cut", exact: true }).click();
    await page
      .getByText("Edits pending. Export to update the final cut.")
      .waitFor();
    await page.getByRole("button", { name: "Update export" }).click();
    await page
      .getByText("Edits pending. Export to update the final cut.")
      .waitFor({ state: "hidden", timeout: 180000 });
    assert.equal((await readdir(path.join(root, "recordings"))).length, 5);
    const mp4Href = await page
      .getByRole("link", { name: /Download MP4/ })
      .getAttribute("href");
    const gifHref = await page
      .getByRole("link", { name: /Download GIF/ })
      .getAttribute("href");
    for (const href of [mp4Href, gifHref]) {
      const download = await fetch(origin + href);
      assert.equal(download.status, 200);
      assert.ok((await download.arrayBuffer()).byteLength > 1000);
    }
    await page
      .waitForFunction(() => {
        const video = document.querySelector("video");
        return video && video.readyState >= 2;
      })
      .catch(async (cause) => {
        await writeFile(
          path.join(root, "playback-failure.json"),
          JSON.stringify(
            await page.locator("video").evaluate((el: HTMLVideoElement) => ({
              src: el.currentSrc,
              readyState: el.readyState,
              networkState: el.networkState,
              error: el.error && {
                code: el.error.code,
                message: el.error.message,
              },
            })),
            null,
            2,
          ),
        );
        await page.screenshot({
          path: path.join(root, "playback-failure.png"),
          fullPage: true,
        });
        throw cause;
      });
    const frameButton = page.getByRole("button", {
      name: "Frame & export",
      exact: true,
    });
    await frameButton.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("radio", { name: /Midnight/ }).check();
    await page.screenshot({
      path: path.join(root, "studio-frame.png"),
      fullPage: true,
    });
    await page.getByRole("radio", { name: /Studio/ }).check();
    await page.getByRole("button", { name: "Script", exact: true }).click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "Caption for scene 2", exact: true })
        .inputValue(),
      "The title changes, the original footage stays.",
    );
    const layouts = [
      { width: 390, height: 900 },
      { width: 768, height: 900 },
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
    ];
    for (const { width, height } of layouts) {
      await page.setViewportSize({ width, height });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Horizontal overflow at ${width} × ${height}`,
      );
      if (width >= 1200) {
        const stage = await page.locator(".preview-stage").boundingBox();
        const scene = await page
          .getByRole("button", { name: "Edit scene 1", exact: true })
          .boundingBox();
        assert.ok(
          stage && stage.height > 220 && stage.y + stage.height < height,
        );
        assert.ok(
          scene && scene.y + scene.height < height,
          "The scene strip must fit without page scrolling",
        );
      }
      await page.screenshot({
        path: path.join(root, `studio-${width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1600, height: 1120 });
    const captionTwo = page.getByRole("textbox", {
      name: "Caption for scene 2",
      exact: true,
    });
    const previousCaption = await captionTwo.inputValue();
    await captionTwo.fill(
      "Keep the project name readable while the same workflow records again. 编辑字幕不会改变原始录像；较长的中文和英文内容也应完整显示。",
    );
    assert.ok(
      await captionTwo.evaluate(
        (el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 1,
      ),
      "Long captions must expand instead of clipping",
    );
    await page.screenshot({
      path: path.join(root, "studio-long-caption.png"),
      fullPage: true,
    });
    await captionTwo.fill(previousCaption);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Open help", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Close help",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Got it",
    );
    await page.screenshot({ path: path.join(root, "studio-help.png") });
    await page.getByRole("button", { name: "Got it", exact: true }).click();
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Open help",
    );
    assert.deepEqual(errors, []);
    results.ui = {
      recordEditExport: true,
      videoPlayback: true,
      downloads: true,
      offlineEditNoRecapture: true,
      responsiveWidths: [390, 768, 1280, 1366, 1600],
      frameInspectorPreservesEdits: true,
      desktopPreviewAndScenesFit: true,
      helpKeyboardFocus: true,
      externalPlaybackControls: true,
      keyboardSeek: true,
      keyboardDisclosures: true,
      inlineCaptionExpansion: true,
      pageErrors: errors,
    };
    const publicDir = path.resolve("docs", "media");
    await mkdir(publicDir, { recursive: true });
    await copyFile(
      path.join(root, "studio-export.png"),
      path.join(publicDir, "studio.png"),
    );
    await copyFile(
      path.join(itemPath(root, "exports", original.id), "demo.gif"),
      path.join(publicDir, "demo.gif"),
    );
    await copyFile(
      path.join(itemPath(root, "exports", original.id), "demo.mp4"),
      path.join(publicDir, "demo.mp4"),
    );
    await copyFile(
      path.join(itemPath(root, "exports", original.id), "poster.png"),
      path.join(publicDir, "poster.png"),
    );
  } finally {
    await browser.close();
  }
  results.totalSeconds = (performance.now() - started) / 1000;
  await writeFile(
    path.join(root, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(`PASS all end-to-end checks. Evidence: ${root}`);
} finally {
  fixture.closeAllConnections();
  fixture.close();
  await studio.close();
  studioServer.closeAllConnections();
  await new Promise<void>((resolve) => studioServer.close(() => resolve()));
}
