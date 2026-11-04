import {
  ClaimedWebhookEvent,
  WebhookEventRepository,
} from "../../domain/ports/WebhookEventRepository";
import { ProcessResult } from "./ProcessWebhookEvent";

export const SWEEP_BATCH_SIZE = 5;
export const HANDLED_EVENT_RETENTION_DAYS = 30;

export interface SweepWebhookEventsDeps {
  webhookEventRepository: WebhookEventRepository;
  processEvent: (event: ClaimedWebhookEvent) => Promise<ProcessResult>;
}

export interface SweepSummary {
  claimed: number;
  processed: number;
  ignored: number;
  retrying: number;
  failed: number;
}

export class SweepWebhookEvents {
  constructor(private readonly deps: SweepWebhookEventsDeps) {}

  /**
   * Retry sweep (S4, ADR-5). Claims at most 5 stuck events atomically
   * (messaging_claim_retry increments attempts with FOR UPDATE SKIP LOCKED,
   * so overlapping sweeps never share an event), processes them, then purges
   * handled events past the retention window.
   */
  async execute(): Promise<SweepSummary> {
    const { webhookEventRepository, processEvent } = this.deps;

    const events = await webhookEventRepository.claimRetry(SWEEP_BATCH_SIZE);
    const summary: SweepSummary = {
      claimed: events.length,
      processed: 0,
      ignored: 0,
      retrying: 0,
      failed: 0,
    };

    for (const event of events) {
      const result = await processEvent(event);
      if (result === "processed") summary.processed++;
      else if (result === "ignored") summary.ignored++;
      else if (result === "received") summary.retrying++;
      else if (result === "failed") summary.failed++;
    }

    await webhookEventRepository.deleteHandledOlderThan(
      HANDLED_EVENT_RETENTION_DAYS
    );
    return summary;
  }
}
