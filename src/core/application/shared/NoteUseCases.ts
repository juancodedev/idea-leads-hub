import { CreateNoteDTO, Note, UpdateNoteDTO } from "../../domain/Note";
import { NoteRepository } from "../../ports/NoteRepository";

export class CreateNote {
  constructor(private readonly noteRepository: NoteRepository) {}

  async execute(note: CreateNoteDTO): Promise<Note> {
    return this.noteRepository.create(note);
  }
}

export class UpdateNote {
  constructor(private readonly noteRepository: NoteRepository) {}

  async execute(note: UpdateNoteDTO): Promise<Note> {
    return this.noteRepository.update(note);
  }
}

export class DeleteNote {
  constructor(private readonly noteRepository: NoteRepository) {}

  async execute(id: string): Promise<void> {
    return this.noteRepository.delete(id);
  }
}
