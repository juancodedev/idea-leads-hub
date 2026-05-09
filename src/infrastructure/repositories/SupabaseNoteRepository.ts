import { SupabaseClient } from '@supabase/supabase-js';
import { Note, CreateNoteDTO, UpdateNoteDTO } from "../../core/domain/Note";
import { NoteRepository } from "../../core/ports/NoteRepository";

export class SupabaseNoteRepository implements NoteRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Note[]> {
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';
    const { data, error } = await this.supabase
      .from('notes')
      .select('*')
      .eq(column, entityId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data.map(this.mapToDomain);
  }

  async create(note: CreateNoteDTO): Promise<Note> {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuario no autenticado');

    const column = note.entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { data, error } = await this.supabase
      .from('notes')
      .insert([{
        [column]: note.entityId,
        content: note.content,
        user_id: userData.user.id
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async update(note: UpdateNoteDTO): Promise<Note> {
    const { data, error } = await this.supabase
      .from('notes')
      .update({ content: note.content })
      .eq('id', note.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: any): Note {
    return {
      id: row.id,
      userId: row.user_id,
      entityId: row.lead_id || row.idea_id,
      entityType: row.lead_id ? 'lead' : 'idea',
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
