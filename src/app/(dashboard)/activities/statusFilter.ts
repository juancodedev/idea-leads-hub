import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";

/**
 * Maps the `/activities` `status` URL param to the repository `statusIn`
 * filter (design Search contract, review-fix). An absent/empty/unknown value
 * returns `undefined` so the page OMITS `statusIn`: the repository default
 * branch (`status.in.(PENDING,IN_PROGRESS),status.is.null`) then keeps
 * legacy rows whose `status` is still NULL visible during the rollout window
 * (1.1 applied, 1.2 NOT NULL not yet). Explicit params map to their set;
 * `all` expands to every status.
 */
export function resolveStatusIn(statusParam: string | undefined): ActivityStatus[] | undefined {
  switch (statusParam) {
    case "pending":
      return [ActivityStatus.PENDING];
    case "in_progress":
      return [ActivityStatus.IN_PROGRESS];
    case "completed":
      return [ActivityStatus.COMPLETED];
    case "all":
      return [ActivityStatus.PENDING, ActivityStatus.IN_PROGRESS, ActivityStatus.COMPLETED];
    default:
      return undefined;
  }
}