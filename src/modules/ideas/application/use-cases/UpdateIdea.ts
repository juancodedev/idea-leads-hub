import { Idea, UpdateIdeaDTO } from "../../domain/entities/Idea";
import { IdeaRepository } from "../../domain/repositories/IdeaRepository";

export class UpdateIdea {
  constructor(private readonly ideaRepository: IdeaRepository) {}

  async execute(dto: UpdateIdeaDTO): Promise<Idea> {
    const existing = await this.ideaRepository.getById(dto.id);
    if (!existing) {
      throw new Error("La idea no existe");
    }

    return await this.ideaRepository.update(dto);
  }
}
