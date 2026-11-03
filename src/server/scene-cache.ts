import path from "node:path";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { throwIfAborted } from "./process.js";
import { writeJson } from "./store.js";

export const SCENE_RENDER_VERSION = 1;
const MAX_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 128;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const cacheDir = (root: string) => path.join(root, "cache", "scenes");
export const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export async function hashFile(file: string, signal?: AbortSignal) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) {
    throwIfAborted(signal);
    hash.update(chunk);
  }
  throwIfAborted(signal);
  return hash.digest("hex");
}

function files(root: string, key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid scene cache key.");
  return {
    clip: path.join(cacheDir(root), `${key}.mp4`),
    metadata: path.join(cacheDir(root), `${key}.json`),
  };
}

/** A damaged/incomplete entry is a miss; copying and hashing also detects partial disk writes. */
export async function reuseScene(
  root: string,
  key: string,
  destination: string,
  signal: AbortSignal,
) {
  const entry = files(root, key);
  try {
    const metadata = JSON.parse(await readFile(entry.metadata, "utf8"));
    const info = await stat(entry.clip);
    if (
      metadata.version !== SCENE_RENDER_VERSION ||
      metadata.bytes !== info.size ||
      !/^[a-f0-9]{64}$/.test(metadata.sha256)
    )
      return false;
    throwIfAborted(signal);
    await copyFile(entry.clip, destination);
    if ((await hashFile(destination, signal)) !== metadata.sha256) {
      await rm(destination, { force: true });
      return false;
    }
    await utimes(entry.clip, new Date(), new Date()).catch(() => {});
    return true;
  } catch {
    throwIfAborted(signal);
    await rm(destination, { force: true }).catch(() => {});
    return false;
  }
}

/** Publish only fully encoded scenes, atomically. Cache failure must not lose a valid export. */
export async function rememberScene(
  root: string,
  key: string,
  source: string,
  signal: AbortSignal,
) {
  const entry = files(root, key),
    temporary = `${entry.clip}.${randomUUID()}.tmp`;
  try {
    throwIfAborted(signal);
    await mkdir(cacheDir(root), { recursive: true });
    const bytes = (await stat(source)).size;
    if (bytes > MAX_BYTES) return;
    await copyFile(source, temporary);
    const sha256 = await hashFile(temporary, signal);
    await rename(temporary, entry.clip);
    await writeJson(entry.metadata, {
      version: SCENE_RENDER_VERSION,
      bytes,
      sha256,
    });
  } catch {
    throwIfAborted(signal);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export async function pruneSceneCache(root: string) {
  const dir = cacheDir(root);
  const names = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const entries = await Promise.all(
    names
      .filter((name) => name.isFile() && /^[a-f0-9]{64}\.mp4$/.test(name.name))
      .map(async (name) => {
        const info = await stat(path.join(dir, name.name)).catch(() => null);
        return info
          ? { name: name.name, bytes: info.size, touched: info.mtimeMs }
          : null;
      }),
  );
  let bytes = 0,
    count = 0;
  for (const entry of entries
    .filter((item) => item !== null)
    .sort((a, b) => b.touched - a.touched)) {
    count++;
    bytes += entry.bytes;
    if (
      count > MAX_ENTRIES ||
      bytes > MAX_BYTES ||
      Date.now() - entry.touched > MAX_AGE_MS
    ) {
      await rm(path.join(dir, entry.name), { force: true }).catch(() => {});
      await rm(path.join(dir, entry.name.replace(/\.mp4$/, ".json")), {
        force: true,
      }).catch(() => {});
    }
  }
}
