import { describe, expect, it } from "vitest";
import { JobManager } from "./jobs.js";

describe("JobManager", () => {
  it("marks a cancelled job cancelled rather than done", async () => {
    const jobs = new JobManager();
    const job = jobs.startJob("cpu-profile", () => new Promise((resolve) => setTimeout(() => resolve("late"), 5)));

    expect(jobs.cancel(job.id)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 15));

    const result = jobs.getResult(job.id);
    expect(result?.status).toBe("cancelled");
    expect(result?.result).toBeUndefined();
  });

  it("refuses to cancel a job that already finished", async () => {
    const jobs = new JobManager();
    const job = jobs.startJob("cpu-profile", () => Promise.resolve("done"));
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(jobs.cancel(job.id)).toBe(false);
    expect(jobs.getResult(job.id)?.result).toBe("done");
  });

  it("records the failure reason when the executor rejects", async () => {
    const jobs = new JobManager();
    const job = jobs.startJob("cpu-profile", () => Promise.reject(new Error("detached")));
    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = jobs.getResult(job.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("detached");
  });
});
