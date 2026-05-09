import { SupabaseClient } from '@supabase/supabase-js';
import { Tag, CreateTagDTO } from "../../core/domain/Tag";
import { TagRepository } from "../../core/ports/TagRepository";

export class SupabaseTagRepository implements TagRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAll(): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data.map(this.mapToDomain);
  }

  async create(tag: CreateTagDTO): Promise<Tag> {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuario no autenticado');

    const { data, error } = await this.supabase
      .from('tags')
      .insert([{ 
        name: tag.name,
        color: tag.color,
        user_id: userData.user.id 
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('tags')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async assignToEntity(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void> {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuario no autenticado');

    const table = entityType === 'lead' ? 'lead_tags' : 'idea_tags';
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { error } = await this.supabase
      .from(table)
      .insert([{
        tag_id: tagId,
        [column]: entityId,
        user_id: userData.user.id
      }]);

    if (error && error.code !== '23505') { // Ignore unique constraint violation
      throw new Error(error.message);
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

    if (error) throw new Error(error.message);
  }

  async getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Tag[]> {
    const table = entityType === 'lead' ? 'lead_tags' : 'idea_tags';
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { data, error } = await this.supabase
      .from(table)
      .select('tags (*)')
      .eq(column, entityId);

    if (error) throw new Error(error.message);
    return data.map((row: any) => this.mapToDomain(row.tags));
  }

  private mapToDomain(row: any): Tag {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      userId: row.user_id,
      createdAt: row.created_at,
    };
  }
}
