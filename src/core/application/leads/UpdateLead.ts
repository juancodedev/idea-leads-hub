import { Lead, UpdateLeadDTO } from "../../domain/Lead";
import { LeadRepository } from "../../ports/LeadRepository";

export class UpdateLead {
  constructor(private readonly leadRepository: LeadRepository) {}

  async execute(updateLeadDto: UpdateLeadDTO): Promise<Lead> {
    return this.leadRepository.update(updateLeadDto);
  }
}
