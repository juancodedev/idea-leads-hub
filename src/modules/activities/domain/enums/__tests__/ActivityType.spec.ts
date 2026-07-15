/**
 * Tests for ActivityType enum — specifically the new INSTAGRAM_MESSAGE value.
 */

import { ActivityType } from "../ActivityType";

describe("ActivityType enum", () => {
  it("should include INSTAGRAM_MESSAGE value", () => {
    expect(ActivityType.INSTAGRAM_MESSAGE).toBe("INSTAGRAM_MESSAGE");
  });

  it("should preserve existing activity types", () => {
    expect(ActivityType.CALL).toBe("CALL");
    expect(ActivityType.MEETING).toBe("MEETING");
    expect(ActivityType.FOLLOW_UP).toBe("FOLLOW_UP");
    expect(ActivityType.EMAIL).toBe("EMAIL");
    expect(ActivityType.TASK).toBe("TASK");
    expect(ActivityType.NOTE).toBe("NOTE");
    expect(ActivityType.REMINDER).toBe("REMINDER");
    expect(ActivityType.INVESTIGATION).toBe("INVESTIGATION");
    expect(ActivityType.ACTION).toBe("ACTION");
  });

  it("should have exactly 10 enum values after adding INSTAGRAM_MESSAGE", () => {
    const values = Object.values(ActivityType);
    expect(values).toHaveLength(10);
    expect(values).toContain("INSTAGRAM_MESSAGE");
  });
});
