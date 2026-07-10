import { SupabaseClient } from '@supabase/supabase-js';
import { Lead, CreateLeadDTO, UpdateLeadDTO } from "../../core/domain/Lead";
import { LeadRepository } from "../../core/ports/LeadRepository";
import { Database } from "../database/database.types";
import { BaseRepository } from "./BaseRepository";

type LeadRow = Database['public']['Tables']['leads']['Row'];
type TagRow = Database['public']['Tables']['tags']['Row'];
type NoteRow = Database['public']['Tables']['notes']['Row'];

// PostgREST join shape (not expressible in Database type)
interface LeadWithJoins extends LeadRow {
  lead_tags?: Array<{ tags: TagRow }>;
  notes_data?: NoteRow[];
}

export class SupabaseLeadRepository extends BaseRepository implements LeadRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'leads');
  }

  async getAll(): Promise<Lead[]> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*, lead_tags(tags(*)), notes_data:notes(*)')
      .order('created_at', { ascending: false });

    if (error) this.handleError(error);
    const rows = (data ?? []) as unknown as LeadWithJoins[];
    return rows.map(row => this.mapToDomain(row, row.lead_tags, row.notes_data));
  }

  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*, lead_tags(tags(*)), notes_data:notes(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) this.handleError(error);
    const row = data as unknown as LeadWithJoins | null;
    return row ? this.mapToDomain(row, row.lead_tags, row.notes_data) : null;
  }

  async create(lead: CreateLeadDTO): Promise<Lead> {
    const userId = await this.requireUser();

    const { data, error } = await this.supabase
      .from('leads')
      .insert([{
        name: lead.name ?? '',
        company: lead.company,
        email: lead.email,
        phone: lead.phone ?? null,
        address: lead.address ?? null,
        website: lead.website ?? null,
        status: lead.status || 'Nuevo',
        source: lead.source ?? null,
        notes: lead.notes ?? null,
        pipeline_id: lead.pipelineId ?? null,
        stage_id: lead.stageId ?? null,
        user_id: userId
      }] as never)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as LeadRow);
  }

  async update(lead: UpdateLeadDTO): Promise<Lead> {
    const { id, ...updates } = lead;

    // Map camelCase DTO to snake_case DB columns
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.website !== undefined) dbUpdates.website = updates.website;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.source !== undefined) dbUpdates.source = updates.source;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.pipelineId !== undefined) dbUpdates.pipeline_id = updates.pipelineId;
    if (updates.stageId !== undefined) dbUpdates.stage_id = updates.stageId;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('leads')
      .update(dbUpdates as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as LeadRow);
  }

  async updateStatus(id: string, status: Lead['status']): Promise<Lead> {
    const { data, error } = await this.supabase
      .from('leads')
      .update({
        status,
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating status:', error);
      this.handleError(error);
    }

    if (!data) this.handleError({ code: 'PGRST116', message: 'No se encontró el lead para actualizar', details: '', hint: '' });

    return this.mapToDomain(data as unknown as LeadRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) this.handleError(error);
  }

  private mapToDomain(row: LeadRow, entityTags?: Array<{ tags: TagRow }>, notesData?: NoteRow[]): Lead {
    return {
      id: row.id,
      name: row.name,
      company: row.company,
      email: row.email,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      website: row.website ?? undefined,
      status: row.status as Lead['status'],
      source: row.source ?? undefined,
      notes: row.notes ?? undefined,
      userId: row.user_id,
      pipelineId: row.pipeline_id ?? undefined,
      stageId: row.stage_id ?? undefined,
      tags: entityTags ? entityTags.map(et => ({
        id: et.tags.id,
        name: et.tags.name,
        color: et.tags.color,
        userId: et.tags.user_id,
        createdAt: et.tags.created_at
      })) : [],
      notes_data: notesData ? notesData.map(n => ({
        id: n.id,
        userId: n.user_id,
        entityId: n.lead_id ?? n.idea_id ?? '',
        entityType: n.lead_id ? 'lead' : 'idea',
        content: n.content,
        createdAt: n.created_at,
        updatedAt: n.updated_at
      })) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
