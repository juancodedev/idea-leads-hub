import { Lead } from "@/core/domain/Lead";
import { LeadRepository } from "../../ports/LeadRepository";

export class MoveLeadToStage {
  constructor(private readonly leadRepository: LeadRepository) { }

  async execute(leadId: string, stageId: string): Promise<Lead> {
    return this.leadRepository.update({ id: leadId, stageId });
  }
}
