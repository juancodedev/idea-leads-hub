/**
 * @jest-environment node
 */

process.env.META_VERIFY_TOKEN = "test_verify_token_123";
process.env.META_APP_SECRET = "test_app_secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const mockVerifyMetaSignature = jest.fn();
const mockParseIncomingMessage = jest.fn();

jest.mock("@/infrastructure/services/InstagramMessagingService", () => ({
  InstagramMessagingService: jest.fn().mockImplementation(() => ({
    verifyMetaSignature: mockVerifyMetaSignature,
    parseIncomingMessage: mockParseIncomingMessage,
  })),
}));

// Mock @supabase/supabase-js createClient to return a fake supabase client
// Values are defined inline because jest.mock() is hoisted before const init
jest.mock("@supabase/supabase-js", () => {
  const mockSingle = jest.fn().mockResolvedValue({ data: { id: "new-lead-id" }, error: null });
  const mockInsertSelect = jest.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = jest.fn().mockReturnValue({ select: mockInsertSelect });
  const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
  const mockEq = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = jest.fn().mockReturnValue({ select: mockSelect, insert: mockInsert });
  return {
    createClient: jest.fn().mockReturnValue({ from: mockFrom }),
  };
});

const mockActivityCreate = jest.fn();
mockActivityCreate.mockResolvedValue({
  id: "activity-1",
  type: "INSTAGRAM_MESSAGE",
  title: "Instagram DM from sender-123",
  description: "Hello!",
  leadId: null,
  userId: "system",
  attachments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    getById: jest.fn(),
    getAll: jest.fn(),
  })),
}));

jest.mock("@/modules/activities/infrastructure/repositories/SupabaseActivityRepository", () => ({
  SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
    create: mockActivityCreate,
  })),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

// Mock crypto.subtle for signature verification tests
const originalSubtle = crypto.subtle;

describe("GET /api/webhook/instagram", () => {
  it("should return challenge when verify_token matches", async () => {
    const url = new URL("http://localhost:3000/api/webhook/instagram");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "test_verify_token_123");
    url.searchParams.set("hub.challenge", "challenge_value_42");

    const request = new NextRequest(url.toString());
    const response = await GET(request);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("challenge_value_42");
  });

  it("should return 403 when verify_token does not match", async () => {
    const url = new URL("http://localhost:3000/api/webhook/instagram");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "wrong_token");
    url.searchParams.set("hub.challenge", "challenge_value_42");

    const request = new NextRequest(url.toString());
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("should return 403 when hub.mode is not subscribe", async () => {
    const url = new URL("http://localhost:3000/api/webhook/instagram");
    url.searchParams.set("hub.mode", "unsubscribe");
    url.searchParams.set("hub.verify_token", "test_verify_token_123");
    url.searchParams.set("hub.challenge", "challenge_value_42");

    const request = new NextRequest(url.toString());
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});

describe("POST /api/webhook/instagram", () => {
  beforeEach(() => {
    mockVerifyMetaSignature.mockClear();
    mockParseIncomingMessage.mockClear();
    mockActivityCreate.mockClear();
  });

  it("should process valid webhook event and create activity", async () => {
    jest.setTimeout(10000);
    mockVerifyMetaSignature.mockResolvedValue(true);
    mockParseIncomingMessage.mockReturnValue({
      senderId: "ig-sender-456",
      messageId: "ig-msg-789",
      text: "Hello from Instagram!",
      timestamp: "2026-07-15T12:00:00.000Z",
    });
    mockActivityCreate.mockResolvedValue({
      id: "activity-1",
      type: ActivityType.INSTAGRAM_MESSAGE,
      title: "Instagram DM from ig-sender-456",
      description: "Hello from Instagram!",
      leadId: null,
      userId: "system",
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/webhook/instagram",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": "sha256=valid_signature_hex",
        },
        body: JSON.stringify({
          entry: [
            {
              id: "page-1",
              messaging: [
                {
                  sender: { id: "ig-sender-456" },
                  message: { mid: "ig-msg-789", text: "Hello from Instagram!" },
                  timestamp: 1721084400000,
                },
              ],
            },
          ],
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("received");
    expect(mockVerifyMetaSignature).toHaveBeenCalled();
    expect(mockParseIncomingMessage).toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalled();
  });

  it("should return 403 when signature is invalid", async () => {
    mockVerifyMetaSignature.mockResolvedValue(false);

    const request = new NextRequest(
      "http://localhost:3000/api/webhook/instagram",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": "sha256=invalid_signature",
        },
        body: JSON.stringify({ entry: [{ messaging: [{}] }] }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mockVerifyMetaSignature).toHaveBeenCalled();
    expect(mockParseIncomingMessage).not.toHaveBeenCalled();
    expect(mockActivityCreate).not.toHaveBeenCalled();
  });

  it("should return 200 and ignore non-message events", async () => {
    mockVerifyMetaSignature.mockResolvedValue(true);
    mockParseIncomingMessage.mockReturnValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/webhook/instagram",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": "sha256=valid_signature",
        },
        body: JSON.stringify({
          entry: [
            {
              id: "page-1",
              changes: [{ field: "mention" }],
            },
          ],
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ignored");
    expect(mockActivityCreate).not.toHaveBeenCalled();
  });
});
