import { Channel } from "../enums/Channel";

export interface Conversation {
  id: string;
  userId: string;
  leadId: string | null;
  accountId: string | null;
  channel: Channel;
  externalId: string;
  participantName: string | null;
  lastInboundAt: Date | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
