/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetAll = jest.fn();
const mockCreate = jest.fn();

jest.mock("@/infrastructure/repositories/SupabasePipelineRepository", () => ({
  SupabasePipelineRepository: jest.fn().mockImplementation(() => ({
    getAll: mockGetAll,
    create: mockCreate,
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getStages: jest.fn(),
    createStage: jest.fn(),
    updateStage: jest.fn(),
    deleteStage: jest.fn(),
    reorderStages: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const mockPipeline = {
  id: "pipe-1",
  name: "Sales Pipeline",
  description: "Main sales pipeline",
  userId: "user-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  stages: [],
};

describe("GET /api/pipelines", () => {
  beforeEach(() => {
    mockGetAll.mockClear();
    mockCreate.mockClear();
  });

  it("should return all pipelines with stages", async () => {
    mockGetAll.mockResolvedValue([mockPipeline]);

    const request = new NextRequest(new URL("http://localhost:3000/api/pipelines"));
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Sales Pipeline");
    expect(mockGetAll).toHaveBeenCalled();
  });

  it("should return empty array when no pipelines exist", async () => {
    mockGetAll.mockResolvedValue([]);

    const request = new NextRequest(new URL("http://localhost:3000/api/pipelines"));
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe("POST /api/pipelines", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it("should create a pipeline and return 201", async () => {
    mockCreate.mockResolvedValue({
      ...mockPipeline,
      id: "new-pipe",
      name: "New Pipeline",
    });

    const request = new NextRequest("http://localhost:3000/api/pipelines", {
      method: "POST",
      body: JSON.stringify({ name: "New Pipeline", description: "A new pipeline" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("New Pipeline");
    expect(mockCreate).toHaveBeenCalledWith({ name: "New Pipeline", description: "A new pipeline" });
  });

  it("should return 400 when name is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/pipelines", {
      method: "POST",
      body: JSON.stringify({ description: "Missing name" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should create a pipeline without description", async () => {
    mockCreate.mockResolvedValue({
      ...mockPipeline,
      id: "pipe-2",
      name: "Minimal Pipeline",
    });

    const request = new NextRequest("http://localhost:3000/api/pipelines", {
      method: "POST",
      body: JSON.stringify({ name: "Minimal Pipeline" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Minimal Pipeline");
    expect(mockCreate).toHaveBeenCalledWith({ name: "Minimal Pipeline" });
  });
});
