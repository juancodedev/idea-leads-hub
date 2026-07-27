/**
 * @jest-environment node
 */

// Mock withAuth at module level — hoisted by Jest
jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetAll = jest.fn();
const mockCreate = jest.fn();
const mockGetById = jest.fn();

jest.mock("@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository", () => ({
  SupabaseIdeaRepository: jest.fn().mockImplementation(() => ({
    getAll: mockGetAll,
    create: mockCreate,
    getById: mockGetById,
    update: jest.fn(),
    delete: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    moveStatus: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { IdeaStatus, IdeaPriority } from "@/modules/ideas/domain/enums/IdeaEnums";

describe("GET /api/ideas", () => {
  beforeEach(() => {
    mockGetAll.mockClear();
    mockCreate.mockClear();
    mockGetById.mockClear();
  });

  it("should return all ideas when no filters provided", async () => {
    mockGetAll.mockResolvedValue([
      {
        id: "idea-1",
        title: "First idea",
        priority: IdeaPriority.HIGH,
        status: IdeaStatus.BACKLOG,
        createdBy: "user-1",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    ]);

    const request = new NextRequest(new URL("http://localhost:3000/api/ideas"));
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("First idea");
    expect(mockGetAll).toHaveBeenCalledWith({});
  });

  it("should filter by status query param", async () => {
    mockGetAll.mockResolvedValue([]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/ideas?status=RESEARCHING")
    );
    await GET(request);

    expect(mockGetAll).toHaveBeenCalledWith({ status: IdeaStatus.RESEARCHING });
  });

  it("should filter by leadIds query param", async () => {
    mockGetAll.mockResolvedValue([]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/ideas?leadIds=lead-1")
    );
    await GET(request);

    expect(mockGetAll).toHaveBeenCalledWith({ leadIds: ["lead-1"] });
  });
});

describe("POST /api/ideas", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it("should create an idea and return 201", async () => {
    mockCreate.mockResolvedValue({
      id: "new-idea",
      title: "New business idea",
      description: "A great idea",
      priority: IdeaPriority.MEDIUM,
      status: IdeaStatus.BACKLOG,
      createdBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest("http://localhost:3000/api/ideas", {
      method: "POST",
      body: JSON.stringify({
        title: "New business idea",
        description: "A great idea",
        priority: "MEDIUM",
        status: "BACKLOG",
      }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.title).toBe("New business idea");
  });

  it("should return 400 when title is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/ideas", {
      method: "POST",
      body: JSON.stringify({
        priority: "MEDIUM",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
