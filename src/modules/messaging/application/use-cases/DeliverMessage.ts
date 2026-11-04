import { MessageDirection } from "../../domain/enums/MessageDirection";
import { MessageOrigin } from "../../domain/enums/MessageOrigin";
import { MessageStatus } from "../../domain/enums/MessageStatus";
import { Message } from "../../domain/entities/Message";
import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { MessageRepository } from "../../domain/ports/MessageRepository";
import { MessagingChannel, SendContext } from "../../domain/ports/MessagingChannel";
import { NotFoundError } from "@/infrastructure/repositories/errors";
import { logger } from "@/lib/logger";

export interface MarkSentSqlInput {
  messageId: string;
  externalId: string;
  legacy: { title: string };
}

export interface DeliverMessageDeps {
  conversationRepository: ConversationRepository;
  messageRepository: MessageRepository;
  channel: MessagingChannel;
  /**
   * messaging_mark_sent: flips pending -> sent (an echo-adopted row stays as
   * is), ensures the single legacy activity and updates last_message_*,
   * atomically. Returns the message as it ends up.
   */
  execMarkSent: (input: MarkSentSqlInput) => Promise<Message>;
}

/** Send context as callers pass it; the recipient defaults to the conversation's participant. */
export type DeliverSendContext = Omit<SendContext, "recipientId"> & {
  recipientId?: string;
};

export interface DeliverMessageInput {
  conversationId: string;
  body: string;
  origin: MessageOrigin;
  sendContext: DeliverSendContext;
}

export class DeliverMessage {
  constructor(private readonly deps: DeliverMessageDeps) {}

  /**
   * Single delivery path (S7). Stores an optimistic pending row, sends it,
   * then marks it sent (with its legacy activity) or failed (error + hint).
   * A row an echo already made sent is never downgraded, and failed sends
   * write no legacy activity, so a rollback never shows them as sent (S8).
   */
  async execute(input: DeliverMessageInput): Promise<Message> {
    const { conversationRepository, messageRepository, channel, execMarkSent } =
      this.deps;

    const conversation = await conversationRepository.findById(input.conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const pending = await messageRepository.create({
      userId: conversation.userId,
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      origin: input.origin,
      type: "text",
      body: input.body,
      externalId: null,
      status: MessageStatus.PENDING,
      errorMessage: null,
      hint: null,
      legacyActivityId: null,
      rawPayload: null,
      deliveredAt: null,
      readAt: null,
    });

    const sendContext: SendContext = {
      ...input.sendContext,
      recipientId: input.sendContext.recipientId ?? conversation.externalId,
    };
    const outcome = await channel.send(sendContext, {
      conversationId: conversation.id,
      body: input.body,
      origin: input.origin,
    });

    if (outcome.ok) {
      return execMarkSent({
        messageId: pending.id,
        externalId: outcome.externalId,
        legacy: { title: `Instagram DM to ${conversation.externalId}` },
      });
    }

    const final = await messageRepository.markFailedIfPending(
      pending.id,
      outcome.error,
      outcome.hint
    );
    logger.warn("DeliverMessage: send failed", {
      messageId: pending.id,
      error: outcome.error,
      finalStatus: final.status,
    });
    return final;
  }
}
