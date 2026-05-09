import { Note, CreateNoteDTO, UpdateNoteDTO } from "../domain/Note";

export interface NoteRepository {
  getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Note[]>;
  create(note: CreateNoteDTO): Promise<Note>;
  update(note: UpdateNoteDTO): Promise<Note>;
  delete(id: string): Promise<void>;
}
