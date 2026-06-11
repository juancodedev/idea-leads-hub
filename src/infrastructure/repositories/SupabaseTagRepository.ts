import { SupabaseClient } from '@supabase/supabase-js';
import { Tag, CreateTagDTO } from "../../core/domain/Tag";
import { TagRepository } from "../../core/ports/TagRepository";
import { Database } from "../database/database.types";
import { BaseRepository } from "./BaseRepository";

type TagRow = Database['public']['Tables']['tags']['Row'];

export class SupabaseTagRepository extends BaseRepository implements TagRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'tags');
  }

  async getAll(): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) this.handleError(error);
    return (data ?? []).map(this.mapToDomain);
  }

  async create(tag: CreateTagDTO): Promise<Tag> {
    const userId = await this.requireUser();

    const { data, error } = await this.supabase
      .from('tags')
      .insert([{
        name: tag.name,
        color: tag.color,
        user_id: userId
      }] as never)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as TagRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('tags')
      .delete()
      .eq('id', id);

    if (error) this.handleError(error);
  }

  async assignToEntity(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void> {
    const userId = await this.requireUser();

    const table = entityType === 'lead' ? 'lead_tags' : 'idea_tags';
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { error } = await this.supabase
      .from(table)
      .insert([{
        tag_id: tagId,
        [column]: entityId,
        user_id: userId
      }] as never);

    if (error && error.code !== '23505') { // Ignore unique constraint violation
      this.handleError(error);
    }
  }

  async removeFromEntity(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void> {
    const table = entityType === 'lead' ? 'lead_tags' : 'idea_tags';
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { error } = await this.supabase
      .from(table)
      .delete()
      .eq('tag_id', tagId)
      .eq(column, entityId);

    if (error) this.handleError(error);
  }

  async getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Tag[]> {
    const table = entityType === 'lead' ? 'lead_tags' : 'idea_tags';
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { data, error } = await this.supabase
      .from(table)
      .select('tags (*)')
      .eq(column, entityId);

    if (error) this.handleError(error);
    const rows = (data ?? []) as unknown as Array<{ tags: TagRow }>;
    return rows.map(row => this.mapToDomain(row.tags));
  }

  private mapToDomain(row: TagRow): Tag {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      userId: row.user_id,
      createdAt: row.created_at,
    };
  }
}
