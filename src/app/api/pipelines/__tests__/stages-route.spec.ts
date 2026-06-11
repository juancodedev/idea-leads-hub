/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetStages = jest.fn();
const mockCreateStage = jest.fn();

jest.mock("@/infrastructure/repositories/SupabasePipelineRepository", () => ({
  SupabasePipelineRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getStages: mockGetStages,
    createStage: mockCreateStage,
    updateStage: jest.fn(),
    deleteStage: jest.fn(),
    reorderStages: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "../[id]/stages/route";

const mockStage = {
  id: "stage-1",
  pipelineId: "pipe-1",
  userId: "user-1",
  name: "Lead In",
  position: 0,
  color: "#3B82F6",
  isClosed: false,
  isWon: false,
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("GET /api/pipelines/[id]/stages", () => {
  beforeEach(() => {
    mockGetStages.mockClear();
    mockCreateStage.mockClear();
  });

  it("should return stages for a pipeline", async () => {
    mockGetStages.mockResolvedValue([mockStage]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/pipelines/pipe-1/stages")
    );
    const response = await GET(request, { params: { id: "pipe-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Lead In");
    expect(mockGetStages).toHaveBeenCalledWith("pipe-1");
  });

  it("should return empty array when no stages exist", async () => {
    mockGetStages.mockResolvedValue([]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/pipelines/pipe-1/stages")
    );
    const response = await GET(request, { params: { id: "pipe-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe("POST /api/pipelines/[id]/stages", () => {
  beforeEach(() => {
    mockCreateStage.mockClear();
  });

  it("should create a stage and return 201", async () => {
    mockCreateStage.mockResolvedValue({
      ...mockStage,
      id: "new-stage",
      name: "Qualified",
    });

    const request = new NextRequest("http://localhost:3000/api/pipelines/pipe-1/stages", {
      method: "POST",
      body: JSON.stringify({
        name: "Qualified",
        position: 1,
        color: "#10B981",
      }),
    });
    const response = await POST(request, { params: { id: "pipe-1" } });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Qualified");
    expect(mockCreateStage).toHaveBeenCalledWith({
      pipelineId: "pipe-1",
      name: "Qualified",
      position: 1,
      color: "#10B981",
    });
  });

  it("should create a stage with isClosed and isWon flags", async () => {
    mockCreateStage.mockResolvedValue({
      ...mockStage,
      id: "stage-won",
      name: "Closed Won",
      isClosed: true,
      isWon: true,
    });

    const request = new NextRequest("http://localhost:3000/api/pipelines/pipe-1/stages", {
      method: "POST",
      body: JSON.stringify({
        name: "Closed Won",
        position: 5,
        isClosed: true,
        isWon: true,
      }),
    });
    const response = await POST(request, { params: { id: "pipe-1" } });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Closed Won");
    expect(mockCreateStage).toHaveBeenCalledWith({
      pipelineId: "pipe-1",
      name: "Closed Won",
      position: 5,
      isClosed: true,
      isWon: true,
    });
  });

  it("should return 400 when name is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/pipelines/pipe-1/stages", {
      method: "POST",
      body: JSON.stringify({ position: 1 }),
    });
    const response = await POST(request, { params: { id: "pipe-1" } });

    expect(response.status).toBe(400);
  });

  it("should return 400 when position is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/pipelines/pipe-1/stages", {
      method: "POST",
      body: JSON.stringify({ name: "Stage" }),
    });
    const response = await POST(request, { params: { id: "pipe-1" } });

    expect(response.status).toBe(400);
  });
});
