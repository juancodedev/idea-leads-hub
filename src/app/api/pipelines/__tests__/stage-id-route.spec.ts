/**
 * @jest-environment node
 */

jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockUpdateStage = jest.fn();
const mockDeleteStage = jest.fn();

jest.mock("@/infrastructure/repositories/SupabasePipelineRepository", () => ({
  SupabasePipelineRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getStages: jest.fn(),
    createStage: jest.fn(),
    updateStage: mockUpdateStage,
    deleteStage: mockDeleteStage,
    reorderStages: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../[id]/stages/[stageId]/route";

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

describe("PATCH /api/pipelines/[id]/stages/[stageId]", () => {
  beforeEach(() => {
    mockUpdateStage.mockClear();
    mockDeleteStage.mockClear();
  });

  it("should update stage name and return 200", async () => {
    mockUpdateStage.mockResolvedValue({ ...mockStage, name: "Updated Stage" });

    const request = new NextRequest(
      "http://localhost:3000/api/pipelines/pipe-1/stages/stage-1",
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Stage" }),
      }
    );
    const response = await PATCH(request, {
      params: { id: "pipe-1", stageId: "stage-1" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Updated Stage");
    expect(mockUpdateStage).toHaveBeenCalledWith("stage-1", { name: "Updated Stage" });
  });

  it("should update stage position and color", async () => {
    mockUpdateStage.mockResolvedValue({
      ...mockStage,
      position: 3,
      color: "#EF4444",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/pipelines/pipe-1/stages/stage-1",
      {
        method: "PATCH",
        body: JSON.stringify({ position: 3, color: "#EF4444" }),
      }
    );
    const response = await PATCH(request, {
      params: { id: "pipe-1", stageId: "stage-1" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.position).toBe(3);
    expect(body.color).toBe("#EF4444");
  });
});

describe("DELETE /api/pipelines/[id]/stages/[stageId]", () => {
  beforeEach(() => {
    mockDeleteStage.mockClear();
  });

  it("should delete a stage and return 204", async () => {
    mockDeleteStage.mockResolvedValue(undefined);

    const request = new NextRequest(
      "http://localhost:3000/api/pipelines/pipe-1/stages/stage-1",
      {
        method: "DELETE",
      }
    );
    const response = await DELETE(request, {
      params: { id: "pipe-1", stageId: "stage-1" },
    });

    expect(response.status).toBe(204);
    expect(mockDeleteStage).toHaveBeenCalledWith("stage-1");
  });
});
