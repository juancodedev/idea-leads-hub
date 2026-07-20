/**
 * @jest-environment node
 */

process.env.META_APP_SECRET = "test_app_secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-123", email: "test@example.com" },
  }),
}));

const mockGetById = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    getById: mockGetById,
    update: mockUpdate,
  })),
}));

const mockGetToken = jest.fn();

jest.mock("@/infrastructure/services/InstagramAuthService", () => ({
  InstagramAuthService: jest.fn().mockImplementation(() => ({
    getToken: mockGetToken,
  })),
}));

const mockSendDM = jest.fn();
const mockSendDMViaInstagramLogin = jest.fn();
const mockResolveHandle = jest.fn();

jest.mock("@/infrastructure/services/InstagramMessagingService", () => ({
  InstagramMessagingService: jest.fn().mockImplementation(() => ({
    sendDM: mockSendDM,
    sendDMViaInstagramLogin: mockSendDMViaInstagramLogin,
    resolveHandleToUserId: mockResolveHandle,
  })),
}));

const mockActivityCreate = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      create: mockActivityCreate,
    })),
  })
);

import { NextRequest } from "next/server";
import { POST } from "../route";

const baseLead = {
  id: "lead-1",
  name: "Test Lead",
  company: "Test Corp",
  email: "test@corp.com",
  status: "Nuevo",
  userId: "user-123",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  tags: [],
};

describe("POST /api/leads/[id]/instagram/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send DM using instagramScopedId and create outbound activity", async () => {
    const lead = { ...baseLead, instagramScopedId: "ig-scoped-789" };
    mockGetById.mockResolvedValue(lead);
    mockGetToken.mockResolvedValue({
      token: "page-access-token-abc",
      igId: "ig-account-456",
      pageId: "page-111",
    });
    mockSendDM.mockResolvedValue({ messageId: "msg-outbound-001" });
    mockActivityCreate.mockResolvedValue({
      id: "activity-1",
      type: "INSTAGRAM_MESSAGE",
      title: "Instagram DM to ig-scoped-789",
      description: "Hello, interested in our product?",
      leadId: "lead-1",
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello, interested in our product?" }),
      }
    );

    const response = await POST(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messageId).toBe("msg-outbound-001");
    expect(mockSendDM).toHaveBeenCalledWith(
      "ig-account-456",
      "ig-scoped-789",
      "Hello, interested in our product?",
      "page-access-token-abc"
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "INSTAGRAM_MESSAGE",
        description: "Hello, interested in our product?",
      })
    );
  });

  it("should fallback to instagramHandle when no scopedId", async () => {
    const lead = { ...baseLead, instagramHandle: "@test_user" };
    mockGetById.mockResolvedValue(lead);
    mockGetToken.mockResolvedValue({
      token: "page-access-token-abc",
      igId: "ig-account-456",
      pageId: "page-111",
    });
    mockResolveHandle.mockResolvedValue("@test_user");
    mockSendDM.mockResolvedValue({ messageId: "msg-outbound-002" });
    mockActivityCreate.mockResolvedValue({
      id: "activity-2",
      type: "INSTAGRAM_MESSAGE",
      title: "Instagram DM to @test_user",
      description: "Hi there!",
      leadId: "lead-1",
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hi there!" }),
      }
    );

    const response = await POST(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messageId).toBe("msg-outbound-002");
    expect(mockSendDM).toHaveBeenCalledWith(
      "ig-account-456",
      "@test_user",
      "Hi there!",
      "page-access-token-abc"
    );
  });

  it("should return 400 when text is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request, { params: { id: "lead-1" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 when lead has no instagram identifier", async () => {
    const lead = { ...baseLead };
    mockGetById.mockResolvedValue(lead);

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello!" }),
      }
    );

    const response = await POST(request, { params: { id: "lead-1" } });
    expect(response.status).toBe(400);
  });

  it("should use sendDMViaInstagramLogin when authType is instagram_business_login", async () => {
    const lead = { ...baseLead, instagramScopedId: "ig-scoped-789" };
    mockGetById.mockResolvedValue(lead);
    mockGetToken.mockResolvedValue({
      token: "page-access-token-abc",
      userToken: "ig-user-token-xyz",
      igId: "ig-account-456",
      pageId: "page-111",
      authType: "instagram_business_login",
    });
    mockSendDMViaInstagramLogin.mockResolvedValue({ messageId: "msg-ig-001" });
    mockActivityCreate.mockResolvedValue({});

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello via IG Business Login!" }),
      }
    );

    const response = await POST(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messageId).toBe("msg-ig-001");
    // Should NOT call the old sendDM
    expect(mockSendDM).not.toHaveBeenCalled();
    // Should call the new sendDMViaInstagramLogin with userToken
    expect(mockSendDMViaInstagramLogin).toHaveBeenCalledWith(
      "ig-account-456",
      "ig-scoped-789",
      "Hello via IG Business Login!",
      "ig-user-token-xyz"
    );
  });

  it("should return 400 with needsManualId when Instagram Business Login and no scopedId", async () => {
    const lead = { ...baseLead, instagramHandle: "@test_user" };
    mockGetById.mockResolvedValue(lead);
    mockGetToken.mockResolvedValue({
      token: "page-access-token-abc",
      userToken: "ig-user-token-xyz",
      igId: "ig-account-456",
      pageId: "page-111",
      authType: "instagram_business_login",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/instagram/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello!" }),
      }
    );

    const response = await POST(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.needsManualId).toBe(true);
    // Should NOT attempt to resolve handle via Business Discovery
    expect(mockSendDM).not.toHaveBeenCalled();
    expect(mockSendDMViaInstagramLogin).not.toHaveBeenCalled();
  });

  it("should return 404 when lead not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/leads/non-existent/instagram/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello!" }),
      }
    );

    const response = await POST(request, { params: { id: "non-existent" } });
    expect(response.status).toBe(404);
  });
});
