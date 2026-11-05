/**
 * @jest-environment node
 *
 * Cron trigger for the webhook retry sweep (S4, ADR-5): the worker's
 * `scheduled` handler calls the sweep endpoint through its own fetch.
 */
import fs from "fs";
import path from "path";
import { runScheduledSweep, SWEEP_PATH } from "../scheduledSweep";

describe("runScheduledSweep", () => {
  const ctx = { waitUntil: jest.fn() };
  let fetchHandler: jest.Mock;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchHandler = jest.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => errorSpy.mockRestore());

  it("calls the sweep endpoint through the worker's own fetch with the Bearer secret", async () => {
    const env = { CRON_SECRET: "s3cret" };

    await runScheduledSweep(fetchHandler, env, ctx);

    expect(fetchHandler).toHaveBeenCalledTimes(1);
    const [request, passedEnv, passedCtx] = fetchHandler.mock.calls[0];
    expect(new URL(request.url).pathname).toBe(SWEEP_PATH);
    expect(SWEEP_PATH).toBe("/api/webhook/instagram/sweep");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer s3cret");
    expect(passedEnv).toBe(env);
    expect(passedCtx).toBe(ctx);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("does not call the endpoint and logs an error when CRON_SECRET is not set", async () => {
    await runScheduledSweep(fetchHandler, {}, ctx);

    expect(fetchHandler).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET"));
  });

  it("logs the status when the sweep endpoint answers with an error", async () => {
    fetchHandler.mockResolvedValue(new Response("{}", { status: 500 }));

    await runScheduledSweep(fetchHandler, { CRON_SECRET: "s3cret" }, ctx);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("500"));
  });

  it("never rejects when the fetch itself throws", async () => {
    fetchHandler.mockRejectedValue(new Error("boom"));

    await expect(runScheduledSweep(fetchHandler, { CRON_SECRET: "s3cret" }, ctx)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("worker entry and Cron trigger configuration", () => {
  const root = path.resolve(__dirname, "../../../..");
  const wrangler = fs.readFileSync(path.join(root, "wrangler.toml"), "utf8");
  const worker = fs.readFileSync(path.join(root, "worker.ts"), "utf8");

  it("uses worker.ts as the entry point and schedules the sweep every 5 minutes", () => {
    expect(wrangler).toMatch(/^main = "worker\.ts"$/m);
    expect(wrangler).toMatch(/\[triggers\]\s*\ncrons = \["\*\/5 \* \* \* \*"\]/);
  });

  it("re-exports the OpenNext worker and its Durable Objects", () => {
    expect(worker).toContain('from "./.open-next/worker.js"');
    for (const durableObject of ["DOQueueHandler", "DOShardedTagCache", "BucketCachePurge"]) {
      expect(worker).toContain(durableObject);
    }
    expect(worker).toContain("scheduled");
    expect(worker).toContain("runScheduledSweep");
  });
});
