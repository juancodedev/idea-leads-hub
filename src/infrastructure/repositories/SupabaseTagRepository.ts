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

    const { error } = await this.supabase
      .from('entity_tags')
      .insert([{
        tag_id: tagId,
        entity_id: entityId,
        entity_type: entityType,
        user_id: userData.user.id
      }]);

    if (error && error.code !== '23505') { // Ignore unique constraint violation
      throw new Error(error.message);
    }
  }

  async removeFromEntity(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void> {
    const { error } = await this.supabase
      .from('entity_tags')
      .delete()
      .eq('tag_id', tagId)
      .eq('entity_id', entityId)
      .eq('entity_type', entityType);

    if (error) throw new Error(error.message);
  }

  async getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from('entity_tags')
      .select('tags (*)')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType);

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
