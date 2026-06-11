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

jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: mockGetById,
    update: mockUpdate,
    delete: mockDelete,
    updateStatus: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../[id]/route";

const mockLead = {
  id: "lead-1",
  name: "John Doe",
  company: "Acme Inc",
  email: "john@acme.com",
  phone: "+1234567890",
  status: "Nuevo",
  source: "Web",
  notes: "Interested",
  userId: "user-1",
  pipelineId: "pipe-1",
  stageId: "stage-1",
  tags: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("GET /api/leads/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  it("should return lead by id", async () => {
    mockGetById.mockResolvedValue(mockLead);

    const request = new NextRequest("http://localhost:3000/api/leads/lead-1");
    const response = await GET(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("lead-1");
    expect(body.name).toBe("John Doe");
    expect(mockGetById).toHaveBeenCalledWith("lead-1");
  });

  it("should return 404 when lead not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/leads/non-existent");
    const response = await GET(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/leads/[id] (English fields)", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockUpdate.mockClear();
  });

  it("should update lead with English field names and return 200", async () => {
    mockGetById.mockResolvedValue(mockLead);
    mockUpdate.mockResolvedValue({ ...mockLead, name: "Jane Smith", company: "New Corp" });

    const request = new NextRequest("http://localhost:3000/api/leads/lead-1", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Jane Smith",
        company: "New Corp",
        email: "jane@newcorp.com",
      }),
    });
    const response = await PATCH(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Jane Smith");
    expect(body.company).toBe("New Corp");
    expect(mockUpdate).toHaveBeenCalledWith({
      id: "lead-1",
      name: "Jane Smith",
      company: "New Corp",
      email: "jane@newcorp.com",
    });
  });

  it("should return 404 when lead not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/leads/non-existent", {
      method: "PATCH",
      body: JSON.stringify({ name: "Nope" }),
    });
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/leads/[id]", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockDelete.mockClear();
  });

  it("should delete a lead and return 204", async () => {
    mockGetById.mockResolvedValue(mockLead);
    mockDelete.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost:3000/api/leads/lead-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "lead-1" } });

    expect(response.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith("lead-1");
  });

  it("should return 404 when lead not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/leads/non-existent", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });
});
