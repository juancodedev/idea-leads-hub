import { Lead, CreateLeadDTO, UpdateLeadDTO } from "../domain/Lead";

export interface LeadSearchParams {
  query?: string;
  status?: string;
  source?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadRepository {
  getAll(): Promise<Lead[]>;
  search(params?: LeadSearchParams): Promise<PaginatedResult<Lead>>;
  getById(id: string): Promise<Lead | null>;
  create(lead: CreateLeadDTO): Promise<Lead>;
  update(lead: UpdateLeadDTO): Promise<Lead>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: Lead['status']): Promise<Lead>;
}
