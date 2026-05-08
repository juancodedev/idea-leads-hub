import { SupabaseClient } from '@supabase/supabase-js';
import { Lead, CreateLeadDTO, UpdateLeadDTO } from "../../core/domain/Lead";
import { LeadRepository } from "../../core/ports/LeadRepository";

export class SupabaseLeadRepository implements LeadRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAll(): Promise<Lead[]> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data.map(this.mapToDomain);
  }

  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return this.mapToDomain(data);
  }

  async create(lead: CreateLeadDTO): Promise<Lead> {
    const { data, error } = await this.supabase
      .from('leads')
      .insert([lead])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async update(lead: UpdateLeadDTO): Promise<Lead> {
    const { id, ...updates } = lead;
    const { data, error } = await this.supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async updateStatus(id: string, status: Lead['status']): Promise<Lead> {
    const { data, error } = await this.supabase
      .from('leads')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: any): Lead {
    return {
      id: row.id,
      name: row.name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      status: row.status,
      source: row.source,
      notes: row.notes,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
