import { SupabaseClient } from "@supabase/supabase-js";
import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../../domain/entities/Activity";
import { ActivityRepository, ActivitySearchParams } from "../../domain/repositories/ActivityRepository";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { ActivityMapper } from "../mappers/ActivityMapper";
import { BaseRepository } from "../../../../infrastructure/repositories/BaseRepository";
import { ConflictError, NotFoundError } from "../../../../infrastructure/repositories/errors";
import { Database } from "../../../../infrastructure/database/database.types";

export interface UpsertActivityResult {
  activity: Activity;
  /** true when the activity was created by this call, false when it was updated. */
  created: boolean;
}

export class SupabaseActivityRepository extends BaseRepository implements ActivityRepository {
  /**
   * @param scopedUserId Set on machine (API key) paths, where the client is
   * service-role and RLS does not scope queries. Every query is filtered by it.
   */
  constructor(supabase: SupabaseClient<Database>, scopedUserId?: string) {
    super(supabase, 'activities', scopedUserId);
  }

  async getById(id: string): Promise<Activity | null> {
    const { data, error } = await this.scopeToUser(
      this.supabase
        .from('activities')
        .select('*')
    )
      .eq('id', id)
      .maybeSingle();

    if (error) this.handleError(error);
    return data ? ActivityMapper.toDomain(data) : null;
  }

  async getForLead(leadId: string): Promise<Activity[]> {
    const { data, error } = await this.scopeToUser(
      this.supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
    ).order('created_at', { ascending: false });

    if (error) this.handleError(error);
    return data.map(ActivityMapper.toDomain);
  }

  async getForIdea(ideaId: string): Promise<Activity[]> {
    const { data, error } = await this.scopeToUser(
      this.supabase
        .from('activities')
        .select('*')
        .eq('idea_id', ideaId)
    ).order('created_at', { ascending: false });

    if (error) this.handleError(error);
    return data.map(ActivityMapper.toDomain);
  }

  async getPending(userId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('due_date', { ascending: true });

    if (error) this.handleError(error);
    return data.map(ActivityMapper.toDomain);
  }

  async search(params: ActivitySearchParams): Promise<{ data: Activity[]; total: number; page: number; totalPages: number }> {
    let query = this.supabase
      .from('activities')
      .select('*', { count: 'exact' });

    query = query.eq('user_id', params.userId);

    if (params.query) {
      query = query.ilike('title', `%${params.query}%`);
    }

    if (params.type) {
      query = query.eq('type', params.type);
    }

    // Status filter (design Search contract): statusIn omitted defaults to the
    // pending set and treats rows with status IS NULL as PENDING (rows written
    // before the backfill read as PENDING — matches the mapper fallback and
    // getPending).
    if (params.statusIn && params.statusIn.length > 0) {
      query = query.in('status', params.statusIn);
    } else {
      query = query.or('status.in.(PENDING,IN_PROGRESS),status.is.null');
    }

    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    query = query
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) this.handleError(error);

    return {
      data: (data || []).map(ActivityMapper.toDomain),
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async create(activity: CreateActivityDTO): Promise<Activity> {
    const userId = await this.resolveUserId();
    await this.assertEntityOwnership(activity.leadId, activity.ideaId);

    // Rollout normalization (BR-4): legacy `completed:true` writers map to
    // status=COMPLETED; the mapper then dual-writes `completed` from status.
    const status = activity.status ?? (activity.completed ? ActivityStatus.COMPLETED : ActivityStatus.PENDING);
    // A completed activity without an explicit date happened now.
    const completedAt = status === ActivityStatus.COMPLETED
      ? activity.completedAt ?? new Date()
      : activity.completedAt;

    const persistence = ActivityMapper.toPersistence({
      ...activity,
      status,
      completedAt,
      userId: userId
    });
    
    // Asignar user_id explícitamente para persistencia si el mapper no lo hace
    persistence.user_id = userId;

    const { data, error } = await this.supabase
      .from('activities')
      .insert([persistence] as never)
      .select()
      .single();

    if (error) this.handleError(error);
    return ActivityMapper.toDomain(data);
  }

  /** Look up an activity by the client-owned id. */
  async getByExternalId(externalId: string): Promise<Activity | null> {
    const { data, error } = await this.scopeToUser(
      this.supabase
        .from('activities')
        .select('*')
        .eq('external_id', externalId)
    ).maybeSingle();

    if (error) this.handleError(error);
    return data ? ActivityMapper.toDomain(data) : null;
  }

  /**
   * Create or update by `externalId` so re-sending the same sent email never
   * duplicates the activity. On update only the sent fields change.
   */
  async upsertByExternalId(
    activity: CreateActivityDTO & { externalId: string }
  ): Promise<UpsertActivityResult> {
    const existing = await this.getByExternalId(activity.externalId);
    if (existing) {
      const updated = await this.update(this.toUpdateDTO(existing.id, activity));
      return { activity: updated, created: false };
    }

    try {
      const created = await this.create(activity);
      return { activity: created, created: true };
    } catch (error) {
      // Concurrent first write of the same external id: adopt the winner.
      if (error instanceof ConflictError) {
        const winner = await this.getByExternalId(activity.externalId);
        if (winner) {
          const updated = await this.update(this.toUpdateDTO(winner.id, activity));
          return { activity: updated, created: false };
        }
      }
      throw error;
    }
  }

  /** The fields an upsert is allowed to change on an existing activity. */
  private toUpdateDTO(id: string, activity: CreateActivityDTO): UpdateActivityDTO {
    const status = activity.status ?? (activity.completed ? ActivityStatus.COMPLETED : ActivityStatus.PENDING);

    return {
      id,
      title: activity.title,
      description: activity.description,
      type: activity.type,
      dueDate: activity.dueDate,
      status,
      completedAt: status === ActivityStatus.COMPLETED
        ? activity.completedAt ?? new Date()
        : activity.completedAt,
    };
  }

  /**
   * On machine paths the client is service-role, so a foreign `leadId` would
   * otherwise let a key attach an activity to another user's lead.
   */
  private async assertEntityOwnership(leadId?: string | null, ideaId?: string | null): Promise<void> {
    if (!this.scopedUserId) return;

    const query = leadId
      ? this.supabase.from('leads').select('id')
      : ideaId
        ? this.supabase.from('ideas').select('id')
        : null;
    const entityId = leadId ?? ideaId;
    const entityType = leadId ? 'lead' : 'idea';
    if (!query || !entityId) return;

    const { data, error } = await query
      .eq('id', entityId)
      .eq('user_id', this.scopedUserId)
      .maybeSingle();

    if (error) this.handleError(error);
    if (!data) throw new NotFoundError(`${entityType} not found`);
  }

  async update(activity: UpdateActivityDTO): Promise<Activity> {
    const { id, ...updates } = activity;
    // toPersistence dual-writes `completed` from `status` when present
    // (BR-4); `completed` is no longer accepted on UpdateActivityDTO.
    const persistence = ActivityMapper.toPersistence(updates);

    const { data, error } = await this.supabase
      .from('activities')
      .update(persistence as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return ActivityMapper.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) this.handleError(error);
  }

  /** Free status transition with the dual-write invariant (design SQL). */
  async moveStatus(id: string, status: ActivityStatus): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .update({
        status,
        completed: status === ActivityStatus.COMPLETED,
        completed_at: status === ActivityStatus.COMPLETED
          ? new Date().toISOString()
          : null,
      } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return ActivityMapper.toDomain(data);
  }

  /** Sets `read_at=now()` only — status/completed untouched (BR-3).
   *  Guarded to INSTAGRAM_MESSAGE rows via a DB-level type filter: a non-IG
   *  row matches 0 rows and .single() surfaces PGRST116 → NotFoundError
   *  (404). Ownership is RLS-based (matches the Ideas module convention). */
  async markRead(id: string): Promise<Activity> {
    await this.syncConversationRead(id, true);
    const { data, error } = await this.supabase
      .from('activities')
      .update({ read_at: new Date().toISOString() } as never)
      .eq('id', id)
      .eq('type', ActivityType.INSTAGRAM_MESSAGE)
      .select()
      .single();

    if (error) this.handleError(error);
    return ActivityMapper.toDomain(data);
  }

  /** Clears `read_at` only — status/completed untouched (BR-3). Guarded to
   *  INSTAGRAM_MESSAGE rows (same DB-level filter as markRead). */
  async markUnread(id: string): Promise<Activity> {
    await this.syncConversationRead(id, false);
    const { data, error } = await this.supabase
      .from('activities')
      .update({ read_at: null } as never)
      .eq('id', id)
      .eq('type', ActivityType.INSTAGRAM_MESSAGE)
      .select()
      .single();

    if (error) this.handleError(error);
    return ActivityMapper.toDomain(data);
  }

  /**
   * Keeps the messaging badge in sync (S12): adjusts the linked conversation's
   * `unread_count` only when this activity's `read_at` is about to change.
   * Must run before the `read_at` write, because it compares against the
   * current value. A no-op for activities not linked to a message.
   */
  private async syncConversationRead(id: string, read: boolean): Promise<void> {
    const { error } = await (this.supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ error: { message: string; code?: string } | null }>;
    }).rpc('messaging_sync_legacy_read', { p_activity_id: id, p_read: read });

    if (error) this.handleError(error);
  }

  /** INSTAGRAM_MESSAGE rows with `read_at IS NULL` — the unread marker (BR-3). */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', ActivityType.INSTAGRAM_MESSAGE)
      .is('read_at', null);

    if (error) this.handleError(error);
    return count || 0;
  }

  /** Legacy verb — re-pointed to the status surface so every writer goes
   *  through the dual-write invariant (BR-4). */
  async complete(id: string): Promise<Activity> {
    return this.moveStatus(id, ActivityStatus.COMPLETED);
  }
}
