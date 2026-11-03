import { z } from "zod";
import {
  recipeSchema,
  stepSchema,
  type Recipe,
  type ExportResult,
} from "../shared/schema";

// Restore incomplete text edits too; capture/export still require recipeSchema.
const draftRecipeSchema = z.object({
  ...recipeSchema.shape,
  title: z.string().max(80),
  url: z.string().max(2048),
  steps: z.array(z.object(stepSchema.shape)).min(1).max(40),
});
const draftSchema = z.object({
  recipe: draftRecipeSchema,
  exportId: z.string().uuid().nullable(),
});
const workspaceSchema = z.object({
  version: z.literal(1),
  recipe: draftRecipeSchema,
  recordingId: z.string().uuid().nullable(),
  drafts: z.record(z.string().uuid(), draftSchema),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type Draft = z.infer<typeof draftSchema>;
const key = "demopilot.workspace";

export function readWorkspace(
  storage: Pick<Storage, "getItem">,
): (Workspace & { legacy?: boolean }) | null {
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const parsed = workspaceSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {
    /* Try the v0.1.0 draft below. */
  }
  try {
    const raw = storage.getItem("demopilot.recipe");
    if (raw)
      return {
        version: 1,
        recipe: draftRecipeSchema.parse(JSON.parse(raw)),
        recordingId: null,
        drafts: {},
        legacy: true,
      };
  } catch {
    /* Missing, corrupt or unavailable browser storage starts a new draft. */
  }
  return null;
}

export function saveWorkspace(
  storage: Pick<Storage, "setItem">,
  recipe: Recipe,
  recordingId: string | null,
  output: ExportResult | null,
  drafts: Record<string, Draft>,
): Workspace {
  const workspace: Workspace = {
    version: 1,
    recipe,
    recordingId,
    drafts: { ...drafts },
  };
  if (recordingId)
    workspace.drafts[recordingId] = { recipe, exportId: output?.id || null };
  // One atomic localStorage write keeps the recipe and media association together.
  storage.setItem(key, JSON.stringify(workspace));
  return workspace;
}

const exportSchema = z.object({
  id: z.string().uuid(),
  recordingId: z.string().uuid(),
  recipe: recipeSchema,
  duration: z.number().positive(),
  trimmedSeconds: z.number().nonnegative(),
  bytes: z.object({ mp4: z.number().positive(), gif: z.number().positive() }),
});

export async function restoreExport(
  id: string,
  recordingId: string,
): Promise<ExportResult> {
  const response = await fetch(
    `/media/exports/${encodeURIComponent(id)}/export.json`,
    { cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      "The previous export is unavailable. Your edits are safe; export again to rebuild it.",
    );
  const parsed = exportSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success)
    throw new Error(
      "The saved export metadata is invalid. Your edits are safe; export again to rebuild it.",
    );
  const result = parsed.data;
  if (result.id !== id || result.recordingId !== recordingId)
    throw new Error(
      "The saved export belongs to another recording. Export this draft again.",
    );
  return {
    ...result,
    mp4: `/media/exports/${id}/demo.mp4`,
    gif: `/media/exports/${id}/demo.gif`,
    poster: `/media/exports/${id}/poster.png`,
  };
}
