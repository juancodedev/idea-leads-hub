import { ChannelAccount } from "../../domain/entities/ChannelAccount";
import { Message } from "../../domain/entities/Message";
import { Channel } from "../../domain/enums/Channel";
import { MessageOrigin } from "../../domain/enums/MessageOrigin";
import { ChannelAccountRepository } from "../../domain/ports/ChannelAccountRepository";
import { ConversationRepository } from "../../domain/ports/ConversationRepository";
import { SendContext } from "../../domain/ports/MessagingChannel";
import { DeliverMessage } from "./DeliverMessage";
import { LinkInboxConversations } from "./LinkInboxConversations";

export interface SendToParticipantDeps {
  channelAccountRepository: ChannelAccountRepository;
  conversationRepository: ConversationRepository;
  deliverMessage: DeliverMessage;
  linkInboxConversations: LinkInboxConversations;
}

export interface SendToParticipantInput {
  userId: string;
  /** External participant id (Instagram: the IGSID). */
  participantId: string;
  /** Lead the conversation belongs to, when the caller knows it. */
  leadId: string | null;
  body: string;
  origin: MessageOrigin;
  /** `accountId` is the user's business account id on the channel. */
  sendContext: Omit<SendContext, "recipientId">;
}

/**
 * Entry point of the send endpoints and the auto trigger (S7, S10): resolves
 * the user's channel account and the participant's conversation (created
 * when missing, linked to the lead when it had none), then delivers through
 * DeliverMessage, the single send path. Returns the final message (`sent`,
 * or `failed` with `errorMessage` and `hint`).
 */
export class SendToParticipant {
  constructor(private readonly deps: SendToParticipantDeps) {}

  async execute(input: SendToParticipantInput): Promise<Message> {
    const { conversationRepository, deliverMessage, linkInboxConversations } = this.deps;
    const account = await this.resolveAccount(input.userId, input.sendContext.accountId);

    const conversation = await conversationRepository.findOrCreate({
      userId: input.userId,
      leadId: input.leadId,
      accountId: account.id,
      channel: Channel.INSTAGRAM,
      externalId: input.participantId,
      participantName: null,
      lastInboundAt: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadCount: 0,
      metadata: {},
    });

    if (input.leadId && !conversation.leadId) {
      await linkInboxConversations.execute(input.userId, input.participantId, input.leadId);
    }

    return deliverMessage.execute({
      conversationId: conversation.id,
      body: input.body,
      origin: input.origin,
      sendContext: { ...input.sendContext, recipientId: input.participantId },
    });
  }

  /**
   * The user's account with the sending id, else the user's first Instagram
   * account, else a new connected account for the sending id (mirrors the
   * `channel_accounts` sync on connect). Never another user's account.
   */
  private async resolveAccount(userId: string, accountId: string): Promise<ChannelAccount> {
    const accounts = (await this.deps.channelAccountRepository.findByUserId(userId)).filter(
      (a) => a.channel === Channel.INSTAGRAM
    );
    const match = accounts.find((a) => a.externalAccountId === accountId) ?? accounts[0];
    if (match) return match;
    if (!accountId) {
      throw new Error("Instagram account is not connected");
    }
    return this.deps.channelAccountRepository.create({
      userId,
      channel: Channel.INSTAGRAM,
      externalAccountId: accountId,
      pageId: null,
      displayName: null,
      status: "connected",
    });
  }
}
