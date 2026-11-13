import { Lead, CreateLeadDTO, UpdateLeadDTO } from "../domain/Lead";

export interface LeadSearchParams {
  query?: string;
  status?: string;
  source?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  /**
   * Only leads whose `updated_at` is at or after this ISO-8601 instant. Used by
   * integrations that poll the CRM for changes (status, do-not-contact).
   */
  updatedSince?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpsertLeadResult {
  lead: Lead;
  /** true when the lead was created by the call, false when it was updated. */
  created: boolean;
}

export interface LeadRepository {
  getAll(): Promise<Lead[]>;
  search(params?: LeadSearchParams): Promise<PaginatedResult<Lead>>;
  getById(id: string): Promise<Lead | null>;
  getByExternalId(externalId: string): Promise<Lead | null>;
  create(lead: CreateLeadDTO): Promise<Lead>;
  upsertByExternalId(
    externalId: string,
    createLead: CreateLeadDTO,
    patch: Omit<UpdateLeadDTO, 'id'>
  ): Promise<UpsertLeadResult>;
  update(lead: UpdateLeadDTO): Promise<Lead>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: Lead['status']): Promise<Lead>;
}
