import { Idea, CreateIdeaDTO, UpdateIdeaDTO } from "../domain/Idea";

export interface IdeaRepository {
  getAll(): Promise<Idea[]>;
  getById(id: string): Promise<Idea | null>;
  create(idea: CreateIdeaDTO): Promise<Idea>;
  update(idea: UpdateIdeaDTO): Promise<Idea>;
  delete(id: string): Promise<void>;
}
