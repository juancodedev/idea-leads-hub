import { SupabaseClient } from '@supabase/supabase-js';
import { Note, CreateNoteDTO, UpdateNoteDTO } from "../../core/domain/Note";
import { NoteRepository } from "../../core/ports/NoteRepository";
import { Database } from "../database/database.types";
import { BaseRepository } from "./BaseRepository";

type NoteRow = Database['public']['Tables']['notes']['Row'];

export class SupabaseNoteRepository extends BaseRepository implements NoteRepository {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'notes');
  }

  async getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Note[]> {
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';
    const { data, error } = await this.supabase
      .from('notes')
      .select('*')
      .eq(column, entityId)
      .order('created_at', { ascending: false });

    if (error) this.handleError(error);
    return (data ?? []).map(this.mapToDomain);
  }

  async create(note: CreateNoteDTO): Promise<Note> {
    const userId = await this.requireUser();

    const column = note.entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { data, error } = await this.supabase
      .from('notes')
      .insert([{
        [column]: note.entityId,
        content: note.content,
        user_id: userId
      }] as never)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as NoteRow);
  }

  async update(note: UpdateNoteDTO): Promise<Note> {
    const { data, error } = await this.supabase
      .from('notes')
      .update({ content: note.content } as never)
      .eq('id', note.id)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as NoteRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) this.handleError(error);
  }

  private mapToDomain(row: NoteRow): Note {
    return {
      id: row.id,
      userId: row.user_id,
      entityId: (row.lead_id ?? row.idea_id) ?? '',
      entityType: row.lead_id ? 'lead' : 'idea',
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
