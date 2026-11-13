import { Tag } from "./Tag";
import { Note } from "./Note";

export type LeadStatus = string;

/**
 * Status assigned when a client creates a lead without one.
 *
 * The full set of valid statuses is the user's pipeline stage names, published
 * by `GET /api/leads/statuses`; this default only matches the seeded pipeline.
 */
export const DEFAULT_LEAD_STATUS = 'Nuevo';

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
  /** When the status last changed. Drives the integration's reverse sync. */
  statusChangedAt?: string;
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
  /** `null` clears the stored value. */
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  status?: LeadStatus;
  source?: string | null;
  notes?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  instagramHandle?: string | null;
  instagramScopedId?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  estimatedValue?: number | null;
  nextFollowUp?: string | null;
  externalId?: string;
  city?: string | null;
  industry?: string | null;
  opportunityScore?: number | null;
  rating?: number | null;
  reviewsCount?: number | null;
}
