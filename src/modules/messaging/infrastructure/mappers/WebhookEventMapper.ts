import { ClaimedWebhookEvent } from "../../domain/ports/WebhookEventRepository";

export interface ClaimedWebhookEventRow {
  event_id: string;
  attempts: number;
  payload: unknown;
}

export const WebhookEventMapper = {
  toClaimed(row: ClaimedWebhookEventRow): ClaimedWebhookEvent {
    return { eventId: row.event_id, attempts: row.attempts, payload: row.payload };
  },
};
