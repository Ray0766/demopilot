import assert from "node:assert/strict";
import { mkdir, writeFile, readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createApp } from "../src/server/app.js";
import { itemPath, loadRecording } from "../src/server/store.js";

const root = path.resolve("test-results", `recovery-${Date.now()}`);
await mkdir(root, { recursive: true });
const origin = "http://127.0.0.1:4324";
let studio = await createApp({ root, port: 4324 });
const listen = () =>
  new Promise<ReturnType<typeof studio.app.listen>>((resolve) => {
    const listener = studio.app.listen(4324, "127.0.0.1", () =>
      resolve(listener),
    );
  });
let server = await listen();
const closeStudio = async () => {
  await studio.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
};
const sourceHashes = async (id: string) =>
  Promise.all(
    (await loadRecording(root, id)).scenes.map(async (scene) =>
      createHash("sha256")
        .update(
          await readFile(
            path.join(itemPath(root, "recordings", id), scene.file),
          ),
        )
        .digest("hex"),
    ),
  );
const relocateTestItem = async (kind: "exports" | "recordings", id: string) => {
  const from = path.resolve(itemPath(root, kind, id));
  const to = path.resolve(root, `unavailable-${kind}-${id}`);
  assert.ok(from.startsWith(root + path.sep) && to.startsWith(root + path.sep));
  await rename(from, to);
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1120 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Record demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Record again", exact: true })
    .waitFor({ timeout: 90000 });
  const recordings = page.getByRole("combobox", {
    name: "Previous recordings",
  });
  const firstId = await recordings.inputValue();
  const originalHashes = await sourceHashes(firstId);
  const caption = page.getByRole("textbox", {
    name: "Caption for scene 1",
    exact: true,
  });
  await caption.fill("A draft worth keeping. 保留这次编辑。");
  await page.locator(".timing-disclosure > summary").click();
  await page.getByLabel("Trim start seconds").fill("0.1");
  await page
    .getByRole("combobox", { name: /Hold the result/ })
    .selectOption("3000");
  await page
    .getByRole("button", { name: "Export MP4 + GIF", exact: true })
    .click();
  const download = page.getByRole("link", { name: /Download MP4/ });
  await download.waitFor({ timeout: 180000 });
  const firstExport = await download.getAttribute("href");
  await caption.fill("An unpublished change survives reload. 未导出的修改。");
  await page.reload();
  await page
    .getByRole("button", { name: "Record again", exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(root, "after-reload.png"),
    fullPage: true,
  });
  assert.equal(
    await recordings.inputValue(),
    firstId,
    "reload must keep the recording associated with its edited draft",
  );
  assert.equal(
    await caption.inputValue(),
    "An unpublished change survives reload. 未导出的修改。",
  );
  await page.locator(".timing-disclosure > summary").click();
  assert.equal(await page.getByLabel("Trim start seconds").inputValue(), "0.1");
  assert.equal(
    await page.getByRole("combobox", { name: /Hold the result/ }).inputValue(),
    "3000",
  );
  await page
    .getByText("Edits pending. Export to update the final cut.")
    .waitFor();
  assert.equal(await download.getAttribute("href"), firstExport);
  assert.equal((await readdir(path.join(root, "recordings"))).length, 1);

  await page.getByRole("button", { name: "Record again", exact: true }).click();
  await page.getByRole("button", { name: "Recording…", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Record again", exact: true })
    .waitFor({ timeout: 90000 });
  const secondId = await recordings.inputValue();
  assert.notEqual(firstId, secondId);
  assert.equal(
    await caption.inputValue(),
    "An unpublished change survives reload. 未导出的修改。",
  );
  await caption.fill("A separate take keeps a separate draft.");
  await recordings.selectOption(firstId);
  await page
    .getByRole("button", { name: "Update export", exact: true })
    .waitFor();
  assert.equal(
    await caption.inputValue(),
    "An unpublished change survives reload. 未导出的修改。",
  );
  assert.equal(await download.getAttribute("href"), firstExport);
  await recordings.selectOption(secondId);
  await page
    .getByRole("button", { name: "Export MP4 + GIF", exact: true })
    .waitFor();
  assert.equal(
    await caption.inputValue(),
    "A separate take keeps a separate draft.",
  );
  assert.equal(await download.count(), 0);
  await recordings.selectOption(firstId);
  await page
    .getByRole("button", { name: "Update export", exact: true })
    .click();
  await page
    .getByText("Edits pending. Export to update the final cut.")
    .waitFor({ state: "hidden", timeout: 180000 });
  const revisedExport = await download.getAttribute("href");
  assert.notEqual(revisedExport, firstExport);
  assert.deepEqual(await sourceHashes(firstId), originalHashes);
  assert.equal((await readdir(path.join(root, "recordings"))).length, 2);
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video && video.readyState >= 2;
  });
  await page.screenshot({
    path: path.join(root, "restored-and-exported.png"),
    fullPage: true,
  });

  // Stop and restart the process, keeping only its disk data and the browser draft.
  await closeStudio();
  studio = await createApp({ root, port: 4324 });
  server = await listen();
  await page.reload();
  await page
    .getByRole("button", { name: "Update export", exact: true })
    .waitFor();
  assert.equal(await recordings.inputValue(), firstId);
  assert.equal(await download.getAttribute("href"), revisedExport);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 503, body: "temporarily unavailable" }),
  );
  await page.reload();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("demopilot.workspace")!).recordingId,
    ),
    firstId,
  );
  await page.unroute("**/api/bootstrap");
  await page.reload();
  await page
    .getByRole("button", { name: "Update export", exact: true })
    .waitFor();
  // An incomplete target is still an edit, not a reason to discard the workspace.
  const target = page.getByRole("textbox", { name: "Target", exact: true });
  await page.locator(".action-disclosure > summary").click();
  const originalTarget = await target.inputValue();
  await target.fill("");
  await page.reload();
  await page
    .getByRole("button", { name: "Record again", exact: true })
    .waitFor();
  await page.locator(".action-disclosure > summary").click();
  assert.equal(await target.inputValue(), "");
  assert.equal(
    await page
      .getByRole("button", { name: "Update export", exact: true })
      .isEnabled(),
    false,
  );
  await target.fill(originalTarget);

  const exportId = revisedExport!.split("/")[3];
  await relocateTestItem("exports", exportId);
  await page.reload();
  await page
    .getByText(
      "The previous export is unavailable. Your edits are safe; export again to rebuild it.",
    )
    .waitFor();
  assert.equal(
    await caption.inputValue(),
    "An unpublished change survives reload. 未导出的修改。",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Export MP4 + GIF", exact: true })
      .isEnabled(),
    true,
  );
  assert.equal(await download.count(), 0);

  await relocateTestItem("recordings", firstId);
  await page.reload();
  await page
    .getByText(
      "The saved recording is unavailable. Your edits are safe; record again to capture new footage.",
    )
    .waitFor();
  assert.equal(await recordings.inputValue(), "");
  assert.equal(
    await caption.inputValue(),
    "An unpublished change survives reload. 未导出的修改。",
  );
  // Reload again: never replace the missing take with a different matching take.
  await page.reload();
  await page
    .getByRole("button", { name: "Record demo", exact: true })
    .waitFor();
  assert.equal(await recordings.inputValue(), "");
  await page.screenshot({
    path: path.join(root, "missing-recording.png"),
    fullPage: true,
  });

  // Migration from v0.1.0 retains its edited recipe and matches existing footage.
  const legacy = structuredClone((await loadRecording(root, secondId)).recipe);
  legacy.steps[0].caption = "A migrated v0.1.0 draft.";
  await page.evaluate((recipe) => {
    localStorage.removeItem("demopilot.workspace");
    localStorage.setItem("demopilot.recipe", JSON.stringify(recipe));
  }, legacy);
  await page.reload();
  await page
    .getByRole("button", { name: "Record again", exact: true })
    .waitFor();
  assert.equal(await recordings.inputValue(), secondId);
  assert.equal(await caption.inputValue(), legacy.steps[0].caption);
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(root, "results.json"),
    JSON.stringify(
      {
        reload: true,
        unpublishedDraft: true,
        exportRestored: true,
        independentTakes: true,
        rerenderWithoutCapture: true,
        sourceHashesUnchanged: true,
        processRestart: true,
        connectionFailurePreservesDraft: true,
        incompleteDraft: true,
        missingExport: true,
        missingRecording: true,
        noSilentSubstitution: true,
        legacyMigration: true,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(`PASS workspace recovery. Evidence: ${root}`);
} finally {
  await browser.close();
  await closeStudio();
}
