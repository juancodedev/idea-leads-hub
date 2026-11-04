/**
 * @jest-environment node
 *
 * MetaInstagramChannel (S2): webhook verification, event id, parsing of both
 * Meta payload shapes, and send outcome mapping (ADR-8).
 */
import { createHash } from "crypto";
import { MetaInstagramChannel } from "../MetaInstagramChannel";
import { GraphApiError } from "@/infrastructure/services/GraphApiError";
import { InstagramMessagingService } from "@/infrastructure/services/InstagramMessagingService";
import { Channel } from "../../../domain/enums/Channel";
import { MessageOrigin } from "../../../domain/enums/MessageOrigin";
import { SendContext } from "../../../domain/ports/MessagingChannel";

type ServiceMock = {
  verifyMetaSignature: jest.Mock;
  sendDM: jest.Mock;
  sendDMViaInstagramLogin: jest.Mock;
};

const encode = (text: string): ArrayBuffer => {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

describe("MetaInstagramChannel", () => {
  let service: ServiceMock;
  let channel: MetaInstagramChannel;

  beforeEach(() => {
    service = {
      verifyMetaSignature: jest.fn(),
      sendDM: jest.fn(),
      sendDMViaInstagramLogin: jest.fn(),
    };
    channel = new MetaInstagramChannel(service as unknown as InstagramMessagingService);
  });

  it("identifies itself as the instagram channel", () => {
    expect(channel.channel).toBe(Channel.INSTAGRAM);
  });

  describe("verifyWebhook", () => {
    it("verifies the raw body against the X-Hub-Signature-256 header", async () => {
      service.verifyMetaSignature.mockResolvedValue(true);
      const rawBody = encode('{"entry":[]}');

      const ok = await channel.verifyWebhook(
        rawBody,
        new Headers({ "X-Hub-Signature-256": "sha256=abc" })
      );

      expect(ok).toBe(true);
      expect(service.verifyMetaSignature).toHaveBeenCalledWith(rawBody, "sha256=abc");
    });

    it("returns false when the signature does not match", async () => {
      service.verifyMetaSignature.mockResolvedValue(false);

      const ok = await channel.verifyWebhook(
        encode("{}"),
        new Headers({ "x-hub-signature-256": "sha256=bad" })
      );

      expect(ok).toBe(false);
    });

    it("returns false without checking when the header is missing", async () => {
      const ok = await channel.verifyWebhook(encode("{}"), new Headers());

      expect(ok).toBe(false);
      expect(service.verifyMetaSignature).not.toHaveBeenCalled();
    });
  });

  describe("eventId", () => {
    it("is sha:<hex sha256> of the raw body", async () => {
      const body = '{"object":"instagram","entry":[{"id":"1"}]}';
      const expected = createHash("sha256").update(body).digest("hex");

      await expect(channel.eventId({ entry: [] }, encode(body))).resolves.toBe(
        `sha:${expected}`
      );
    });

    it("differs for different bodies and repeats for the same body", async () => {
      const a1 = await channel.eventId({}, encode("a"));
      const a2 = await channel.eventId({}, encode("a"));
      const b = await channel.eventId({}, encode("b"));

      expect(a1).toBe(a2);
      expect(a1).not.toBe(b);
    });
  });

  describe("parse", () => {
    const messagingItem = (overrides: Record<string, unknown> = {}) => ({
      sender: { id: "igsid_1" },
      recipient: { id: "ig_business_1" },
      timestamp: 1762257600000,
      message: { mid: "m_1", text: "Hola" },
      ...overrides,
    });

    it("maps a message from the messaging shape", () => {
      const item = messagingItem();

      const events = channel.parse({ object: "instagram", entry: [{ id: "entry_1", messaging: [item] }] });

      expect(events).toEqual([
        {
          kind: "message",
          accountId: "ig_business_1",
          participantId: "igsid_1",
          mid: "m_1",
          text: "Hola",
          timestamp: new Date(1762257600000),
          rawPayload: item,
        },
      ]);
    });

    it("maps a message from the changes shape with a seconds timestamp", () => {
      const value = {
        sender: { id: "igsid_2" },
        recipient: { id: "ig_business_2" },
        timestamp: 1762257600,
        message: { mid: "m_2", text: "Buenas" },
      };

      const events = channel.parse({
        entry: [{ id: "entry_2", changes: [{ field: "messages", value }] }],
      });

      expect(events).toEqual([
        {
          kind: "message",
          accountId: "ig_business_2",
          participantId: "igsid_2",
          mid: "m_2",
          text: "Buenas",
          timestamp: new Date(1762257600 * 1000),
          rawPayload: value,
        },
      ]);
    });

    it("ignores changes for fields other than messages", () => {
      const events = channel.parse({
        entry: [
          {
            id: "entry_1",
            changes: [{ field: "comments", value: messagingItem() }],
          },
        ],
      });

      expect(events).toEqual([]);
    });

    it("parses every entry and every messaging item", () => {
      const events = channel.parse({
        entry: [
          {
            id: "e1",
            messaging: [
              messagingItem({ message: { mid: "m_1", text: "uno" } }),
              messagingItem({ message: { mid: "m_2", text: "dos" } }),
            ],
          },
          { id: "e2", messaging: [messagingItem({ message: { mid: "m_3", text: "tres" } })] },
        ],
      });

      expect(events.map((e) => e.mid)).toEqual(["m_1", "m_2", "m_3"]);
    });

    it("maps an echo with the recipient as participant and the sender as account", () => {
      const events = channel.parse({
        entry: [
          {
            id: "entry_1",
            messaging: [
              {
                sender: { id: "ig_business_1" },
                recipient: { id: "igsid_1" },
                timestamp: 1762257600000,
                message: { mid: "m_echo", text: "Respuesta", is_echo: true },
              },
            ],
          },
        ],
      });

      expect(events).toEqual([
        expect.objectContaining({
          kind: "echo",
          accountId: "ig_business_1",
          participantId: "igsid_1",
          mid: "m_echo",
          text: "Respuesta",
        }),
      ]);
    });

    it("falls back to entry.id for the account of a message and of an echo", () => {
      const events = channel.parse({
        entry: [
          {
            id: "entry_9",
            messaging: [
              { sender: { id: "igsid_1" }, timestamp: 1, message: { mid: "m_1", text: "a" } },
              {
                recipient: { id: "igsid_1" },
                timestamp: 1,
                message: { mid: "m_2", text: "b", is_echo: true },
              },
            ],
          },
        ],
      });

      expect(events.map((e) => [e.kind, e.accountId])).toEqual([
        ["message", "entry_9"],
        ["echo", "entry_9"],
      ]);
    });

    it.each([
      ["image", "image"],
      ["audio", "audio"],
      ["video", "video"],
      ["file", "file"],
      ["share", "file"],
      ["ig_reel", "file"],
    ])("maps attachment type %s to %s with empty text", (type, expected) => {
      const events = channel.parse({
        entry: [
          {
            id: "e1",
            messaging: [
              messagingItem({
                message: { mid: "m_1", attachments: [{ type, payload: { url: "https://x" } }] },
              }),
            ],
          },
        ],
      });

      expect(events[0]).toMatchObject({ text: "", attachmentType: expected });
    });

    it("skips items without a message (reads, deliveries, postbacks, reactions)", () => {
      const events = channel.parse({
        entry: [
          {
            id: "e1",
            messaging: [
              { sender: { id: "a" }, recipient: { id: "b" }, read: { mid: "m_0" } },
              { sender: { id: "a" }, recipient: { id: "b" }, delivery: { mids: ["m_0"] } },
              { sender: { id: "a" }, recipient: { id: "b" }, postback: { payload: "x" } },
              { sender: { id: "a" }, recipient: { id: "b" }, reaction: { mid: "m_0" } },
              messagingItem(),
            ],
          },
        ],
      });

      expect(events.map((e) => e.mid)).toEqual(["m_1"]);
    });

    it("skips malformed items without failing the batch", () => {
      const events = channel.parse({
        entry: [
          null,
          "garbage",
          {
            id: "e1",
            messaging: [
              null,
              42,
              { message: { mid: "m_x", text: "no sender" } },
              { sender: "not-an-object", message: { mid: "m_y", text: "bad" } },
              messagingItem(),
            ],
            changes: [null, { field: "messages" }, { field: "messages", value: "bad" }],
          },
        ],
      });

      expect(events.map((e) => e.mid)).toEqual(["m_1"]);
    });

    it("returns no events for an empty entry array", () => {
      expect(channel.parse({ entry: [] })).toEqual([]);
    });

    it.each([[null], ["text"], [42], [{}], [{ entry: "nope" }]])(
      "throws when the payload has no entry array: %p",
      (payload) => {
        expect(() => channel.parse(payload)).toThrow();
      }
    );
  });

  describe("send", () => {
    const facebookCtx: SendContext = {
      userId: "user_1",
      token: "page_token",
      authType: "facebook",
      accountId: "ig_business_1",
      recipientId: "igsid_1",
    };
    const input = { conversationId: "conv_1", body: "Hola", origin: MessageOrigin.HUMAN };

    it("sends through the Facebook Graph API and returns the message id", async () => {
      service.sendDM.mockResolvedValue({ messageId: "m_out" });

      const outcome = await channel.send(facebookCtx, input);

      expect(outcome).toEqual({ ok: true, externalId: "m_out" });
      expect(service.sendDM).toHaveBeenCalledWith(
        "ig_business_1",
        "igsid_1",
        "Hola",
        "page_token",
        { signal: expect.any(AbortSignal) }
      );
      expect(service.sendDMViaInstagramLogin).not.toHaveBeenCalled();
    });

    it("sends through Instagram Business Login when the auth type says so", async () => {
      service.sendDMViaInstagramLogin.mockResolvedValue({ messageId: "m_ig" });

      const outcome = await channel.send(
        { ...facebookCtx, authType: "instagram_business_login", token: "ig_user_token" },
        input
      );

      expect(outcome).toEqual({ ok: true, externalId: "m_ig" });
      expect(service.sendDMViaInstagramLogin).toHaveBeenCalledWith(
        "ig_business_1",
        "igsid_1",
        "Hola",
        "ig_user_token",
        { signal: expect.any(AbortSignal) }
      );
      expect(service.sendDM).not.toHaveBeenCalled();
    });

    it("uses the Facebook Graph API when the auth type is null", async () => {
      service.sendDM.mockResolvedValue({ messageId: "m_out" });

      await channel.send({ ...facebookCtx, authType: null }, input);

      expect(service.sendDM).toHaveBeenCalledTimes(1);
    });

    it("applies a 15 second timeout by default", async () => {
      const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
      service.sendDM.mockResolvedValue({ messageId: "m_out" });

      await channel.send(facebookCtx, input);

      expect(timeoutSpy).toHaveBeenCalledWith(15000);
      timeoutSpy.mockRestore();
    });

    const graphError = (status: number, code: number | null) =>
      new GraphApiError(`Failed to send Instagram DM: graph says no (${code})`, {
        status,
        code,
      });

    it.each([
      ["code 190", graphError(400, 190), "Token vencido: reconectá Instagram"],
      ["HTTP 401", graphError(401, null), "Token vencido: reconectá Instagram"],
      ["code 10", graphError(400, 10), "Faltan permisos de mensajería en la app de Meta"],
      ["code 200", graphError(400, 200), "Faltan permisos de mensajería en la app de Meta"],
      ["HTTP 403", graphError(403, null), "Faltan permisos de mensajería en la app de Meta"],
      ["HTTP 429", graphError(429, null), "Límite de envíos alcanzado, reintentá en unos minutos"],
      ["code 4", graphError(400, 4), "Límite de envíos alcanzado, reintentá en unos minutos"],
      ["code 613", graphError(400, 613), "Límite de envíos alcanzado, reintentá en unos minutos"],
      ["code 100", graphError(400, 100), "Meta rechazó el mensaje (código 100)"],
      ["code 551 (not mapped)", graphError(400, 551), "Meta rechazó el mensaje (código 551)"],
      ["code 2018278 (not mapped)", graphError(400, 2018278), "Meta rechazó el mensaje (código 2018278)"],
      ["code 2534022 (not mapped)", graphError(400, 2534022), "Meta rechazó el mensaje (código 2534022)"],
      ["no code, HTTP 500", graphError(500, null), "Meta rechazó el mensaje (código 500)"],
    ])("maps %s to its hint", async (_label, error, hint) => {
      service.sendDM.mockRejectedValue(error);

      const outcome = await channel.send(facebookCtx, input);

      expect(outcome).toEqual({ ok: false, error: error.message, hint });
    });

    it("maps a network error to the connectivity hint", async () => {
      service.sendDM.mockRejectedValue(new TypeError("fetch failed"));

      await expect(channel.send(facebookCtx, input)).resolves.toEqual({
        ok: false,
        error: "fetch failed",
        hint: "No se pudo contactar a Instagram",
      });
    });

    it("maps a timeout to the connectivity hint", async () => {
      const shortChannel = new MetaInstagramChannel(
        service as unknown as InstagramMessagingService,
        { timeoutMs: 10 }
      );
      service.sendDM.mockImplementation(
        (_ig: string, _to: string, _text: string, _token: string, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener("abort", () => reject(opts.signal.reason));
          })
      );

      const outcome = await shortChannel.send(facebookCtx, input);

      expect(outcome).toMatchObject({ ok: false, hint: "No se pudo contactar a Instagram" });
    });

    it("never throws, even for non-Error rejections", async () => {
      service.sendDM.mockRejectedValue("boom");

      await expect(channel.send(facebookCtx, input)).resolves.toEqual({
        ok: false,
        error: "boom",
        hint: "No se pudo contactar a Instagram",
      });
    });

    it("never throws when the service throws synchronously", async () => {
      service.sendDM.mockImplementation(() => {
        throw new Error("sync failure");
      });

      await expect(channel.send(facebookCtx, input)).resolves.toMatchObject({
        ok: false,
        error: "sync failure",
      });
    });
  });
});
