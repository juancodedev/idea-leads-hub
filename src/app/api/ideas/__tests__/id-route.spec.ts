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

jest.mock("@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository", () => ({
  SupabaseIdeaRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: mockGetById,
    update: mockUpdate,
    delete: mockDelete,
    archive: jest.fn(),
    restore: jest.fn(),
    moveStatus: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../[id]/route";
import { IdeaStatus, IdeaPriority } from "@/modules/ideas/domain/enums/IdeaEnums";

const mockIdea = {
  id: "idea-1",
  title: "Test idea",
  description: "A test",
  priority: IdeaPriority.HIGH,
  status: IdeaStatus.BACKLOG,
  createdBy: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("GET /api/ideas/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
  });

  it("should return idea by id", async () => {
    mockGetById.mockResolvedValue(mockIdea);

    const request = new NextRequest("http://localhost:3000/api/ideas/idea-1");
    const response = await GET(request, { params: { id: "idea-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("idea-1");
    expect(mockGetById).toHaveBeenCalledWith("idea-1");
  });

  it("should return 404 when idea not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/ideas/non-existent");
    const response = await GET(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/ideas/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockUpdate.mockClear();
  });

  it("should update an idea and return 200", async () => {
    mockGetById.mockResolvedValue(mockIdea);
    mockUpdate.mockResolvedValue({ ...mockIdea, title: "Updated idea" });

    const request = new NextRequest("http://localhost:3000/api/ideas/idea-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated idea" }),
    });
    const response = await PATCH(request, { params: { id: "idea-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe("Updated idea");
    expect(mockUpdate).toHaveBeenCalledWith({ id: "idea-1", title: "Updated idea" });
  });

  it("should return 404 when idea not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/ideas/non-existent", {
      method: "PATCH",
      body: JSON.stringify({ title: "Nope" }),
    });
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/ideas/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockDelete.mockClear();
  });

  it("should delete an idea and return 204", async () => {
    mockGetById.mockResolvedValue(mockIdea);
    mockDelete.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost:3000/api/ideas/idea-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "idea-1" } });

    expect(response.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith("idea-1");
  });

  it("should return 404 when idea not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/ideas/non-existent", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});
