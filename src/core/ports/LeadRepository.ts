import { Lead, CreateLeadDTO, UpdateLeadDTO } from "../domain/Lead";

export interface LeadRepository {
  getAll(): Promise<Lead[]>;
  getById(id: string): Promise<Lead | null>;
  create(lead: CreateLeadDTO): Promise<Lead>;
  update(lead: UpdateLeadDTO): Promise<Lead>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: Lead['status']): Promise<Lead>;
}
