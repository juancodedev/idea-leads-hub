import { Tag } from "./Tag";
import { Note } from "./Note";

export type LeadStatus = string;

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  userId: string;
  pipelineId?: string;
  stageId?: string;
  instagramHandle?: string;
  instagramScopedId?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  estimatedValue?: number;
  nextFollowUp?: string;
  tags?: Tag[];
  notes_data?: Note[];
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadDTO {
  name?: string;
  company: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  status?: LeadStatus;
  source?: string;
  notes?: string;
  pipelineId?: string;
  stageId?: string;
  instagramHandle?: string;
  instagramScopedId?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  estimatedValue?: number;
  nextFollowUp?: string;
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {
  id: string;
}
