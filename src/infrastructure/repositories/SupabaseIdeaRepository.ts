import { SupabaseClient } from '@supabase/supabase-js';
import { Idea, CreateIdeaDTO, UpdateIdeaDTO } from "../../core/domain/Idea";
import { IdeaRepository } from "../../core/ports/IdeaRepository";

export class SupabaseIdeaRepository implements IdeaRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAll(): Promise<Idea[]> {
    const { data, error } = await this.supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data.map(this.mapToDomain);
  }

  async getById(id: string): Promise<Idea | null> {
    const { data, error } = await this.supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapToDomain(data) : null;
  }

  async create(idea: CreateIdeaDTO): Promise<Idea> {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Usuario no autenticado');

    const { data, error } = await this.supabase
      .from('ideas')
      .insert([{ 
        title: idea.title,
        description: idea.description,
        status: idea.status,
        priority: idea.priority,
        potential_revenue: idea.potentialRevenue,
        user_id: userData.user.id 
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async update(idea: UpdateIdeaDTO): Promise<Idea> {
    const { id, ...updates } = idea;
    
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.priority) dbUpdates.priority = updates.priority;
    if (updates.potentialRevenue !== undefined) dbUpdates.potential_revenue = updates.potentialRevenue;
    
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('ideas')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ideas')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: any): Idea {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      potentialRevenue: row.potential_revenue,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
