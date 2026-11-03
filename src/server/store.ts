import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Recording, ExportResult } from "../shared/schema.js";

export const validId = /^[a-f0-9-]{36}$/;
export function itemPath(
  root: string,
  kind: "recordings" | "exports",
  id: string,
) {
  if (!validId.test(id)) throw new Error("Invalid project ID.");
  return path.join(root, kind, id);
}
export async function createItem(root: string, kind: "recordings" | "exports") {
  const id = randomUUID();
  const dir = itemPath(root, kind, id);
  await mkdir(dir, { recursive: true });
  return { id, dir };
}
export async function writeJson(file: string, data: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2) + "\n");
  await rename(temporary, file);
}
export async function loadRecording(
  root: string,
  id: string,
): Promise<Recording> {
  return JSON.parse(
    await readFile(
      path.join(itemPath(root, "recordings", id), "recording.json"),
      "utf8",
    ),
  );
}
export async function listRecordings(root: string): Promise<Recording[]> {
  const names = await readdir(path.join(root, "recordings")).catch(
    () => [] as string[],
  );
  const items = await Promise.all(
    names
      .filter((id) => validId.test(id))
      .map((id) => loadRecording(root, id).catch(() => null)),
  );
  return items
    .filter((item): item is Recording => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function loadExport(
  root: string,
  id: string,
): Promise<ExportResult> {
  return JSON.parse(
    await readFile(
      path.join(itemPath(root, "exports", id), "export.json"),
      "utf8",
    ),
  );
}
export async function removeItem(
  root: string,
  kind: "recordings" | "exports",
  id: string,
) {
  await rm(itemPath(root, kind, id), { recursive: true, force: true });
}
