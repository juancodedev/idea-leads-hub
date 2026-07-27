import { SupabaseClient } from '@supabase/supabase-js';
import { Idea, CreateIdeaDTO, UpdateIdeaDTO } from "../../domain/entities/Idea";
import { IdeaRepository } from "../../domain/repositories/IdeaRepository";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";
import { IdeaMapper } from "../mappers/IdeaMapper";
import { BaseRepository } from "../../../../infrastructure/repositories/BaseRepository";
import { Database } from "../../../../infrastructure/database/database.types";

export class SupabaseIdeaRepository extends BaseRepository implements IdeaRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ideas');
  }

  async getById(id: string): Promise<Idea | null> {
    const { data, error } = await this.supabase
      .from('ideas')
      .select('*, idea_tags(tags(*)), idea_leads(lead_id)')
      .eq('id', id)
      .maybeSingle();

    if (error) this.handleError(error);
    return data ? IdeaMapper.toDomain(data) : null;
  }

  async getAll(filters?: { status?: IdeaStatus; leadIds?: string[] }): Promise<Idea[]> {
    let query = this.supabase
      .from('ideas')
      .select('*, idea_tags(tags(*)), idea_leads(lead_id)')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.leadIds && filters.leadIds.length > 0) {
      // Filter ideas that are linked to ANY of the given leadIds
      const { data: filteredIds } = await this.supabase
        .from('idea_leads')
        .select('idea_id')
        .in('lead_id', filters.leadIds) as unknown as { data: { idea_id: string }[] | null; error: any };

      if (filteredIds && filteredIds.length > 0) {
        const ideaIds = filteredIds.map(item => item.idea_id);
        query = query.in('id', ideaIds);
      } else {
        return []; // No matching ideas
      }
    }

    const { data, error } = await query;

    if (error) this.handleError(error);
    return data.map(IdeaMapper.toDomain);
  }

  async create(idea: CreateIdeaDTO): Promise<Idea> {
    const userId = await this.requireUser();

    const { tagIds, leadIds, ...ideaData } = idea;

    const persistence = IdeaMapper.toPersistence({
      ...ideaData,
      createdBy: userId
    });

    const { data, error } = await this.supabase
      .from('ideas')
      .insert([persistence] as never)
      .select()
      .single() as unknown as { data: any; error: any };

    if (error) this.handleError(error);

    // Assign tags if provided
    if (tagIds && tagIds.length > 0) {
      const tagAssignments = tagIds.map(tagId => ({
        idea_id: data.id,
        tag_id: tagId,
        user_id: userId
      }));

      const { error: tagError } = await this.supabase
        .from('idea_tags')
        .insert(tagAssignments as never);
      
      if (tagError) console.error("Error assigning tags:", tagError);
    }

    // Assign leads if provided
    if (leadIds && leadIds.length > 0) {
      const leadAssignments = leadIds.map(leadId => ({
        idea_id: data.id,
        lead_id: leadId,
        user_id: userId,
      }));

      const { error: leadError } = await this.supabase
        .from('idea_leads')
        .insert(leadAssignments as never);

      if (leadError) console.error("Error assigning leads:", leadError);
    }

    return this.getById(data.id) as Promise<Idea>;
  }

  async update(idea: UpdateIdeaDTO): Promise<Idea> {
    const { id, tagIds, leadIds, ...updates } = idea;
    const persistence = IdeaMapper.toPersistence(updates);
    
    const userId = await this.requireUser();

    const { data, error } = await this.supabase
      .from('ideas')
      .update(persistence as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);

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
          user_id: userId
        }));

        await this.supabase
          .from('idea_tags')
          .insert(tagAssignments as never);
      }
    }

    // Sync leads if provided
    if (leadIds !== undefined) {
      // Remove old lead assignments
      await this.supabase
        .from('idea_leads')
        .delete()
        .eq('idea_id', id);

      // Add new lead assignments
      if (leadIds.length > 0) {
        const leadAssignments = leadIds.map(leadId => ({
          idea_id: id,
          lead_id: leadId,
          user_id: userId,
        }));

        await this.supabase
          .from('idea_leads')
          .insert(leadAssignments as never);
      }
    }

    return this.getById(id) as Promise<Idea>;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ideas')
      .delete()
      .eq('id', id);

    if (error) this.handleError(error);
  }

  async archive(id: string): Promise<Idea> {
    const { data, error } = await this.supabase
      .from('ideas')
      .update({ 
        status: IdeaStatus.ARCHIVED,
        archived_at: new Date().toISOString() 
      } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return IdeaMapper.toDomain(data);
  }

  async restore(id: string): Promise<Idea> {
    const { data, error } = await this.supabase
      .from('ideas')
      .update({ 
        status: IdeaStatus.BACKLOG,
        archived_at: null 
      } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return IdeaMapper.toDomain(data);
  }

  async moveStatus(id: string, status: IdeaStatus): Promise<Idea> {
    const { data, error } = await this.supabase
      .from('ideas')
      .update({ status } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error);
    return IdeaMapper.toDomain(data);
  }
}
