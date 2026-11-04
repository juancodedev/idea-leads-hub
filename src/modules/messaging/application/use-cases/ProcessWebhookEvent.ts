import { InboundEvent } from "../../domain/events/InboundEvent";
import {
  ClaimedWebhookEvent,
  WebhookEventRepository,
} from "../../domain/ports/WebhookEventRepository";
import { IngestResult } from "./IngestInboundEvent";
import { logger } from "@/lib/logger";

export const MAX_WEBHOOK_ATTEMPTS = 3;

export interface ProcessWebhookEventDeps {
  webhookEventRepository: WebhookEventRepository;
  /** Parses a stored payload into InboundEvents (MessagingChannel.parse). */
  parsePayload: (payload: unknown) => InboundEvent[];
  ingestEvent: (event: InboundEvent) => Promise<IngestResult>;
}

/**
 * - processed: at least one message was stored or adopted
 * - ignored: nothing applicable (no events, unknown account, duplicates)
 * - received: a retryable error happened; the sweep will retry it
 * - failed: unparseable payload, or the last allowed attempt failed
 * - skipped: the event was missing or already handled by another run
 */
export type ProcessResult = "processed" | "ignored" | "received" | "failed" | "skipped";

export class ProcessWebhookEvent {
  constructor(private readonly deps: ProcessWebhookEventDeps) {}

  /**
   * Processes one claimed webhook event (S4). The background run passes only
   * the id and the attempt is started here; the sweep passes the event it
   * already claimed through messaging_claim_retry, so attempts are never
   * incremented twice.
   */
  async execute(
    eventId: string,
    claimed?: ClaimedWebhookEvent
  ): Promise<ProcessResult> {
    const { webhookEventRepository, parsePayload, ingestEvent } = this.deps;

    const event = claimed ?? (await webhookEventRepository.startAttempt(eventId));
    if (!event) {
      return "skipped";
    }

    let events: InboundEvent[];
    try {
      events = parsePayload(event.payload);
    } catch (error) {
      logger.error("ProcessWebhookEvent: unparseable payload", { eventId, error });
      await webhookEventRepository.markFailed(eventId);
      return "failed";
    }

    let stored = false;
    try {
      for (const inbound of events) {
        const result = await ingestEvent(inbound);
        if (result.kind === "processed") stored = true;
      }
    } catch (error) {
      if (event.attempts >= MAX_WEBHOOK_ATTEMPTS) {
        logger.error("ProcessWebhookEvent: giving up after max attempts", {
          eventId,
          attempts: event.attempts,
          error,
        });
        await webhookEventRepository.markFailed(eventId);
        return "failed";
      }
      logger.warn("ProcessWebhookEvent: retryable error, left for the sweep", {
        eventId,
        attempts: event.attempts,
        error,
      });
      return "received";
    }

    if (stored) {
      await webhookEventRepository.markProcessed(eventId);
      return "processed";
    }
    await webhookEventRepository.markIgnored(eventId);
    return "ignored";
  }
}
