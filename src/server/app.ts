import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { recipeSchema } from "../shared/schema.js";
import { exampleRecipe } from "../shared/example.js";
import { capture } from "./capture.js";
import { render } from "./render.js";
import { listRecordings, loadRecording, itemPath, validId } from "./store.js";
import { Jobs } from "./jobs.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export async function createApp(options: {
  root: string;
  port: number;
  dev?: boolean;
}) {
  const app = express();
  const jobs = new Jobs();
  const token = randomBytes(32).toString("hex");
  const allowedHosts = new Set([
    `127.0.0.1:${options.port}`,
    `localhost:${options.port}`,
  ]);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (!allowedHosts.has(req.headers.host || ""))
      return res
        .status(403)
        .json({
          error: "Use the loopback Studio URL printed in your terminal.",
        });
    const origin = req.headers.origin;
    if (
      origin &&
      ![
        `http://127.0.0.1:${options.port}`,
        `http://localhost:${options.port}`,
      ].includes(origin)
    )
      return res
        .status(403)
        .json({ error: "Cross-origin requests are not allowed." });
    if (
      req.headers["sec-fetch-site"] === "cross-site" &&
      !req.path.startsWith("/sample")
    )
      return res.status(403).end();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET") return next();
    const sent = Buffer.from(
      req.headers["x-demopilot-token"]?.toString() || "",
    );
    const expected = Buffer.from(token);
    if (sent.length !== expected.length || !timingSafeEqual(sent, expected))
      return res
        .status(403)
        .json({ error: "Reload Studio to renew the local session." });
    next();
  });
  app.get("/api/bootstrap", async (_req, res) =>
    res.json({
      token,
      example: exampleRecipe(`http://127.0.0.1:${options.port}`),
      recordings: await listRecordings(options.root),
    }),
  );
  app.post("/api/record", async (req, res) => {
    const recipe = recipeSchema.parse(req.body);
    res
      .status(202)
      .json(
        jobs.start("record", (signal, progress) =>
          capture(recipe, options.root, signal, progress),
        ),
      );
  });
  app.post("/api/render", async (req, res) => {
    const recipe = recipeSchema.parse(req.body.recipe);
    const recording = await loadRecording(options.root, req.body.recordingId);
    res
      .status(202)
      .json(
        jobs.start("render", (signal, progress) =>
          render(recording, recipe, options.root, signal, progress),
        ),
      );
  });
  app.get("/api/jobs/:id", (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job)
      return res
        .status(404)
        .json({ error: "This job is no longer available. Record again." });
    res.json(job);
  });
  app.post("/api/jobs/:id/cancel", (req, res) => {
    jobs.cancel(req.params.id);
    res.json({ ok: true });
  });
  app.get("/media/:kind/:id/:file", (req, res) => {
    const { kind, id, file } = req.params;
    if (
      !["recordings", "exports"].includes(kind) ||
      !validId.test(id) ||
      !/^(\d+\.(webm|png)|demo\.(mp4|gif)|poster\.png|export\.json|recording\.json)$/.test(
        file,
      )
    )
      return res.sendStatus(404);
    res.sendFile(
      path.join(
        itemPath(options.root, kind as "recordings" | "exports", id),
        file,
      ),
    );
  });
  app.get("/sample", async (_req, res) =>
    res
      .type("html")
      .send(
        await readFile(
          path.join(packageRoot, "examples", "sample.html"),
          "utf8",
        ),
      ),
  );
  let vite: { close(): Promise<void> } | undefined;
  if (options.dev) {
    const { createServer } = await import("vite");
    const server = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(server.middlewares);
    vite = server;
  } else {
    app.use(express.static(path.join(packageRoot, "dist", "client")));
    app.get("/", (_req, res) =>
      res.sendFile(path.join(packageRoot, "dist", "client", "index.html")),
    );
  }
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message =
        error instanceof Error ? error.message : "Unexpected error";
      res
        .status(message.includes("Another job") ? 409 : 400)
        .json({ error: message });
    },
  );
  return {
    app,
    jobs,
    close: async () => {
      jobs.cancelAll();
      await jobs.settle();
      await vite?.close();
    },
  };
}
