export type WebhookEventStatus = "received" | "processed" | "ignored" | "failed";

export interface WebhookEvent {
  eventId: string;
  provider: string;
  status: WebhookEventStatus;
  attempts: number;
  payload: unknown;
  receivedAt: Date;
  /** Lease start of the latest attempt; blocks re-claims for 2 minutes. */
  lastAttemptAt: Date | null;
}

/** An event already claimed for processing, with `attempts` incremented. */
export interface ClaimedWebhookEvent {
  eventId: string;
  attempts: number;
  payload: unknown;
}

export interface WebhookEventRepository {
  /** Inserts the event; returns null when it was already claimed. */
  claim(
    eventId: string,
    provider: string,
    payload: unknown
  ): Promise<{ eventId: string } | null>;
  /**
   * Atomically increments `attempts` and sets `last_attempt_at = now()` while
   * the event is `received`; null when it is missing or no longer `received`.
   */
  startAttempt(eventId: string): Promise<ClaimedWebhookEvent | null>;
  /**
   * Atomically claims up to `limit` retryable events (`received`,
   * attempts < 3, no attempt and no receipt in the last 2 minutes),
   * incrementing attempts and leasing them via `last_attempt_at`
   * (messaging_claim_retry, FOR UPDATE SKIP LOCKED).
   */
  claimRetry(limit: number): Promise<ClaimedWebhookEvent[]>;
  markProcessed(eventId: string): Promise<void>;
  markIgnored(eventId: string): Promise<void>;
  markFailed(eventId: string): Promise<void>;
  /** Deletes processed/ignored events older than `days`. */
  deleteHandledOlderThan(days: number): Promise<void>;
}
