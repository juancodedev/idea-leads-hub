/**
 * @jest-environment node
 *
 * SQL function executors (ADR-10): exact rpc names and parameter names, ISO
 * dates, `{ title }` legacy argument, and result mapping to the use-case deps.
 */
import { createSupabaseQueryMock } from "../testing/supabaseQueryMock";
import { createMessagingSqlExecutors } from "../sql/executors";
import { SupabaseMessageRepository } from "../repositories/SupabaseMessageRepository";
import { MessageStatus } from "../../domain/enums/MessageStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

const at = new Date("2026-11-04T12:00:00.000Z");

const setup = () => {
  const db = createSupabaseQueryMock();
  const executors = createMessagingSqlExecutors(
    db.client,
    new SupabaseMessageRepository(db.client)
  );
  return { db, ...executors };
};

describe("createMessagingSqlExecutors", () => {
  it("execIngestInbound calls messaging_ingest_inbound and maps the result", async () => {
    const { db, execIngestInbound } = setup();
    db.respond({ data: { inserted: true, message_id: "msg_1" } });

    const result = await execIngestInbound({
      conversationId: "conv_1",
      externalId: "m_1",
      type: "image",
      body: "[imagen]",
      rawPayload: { message: { mid: "m_1" } },
      at,
      legacy: { title: "Instagram DM from igsid_1" },
    });

    expect(db.rpcs).toEqual([
      {
        fn: "messaging_ingest_inbound",
        args: {
          p_conversation_id: "conv_1",
          p_external_id: "m_1",
          p_type: "image",
          p_body: "[imagen]",
          p_raw: { message: { mid: "m_1" } },
          p_at: "2026-11-04T12:00:00.000Z",
          p_legacy: { title: "Instagram DM from igsid_1" },
        },
      },
    ]);
    expect(result).toEqual({ inserted: true, messageId: "msg_1" });
  });

  it("execIngestInbound reports a duplicate mid as not inserted", async () => {
    const { db, execIngestInbound } = setup();
    db.respond({ data: { inserted: false, message_id: null } });

    await expect(
      execIngestInbound({
        conversationId: "conv_1",
        externalId: "m_1",
        type: "text",
        body: "Hola",
        rawPayload: {},
        at,
        legacy: { title: "t" },
      })
    ).resolves.toEqual({ inserted: false, messageId: null });
  });

  it("execRecordEcho calls messaging_record_echo with the echo timestamp", async () => {
    const { db, execRecordEcho } = setup();
    db.respond({ data: { outcome: "adopted", message_id: "msg_1" } });

    const result = await execRecordEcho({
      conversationId: "conv_1",
      externalId: "m_echo",
      body: "Hola",
      eventAt: at,
      rawPayload: { x: 1 },
      legacy: { title: "Instagram DM to igsid_1" },
    });

    expect(db.rpcs).toEqual([
      {
        fn: "messaging_record_echo",
        args: {
          p_conversation_id: "conv_1",
          p_external_id: "m_echo",
          p_body: "Hola",
          p_event_at: "2026-11-04T12:00:00.000Z",
          p_raw: { x: 1 },
          p_legacy: { title: "Instagram DM to igsid_1" },
        },
      },
    ]);
    expect(result).toEqual({ outcome: "adopted", messageId: "msg_1" });
  });

  it("execMarkSent calls messaging_mark_sent and returns the message as it ends up", async () => {
    const { db, execMarkSent } = setup();
    db.respond(
      { data: { id: "msg_1", status: "sent", external_id: "m_1", conversation_id: "conv_1" } },
      {
        data: {
          id: "msg_1",
          user_id: "user_1",
          conversation_id: "conv_1",
          direction: "out",
          origin: "human",
          type: "text",
          body: "Hola",
          external_id: "m_echo",
          status: "sent",
          error_message: null,
          hint: null,
          legacy_activity_id: "act_1",
          raw_payload: null,
          created_at: "2026-11-04T12:00:00.000Z",
          delivered_at: null,
          read_at: null,
          updated_at: "2026-11-04T12:00:00.000Z",
        },
      }
    );

    const message = await execMarkSent({
      messageId: "msg_1",
      externalId: "m_1",
      legacy: { title: "Instagram DM to igsid_1" },
    });

    expect(db.rpcs).toEqual([
      {
        fn: "messaging_mark_sent",
        args: {
          p_message_id: "msg_1",
          p_external_id: "m_1",
          p_legacy: { title: "Instagram DM to igsid_1" },
        },
      },
    ]);
    expect(db.queries[0].table).toBe("messages");
    // the row an echo adopted keeps the echo's id
    expect(message).toMatchObject({
      id: "msg_1",
      status: MessageStatus.SENT,
      externalId: "m_echo",
      legacyActivityId: "act_1",
    });
  });

  it("execMarkSent throws NotFoundError when the message is gone", async () => {
    const { db, execMarkSent } = setup();
    db.respond({ data: {} }, { data: null });

    await expect(
      execMarkSent({ messageId: "msg_x", externalId: "m_1", legacy: { title: "t" } })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("execSetConversationsRead calls messaging_set_conversations_read with the ids", async () => {
    const { db, execSetConversationsRead } = setup();

    await execSetConversationsRead(["conv_1", "conv_2"]);

    expect(db.rpcs).toEqual([
      {
        fn: "messaging_set_conversations_read",
        args: { p_conversation_ids: ["conv_1", "conv_2"] },
      },
    ]);
  });

  it("propagates rpc errors", async () => {
    const { db, execSetConversationsRead } = setup();
    db.respond({ error: { message: "permission denied" } });

    await expect(execSetConversationsRead(["conv_1"])).rejects.toThrow("permission denied");
  });
});
