/**
 * @jest-environment node
 */

jest.mock("@/lib/api/cors", () => ({
  handlePreflight: jest.fn(() => null),
  withCors: jest.fn((response: Response) => response),
}));

import { NextRequest } from "next/server";
import { GET } from "../openapi.json/route";

describe("GET /api/docs/openapi.json", () => {
  it("should document the ActivityStatus enum and status/read/unread surface", async () => {
    const request = new NextRequest("http://localhost:3000/api/docs/openapi.json");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    // ActivityStatus enum documented.
    expect(body.components.schemas.ActivityStatus).toBeDefined();
    expect(body.components.schemas.ActivityStatus.enum).toEqual([
      "PENDING",
      "IN_PROGRESS",
      "COMPLETED",
    ]);

    // New endpoints documented under Activities.
    const activitiesPaths = Object.keys(body.paths).filter((p) =>
      p.startsWith("/api/activities")
    );
    expect(activitiesPaths).toContain("/api/activities/{id}/status");
    expect(activitiesPaths).toContain("/api/activities/{id}/read");
    expect(activitiesPaths).toContain("/api/activities/unread");

    // Activity schema: status + read_at added, completed marked deprecated
    // (kept during rollout — removal deferred to the column drop).
    const activitySchema = body.components.schemas.Activity.properties;
    expect(activitySchema.status).toBeDefined();
    expect(activitySchema.readAt).toBeDefined();
    expect(activitySchema.completed.deprecated).toBe(true);
  });
});