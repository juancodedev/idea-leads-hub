import { Channel } from "../enums/Channel";
import { ChannelAccount } from "../entities/ChannelAccount";

export interface ChannelAccountRepository {
  findById(id: string): Promise<ChannelAccount | null>;
  findByExternalAccountId(
    channel: Channel,
    externalAccountId: string
  ): Promise<ChannelAccount | null>;
  findByUserId(userId: string): Promise<ChannelAccount[]>;
  create(account: Omit<ChannelAccount, "id" | "createdAt" | "updatedAt">): Promise<ChannelAccount>;
}
