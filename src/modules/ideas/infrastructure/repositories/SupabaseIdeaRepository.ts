import { SupabaseClient } from '@supabase/supabase-js';
import { Idea, CreateIdeaDTO, UpdateIdeaDTO } from "../../domain/entities/Idea";
import { IdeaRepository } from "../../domain/repositories/IdeaRepository";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";
import { IdeaMapper } from "../mappers/IdeaMapper";

export class SupabaseIdeaRepository implements IdeaRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getById(id: string): Promise<Idea | null> {
    const { data, error } = await this.supabase
      .from('ideas')
      .select('*, idea_tags(tags(*))')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? IdeaMapper.toDomain(data) : null;
  }

  async getAll(filters?: { status?: IdeaStatus; leadId?: string }): Promise<Idea[]> {
    let query = this.supabase
      .from('ideas')
      .select('*, idea_tags(tags(*))')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.leadId) {
      query = query.eq('lead_id', filters.leadId);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data.map(IdeaMapper.toDomain);
  }

  async create(idea: CreateIdeaDTO): Promise<Idea> {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Usuario no autenticado');

    const { tagIds, ...ideaData } = idea;

    const persistence = IdeaMapper.toPersistence({
      ...ideaData,
      createdBy: userData.user.id
    });

    const { data, error } = await this.supabase
      .from('ideas')
      .insert([persistence])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Assign tags if provided
    if (tagIds && tagIds.length > 0) {
      const tagAssignments = tagIds.map(tagId => ({
        idea_id: data.id,
        tag_id: tagId,
        user_id: userData.user.id
      }));

      const { error: tagError } = await this.supabase
        .from('idea_tags')
        .insert(tagAssignments);
      
      if (tagError) console.error("Error assigning tags:", tagError);
    }

    return this.getById(data.id) as Promise<Idea>;
  }

  async update(idea: UpdateIdeaDTO): Promise<Idea> {
    const { id, tagIds, ...updates } = idea;
    const persistence = IdeaMapper.toPersistence(updates);
    
    const { data: userData, error: userError } = await this.supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Usuario no autenticado');

    const { data, error } = await this.supabase
      .from('ideas')
      .update(persistence)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Sync tags if provided
    if (tagIds !== undefined) {
      // Remove old tags
      await this.supabase
        .from('idea_tags')
        .delete()
        .eq('idea_id', id);

      // Add new tags
      if (tagIds.length > 0) {
        const tagAssignments = tagIds.map(tagId => ({
          idea_id: id,
          tag_id: tagId,
          user_id: userData.user.id
        }));

        await this.supabase
          .from('idea_tags')
          .insert(tagAssignments);
      }
    }

    return this.getById(id) as Promise<Idea>;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ideas')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async archive(id: string): Promise<Idea> {
    const { data, error } = await this.supabase
      .from('ideas')
      .update({ 
        status: IdeaStatus.ARCHIVED,
        archived_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return IdeaMapper.toDomain(data);
  }

  async restore(id: string): Promise<Idea> {
    const { data, error } = await this.supabase
      .from('ideas')
      .update({ 
        status: IdeaStatus.BACKLOG,
        archived_at: null 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return IdeaMapper.toDomain(data);
  }

  async moveStatus(id: string, status: IdeaStatus): Promise<Idea> {
    const { data, error } = await this.supabase
      .from('ideas')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return IdeaMapper.toDomain(data);
  }
}
