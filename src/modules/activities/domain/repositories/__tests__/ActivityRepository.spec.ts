/**
 * Repository contract tests for the status/read-at rollout (P2.3).
 *
 * Type-contract assertions: enforces the four new verbs and the `statusIn`
 * search param. RED/GREEN via `tsc --noEmit` (satisfies/interface checks)
 * plus runtime sanity that the verbs carry ActivityStatus through.
 */

import { ActivityRepository, ActivitySearchParams } from "../ActivityRepository";
import { ActivityStatus } from "../../enums/ActivityStatus";
import { ActivityType } from "../../enums/ActivityType";

describe("ActivityRepository status contract (P2.3)", () => {
  it("exposes moveStatus/markRead/markUnread/getUnreadCount on the interface", () => {
    // A minimal actor satisfying ActivityRepository — fails to typecheck
    // until the new verbs exist on the interface.
    const repo = {
      getById: async () => null,
      getForLead: async () => [],
      getForIdea: async () => [],
      getPending: async () => [],
      search: async () => ({ data: [], total: 0, page: 1, totalPages: 0 }),
      create: async () => {
        throw new Error("unused");
      },
      update: async () => {
        throw new Error("unused");
      },
      delete: async () => {},
      complete: async () => {
        throw new Error("unused");
      },
      moveStatus: async (id: string, status: ActivityStatus) => {
        return { id, status } as never;
      },
      markRead: async () => {
        return {} as never;
      },
      markUnread: async () => {
        return {} as never;
      },
      getUnreadCount: async () => 0,
    } satisfies ActivityRepository;

    expect(typeof repo.moveStatus).toBe("function");
    expect(typeof repo.markRead).toBe("function");
    expect(typeof repo.markUnread).toBe("function");
    expect(typeof repo.getUnreadCount).toBe("function");
  });

  it("search params accept statusIn with ActivityStatus values", () => {
    const params: ActivitySearchParams = {
      userId: "user-1",
      statusIn: [ActivityStatus.PENDING, ActivityStatus.IN_PROGRESS],
    };

    expect(params.statusIn).toContain(ActivityStatus.PENDING);
    expect(params.statusIn).toContain(ActivityStatus.IN_PROGRESS);
  });

  it("search params keep completed as a rollout alias (page layer still uses it)", () => {
    const params: ActivitySearchParams = {
      userId: "user-1",
      completed: false,
      type: ActivityType.TASK,
    };

    expect(params.completed).toBe(false);
  });
});