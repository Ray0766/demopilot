import { chromium, type Page, type Locator } from "playwright";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  captureIdentity,
  type Recipe,
  type Recording,
  type Scene,
} from "../shared/schema.js";
import { createItem, writeJson, removeItem } from "./store.js";
import { pause, probe, throwIfAborted } from "./process.js";

export type Progress = (
  message: string,
  progress: number,
  stepId?: string,
) => void;
export const fingerprint = (recipe: Recipe) =>
  createHash("sha256").update(captureIdentity(recipe)).digest("hex");

export function locate(page: Page, target: string): Locator {
  if (target.startsWith("role:")) {
    const [, role, ...name] = target.split(":");
    return page.getByRole(role as Parameters<Page["getByRole"]>[0], {
      name: name.join(":"),
      exact: true,
    });
  }
  if (target.startsWith("label:"))
    return page.getByLabel(target.slice(6), { exact: true });
  if (target.startsWith("text:"))
    return page.getByText(target.slice(5), { exact: true });
  if (target.startsWith("testid:")) return page.getByTestId(target.slice(7));
  return page.locator(target);
}

export async function capture(
  recipe: Recipe,
  root: string,
  signal: AbortSignal,
  progress: Progress = () => {},
): Promise<Recording> {
  const { id, dir } = await createItem(root, "recordings");
  const started = performance.now();
  const scenes: Scene[] = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let currentStep = "";
  let failure = "";
  const cancel = () => {
    void browser?.close().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    throwIfAborted(signal);
    progress("Opening a fresh browser…", 0.02);
    browser = await chromium.launch({ headless: true });
    throwIfAborted(signal);
    const context = await browser.newContext({
      viewport: recipe.viewport,
      deviceScaleFactor: 1,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      acceptDownloads: false,
    });
    // Block non-web main-frame navigations, including links clicked by a recipe.
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && !/^https?:\/\//i.test(request.url()))
        return route.abort();
      await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(recipe.timeoutMs);
    page.setDefaultNavigationTimeout(recipe.timeoutMs);
    page.on("dialog", (dialog) => {
      failure = `Unexpected ${dialog.type()} dialog. Dismiss it in the app before recording.`;
      void dialog.dismiss();
    });
    context.on("page", (popup) => {
      if (popup !== page) {
        failure =
          "This workflow opened a new tab. Version 0.1 records a single tab.";
        void popup.close();
      }
    });
    const response = await page.goto(recipe.url, {
      waitUntil: "domcontentloaded",
    });
    if (response && response.status() >= 400)
      throw new Error(
        `The website returned HTTP ${response.status()}. Start your app and check the URL.`,
      );
    await page.evaluate(() =>
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]),
    );
    await page.screencast.showActions({
      cursor: "pointer",
      duration: 700,
      style: {
        point:
          "width: 28px; height: 28px; border-radius: 50%; border: 3px solid #7589ff; background: #7589ff26",
        highlight: "outline: 2px solid #7589ff; border-radius: 5px",
        title: "display: none",
      },
    });
    for (const [index, step] of recipe.steps.entries()) {
      throwIfAborted(signal);
      if (failure) throw new Error(failure);
      currentStep = step.id;
      progress(
        `Recording ${index + 1}/${recipe.steps.length}: ${step.caption || step.action}`,
        0.05 + (index / recipe.steps.length) * 0.9,
        step.id,
      );
      const waitStarted = performance.now();
      const target =
        step.target && !["navigate", "scroll"].includes(step.action)
          ? locate(page, step.target)
          : undefined;
      let focus = { x: 0.5, y: 0.5 };
      if (target) {
        await target.waitFor({ state: "visible" });
        await target.scrollIntoViewIfNeeded();
        if (
          ["click", "fill", "select", "hover", "press"].includes(step.action)
        ) {
          const count = await target.count();
          if (count !== 1)
            throw new Error(
              `Target matches ${count} elements. Use a unique role/name, test ID or selector.`,
            );
        }
        const box = await target.boundingBox();
        if (box)
          focus = {
            x: Math.max(
              0,
              Math.min(1, (box.x + box.width / 2) / recipe.viewport.width),
            ),
            y: Math.max(
              0,
              Math.min(1, (box.y + box.height / 2) / recipe.viewport.height),
            ),
          };
      }
      const preWaitMs = performance.now() - waitStarted;
      const file = `${index}.webm`;
      const poster = `${index}.png`;
      await page.screencast.start({
        path: path.join(dir, file),
        size: recipe.viewport,
        fps: 30,
      });
      const sceneStarted = performance.now();
      await pause(450, signal);
      switch (step.action) {
        case "click":
          await target!.click();
          break;
        case "fill":
          if ((await target!.getAttribute("type")) === "password")
            throw new Error(
              "Password fields are not recorded. Use a synthetic, signed-out demo.",
            );
          await target!.fill(step.value);
          break;
        case "press":
          await target!.press(step.value);
          break;
        case "select":
          await target!.selectOption(step.value);
          break;
        case "hover":
          await target!.hover();
          break;
        case "scroll":
          await page.mouse.wheel(0, Number(step.value));
          await pause(450, signal);
          break;
        case "navigate": {
          const result = await page.goto(step.value, {
            waitUntil: "domcontentloaded",
          });
          if (result && result.status() >= 400)
            throw new Error(`Navigation returned HTTP ${result.status()}.`);
          break;
        }
        case "wait":
          break; // The explicit condition has already been awaited above.
      }
      const actionEnd = (performance.now() - sceneStarted) / 1000;
      if (step.waitFor)
        await locate(page, step.waitFor).waitFor({ state: "visible" });
      const readyAt = (performance.now() - sceneStarted) / 1000;
      // Always retain two seconds after readiness; editorial holds are applied in render.
      await pause(2000, signal);
      if (failure) throw new Error(failure);
      await page.screenshot({
        path: path.join(dir, poster),
        animations: "disabled",
      });
      await page.screencast.stop();
      const media = await probe(path.join(dir, file), signal);
      scenes.push({
        stepId: step.id,
        file,
        poster,
        duration: media.duration,
        actionEnd,
        readyAt,
        preWaitMs,
        focus,
      });
    }
    throwIfAborted(signal);
    const recording: Recording = {
      id,
      createdAt: new Date().toISOString(),
      recipe,
      fingerprint: fingerprint(recipe),
      scenes,
      elapsedMs: Math.round(performance.now() - started),
    };
    await writeJson(path.join(dir, "recording.json"), recording);
    progress("Recording saved. Your scenes are ready to edit.", 1);
    return recording;
  } catch (error) {
    await browser?.close().catch(() => {});
    await removeItem(root, "recordings", id);
    if (signal.aborted) throw new Error("Cancelled");
    throw new Error(
      `${currentStep ? `Step “${currentStep}”: ` : ""}${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    signal.removeEventListener("abort", cancel);
    await browser?.close().catch(() => {});
  }
}
