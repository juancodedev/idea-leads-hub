import { SupabaseClient } from "@supabase/supabase-js";
import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../../domain/entities/Activity";
import { ActivityRepository, ActivitySearchParams } from "../../domain/repositories/ActivityRepository";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { ActivityMapper } from "../mappers/ActivityMapper";
import { BaseRepository } from "../../../../infrastructure/repositories/BaseRepository";
import { Database } from "../../../../infrastructure/database/database.types";

export class SupabaseActivityRepository extends BaseRepository implements ActivityRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'activities');
  }

  async getById(id: string): Promise<Activity | null> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) this.handleError(error);
    return data ? ActivityMapper.toDomain(data) : null;
  }

  async getForLead(leadId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) this.handleError(error);
    return data.map(ActivityMapper.toDomain);
  }

  async getForIdea(ideaId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('idea_id', ideaId)
      .order('created_at', { ascending: false });

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

    // Status filter: statusIn (new) wins; completed stays as a rollout alias
    // until the page layer (P6) migrates. Defaults preserve the pending list
    // and treat rows with status IS NULL as PENDING (rows written before the
    // backfill read as PENDING — matches the mapper fallback and getPending).
    if (params.statusIn && params.statusIn.length > 0) {
      query = query.in('status', params.statusIn);
    } else if (params.completed !== undefined) {
      query = query.eq('completed', params.completed);
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
    const userId = await this.requireUser();

    // Rollout normalization (BR-4): legacy `completed:true` writers map to
    // status=COMPLETED; the mapper then dual-writes `completed` from status.
    const status = activity.status ?? (activity.completed ? ActivityStatus.COMPLETED : ActivityStatus.PENDING);

    const persistence = ActivityMapper.toPersistence({
      ...activity,
      status,
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
