/**
 * @jest-environment jsdom
 *
 * useUnreadCount (S12, ADR-11): badge = GET /api/activities/unread `{ count }`;
 * refetches on INSERT/UPDATE of the user's conversations.
 */
import { renderHook, waitFor, act } from "@testing-library/react";

const handlers: Array<{ config: Record<string, string>; cb: () => void }> = [];
const mockUnsubscribe = jest.fn();
interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}
const mockChannel: FakeChannel = {
  on: jest.fn((_type: string, config: Record<string, string>, cb: () => void): FakeChannel => {
    handlers.push({ config, cb });
    return mockChannel;
  }),
  subscribe: jest.fn(() => ({ unsubscribe: mockUnsubscribe })),
};

jest.mock("@/infrastructure/database/client", () => ({
  createClient: () => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user_1" } } }) },
    channel: jest.fn(() => mockChannel),
  }),
}));

import { useUnreadCount } from "../useUnreadCount";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("useUnreadCount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handlers.length = 0;
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ count: 3 }) });
  });

  it("loads the badge from /api/activities/unread", async () => {
    const { result } = renderHook(() => useUnreadCount(true));

    await waitFor(() => expect(result.current.count).toBe(3));
    expect(mockFetch).toHaveBeenCalledWith("/api/activities/unread");
  });

  it("subscribes to INSERT and UPDATE on the user's conversations and refetches on each", async () => {
    const { result } = renderHook(() => useUnreadCount(true));
    await waitFor(() => expect(handlers).toHaveLength(2));

    expect(handlers.map((h) => h.config)).toEqual([
      { event: "INSERT", schema: "public", table: "conversations", filter: "user_id=eq.user_1" },
      { event: "UPDATE", schema: "public", table: "conversations", filter: "user_id=eq.user_1" },
    ]);

    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ count: 1 }) });
    await act(async () => {
      handlers[1].cb();
    });
    await waitFor(() => expect(result.current.count).toBe(1));
  });

  it("does nothing when disabled", () => {
    renderHook(() => useUnreadCount(false));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
