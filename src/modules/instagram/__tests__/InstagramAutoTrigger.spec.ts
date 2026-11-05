import { InstagramAutoTrigger, AutoDmSender } from "../InstagramAutoTrigger";
import { Lead } from "@/core/domain/Lead";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { MessageOrigin } from "@/modules/messaging/domain/enums/MessageOrigin";
import { MessageStatus } from "@/modules/messaging/domain/enums/MessageStatus";

const mockGetToken = jest.fn();
const mockExecute = jest.fn();

const mockAuthService = {
  getToken: mockGetToken,
} as unknown as InstagramAuthService;

const sender: AutoDmSender = { execute: mockExecute };

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

const withScopedId: Lead = { ...baseLead, instagramScopedId: "ig-scoped-789" };

describe("InstagramAutoTrigger", () => {
  let trigger: InstagramAutoTrigger;

  beforeEach(() => {
    jest.clearAllMocks();
    trigger = new InstagramAutoTrigger(sender);
    mockGetToken.mockResolvedValue({
      token: "page-token-abc",
      userToken: "user-token-def",
      igId: "ig-account-456",
      pageId: "page-111",
      authType: "facebook",
    });
    mockExecute.mockResolvedValue({ status: MessageStatus.SENT, externalId: "msg-001" });
  });

  it("returns true and delivers with origin auto on a configured transition for a lead with scopedId", async () => {
    const result = await trigger.maybeSendAutoDm(withScopedId, "Interesado", mockAuthService);

    expect(result).toBe(true);
    expect(mockGetToken).toHaveBeenCalledWith("user-123");
    expect(mockExecute).toHaveBeenCalledWith({
      userId: "user-123",
      participantId: "ig-scoped-789",
      leadId: "lead-1",
      body: expect.stringContaining("Gracias"),
      origin: MessageOrigin.AUTO,
      sendContext: {
        userId: "user-123",
        token: "page-token-abc",
        authType: "facebook",
        accountId: "ig-account-456",
      },
    });
  });

  it("sends with the Instagram user token when authType is instagram_business_login", async () => {
    mockGetToken.mockResolvedValue({
      token: "page-token-abc",
      userToken: "ig-user-token-xyz",
      igId: "ig-account-456",
      pageId: "page-111",
      authType: "instagram_business_login",
    });

    const result = await trigger.maybeSendAutoDm(withScopedId, "Ganado", mockAuthService);

    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: MessageOrigin.AUTO,
        sendContext: expect.objectContaining({
          token: "ig-user-token-xyz",
          authType: "instagram_business_login",
        }),
      })
    );
  });

  it("returns false when the delivery ends failed", async () => {
    mockExecute.mockResolvedValue({ status: MessageStatus.FAILED, errorMessage: "outside window" });
    const consoleSpy = jest.spyOn(console, "info").mockImplementation();

    expect(await trigger.maybeSendAutoDm(withScopedId, "Interesado", mockAuthService)).toBe(false);

    consoleSpy.mockRestore();
  });

  it("returns false for lead without scopedId", async () => {
    expect(await trigger.maybeSendAutoDm(baseLead, "Interesado", mockAuthService)).toBe(false);
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns false for non-configured transition", async () => {
    expect(await trigger.maybeSendAutoDm(withScopedId, "Contactado", mockAuthService)).toBe(false);
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns false when scopedId is empty string", async () => {
    const lead = { ...baseLead, instagramScopedId: "" };
    expect(await trigger.maybeSendAutoDm(lead, "Interesado", mockAuthService)).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns false without sending when the connection has no token or IG id", async () => {
    mockGetToken.mockResolvedValue({ token: "", userToken: "", igId: "", pageId: "", authType: null });
    const consoleSpy = jest.spyOn(console, "info").mockImplementation();

    expect(await trigger.maybeSendAutoDm(withScopedId, "Interesado", mockAuthService)).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("returns false and logs when getToken fails", async () => {
    const consoleSpy = jest.spyOn(console, "info").mockImplementation();
    mockGetToken.mockRejectedValue(new Error("Token not found"));

    const result = await trigger.maybeSendAutoDm(withScopedId, "Interesado", mockAuthService);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("auto DM"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
