import { Channel } from "../enums/Channel";
import { MessageOrigin } from "../enums/MessageOrigin";
import { InboundEvent } from "../events/InboundEvent";

export interface SendContext {
  userId: string;
  token: string;
  authType: string | null;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  origin: MessageOrigin;
}

export interface SendOutcomeOk {
  ok: true;
  externalId: string;
}

export interface SendOutcomeError {
  ok: false;
  error: string;
  hint: string;
}

export type SendOutcome = SendOutcomeOk | SendOutcomeError;

export interface MessagingChannel {
  readonly channel: Channel;
  verifyWebhook(rawBody: ArrayBuffer, headers: Headers): Promise<boolean>;
  eventId(payload: unknown, rawBody: ArrayBuffer): Promise<string>;
  parse(payload: unknown): InboundEvent[];
  send(ctx: SendContext, input: SendMessageInput): Promise<SendOutcome>;
}
