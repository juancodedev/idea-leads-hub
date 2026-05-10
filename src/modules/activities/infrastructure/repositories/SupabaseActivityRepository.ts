import { SupabaseClient } from "@supabase/supabase-js";
import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { ActivityMapper } from "../mappers/ActivityMapper";

export class SupabaseActivityRepository implements ActivityRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getById(id: string): Promise<Activity | null> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? ActivityMapper.toDomain(data) : null;
  }

  async getForLead(leadId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data.map(ActivityMapper.toDomain);
  }

  async getPending(userId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('due_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data.map(ActivityMapper.toDomain);
  }

  async create(activity: CreateActivityDTO): Promise<Activity> {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Usuario no autenticado');

    const persistence = ActivityMapper.toPersistence({
      ...activity,
      userId: userData.user.id
    });
    
    // Asignar user_id explícitamente para persistencia si el mapper no lo hace
    persistence.user_id = userData.user.id;

    const { data, error } = await this.supabase
      .from('activities')
      .insert([persistence])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return ActivityMapper.toDomain(data);
  }

  async update(activity: UpdateActivityDTO): Promise<Activity> {
    const { id, ...updates } = activity;
    const persistence = ActivityMapper.toPersistence(updates);

    const { data, error } = await this.supabase
      .from('activities')
      .update(persistence)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return ActivityMapper.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async complete(id: string): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .update({ 
        completed: true, 
        completed_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return ActivityMapper.toDomain(data);
  }
}
