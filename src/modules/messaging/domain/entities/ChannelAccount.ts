import { Channel } from "../enums/Channel";

export interface ChannelAccount {
  id: string;
  userId: string;
  channel: Channel;
  externalAccountId: string;
  pageId: string | null;
  displayName: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
