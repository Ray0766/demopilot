import assert from "node:assert/strict";
import type { Page } from "playwright";
import type { Recording } from "../src/shared/schema.js";
import { scenePlan } from "../src/shared/composition.js";

/** Exercise native playback through a real removed wait and a repeated final-frame hold. */
export async function checkEditedPlayback(page: Page, recording: Recording) {
  await page.getByLabel("Previous recordings").selectOption(recording.id);
  await page.getByRole("button", { name: "Edit scene 3", exact: true }).click();
  const details = page.locator(".timing-disclosure");
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
  await page.getByLabel("Trim start seconds").fill("60");
  await page.getByText(/trims leave less than 0.3 seconds/).waitFor();
  await page.getByLabel("Trim start seconds").fill("0.2");
  await page.getByLabel("Trim end seconds").fill("0.3");
  await page
    .getByRole("combobox", { name: "Hold the result", exact: true })
    .selectOption("6000");
  await page
    .getByRole("combobox", { name: "Camera focus", exact: true })
    .selectOption("target");
  await page
    .getByRole("combobox", { name: "Camera focus", exact: true })
    .selectOption("follow");
  const caption = page.getByRole("textbox", {
    name: "Caption for scene 3",
    exact: true,
  });
  for (const text of [
    "First edit",
    "Second edit",
    "The last edit wins. 最后一次修改。",
  ])
    await caption.fill(text);
  await page.waitForFunction(
    () =>
      document.querySelector("canvas")?.dataset.caption ===
      "The last edit wins. 最后一次修改。",
  );

  await page.route("**/api/preview-frame", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Synthetic preview interruption. Retry this frame.",
      }),
    }),
  );
  await caption.fill("Recovered preview. 恢复预览。");
  await page
    .getByText("Synthetic preview interruption. Retry this frame.")
    .waitFor();
  await page.unroute("**/api/preview-frame");
  await page
    .getByRole("button", { name: "Retry preview", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("canvas")?.dataset.caption ===
        "Recovered preview. 恢复预览。" &&
      document.querySelector("canvas")?.dataset.ready === "true",
  );

  const edited = {
    ...recording.recipe.steps[2],
    holdMs: 6000,
    trimStart: 0.2,
    trimEnd: 0.3,
  };
  const plan = scenePlan(recording.scenes[2], edited, true);
  assert.equal(plan.ranges.length, 2);
  assert.ok(
    Math.abs(
      Number(
        await page
          .getByLabel("Preview position", { exact: true })
          .getAttribute("max"),
      ) - plan.duration,
    ) < 0.001,
  );
  await page.getByLabel("Preview position", { exact: true }).fill("0");
  await page.evaluate(() => {
    const w = window as unknown as {
      previewSamples: { time: number; source: number; paused: boolean }[];
      previewSampling: number;
    };
    w.previewSamples = [];
    w.previewSampling = window.setInterval(() => {
      const video = document.querySelector("video")!,
        canvas = document.querySelector("canvas")!;
      w.previewSamples.push({
        time: Number(canvas.dataset.time),
        source: video.currentTime,
        paused: video.paused,
      });
    }, 30);
  });
  await page.getByRole("button", { name: "Play preview", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause preview", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Play preview", exact: true })
    .waitFor({ timeout: 15000 });
  const samples = await page.evaluate(() => {
    const w = window as unknown as {
      previewSamples: { time: number; source: number; paused: boolean }[];
      previewSampling: number;
    };
    clearInterval(w.previewSampling);
    return w.previewSamples;
  });
  assert.ok(
    samples.some(
      (s, i) =>
        i > 0 &&
        s.source - samples[i - 1].source > 1 &&
        Math.abs(s.time - samples[i - 1].time) < 0.3,
    ),
    "source jumps over the removed wait while edited time stays continuous",
  );
  assert.ok(
    samples.some((s) => s.paused && s.time > plan.contentEnd + 1),
    "extended hold repeats source footage instead of playing encoder tail frames",
  );
  assert.ok(
    samples.every((s, i) => i === 0 || s.time >= samples[i - 1].time - 0.04),
    "preview time never runs backward",
  );
  assert.ok(
    Math.abs(
      Number(
        await page.getByLabel("Preview position", { exact: true }).inputValue(),
      ) - plan.duration,
    ) < 0.001,
  );
  return {
    invalidTrimRecovered: true,
    latestCaptionWins: true,
    failedFrameRetried: true,
    cutSkippedDuringPlayback: true,
    extendedHold: true,
    duration: plan.duration,
    sampleCount: samples.length,
  };
}
