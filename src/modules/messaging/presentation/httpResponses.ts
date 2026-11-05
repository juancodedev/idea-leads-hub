import { Message } from "../domain/entities/Message";
import { MessageDirection } from "../domain/enums/MessageDirection";
import { MessageStatus } from "../domain/enums/MessageStatus";
import { SendContext } from "../domain/ports/MessagingChannel";

/**
 * Response item of the message readers. `id`, `text`, `direction` and
 * `timestamp` keep the pre-pipeline contract (S10); `status`, `errorMessage`
 * and `hint` are additive.
 */
export interface InboxMessageResponse {
  id: string;
  text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
  status: string;
  errorMessage: string | null;
  hint: string | null;
}

export function toInboxMessageResponse(message: Message): InboxMessageResponse {
  return {
    id: message.id,
    text: message.body ?? "",
    direction: message.direction === MessageDirection.INBOUND ? "inbound" : "outbound",
    timestamp: message.createdAt.toISOString(),
    status: message.status,
    errorMessage: message.errorMessage,
    hint: message.hint,
  };
}

export const INSTAGRAM_LOGIN_AUTH_TYPE = "instagram_business_login";

/** Stored Instagram connection, as `InstagramAuthService.getToken` returns it. */
export interface InstagramTokenData {
  token: string;
  userToken: string;
  igId: string;
  authType: string | null;
}

/**
 * Send context from the stored connection: the Instagram user token for
 * Instagram Business Login, the page token otherwise (same choice as the
 * pre-pipeline send routes); the account is the user's IG business account.
 */
export function instagramSendContext(
  userId: string,
  tokenData: InstagramTokenData
): Omit<SendContext, "recipientId"> {
  const isInstagramLogin = tokenData.authType === INSTAGRAM_LOGIN_AUTH_TYPE;
  return {
    userId,
    token: isInstagramLogin ? tokenData.userToken : tokenData.token,
    authType: tokenData.authType ?? null,
    accountId: tokenData.igId,
  };
}

export type SendResponse =
  | { status: 200; body: { messageId: string | null } }
  | { status: 502; body: { error: string; hint: string | null } };

/** 200 with `messageId` when the message ended sent, 502 with `error` and `hint` when it failed. */
export function toSendResponse(message: Message): SendResponse {
  if (message.status === MessageStatus.FAILED) {
    return {
      status: 502,
      body: {
        error: message.errorMessage || "Error al enviar mensaje de Instagram",
        hint: message.hint,
      },
    };
  }
  return { status: 200, body: { messageId: message.externalId } };
}
