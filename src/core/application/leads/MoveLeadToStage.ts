import { LeadRepository } from "../../ports/LeadRepository";

export class MoveLeadToStage {
  constructor(private readonly leadRepository: LeadRepository) {}

  async execute(leadId: string, stageId: string): Promise<void> {
    return this.leadRepository.update({ id: leadId, stageId });
  }
}
