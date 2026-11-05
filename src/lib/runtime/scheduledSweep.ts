/**
 * Cron trigger for the webhook retry sweep (S4, ADR-5).
 *
 * The worker's `scheduled` handler calls the sweep endpoint through the
 * worker's own `fetch`, so no public URL is involved and the endpoint keeps
 * its single guard (Bearer `CRON_SECRET`). Kept free of path aliases and
 * Next.js imports because `worker.ts` bundles it outside the Next build.
 */

export const SWEEP_PATH = "/api/webhook/instagram/sweep";

export interface ScheduledSweepEnv {
  CRON_SECRET?: string;
}

export type WorkerFetch<Env, Ctx> = (
  request: Request,
  env: Env,
  ctx: Ctx
) => Promise<Response> | Response;

/** Runs one sweep. Never rejects: failures are logged for Workers Logs. */
export async function runScheduledSweep<Env extends ScheduledSweepEnv, Ctx>(
  fetchHandler: WorkerFetch<Env, Ctx>,
  env: Env,
  ctx: Ctx
): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error("Scheduled sweep skipped: CRON_SECRET is not set");
    return;
  }

  try {
    const request = new Request(`https://internal${SWEEP_PATH}`, {
      method: "GET",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const response = await fetchHandler(request, env, ctx);
    if (!response.ok) {
      console.error(`Scheduled sweep failed with status ${response.status}`);
    }
  } catch (error) {
    console.error("Scheduled sweep threw", error);
  }
}
