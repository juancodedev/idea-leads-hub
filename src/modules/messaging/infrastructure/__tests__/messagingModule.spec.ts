/**
 * @jest-environment node
 *
 * messagingModule(supabase) wiring: repositories, MetaInstagramChannel, SQL
 * executors and the five use cases, including the parse/process bindings.
 */
import { messagingModule } from "../..";
import { createSupabaseQueryMock } from "../testing/supabaseQueryMock";
import { MetaInstagramChannel } from "../channels/MetaInstagramChannel";
import { IngestInboundEvent } from "../../application/use-cases/IngestInboundEvent";
import { DeliverMessage } from "../../application/use-cases/DeliverMessage";
import { ProcessWebhookEvent } from "../../application/use-cases/ProcessWebhookEvent";
import { SweepWebhookEvents } from "../../application/use-cases/SweepWebhookEvents";
import { MarkConversationRead } from "../../application/use-cases/MarkConversationRead";

describe("messagingModule", () => {
  it("wires the Meta Instagram channel and the five use cases", () => {
    const wired = messagingModule(createSupabaseQueryMock().client);

    expect(wired.channel).toBeInstanceOf(MetaInstagramChannel);
    expect(wired.ingestInboundEvent).toBeInstanceOf(IngestInboundEvent);
    expect(wired.deliverMessage).toBeInstanceOf(DeliverMessage);
    expect(wired.processWebhookEvent).toBeInstanceOf(ProcessWebhookEvent);
    expect(wired.sweepWebhookEvents).toBeInstanceOf(SweepWebhookEvents);
    expect(wired.markConversationRead).toBeInstanceOf(MarkConversationRead);
  });

  it("processes a stored event by starting its attempt and parsing it with the channel", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [{ event_id: "sha:1", attempts: 1, payload: { entry: [] } }] });

    const result = await messagingModule(db.client).processWebhookEvent.execute("sha:1");

    expect(result).toBe("ignored");
    expect(db.rpcs.map((r) => r.fn)).toEqual(["messaging_start_attempt"]);
    expect(db.callsOf(0)).toEqual([
      ["update", { status: "ignored" }],
      ["eq", "event_id", "sha:1"],
    ]);
  });

  it("sweeps claimed events without starting a second attempt", async () => {
    const db = createSupabaseQueryMock();
    db.respond({ data: [{ event_id: "sha:2", provider: "instagram", attempts: 2, payload: "bad" }] });

    const summary = await messagingModule(db.client).sweepWebhookEvents.execute();

    expect(db.rpcs.map((r) => r.fn)).toEqual(["messaging_claim_retry"]);
    expect(summary).toMatchObject({ claimed: 1, failed: 1 });
    expect(db.callsOf(0)).toEqual([
      ["update", { status: "failed" }],
      ["eq", "event_id", "sha:2"],
    ]);
    expect(db.callsOf(1)[0]).toEqual(["delete"]);
  });

  it("marks a set of conversations read through the SQL function", async () => {
    const db = createSupabaseQueryMock();

    await messagingModule(db.client).markConversationRead.execute(["c1", "c1", "c2"]);

    expect(db.rpcs).toEqual([
      { fn: "messaging_set_conversations_read", args: { p_conversation_ids: ["c1", "c2"] } },
    ]);
  });
});
