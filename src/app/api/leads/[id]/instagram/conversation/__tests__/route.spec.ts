/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-123" },
  }),
}));

const mockGetForLead = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      getForLead: mockGetForLead,
    })),
  })
);

import { NextRequest } from "next/server";
import { GET } from "../route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

describe("GET /api/leads/[id]/instagram/conversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return ordered conversation timeline for lead", async () => {
    const activities = [
      {
        id: "activity-1",
        leadId: "lead-1",
        userId: "system",
        type: ActivityType.INSTAGRAM_MESSAGE,
        title: "Instagram DM from sender-123",
        description: "Hola, estoy interesado!",
        completed: false,
        createdAt: new Date("2026-07-15T10:00:00.000Z"),
        updatedAt: new Date("2026-07-15T10:00:00.000Z"),
        attachments: [
          {
            name: "instagram_message",
            url: "",
            path: "",
            size: 0,
            type: "instagram/message",
            direction: "inbound",
          },
        ],
      },
      {
        id: "activity-2",
        leadId: "lead-1",
        userId: "user-123",
        type: ActivityType.INSTAGRAM_MESSAGE,
        title: "Instagram DM to sender-123",
        description: "Claro, te cuento mas!",
        completed: false,
        createdAt: new Date("2026-07-15T10:05:00.000Z"),
        updatedAt: new Date("2026-07-15T10:05:00.000Z"),
        attachments: [
          {
            name: "instagram_message",
            url: "",
            path: "",
            size: 0,
            type: "instagram/message",
            direction: "outbound",
          },
        ],
      },
    ];

    mockGetForLead.mockResolvedValue(activities);

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/conversation"
    );

    const response = await GET(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    // Should be ordered ascending by timestamp
    expect(body[0].timestamp).toBe("2026-07-15T10:00:00.000Z");
    expect(body[1].timestamp).toBe("2026-07-15T10:05:00.000Z");
    expect(body[0].direction).toBe("inbound");
    expect(body[1].direction).toBe("outbound");
    expect(body[0].text).toBe("Hola, estoy interesado!");
    expect(body[1].text).toBe("Claro, te cuento mas!");
  });

  it("should filter out non-Instagram activities", async () => {
    const activities = [
      {
        id: "activity-1",
        leadId: "lead-1",
        userId: "user-123",
        type: ActivityType.CALL,
        title: "Phone call",
        description: "Discussed proposal",
        completed: false,
        createdAt: new Date("2026-07-15T10:00:00.000Z"),
        updatedAt: new Date("2026-07-15T10:00:00.000Z"),
        attachments: [],
      },
      {
        id: "activity-2",
        leadId: "lead-1",
        userId: "user-123",
        type: ActivityType.INSTAGRAM_MESSAGE,
        title: "Instagram DM to user",
        description: "Sent via DM",
        completed: false,
        createdAt: new Date("2026-07-15T10:05:00.000Z"),
        updatedAt: new Date("2026-07-15T10:05:00.000Z"),
        attachments: [
          {
            name: "instagram_message",
            url: "",
            path: "",
            size: 0,
            type: "instagram/message",
            direction: "outbound",
          },
        ],
      },
    ];

    mockGetForLead.mockResolvedValue(activities);

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/conversation"
    );

    const response = await GET(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("activity-2");
  });

  it("should return empty array when no instagram messages", async () => {
    mockGetForLead.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/conversation"
    );

    const response = await GET(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
