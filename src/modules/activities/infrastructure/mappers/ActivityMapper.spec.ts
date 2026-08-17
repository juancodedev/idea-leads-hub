/**
 * Implementation-level spec for ActivityMapper (task 4.2).
 *
 * Round-trips the status/read_at/completed_at surface between domain
 * entities and persistence rows, including the NULL-status fallback and the
 * dual-write derivation of `completed` from `status`.
 */

import { ActivityMapper } from "./ActivityMapper";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { ActivityType } from "../../domain/enums/ActivityType";
import type { Database } from "@/infrastructure/database/database.types";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

const baseRow: ActivityRow = {
  id: "act-1",
  user_id: "user-1",
  lead_id: null,
  idea_id: null,
  type: ActivityType.TASK,
  title: "Test",
  description: "",
  due_date: null,
  status: ActivityStatus.PENDING,
  completed: false,
  completed_at: null,
  read_at: null,
  attachments: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("ActivityMapper.toDomain", () => {
  it("should map status, read_at and completed_at from the row", () => {
    const domain = ActivityMapper.toDomain({
      ...baseRow,
      status: ActivityStatus.IN_PROGRESS,
      read_at: "2024-06-01T10:00:00Z",
      completed_at: "2024-06-02T10:00:00Z",
    });

    expect(domain.status).toBe(ActivityStatus.IN_PROGRESS);
    expect(domain.readAt).toEqual(new Date("2024-06-01T10:00:00Z"));
    expect(domain.completedAt).toEqual(new Date("2024-06-02T10:00:00Z"));
    expect(domain.completed).toBe(false);
  });

  it("should fall back to the legacy completed flag when status is NULL", () => {
    const fromCompleted = ActivityMapper.toDomain({ ...baseRow, status: null, completed: true });
    const fromPending = ActivityMapper.toDomain({ ...baseRow, status: null, completed: false });

    expect(fromCompleted.status).toBe(ActivityStatus.COMPLETED);
    expect(fromPending.status).toBe(ActivityStatus.PENDING);
  });

  it("should leave readAt undefined when read_at is NULL", () => {
    const domain = ActivityMapper.toDomain({ ...baseRow, read_at: null });
    expect(domain.readAt).toBeUndefined();
  });
});

describe("ActivityMapper.toPersistence", () => {
  it("should dual-write completed from status when status is provided (BR-4)", () => {
    const persistence = ActivityMapper.toPersistence({ status: ActivityStatus.COMPLETED });
    expect(persistence.status).toBe(ActivityStatus.COMPLETED);
    expect(persistence.completed).toBe(true);
  });

  it("should dual-write completed=false for a non-completed status", () => {
    const persistence = ActivityMapper.toPersistence({ status: ActivityStatus.PENDING });
    expect(persistence.status).toBe(ActivityStatus.PENDING);
    expect(persistence.completed).toBe(false);
  });

  it("should pass a raw completed through during rollout when status is absent", () => {
    const persistence = ActivityMapper.toPersistence({ completed: true });
    expect(persistence.completed).toBe(true);
    expect(persistence).not.toHaveProperty("status");
  });

  it("should serialize readAt and completedAt to ISO strings", () => {
    const persistence = ActivityMapper.toPersistence({
      readAt: new Date("2024-06-01T10:00:00Z"),
      completedAt: new Date("2024-06-02T10:00:00Z"),
    });
    expect(persistence.read_at).toBe("2024-06-01T10:00:00.000Z");
    expect(persistence.completed_at).toBe("2024-06-02T10:00:00.000Z");
  });

  it("should persist null when readAt is explicitly cleared", () => {
    const persistence = ActivityMapper.toPersistence({ readAt: null });
    expect(persistence.read_at).toBeNull();
  });
});