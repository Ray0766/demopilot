import { z } from "zod";

export const httpUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Use an http(s) URL without embedded credentials.");

export const stepSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    action: z.enum([
      "click",
      "fill",
      "press",
      "scroll",
      "wait",
      "navigate",
      "hover",
      "select",
    ]),
    target: z.string().max(500).default(""),
    value: z.string().max(2000).default(""),
    caption: z.string().max(160).default(""),
    waitFor: z.string().max(500).default(""),
    holdMs: z.number().int().min(500).max(8000).default(1800),
    zoom: z.number().min(1).max(1.8).default(1),
    trimStart: z.number().min(0).max(60).default(0),
    trimEnd: z.number().min(0).max(60).default(0),
  })
  .superRefine((step, ctx) => {
    if (
      ["click", "fill", "press", "hover", "select", "wait"].includes(
        step.action,
      ) &&
      !step.target.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["target"],
        message: "This action needs a target.",
      });
    }
    if (step.action === "navigate" && !httpUrl.safeParse(step.value).success) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Navigation needs an http(s) URL.",
      });
    }
    if (
      step.action === "press" &&
      (!step.value.trim() || step.value.length > 120)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter a key or shortcut, for example Enter or Control+A.",
      });
    }
    if (
      step.action === "scroll" &&
      (!Number.isFinite(Number(step.value)) ||
        Math.abs(Number(step.value)) > 5000)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Scroll distance must be between -5000 and 5000 pixels.",
      });
    }
  });

export const recipeSchema = z
  .object({
    version: z.literal(1).default(1),
    title: z.string().trim().min(1).max(80),
    url: httpUrl,
    viewport: z
      .object({
        width: z.number().int().min(640).max(1920),
        height: z.number().int().min(480).max(1080),
      })
      .default({ width: 1280, height: 800 }),
    template: z.enum(["studio", "paper", "midnight"]).default("studio"),
    trimWaiting: z.boolean().default(true),
    timeoutMs: z.number().int().min(1000).max(60000).default(15000),
    steps: z.array(stepSchema).min(1).max(40),
  })
  .superRefine((recipe, ctx) => {
    if (new Set(recipe.steps.map((s) => s.id)).size !== recipe.steps.length) {
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Step IDs must be unique.",
      });
    }
  });

export type Recipe = z.infer<typeof recipeSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Template = Recipe["template"];
export type Scene = {
  stepId: string;
  file: string;
  poster: string;
  duration: number;
  actionEnd: number;
  readyAt: number;
  preWaitMs: number;
  focus: { x: number; y: number };
};
export type Recording = {
  id: string;
  createdAt: string;
  recipe: Recipe;
  fingerprint: string;
  scenes: Scene[];
  elapsedMs: number;
};
export type ExportResult = {
  id: string;
  recordingId: string;
  recipe: Recipe;
  duration: number;
  trimmedSeconds: number;
  mp4: string;
  gif: string;
  poster: string;
  bytes: { mp4: number; gif: number };
};
export type Job = {
  id: string;
  kind: "record" | "render";
  status: "running" | "complete" | "failed" | "cancelled";
  message: string;
  progress: number;
  stepId?: string;
  result?: Recording | ExportResult;
  error?: string;
};

/** Editing never changes capture identity; any workflow change requires a new recording. */
export function captureIdentity(recipe: Recipe) {
  return JSON.stringify({
    url: recipe.url,
    viewport: recipe.viewport,
    steps: recipe.steps.map(({ id, action, target, value, waitFor }) => ({
      id,
      action,
      target,
      value,
      waitFor,
    })),
  });
}

export const templateColors = {
  studio: {
    background: "#e6e8f7",
    surface: "#ffffff",
    ink: "#273147",
    accent: "#4f63d8",
    muted: "#58647a",
  },
  paper: {
    background: "#edf1ed",
    surface: "#ffffff",
    ink: "#233a32",
    accent: "#36735b",
    muted: "#536d61",
  },
  midnight: {
    background: "#202b40",
    surface: "#303e58",
    ink: "#f2f5ff",
    accent: "#a7b9ff",
    muted: "#c2cde2",
  },
} as const;
