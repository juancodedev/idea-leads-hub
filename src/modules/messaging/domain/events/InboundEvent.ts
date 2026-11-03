export type InboundEventKind = "message" | "echo";

export interface InboundEvent {
  kind: InboundEventKind;
  accountId: string;
  participantId: string;
  mid?: string;
  text: string;
  timestamp: Date;
  rawPayload: unknown;
}
