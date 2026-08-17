/**
 * Tests for ActivityStatus enum — PENDING / IN_PROGRESS / COMPLETED.
 * Mirrors the ActivityType enum test pattern.
 */

import { ActivityStatus } from "../ActivityStatus";

describe("ActivityStatus enum", () => {
  it("should have the three canonical lifecycle values", () => {
    expect(ActivityStatus.PENDING).toBe("PENDING");
    expect(ActivityStatus.IN_PROGRESS).toBe("IN_PROGRESS");
    expect(ActivityStatus.COMPLETED).toBe("COMPLETED");
  });

  it("should have exactly 3 enum values", () => {
    const values = Object.values(ActivityStatus);
    expect(values).toHaveLength(3);
    expect(values).toEqual(["PENDING", "IN_PROGRESS", "COMPLETED"]);
  });

  it("should use string literal values for DB round-tripping", () => {
    // Values must match the CHECK constraint in the data-prep migration.
    const checkConstraintValues = ["PENDING", "IN_PROGRESS", "COMPLETED"];
    for (const value of checkConstraintValues) {
      expect(Object.values(ActivityStatus)).toContain(value);
    }
  });
});