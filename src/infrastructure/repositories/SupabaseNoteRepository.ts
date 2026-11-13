import { SupabaseClient } from '@supabase/supabase-js';
import { Note, CreateNoteDTO, UpdateNoteDTO } from "../../core/domain/Note";
import { NoteRepository } from "../../core/ports/NoteRepository";
import { Database } from "../database/database.types";
import { BaseRepository } from "./BaseRepository";
import { ConflictError, NotFoundError } from "./errors";

type NoteRow = Database['public']['Tables']['notes']['Row'];

export interface UpsertNoteResult {
  note: Note;
  /** true when the note was created by this call, false when it was updated. */
  created: boolean;
}

export class SupabaseNoteRepository extends BaseRepository implements NoteRepository {
  /**
   * @param scopedUserId Set on machine (API key) paths, where the client is
   * service-role and RLS does not scope queries. Every query is filtered by it.
   */
  constructor(supabase: SupabaseClient<Database>, scopedUserId?: string) {
    super(supabase, 'notes', scopedUserId);
  }

  async getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Note[]> {
    const column = entityType === 'lead' ? 'lead_id' : 'idea_id';
    const { data, error } = await this.scopeToUser(
      this.supabase
        .from('notes')
        .select('*')
        .eq(column, entityId)
    ).order('created_at', { ascending: false });

    if (error) this.handleError(error);
    return (data ?? []).map(this.mapToDomain);
  }

  async getByExternalId(externalId: string): Promise<Note | null> {
    const { data, error } = await this.scopeToUser(
      this.supabase
        .from('notes')
        .select('*')
        .eq('external_id', externalId)
    ).maybeSingle();

    if (error) this.handleError(error);
    return data ? this.mapToDomain(data as unknown as NoteRow) : null;
  }

  async create(note: CreateNoteDTO): Promise<Note> {
    const userId = await this.resolveUserId();
    await this.assertEntityOwnership(note.entityId, note.entityType);

    const column = note.entityType === 'lead' ? 'lead_id' : 'idea_id';

    const { data, error } = await this.supabase
      .from('notes')
      .insert([{
        [column]: note.entityId,
        content: note.content,
        external_id: note.externalId ?? null,
        user_id: userId
      }] as never)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as NoteRow);
  }

  /**
   * Create or update by `externalId` so re-sending the same research note never
   * duplicates it. Returns whether the row was created.
   */
  async upsertByExternalId(note: CreateNoteDTO & { externalId: string }): Promise<UpsertNoteResult> {
    const existing = await this.getByExternalId(note.externalId);
    if (existing) {
      const updated = await this.update({ id: existing.id, content: note.content });
      return { note: updated, created: false };
    }

    try {
      const created = await this.create(note);
      return { note: created, created: true };
    } catch (error) {
      // Concurrent first write of the same external id: adopt the winner.
      if (error instanceof ConflictError) {
        const winner = await this.getByExternalId(note.externalId);
        if (winner) {
          const updated = await this.update({ id: winner.id, content: note.content });
          return { note: updated, created: false };
        }
      }
      throw error;
    }
  }

  async update(note: UpdateNoteDTO): Promise<Note> {
    const { data, error } = await this.scopeToUser(
      this.supabase
        .from('notes')
        .update({ content: note.content } as never)
    )
      .eq('id', note.id)
      .select()
      .single();

    if (error) this.handleError(error);
    return this.mapToDomain(data as unknown as NoteRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.scopeToUser(
      this.supabase
        .from('notes')
        .delete()
    ).eq('id', id);

    if (error) this.handleError(error);
  }

  /**
   * On machine paths the client is service-role, so a foreign `entityId` would
   * otherwise let a key write a note onto another user's lead.
   */
  private async assertEntityOwnership(entityId: string, entityType: 'lead' | 'idea'): Promise<void> {
    if (!this.scopedUserId) return;

    const query = entityType === 'lead'
      ? this.supabase.from('leads').select('id')
      : this.supabase.from('ideas').select('id');
    const { data, error } = await query
      .eq('id', entityId)
      .eq('user_id', this.scopedUserId)
      .maybeSingle();

    if (error) this.handleError(error);
    if (!data) throw new NotFoundError(`${entityType} not found`);
  }

  private mapToDomain(row: NoteRow): Note {
    return {
      id: row.id,
      userId: row.user_id,
      entityId: (row.lead_id ?? row.idea_id) ?? '',
      entityType: row.lead_id ? 'lead' : 'idea',
      content: row.content,
      externalId: row.external_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
