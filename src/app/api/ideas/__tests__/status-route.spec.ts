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
const mockMoveStatus = jest.fn();

jest.mock("@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository", () => ({
  SupabaseIdeaRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: mockGetById,
    update: jest.fn(),
    delete: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    moveStatus: mockMoveStatus,
  })),
}));

import { NextRequest } from "next/server";
import { PATCH } from "../[id]/status/route";
import { IdeaStatus, IdeaPriority } from "@/modules/ideas/domain/enums/IdeaEnums";

const mockIdea = {
  id: "idea-1",
  title: "Test idea",
  priority: IdeaPriority.HIGH,
  status: IdeaStatus.BACKLOG,
  createdBy: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("PATCH /api/ideas/[id]/status", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockMoveStatus.mockClear();
  });

  it("should change idea status and return 200", async () => {
    mockGetById.mockResolvedValue(mockIdea);
    mockMoveStatus.mockResolvedValue({ ...mockIdea, status: IdeaStatus.IN_PROGRESS });

    const request = new NextRequest("http://localhost:3000/api/ideas/idea-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    const response = await PATCH(request, { params: { id: "idea-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("IN_PROGRESS");
    expect(mockMoveStatus).toHaveBeenCalledWith("idea-1", IdeaStatus.IN_PROGRESS);
  });

  it("should return 400 when status is invalid", async () => {
    const request = new NextRequest("http://localhost:3000/api/ideas/idea-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "INVALID_STATUS" }),
    });
    const response = await PATCH(request, { params: { id: "idea-1" } });

    expect(response.status).toBe(400);
  });

  it("should return 404 when idea not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/ideas/idea-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    const response = await PATCH(request, { params: { id: "idea-1" } });

    expect(response.status).toBe(404);
  });
});
