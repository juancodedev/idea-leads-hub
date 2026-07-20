import { InstagramAutoTrigger } from "../InstagramAutoTrigger";
import { Lead } from "@/core/domain/Lead";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { InstagramMessagingService } from "@/infrastructure/services/InstagramMessagingService";

const mockGetToken = jest.fn();
const mockSendDM = jest.fn();
const mockSendDMViaInstagramLogin = jest.fn();

const mockAuthService = {
  getToken: mockGetToken,
} as unknown as InstagramAuthService;

const mockMessagingService = {
  sendDM: mockSendDM,
  sendDMViaInstagramLogin: mockSendDMViaInstagramLogin,
} as unknown as InstagramMessagingService;

const baseLead: Lead = {
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

describe("InstagramAutoTrigger", () => {
  let trigger: InstagramAutoTrigger;

  beforeEach(() => {
    jest.clearAllMocks();
    trigger = new InstagramAutoTrigger();
  });

  it("returns true and calls sendDM on configured transition for lead with scopedId", async () => {
    const lead: Lead = {
      ...baseLead,
      instagramScopedId: "ig-scoped-789",
    };

    mockGetToken.mockResolvedValue({
      token: "page-token-abc",
      igId: "ig-account-456",
      pageId: "page-111",
    });
    mockSendDM.mockResolvedValue({ messageId: "msg-001" });

    const result = await trigger.maybeSendAutoDm(
      lead,
      "Interesado",
      mockAuthService,
      mockMessagingService
    );

    expect(result).toBe(true);
    expect(mockGetToken).toHaveBeenCalledWith("user-123");
    expect(mockSendDM).toHaveBeenCalledWith(
      "ig-account-456",
      "ig-scoped-789",
      expect.stringContaining("Gracias"),
      "page-token-abc"
    );
  });

  it("returns false for lead without scopedId", async () => {
    const lead: Lead = {
      ...baseLead,
      instagramHandle: "@test_user",
    };

    const result = await trigger.maybeSendAutoDm(
      lead,
      "Interesado",
      mockAuthService,
      mockMessagingService
    );

    expect(result).toBe(false);
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockSendDM).not.toHaveBeenCalled();
  });

  it("returns true and calls sendDMViaInstagramLogin when authType is instagram_business_login", async () => {
    const lead: Lead = {
      ...baseLead,
      instagramScopedId: "ig-scoped-789",
    };

    mockGetToken.mockResolvedValue({
      token: "page-token-abc",
      userToken: "ig-user-token-xyz",
      igId: "ig-account-456",
      pageId: "page-111",
      authType: "instagram_business_login",
    });
    mockSendDMViaInstagramLogin.mockResolvedValue({ messageId: "msg-ig-001" });

    const result = await trigger.maybeSendAutoDm(
      lead,
      "Interesado",
      mockAuthService,
      mockMessagingService
    );

    expect(result).toBe(true);
    expect(mockGetToken).toHaveBeenCalledWith("user-123");
    // Should NOT call the old sendDM
    expect(mockSendDM).not.toHaveBeenCalled();
    // Should call sendDMViaInstagramLogin with userToken
    expect(mockSendDMViaInstagramLogin).toHaveBeenCalledWith(
      "ig-account-456",
      "ig-scoped-789",
      expect.stringContaining("Gracias"),
      "ig-user-token-xyz"
    );
  });

  it("returns false for non-configured transition", async () => {
    const lead: Lead = {
      ...baseLead,
      instagramScopedId: "ig-scoped-789",
    };

    const result = await trigger.maybeSendAutoDm(
      lead,
      "Contactado",
      mockAuthService,
      mockMessagingService
    );

    expect(result).toBe(false);
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockSendDM).not.toHaveBeenCalled();
  });

  it("returns false when scopedId is empty string", async () => {
    const lead: Lead = {
      ...baseLead,
      instagramScopedId: "",
    };

    const result = await trigger.maybeSendAutoDm(
      lead,
      "Interesado",
      mockAuthService,
      mockMessagingService
    );

    expect(result).toBe(false);
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockSendDM).not.toHaveBeenCalled();
  });

  it("returns false when transition is not in config", async () => {
    const lead: Lead = {
      ...baseLead,
      instagramScopedId: "ig-scoped-789",
    };

    const result = await trigger.maybeSendAutoDm(
      lead,
      "Propuesta",
      mockAuthService,
      mockMessagingService
    );

    expect(result).toBe(false);
  });

  it("returns false and logs when getToken fails", async () => {
    const lead: Lead = {
      ...baseLead,
      instagramScopedId: "ig-scoped-789",
    };

    const consoleSpy = jest.spyOn(console, "info").mockImplementation();

    mockGetToken.mockRejectedValue(new Error("Token not found"));

    const result = await trigger.maybeSendAutoDm(
      lead,
      "Interesado",
      mockAuthService,
      mockMessagingService
    );

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("auto DM"),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
