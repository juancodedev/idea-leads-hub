/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetUnreadCount = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      getById: jest.fn(),
      getForLead: jest.fn(),
      getForIdea: jest.fn(),
      getPending: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      complete: jest.fn(),
      moveStatus: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      getUnreadCount: mockGetUnreadCount,
    })),
  })
);

import { NextRequest } from "next/server";
import { GET } from "../unread/route";

describe("GET /api/activities/unread", () => {
  beforeEach(() => {
    mockGetUnreadCount.mockClear();
    mockGetUnreadCount.mockResolvedValue(3);
  });

  it("should return the count of unread Instagram messages (read_at IS NULL — BR-3)", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/activities/unread",
      { method: "GET" }
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(3);
    // Unread marker: INSTAGRAM_MESSAGE rows with read_at IS NULL (via repo verb).
    expect(mockGetUnreadCount).toHaveBeenCalledWith("user-1");
    expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
  });

  it("should return 0 when no unread messages", async () => {
    mockGetUnreadCount.mockResolvedValue(0);

    const request = new NextRequest(
      "http://localhost:3000/api/activities/unread",
      { method: "GET" }
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(0);
  });
});