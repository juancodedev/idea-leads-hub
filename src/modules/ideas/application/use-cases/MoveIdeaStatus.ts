import { Idea } from "../../domain/entities/Idea";
import { IdeaRepository } from "../../domain/repositories/IdeaRepository";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";

export class MoveIdeaStatus {
  constructor(private readonly ideaRepository: IdeaRepository) {}

  async execute(id: string, status: IdeaStatus): Promise<Idea> {
    const existing = await this.ideaRepository.getById(id);
    if (!existing) {
      throw new Error("La idea no existe");
    }

    return await this.ideaRepository.moveStatus(id, status);
  }
}
