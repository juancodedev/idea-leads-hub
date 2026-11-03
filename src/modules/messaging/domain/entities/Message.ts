import { MessageDirection } from "../enums/MessageDirection";
import { MessageOrigin } from "../enums/MessageOrigin";
import { MessageStatus } from "../enums/MessageStatus";

export interface Message {
  id: string;
  userId: string;
  conversationId: string;
  direction: MessageDirection;
  origin: MessageOrigin | null;
  type: string;
  body: string | null;
  externalId: string | null;
  status: MessageStatus;
  errorMessage: string | null;
  hint: string | null;
  legacyActivityId: string | null;
  rawPayload: unknown;
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  updatedAt: Date;
}
