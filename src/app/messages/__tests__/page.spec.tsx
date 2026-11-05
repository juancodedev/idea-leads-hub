/**
 * @jest-environment jsdom
 *
 * Messages page (S10, S12): opening a conversation marks its whole key read
 * with one PATCH /api/messages/read instead of the per-activity loop.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/ui/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/modules/instagram/components/InstagramConversation", () => ({
  InstagramConversation: () => <div data-testid="thread" />,
}));
jest.mock("@/modules/leads/components/LeadSearchModal", () => ({
  LeadSearchModal: () => null,
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import MessagesPage from "../page";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const conversation = {
  id: "lead:lead-1",
  conversationIds: ["c1", "c2"],
  leadId: "lead-1",
  leadName: "Ana Lopez",
  instagramHandle: "ana",
  instagramScopedId: "111",
  lastMessage: { text: "Hola", timestamp: "2026-11-04T10:00:00.000Z", direction: "inbound" },
  unreadCount: 3,
  isConnected: true,
  isLinked: true,
};

describe("MessagesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url === "/api/instagram/conversations" ? { conversations: [conversation] } : {}),
    }));
  });

  it("marks the whole key read with PATCH /api/messages/read when a conversation is opened", async () => {
    render(<MessagesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Ana Lopez/ }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith("/api/messages/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "lead:lead-1" }),
      })
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/activities/),
      expect.anything()
    );
  });

  it("does not call the read endpoint for a conversation without unread messages", async () => {
    mockFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url === "/api/instagram/conversations"
          ? { conversations: [{ ...conversation, unreadCount: 0 }] }
          : {},
    }));
    render(<MessagesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Ana Lopez/ }));

    await waitFor(() => expect(screen.getAllByText("Ana Lopez").length).toBeGreaterThan(1));
    expect(mockFetch).not.toHaveBeenCalledWith("/api/messages/read", expect.anything());
  });
});
