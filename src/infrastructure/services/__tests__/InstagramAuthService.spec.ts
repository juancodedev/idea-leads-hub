/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();

const mockSupabase = {
  from: mockFrom,
};

// Mock global fetch for refreshToken
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { InstagramAuthService } from "../InstagramAuthService";

describe("InstagramAuthService", () => {
  let service: InstagramAuthService;

  const userId = "user-123";
  const mockTokenData = {
    token: "EAATestToken123",
    igId: "ig-123456",
    pageId: "page-789",
  };
  const mockRow = {
    id: "secret-1",
    user_id: userId,
    instagram_token: "EAATestToken123",
    instagram_ig_id: "ig-123456",
    instagram_page_id: "page-789",
    token_expires_at: "2026-12-31T23:59:59Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockFrom.mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });

    service = new InstagramAuthService(mockSupabase as any);
  });

  describe("getToken", () => {
    it("should query user_secrets and return token, igId, and pageId", async () => {
      mockMaybeSingle.mockResolvedValue({ data: mockRow, error: null });

      const result = await service.getToken(userId);

      expect(mockFrom).toHaveBeenCalledWith("user_secrets");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("user_id", userId);
      expect(result).toEqual({
        token: "EAATestToken123",
        igId: "ig-123456",
        pageId: "page-789",
      });
    });

    it("should throw when no token found for user", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(service.getToken(userId)).rejects.toThrow(
        "No Instagram token found for user"
      );
    });

    it("should throw when supabase query fails", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      await expect(service.getToken(userId)).rejects.toThrow(
        "Failed to retrieve Instagram token"
      );
    });
  });

  describe("storeToken", () => {
    const tokenData = {
      token: "EAATestToken123",
      igId: "ig-123456",
      pageId: "page-789",
      expiresAt: "2026-12-31T23:59:59Z",
    };

    it("should upsert token data into user_secrets", async () => {
      mockUpsert.mockResolvedValue({ data: null, error: null });

      await service.storeToken(userId, tokenData);

      expect(mockFrom).toHaveBeenCalledWith("user_secrets");
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          user_id: userId,
          instagram_token: tokenData.token,
          instagram_ig_id: tokenData.igId,
          instagram_page_id: tokenData.pageId,
          token_expires_at: tokenData.expiresAt,
        },
        { onConflict: "user_id" }
      );
    });

    it("should throw when upsert fails", async () => {
      mockUpsert.mockResolvedValue({
        data: null,
        error: { message: "Upsert failed" },
      });

      await expect(service.storeToken(userId, tokenData)).rejects.toThrow(
        "Failed to store Instagram token"
      );
    });
  });

  describe("refreshToken", () => {
    beforeEach(() => {
      mockMaybeSingle.mockResolvedValue({ data: mockRow, error: null });
    });

    it("should refresh token via Meta API and store the new token", async () => {
      const newToken = "EAANewToken456";
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: newToken,
          expires_in: 5184000, // 60 days
        }),
      } as Response);

      mockUpsert.mockResolvedValue({ data: null, error: null });

      const result = await service.refreshToken(userId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("grant_type=fb_exchange_token")
      );
      expect(mockUpsert).toHaveBeenCalled();
      expect(result).toBe(newToken);
    });

    it("should throw when Meta API returns non-ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
      } as Response);

      await expect(service.refreshToken(userId)).rejects.toThrow(
        "Failed to refresh Instagram token"
      );
    });

    it("should throw when no existing token to refresh", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(service.refreshToken(userId)).rejects.toThrow(
        "No existing Instagram token to refresh"
      );
    });
  });
});
