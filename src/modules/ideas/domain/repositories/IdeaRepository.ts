import { Idea, CreateIdeaDTO, UpdateIdeaDTO } from "../entities/Idea";
import { IdeaStatus } from "../enums/IdeaEnums";

export interface IdeaRepository {
  getById(id: string): Promise<Idea | null>;
  getAll(filters?: { status?: IdeaStatus; leadId?: string }): Promise<Idea[]>;
  create(idea: CreateIdeaDTO): Promise<Idea>;
  update(idea: UpdateIdeaDTO): Promise<Idea>;
  delete(id: string): Promise<void>;
  archive(id: string): Promise<Idea>;
  restore(id: string): Promise<Idea>;
  moveStatus(id: string, status: IdeaStatus): Promise<Idea>;
}
