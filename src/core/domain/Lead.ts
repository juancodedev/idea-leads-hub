import { Tag } from "./Tag";
import { Note } from "./Note";

export type LeadStatus = string;

export interface Lead {
  id: string;
  name: string;
  company: string;
  /** Optional: leads that only have WhatsApp or Instagram have no email. */
  email?: string;
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
  /** Client-owned identifier (e.g. the prospect domain); unique per user. */
  externalId?: string;
  city?: string;
  industry?: string;
  /** Imported prioritization score, 0-100. */
  opportunityScore?: number;
  /** Imported reputation rating, 0-5. */
  rating?: number;
  reviewsCount?: number;
  tags?: Tag[];
  notes_data?: Note[];
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadDTO {
  name?: string;
  company: string;
  email?: string;
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
  externalId?: string;
  city?: string;
  industry?: string;
  opportunityScore?: number;
  rating?: number;
  reviewsCount?: number;
}

export interface UpdateLeadDTO {
  id: string;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  status?: LeadStatus;
  source?: string;
  notes?: string;
  pipelineId?: string | null;
  stageId?: string | null;
  instagramHandle?: string;
  instagramScopedId?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  estimatedValue?: number | null;
  nextFollowUp?: string | null;
  externalId?: string;
  city?: string;
  industry?: string;
  opportunityScore?: number | null;
  rating?: number | null;
  reviewsCount?: number | null;
}
