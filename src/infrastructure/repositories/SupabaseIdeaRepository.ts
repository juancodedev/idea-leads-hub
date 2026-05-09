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
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return this.mapToDomain(data);
  }

  async create(idea: CreateIdeaDTO): Promise<Idea> {
    const { data, error } = await this.supabase
      .from('ideas')
      .insert([idea])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async update(idea: UpdateIdeaDTO): Promise<Idea> {
    const { id, ...updates } = idea;
    const { data, error } = await this.supabase
      .from('ideas')
      .update(updates)
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
