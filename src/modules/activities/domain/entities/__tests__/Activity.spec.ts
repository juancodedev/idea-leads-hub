/**
 * Entity contract tests for the status/read-at rollout (P2.2).
 *
 * These are type-contract assertions: Jest runs them with types stripped,
 * so RED/GREEN is verified via `tsc --noEmit` (type errors fail the build)
 * plus runtime value checks that only pass once the types exist.
 */

import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../Activity";
import { ActivityStatus } from "../../enums/ActivityStatus";
import { ActivityType } from "../../enums/ActivityType";

describe("Activity entity status contract (P2.2)", () => {
  it("exposes a required status and optional readAt on Activity", () => {
    const activity: Activity = {
      id: "activity-1",
      userId: "user-1",
      type: ActivityType.TASK,
      title: "Test activity",
      completed: false,
      status: ActivityStatus.PENDING,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };

    expect(activity.status).toBe(ActivityStatus.PENDING);
    expect(activity.readAt).toBeUndefined();
  });

  it("CreateActivityDTO accepts an optional status while keeping completed", () => {
    const dto: CreateActivityDTO = {
      type: ActivityType.TASK,
      title: "Call",
      completed: true,
      status: ActivityStatus.COMPLETED,
    };

    expect(dto.completed).toBe(true);
    expect(dto.status).toBe(ActivityStatus.COMPLETED);
  });

  it("UpdateActivityDTO no longer accepts completed (rollout: writers use status surface)", () => {
    // @ts-expect-error — completed is dropped from UpdateActivityDTO
    const withLegacyCompleted: UpdateActivityDTO = { id: "activity-1", completed: true };
    expect(withLegacyCompleted).toBeDefined();
  });
});