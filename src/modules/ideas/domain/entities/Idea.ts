import { IdeaPriority, IdeaStatus } from "../enums/IdeaEnums";
import { Tag } from "@/core/domain/Tag";

export interface Idea {
  id: string;
  title: string;
  description: string;
  priority: IdeaPriority;
  status: IdeaStatus;
  leadId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
  tags?: Tag[];
}

export type CreateIdeaDTO = Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'createdBy' | 'tags'> & {
  tagIds?: string[];
};
export type UpdateIdeaDTO = Partial<CreateIdeaDTO> & { id: string };
