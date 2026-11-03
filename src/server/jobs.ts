import { randomUUID } from "node:crypto";
import type { Job } from "../shared/schema.js";
import type { Progress } from "./capture.js";

export class Jobs {
  private jobs = new Map<string, Job>();
  private controllers = new Map<string, AbortController>();

  start(
    kind: Job["kind"],
    work: (signal: AbortSignal, progress: Progress) => Promise<Job["result"]>,
  ): Job {
    if (this.controllers.size)
      throw new Error(
        "Another job is running. Wait for it to finish or cancel it.",
      );
    while (this.jobs.size >= 50)
      this.jobs.delete(this.jobs.keys().next().value!);
    const id = randomUUID();
    const job: Job = {
      id,
      kind,
      status: "running",
      message: "Starting…",
      progress: 0,
    };
    const controller = new AbortController();
    this.jobs.set(id, job);
    this.controllers.set(id, controller);
    const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    void work(controller.signal, (message, progress, stepId) =>
      Object.assign(job, { message, progress, stepId }),
    )
      .then((result) => {
        job.result = result;
        job.status = "complete";
        job.progress = 1;
      })
      .catch((error: Error) => {
        job.status = controller.signal.aborted ? "cancelled" : "failed";
        job.error = error.message;
        job.message =
          job.status === "cancelled"
            ? "Cancelled. No partial export was kept."
            : "The job stopped. Fix the issue and try again.";
      })
      .finally(() => {
        clearTimeout(timer);
        this.controllers.delete(id);
      });
    return job;
  }
  get(id: string) {
    return this.jobs.get(id);
  }
  cancel(id: string) {
    this.controllers.get(id)?.abort();
  }
  cancelAll() {
    for (const controller of this.controllers.values()) controller.abort();
  }
  async settle() {
    while (this.controllers.size)
      await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
