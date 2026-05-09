import { SupabaseClient } from '@supabase/supabase-js';
import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../../core/domain/Activity";
import { ActivityRepository } from "../../core/ports/ActivityRepository";

export class SupabaseActivityRepository implements ActivityRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAllByLeadId(leadId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('due_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data.map(this.mapToDomain);
  }

  async getAllPending(): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('completed', false)
      .order('due_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data.map(this.mapToDomain);
  }

  async create(activity: CreateActivityDTO): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .insert([{
        lead_id: activity.leadId,
        type: activity.type,
        description: activity.description,
        due_date: activity.dueDate,
        completed: activity.completed ?? false
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async update(activity: UpdateActivityDTO): Promise<Activity> {
    const { id, ...updates } = activity;
    const { data, error } = await this.supabase
      .from('activities')
      .update({
        type: updates.type,
        description: updates.description,
        due_date: updates.dueDate,
        completed: updates.completed
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async toggleCompleted(id: string, completed: boolean): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .update({ completed })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: any): Activity {
    return {
      id: row.id,
      leadId: row.lead_id,
      userId: row.user_id,
      type: row.type,
      description: row.description,
      dueDate: row.due_date ? new Date(row.due_date) : null,
      completed: row.completed,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
