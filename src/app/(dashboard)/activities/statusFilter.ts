import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";

const DEFAULT_STATUS_IN = [ActivityStatus.PENDING, ActivityStatus.IN_PROGRESS];

/**
 * Maps the `/activities` `status` URL param to the repository `statusIn`
 * filter (design Search contract). The default — no param or an unknown
 * value — is the pending set (PENDING + IN_PROGRESS), replacing today's
 * `completed=false` default. `all` expands to every status.
 */
export function resolveStatusIn(statusParam: string | undefined): ActivityStatus[] {
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
      return DEFAULT_STATUS_IN;
  }
}