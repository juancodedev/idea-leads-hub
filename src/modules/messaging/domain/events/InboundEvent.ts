export type InboundEventKind = "message" | "echo";

export type InboundAttachmentType = "image" | "audio" | "video" | "file";

export interface InboundEvent {
  kind: InboundEventKind;
  /** Channel account that received (message) or sent (echo) the message. */
  accountId: string;
  /** External participant (IGSID); for echoes, the recipient. */
  participantId: string;
  mid?: string;
  text: string;
  /** Set when the message carries an attachment instead of (or besides) text. */
  attachmentType?: InboundAttachmentType;
  /** Provider timestamp of the message (not the processing time). */
  timestamp: Date;
  rawPayload: unknown;
}
