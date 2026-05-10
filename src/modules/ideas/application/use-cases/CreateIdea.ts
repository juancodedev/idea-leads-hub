import { Idea, CreateIdeaDTO } from "../../domain/entities/Idea";
import { IdeaRepository } from "../../domain/repositories/IdeaRepository";

export class CreateIdea {
  constructor(private readonly ideaRepository: IdeaRepository) {}

  async execute(dto: CreateIdeaDTO): Promise<Idea> {
    // Validaciones de negocio adicionales pueden ir aquí
    if (!dto.title.trim()) {
      throw new Error("El título de la idea no puede estar vacío");
    }

    return await this.ideaRepository.create(dto);
  }
}
