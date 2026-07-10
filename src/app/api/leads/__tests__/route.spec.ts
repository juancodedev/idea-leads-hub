/**
 * @jest-environment node
 */

// Mock withAuth at module level — won't affect POST (POST doesn't call it)
jest.mock("@/lib/api/with-auth", () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

const mockGetAll = jest.fn();
const mockCreate = jest.fn();
const mockGetById = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    getAll: mockGetAll,
    create: mockCreate,
    getById: mockGetById,
    update: mockUpdate,
    delete: mockDelete,
    updateStatus: mockUpdateStatus,
  })),
}));

// Mock createClient for the existing POST handler
jest.mock("@/infrastructure/database/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "test@example.com" } },
        error: null,
      }),
    },
  }),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const mockLead = {
  id: "lead-1",
  name: "John Doe",
  company: "Acme Inc",
  email: "john@acme.com",
  phone: "+1234567890",
  address: "Av. Corrientes 1234, CABA",
  website: "https://acme.com",
  status: "Nuevo",
  source: "Web",
  notes: "Interested",
  userId: "user-1",
  tags: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("GET /api/leads (new)", () => {
  beforeEach(() => {
    mockGetAll.mockClear();
    mockCreate.mockClear();
    mockGetById.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    mockUpdateStatus.mockClear();
  });

  it("should return all leads", async () => {
    mockGetAll.mockResolvedValue([mockLead]);

    const request = new NextRequest(new URL("http://localhost:3000/api/leads"));
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].company).toBe("Acme Inc");
  });

  it("should filter leads by status", async () => {
    mockGetAll.mockResolvedValue([mockLead]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/leads?status=Nuevo")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("Nuevo");
  });

  it("should filter leads by search query q", async () => {
    const lead2 = { ...mockLead, id: "lead-2", name: "Jane Smith", company: "Beta Corp", email: "jane@beta.com", website: "https://beta-corp.io" };
    mockGetAll.mockResolvedValue([mockLead, lead2]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/leads?q=acme")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].company).toBe("Acme Inc");
  });

  it("should return empty array when no leads match search", async () => {
    mockGetAll.mockResolvedValue([mockLead]);

    const request = new NextRequest(
      new URL("http://localhost:3000/api/leads?q=nonexistent")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe("POST /api/leads (existing backward compat)", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockGetAll.mockClear();
    mockGetById.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    mockUpdateStatus.mockClear();
  });

  it("should create a lead with Spanish fields and return 201", async () => {
    mockCreate.mockResolvedValue(mockLead);

    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({
        empresa: "Acme Inc",
        email: "john@acme.com",
        origen: "Web",
        nombre: "John Doe",
      }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.company).toBe("Acme Inc");
  });

  it("should return 400 when empresa is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({
        email: "john@acme.com",
        origen: "Web",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
