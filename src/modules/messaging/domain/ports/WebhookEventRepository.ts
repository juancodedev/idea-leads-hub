export interface WebhookEvent {
  eventId: string;
  provider: string;
  status: "received" | "processed" | "ignored" | "failed";
  attempts: number;
  payload: unknown;
  receivedAt: Date;
}

export interface WebhookEventRepository {
  claim(
    eventId: string,
    provider: string,
    payload: unknown
  ): Promise<{ eventId: string } | null>;
  incrementAttempts(eventId: string): Promise<number>;
  markProcessed(eventId: string): Promise<void>;
  markIgnored(eventId: string): Promise<void>;
  markFailed(eventId: string): Promise<void>;
  findStale(olderThanMinutes: number, maxAttempts: number, limit: number): Promise<WebhookEvent[]>;
  deleteOlderThan(days: number): Promise<void>;
}
