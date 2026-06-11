import { SupabaseClient } from "@supabase/supabase-js";
import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
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

  async create(activity: CreateActivityDTO): Promise<Activity> {
    const userId = await this.requireUser();

    const persistence = ActivityMapper.toPersistence({
      ...activity,
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

  async complete(id: string): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .update({ 
        completed: true, 
        completed_at: new Date().toISOString() 
      } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return ActivityMapper.toDomain(data);
  }
}
