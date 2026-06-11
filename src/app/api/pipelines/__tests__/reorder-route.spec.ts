/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockReorderStages = jest.fn();

jest.mock("@/infrastructure/repositories/SupabasePipelineRepository", () => ({
  SupabasePipelineRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getStages: jest.fn(),
    createStage: jest.fn(),
    updateStage: jest.fn(),
    deleteStage: jest.fn(),
    reorderStages: mockReorderStages,
  })),
}));

import { NextRequest } from "next/server";
import { PUT } from "../[id]/stages/reorder/route";

describe("PUT /api/pipelines/[id]/stages/reorder", () => {
  beforeEach(() => {
    mockReorderStages.mockClear();
  });

  it("should reorder stages and return 200", async () => {
    mockReorderStages.mockResolvedValue(undefined);

    const request = new NextRequest(
      "http://localhost:3000/api/pipelines/pipe-1/stages/reorder",
      {
        method: "PUT",
        body: JSON.stringify({
          stageIds: ["stage-3", "stage-1", "stage-2"],
        }),
      }
    );
    const response = await PUT(request, { params: { id: "pipe-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockReorderStages).toHaveBeenCalledWith([
      { id: "stage-3", position: 0 },
      { id: "stage-1", position: 1 },
      { id: "stage-2", position: 2 },
    ]);
  });

  it("should return 400 when stageIds is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/pipelines/pipe-1/stages/reorder",
      {
        method: "PUT",
        body: JSON.stringify({}),
      }
    );
    const response = await PUT(request, { params: { id: "pipe-1" } });

    expect(response.status).toBe(400);
  });

  it("should return 400 when stageIds is empty", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/pipelines/pipe-1/stages/reorder",
      {
        method: "PUT",
        body: JSON.stringify({ stageIds: [] }),
      }
    );
    const response = await PUT(request, { params: { id: "pipe-1" } });

    expect(response.status).toBe(400);
  });
});
