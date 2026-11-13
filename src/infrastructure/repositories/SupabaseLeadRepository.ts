import { SupabaseClient } from '@supabase/supabase-js';
import { Lead, CreateLeadDTO, UpdateLeadDTO } from "../../core/domain/Lead";
import { LeadRepository, LeadSearchParams, PaginatedResult } from "../../core/ports/LeadRepository";
import { Database } from "../database/database.types";
import { BaseRepository } from "./BaseRepository";
import { ConflictError } from "./errors";

/** Postgres foreign_key_violation. */
const FOREIGN_KEY_VIOLATION = '23503';

/** Shown to the user when a lead cannot be deleted because conversations reference it. */
export const LEAD_HAS_CONVERSATIONS_MESSAGE =
  'No se puede eliminar el lead porque tiene conversaciones de Instagram asociadas. ' +
  'Eliminá o desvinculá esas conversaciones desde Mensajes y volvé a intentarlo.';

type LeadRow = Database['public']['Tables']['leads']['Row'];
type TagRow = Database['public']['Tables']['tags']['Row'];
type NoteRow = Database['public']['Tables']['notes']['Row'];

// PostgREST join shape (not expressible in Database type)
interface LeadWithJoins extends LeadRow {
  lead_tags?: Array<{ tags: TagRow }>;
  notes_data?: NoteRow[];
}

// last_activity_at is now a column on the leads table, updated by DB triggers
// on notes/activities INSERT and leads UPDATE — no need to join activities here
const LEAD_SELECT_WITH_JOINS = '*, lead_tags(tags(*)), notes_data:notes(*)';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'name',
  company: 'company',
  email: 'email',
  status: 'status',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  estimatedValue: 'estimated_value',
  opportunityScore: 'opportunity_score',
  rating: 'rating',
};

export interface UpsertLeadResult {
  lead: Lead;
  /** true when the lead was created by this call, false when it was updated. */
  created: boolean;
}

export class SupabaseLeadRepository extends BaseRepository implements LeadRepository {
  /**
   * @param scopedUserId Set on machine (API key) paths, where the client is
   * service-role and RLS does not scope queries. Every query is filtered by it.
   * On session paths it stays undefined and RLS keeps scoping the user.
   */
  constructor(
    supabase: SupabaseClient<Database>,
    scopedUserId?: string
  ) {
    super(supabase, 'leads', scopedUserId);
  }

  private get userId(): string | undefined {
    return this.scopedUserId;
  }

  private scope<T>(query: T): T {
    return this.scopeToUser(query);
  }

  async getAll(): Promise<Lead[]> {
    const { data, error } = await this.scope(
      this.supabase
        .from('leads')
        .select(LEAD_SELECT_WITH_JOINS)
    ).order('created_at', { ascending: false });

    if (error) this.handleError(error);
    const rows = (data ?? []) as unknown as LeadWithJoins[];
    return rows.map(row => this.mapToDomain(row, row.lead_tags, row.notes_data));
  }

  async search(params?: LeadSearchParams): Promise<PaginatedResult<Lead>> {
    const {
      query,
      status,
      source,
      sort,
      order,
      page = 1,
      limit = 25,
      updatedSince,
    } = params || {};

    let queryBuilder = this.scope(
      this.supabase
        .from('leads')
        .select(LEAD_SELECT_WITH_JOINS, { count: 'exact' })
    );

    // Text search across name, company, email and the external id
    if (query && query.trim()) {
      const q = query.trim();
      queryBuilder = queryBuilder.or(
        `name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%,external_id.ilike.%${q}%`
      );
    }

    // Status filter
    if (status && status !== 'all') {
      queryBuilder = queryBuilder.eq('status', status);
    }

    // Source filter
    if (source && source !== 'all') {
      queryBuilder = queryBuilder.eq('source', source);
    }

    // Changes since an instant: the poller reads forward, so the default order
    // flips to updated_at ascending to page without gaps.
    if (updatedSince) {
      queryBuilder = queryBuilder.gte('updated_at', updatedSince);
    }

    // Map sort field to DB column
    const sortKey = sort ?? (updatedSince ? 'updatedAt' : 'createdAt');
    const sortField = SORT_FIELD_MAP[sortKey] || 'created_at';
    const ascending = order ? order === 'asc' : Boolean(updatedSince);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await queryBuilder
      .order(sortField, { ascending })
      .range(from, to);

    if (error) this.handleError(error);
    const rows = (data ?? []) as unknown as LeadWithJoins[];
    const leads = rows.map(row => this.mapToDomain(row, row.lead_tags, row.notes_data));

    return {
      data: leads,
      total: count ?? 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    };
  }

  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await this.scope(
      this.supabase
        .from('leads')
        .select(LEAD_SELECT_WITH_JOINS)
    )
      .eq('id', id)
      .maybeSingle();

    if (error) this.handleError(error);
    const row = data as unknown as LeadWithJoins | null;
    return row ? this.mapToDomain(row, row.lead_tags, row.notes_data) : null;
  }

  async getByExternalId(externalId: string): Promise<Lead | null> {
    const { data, error } = await this.scope(
      this.supabase
        .from('leads')
        .select(LEAD_SELECT_WITH_JOINS)
    )
      .eq('external_id', externalId)
      .maybeSingle();

    if (error) this.handleError(error);
    const row = data as unknown as LeadWithJoins | null;
    return row ? this.mapToDomain(row, row.lead_tags, row.notes_data) : null;
  }

  async create(lead: CreateLeadDTO): Promise<Lead> {
    const userId = await this.resolveUserId();

    const { data, error } = await this.supabase
      .from('leads')
      .insert([{
        name: lead.name ?? '',
        company: lead.company,
        email: lead.email || null,
        phone: lead.phone ?? null,
        address: lead.address ?? null,
        website: lead.website ?? null,
        status: lead.status || 'Nuevo',
        source: lead.source ?? null,
        notes: lead.notes ?? null,
        pipeline_id: lead.pipelineId ?? null,
        stage_id: lead.stageId ?? null,
        instagram_handle: lead.instagramHandle ?? null,
        instagram_scoped_id: lead.instagramScopedId ?? null,
        job_title: lead.jobTitle ?? null,
        linkedin_url: lead.linkedinUrl ?? null,
        estimated_value: lead.estimatedValue ?? null,
        next_follow_up: lead.nextFollowUp ?? null,
        external_id: lead.externalId ?? null,
        city: lead.city ?? null,
        industry: lead.industry ?? null,
        opportunity_score: lead.opportunityScore ?? null,
        rating: lead.rating ?? null,
        reviews_count: lead.reviewsCount ?? null,
        user_id: userId,
      }] as never)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as LeadRow);
  }

  /**
   * Create or update by `externalId` so retried integration sends and repeated
   * backfills never duplicate a lead.
   *
   * `createLead` is only used when the row does not exist, so defaults such as
   * `status: 'Nuevo'` cannot overwrite a value the user set in the CRM. An
   * existing lead receives only `patch` — the fields the client actually sent.
   */
  async upsertByExternalId(
    externalId: string,
    createLead: CreateLeadDTO,
    patch: Omit<UpdateLeadDTO, 'id'>
  ): Promise<UpsertLeadResult> {
    const existing = await this.getByExternalId(externalId);

    if (existing) {
      const updated = await this.update({ id: existing.id, ...patch });
      return { lead: updated, created: false };
    }

    try {
      const created = await this.create({ ...createLead, externalId });
      return { lead: created, created: true };
    } catch (error) {
      // Concurrent first insert of the same external id: adopt the winner.
      if (error instanceof ConflictError) {
        const winner = await this.getByExternalId(externalId);
        if (winner) {
          const updated = await this.update({ id: winner.id, ...patch });
          return { lead: updated, created: false };
        }
      }
      throw error;
    }
  }

  async update(lead: UpdateLeadDTO): Promise<Lead> {
    const { id, ...updates } = lead;

    // Map camelCase DTO to snake_case DB columns
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.company !== undefined) dbUpdates.company = updates.company || null;
    if (updates.email !== undefined) dbUpdates.email = updates.email || null;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
    if (updates.address !== undefined) dbUpdates.address = updates.address || null;
    if (updates.website !== undefined) dbUpdates.website = updates.website || null;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.source !== undefined) dbUpdates.source = updates.source || null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
    if (updates.pipelineId !== undefined) dbUpdates.pipeline_id = updates.pipelineId;
    if (updates.stageId !== undefined) dbUpdates.stage_id = updates.stageId;
    if (updates.instagramHandle !== undefined) dbUpdates.instagram_handle = updates.instagramHandle || null;
    if (updates.instagramScopedId !== undefined) dbUpdates.instagram_scoped_id = updates.instagramScopedId || null;
    if (updates.jobTitle !== undefined) dbUpdates.job_title = updates.jobTitle || null;
    if (updates.linkedinUrl !== undefined) dbUpdates.linkedin_url = updates.linkedinUrl || null;
    if (updates.estimatedValue !== undefined) dbUpdates.estimated_value = updates.estimatedValue;
    if (updates.nextFollowUp !== undefined) dbUpdates.next_follow_up = updates.nextFollowUp || null;
    if (updates.externalId !== undefined) dbUpdates.external_id = updates.externalId;
    if (updates.city !== undefined) dbUpdates.city = updates.city || null;
    if (updates.industry !== undefined) dbUpdates.industry = updates.industry || null;
    if (updates.opportunityScore !== undefined) dbUpdates.opportunity_score = updates.opportunityScore;
    if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
    if (updates.reviewsCount !== undefined) dbUpdates.reviews_count = updates.reviewsCount;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await this.scope(
      this.supabase
        .from('leads')
        .update(dbUpdates as never)
    )
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as LeadRow);
  }

  async updateStatus(id: string, status: Lead['status']): Promise<Lead> {
    const { data, error } = await this.scope(
      this.supabase
        .from('leads')
        .update({
          status,
          updated_at: new Date().toISOString()
        } as never)
    )
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
    const { error } = await this.scope(
      this.supabase
        .from('leads')
        .delete()
    ).eq('id', id);

    // Instagram conversations reference the lead without ON DELETE, so a lead
    // with conversations cannot be deleted. Surface that as a 409 the UI can
    // show as a warning instead of a generic database error.
    if (error?.code === FOREIGN_KEY_VIOLATION) {
      throw new ConflictError(LEAD_HAS_CONVERSATIONS_MESSAGE);
    }
    if (error) this.handleError(error);
  }

  private mapToDomain(
    row: LeadRow,
    entityTags?: Array<{ tags: TagRow }>,
    notesData?: NoteRow[]
  ): Lead {
    return {
      id: row.id,
      name: row.name,
      company: row.company,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      website: row.website ?? undefined,
      status: row.status as Lead['status'],
      source: row.source ?? undefined,
      notes: row.notes ?? undefined,
      userId: row.user_id,
      pipelineId: row.pipeline_id ?? undefined,
      stageId: row.stage_id ?? undefined,
      instagramHandle: row.instagram_handle ?? undefined,
      instagramScopedId: row.instagram_scoped_id ?? undefined,
      jobTitle: row.job_title ?? undefined,
      linkedinUrl: row.linkedin_url ?? undefined,
      estimatedValue: row.estimated_value ?? undefined,
      nextFollowUp: row.next_follow_up ?? undefined,
      externalId: row.external_id ?? undefined,
      city: row.city ?? undefined,
      industry: row.industry ?? undefined,
      opportunityScore: row.opportunity_score ?? undefined,
      rating: row.rating ?? undefined,
      reviewsCount: row.reviews_count ?? undefined,
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
      lastActivityAt: row.last_activity_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
