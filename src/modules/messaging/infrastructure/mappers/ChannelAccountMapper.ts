import { Database } from "@/infrastructure/database/database.types";
import { ChannelAccount } from "../../domain/entities/ChannelAccount";
import { Channel } from "../../domain/enums/Channel";
import { toDate } from "./dates";

type Tables = Database["public"]["Tables"];
export type ChannelAccountRow = Tables["channel_accounts"]["Row"];
export type ChannelAccountInsert = Tables["channel_accounts"]["Insert"];

export const ChannelAccountMapper = {
  toDomain(row: ChannelAccountRow): ChannelAccount {
    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel as Channel,
      externalAccountId: row.external_account_id,
      pageId: row.page_id,
      displayName: row.display_name,
      status: row.status,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    };
  },

  toInsert(
    account: Omit<ChannelAccount, "id" | "createdAt" | "updatedAt">
  ): ChannelAccountInsert {
    return {
      user_id: account.userId,
      channel: account.channel,
      external_account_id: account.externalAccountId,
      page_id: account.pageId,
      display_name: account.displayName,
      status: account.status,
    };
  },
};
