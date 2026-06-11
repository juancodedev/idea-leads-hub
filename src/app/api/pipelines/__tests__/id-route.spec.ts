/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetById = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/infrastructure/repositories/SupabasePipelineRepository", () => ({
  SupabasePipelineRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: mockGetById,
    update: mockUpdate,
    delete: mockDelete,
    getStages: jest.fn(),
    createStage: jest.fn(),
    updateStage: jest.fn(),
    deleteStage: jest.fn(),
    reorderStages: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../[id]/route";

const mockPipeline = {
  id: "pipe-1",
  name: "Sales Pipeline",
  description: "Main sales pipeline",
  userId: "user-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  stages: [
    {
      id: "stage-1",
      pipelineId: "pipe-1",
      userId: "user-1",
      name: "Lead In",
      position: 0,
      color: "#3B82F6",
      isClosed: false,
      isWon: false,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ],
};

describe("GET /api/pipelines/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  it("should return pipeline by id with stages", async () => {
    mockGetById.mockResolvedValue(mockPipeline);

    const request = new NextRequest("http://localhost:3000/api/pipelines/pipe-1");
    const response = await GET(request, { params: { id: "pipe-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("pipe-1");
    expect(body.name).toBe("Sales Pipeline");
    expect(body.stages).toHaveLength(1);
    expect(mockGetById).toHaveBeenCalledWith("pipe-1");
  });

  it("should return 404 when pipeline not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/pipelines/non-existent");
    const response = await GET(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/pipelines/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockUpdate.mockClear();
  });

  it("should update pipeline name and return 200", async () => {
    mockGetById.mockResolvedValue(mockPipeline);
    mockUpdate.mockResolvedValue({ ...mockPipeline, name: "Updated Pipeline" });

    const request = new NextRequest("http://localhost:3000/api/pipelines/pipe-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Pipeline" }),
    });
    const response = await PATCH(request, { params: { id: "pipe-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Updated Pipeline");
    expect(mockUpdate).toHaveBeenCalledWith("pipe-1", { name: "Updated Pipeline" });
  });

  it("should return 404 when pipeline not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/pipelines/non-existent", {
      method: "PATCH",
      body: JSON.stringify({ name: "Nope" }),
    });
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/pipelines/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockDelete.mockClear();
  });

  it("should delete a pipeline and return 204", async () => {
    mockGetById.mockResolvedValue(mockPipeline);
    mockDelete.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost:3000/api/pipelines/pipe-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "pipe-1" } });

    expect(response.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith("pipe-1");
  });

  it("should return 404 when pipeline not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/pipelines/non-existent", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});
