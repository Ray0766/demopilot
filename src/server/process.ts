import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Cancelled");
}

export async function pause(ms: number, signal?: AbortSignal) {
  throwIfAborted(signal);
  await delay(ms, undefined, { signal });
}

export async function run(
  binary: string,
  args: string[],
  options: { cwd?: string; signal?: AbortSignal; timeout?: number } = {},
): Promise<string> {
  throwIfAborted(options.signal);
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let output = "";
    let error = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${binary} exceeded its time limit.`));
    }, options.timeout ?? 180000);
    const cancel = () => child.kill();
    options.signal?.addEventListener("abort", cancel, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-100000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      error = (error + chunk.toString()).slice(-12000);
    });
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
    };
    child.on("error", (cause) => {
      cleanup();
      reject(
        new Error(
          `Cannot run ${binary}. Install it and add it to PATH. ${cause.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      cleanup();
      if (options.signal?.aborted) reject(new Error("Cancelled"));
      else if (code !== 0)
        reject(new Error(`${binary} failed (${code}): ${error.slice(-2500)}`));
      else resolve(output);
    });
  });
}

export const ffmpeg = () => process.env.FFMPEG_PATH || "ffmpeg";
export const ffprobe = () => process.env.FFPROBE_PATH || "ffprobe";

export async function probe(file: string, signal?: AbortSignal) {
  const data = JSON.parse(
    await run(
      ffprobe(),
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
      { signal },
    ),
  );
  const stream = data.streams.find(
    (s: { codec_type: string }) => s.codec_type === "video",
  );
  if (
    !stream ||
    !Number.isFinite(Number(data.format.duration)) ||
    Number(data.format.duration) <= 0
  )
    throw new Error("The recording has no usable video frames.");
  return {
    duration: Number(data.format.duration),
    width: stream.width as number,
    height: stream.height as number,
    codec: stream.codec_name as string,
    fps: stream.avg_frame_rate as string,
  };
}
