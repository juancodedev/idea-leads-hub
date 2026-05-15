import { Lead, CreateLeadDTO } from "../../domain/Lead";
import { LeadRepository } from "../../ports/LeadRepository";

export class CreateLead {
  constructor(private readonly leadRepository: LeadRepository) {}

  async execute(dto: CreateLeadDTO): Promise<Lead> {
    // If name is not provided but company is (as per API requirements), 
    // we use company as name to satisfy DB constraints
    if (!dto.name && dto.company) {
      dto.name = dto.company;
    }
    
    return await this.leadRepository.create(dto);
  }
}
