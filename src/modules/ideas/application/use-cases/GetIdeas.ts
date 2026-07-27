import { Idea } from "../../domain/entities/Idea";
import { IdeaRepository } from "../../domain/repositories/IdeaRepository";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";

export class GetIdeas {
  constructor(private readonly ideaRepository: IdeaRepository) {}

  async execute(filters?: { status?: IdeaStatus; leadIds?: string[] }): Promise<Idea[]> {
    return await this.ideaRepository.getAll(filters);
  }
}
