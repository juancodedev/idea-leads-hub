import { SupabaseClient } from '@supabase/supabase-js';
import { Lead, CreateLeadDTO, UpdateLeadDTO } from "../../core/domain/Lead";
import { LeadRepository } from "../../core/ports/LeadRepository";

export class SupabaseLeadRepository implements LeadRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAll(): Promise<Lead[]> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*, lead_tags(tags(*))')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data.map(row => this.mapToDomain(row, row.lead_tags));
  }

  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*, lead_tags(tags(*))')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapToDomain(data, data.lead_tags) : null;
  }

  async create(lead: CreateLeadDTO): Promise<Lead> {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Usuario no autenticado');

    const { data, error } = await this.supabase
      .from('leads')
      .insert([{ 
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        status: lead.status || 'Nuevo',
        source: lead.source,
        notes: lead.notes,
        pipeline_id: lead.pipelineId,
        stage_id: lead.stageId,
        user_id: userData.user.id 
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async update(lead: UpdateLeadDTO): Promise<Lead> {
    const { id, ...updates } = lead;
    
    // Map camelCase DTO to snake_case DB columns
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.source !== undefined) dbUpdates.source = updates.source;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.pipelineId !== undefined) dbUpdates.pipeline_id = updates.pipelineId;
    if (updates.stageId !== undefined) dbUpdates.stage_id = updates.stageId;
    
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('leads')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async updateStatus(id: string, status: Lead['status']): Promise<Lead> {
    const { data, error } = await this.supabase
      .from('leads')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating status:', error);
      throw new Error(error.message);
    }
    
    if (!data) throw new Error('No se encontró el lead para actualizar');
    
    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: any, entityTags?: any[]): Lead {
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
      pipelineId: row.pipeline_id,
      stageId: row.stage_id,
      tags: entityTags ? entityTags.map((et: any) => ({
        id: et.tags.id,
        name: et.tags.name,
        color: et.tags.color,
        userId: et.tags.user_id,
        createdAt: et.tags.created_at
      })) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
