import { CreateIdea } from "./CreateIdea";
import { IdeaRepository } from "../../domain/repositories/IdeaRepository";
import { IdeaStatus, IdeaPriority } from "../../domain/enums/IdeaEnums";
import { Idea } from "../../domain/entities/Idea";

describe("CreateIdea Use Case", () => {
  let createIdea: CreateIdea;
  let mockRepository: jest.Mocked<IdeaRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      getById: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      moveStatus: jest.fn(),
    } as any;
    createIdea = new CreateIdea(mockRepository);
  });

  it("should create a new idea successfully", async () => {
    const dto = {
      title: "Nueva Idea de Negocio",
      description: "Una descripción interesante",
      priority: IdeaPriority.HIGH,
      status: IdeaStatus.BACKLOG,
      leadIds: [],
    };

    const expectedIdea: Idea = {
      id: "uuid-123",
      ...dto,
      createdBy: "user-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepository.create.mockResolvedValue(expectedIdea);

    const result = await createIdea.execute(dto);

    expect(result).toEqual(expectedIdea);
    expect(mockRepository.create).toHaveBeenCalledWith(dto);
  });

  it("should throw an error if title is empty", async () => {
    const dto = {
      title: "",
      description: "Sin título",
      priority: IdeaPriority.LOW,
      status: IdeaStatus.BACKLOG,
      leadIds: [],
    };

    await expect(createIdea.execute(dto)).rejects.toThrow("El título de la idea no puede estar vacío");
  });
});
