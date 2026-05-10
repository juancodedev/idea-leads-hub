import { IdeaRepository } from "../../domain/repositories/IdeaRepository";

export class DeleteIdea {
  constructor(private readonly ideaRepository: IdeaRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.ideaRepository.getById(id);
    if (!existing) {
      throw new Error("La idea no existe");
    }

    await this.ideaRepository.delete(id);
  }
}
