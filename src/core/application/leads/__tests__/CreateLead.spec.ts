import { CreateLead } from "../CreateLead";
import { LeadRepository } from "../../../ports/LeadRepository";
import { CreateLeadDTO } from "../../../domain/Lead";

describe('CreateLead Use Case', () => {
  let createLead: CreateLead;
  let mockLeadRepository: jest.Mocked<LeadRepository>;

  beforeEach(() => {
    mockLeadRepository = {
      create: jest.fn(),
      getAll: jest.fn(),
      search: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateStatus: jest.fn(),
    };
    createLead = new CreateLead(mockLeadRepository);
  });

  it('should create a lead successfully', async () => {
    const dto: CreateLeadDTO = {
      name: 'John Doe',
      company: 'Test Corp',
      email: 'john@example.com',
      source: 'Web',
    };

    mockLeadRepository.create.mockResolvedValue({
      id: '1',
      ...dto,
      name: dto.name!,
      status: 'Nuevo',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await createLead.execute(dto);

    expect(result.company).toBe('Test Corp');
    expect(mockLeadRepository.create).toHaveBeenCalledWith(dto);
  });

  it('should use company as name if name is missing', async () => {
    const dto: CreateLeadDTO = {
      company: 'Test Corp',
      email: 'john@example.com',
      source: 'Web',
    };

    const expectedDto = { ...dto, name: 'Test Corp' };

    mockLeadRepository.create.mockResolvedValue({
      id: '1',
      ...expectedDto,
      status: 'Nuevo',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await createLead.execute(dto);

    expect(mockLeadRepository.create).toHaveBeenCalledWith(expectedDto);
  });
});
