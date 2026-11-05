import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Runs a task in the background without blocking the HTTP response.
 *
 * On Cloudflare Workers (via OpenNext) it schedules the task with
 * `waitUntil`, so the response can return 200 immediately while the task
 * keeps running. When no Cloudflare context exists (Jest, `next dev`) it
 * runs the task and only logs failures — errors never reach the HTTP
 * response. The sweep (ADR-5) covers work killed by the runtime.
 */
export function runInBackground(task: () => Promise<void>): void {
  try {
    const ctx = getCloudflareContext();
    if (ctx?.ctx?.waitUntil) {
      ctx.ctx.waitUntil(task());
      return;
    }
  } catch {
    // No Cloudflare context available (Jest, next dev, etc.)
  }

  // Fallback: run and log failures only. Errors never reach the response.
  void task().catch((error: unknown) => {
    console.error("Background task failed:", error);
  });
}
