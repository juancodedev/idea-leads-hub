import { IdeaPriority, IdeaStatus } from "../enums/IdeaEnums";
import { Tag } from "@/core/domain/Tag";

export interface IdeaAttachment {
  name: string;
  url: string;
  path: string;
  size: number;
  type: string;
}

export interface Idea {
  id: string;
  title: string;
  description?: string;
  priority: IdeaPriority;
  status: IdeaStatus;
  leadId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
  tags?: Tag[];
  attachments?: IdeaAttachment[];
}

export type CreateIdeaDTO = Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'createdBy' | 'tags'> & {
  tagIds?: string[];
};
export type UpdateIdeaDTO = Partial<CreateIdeaDTO> & { id: string };
