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

const mockSearch = jest.fn();
const mockCreate = jest.fn();
const mockGetById = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    search: mockSearch,
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

describe("GET /api/leads", () => {
  beforeEach(() => {
    mockSearch.mockClear();
    mockCreate.mockClear();
    mockGetById.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    mockUpdateStatus.mockClear();
  });

  it("should return paginated leads via search()", async () => {
    mockSearch.mockResolvedValue({
      data: [mockLead],
      total: 1,
      page: 1,
      totalPages: 1,
      limit: 25,
    });

    const request = new NextRequest(new URL("http://localhost:3000/api/leads"));
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].company).toBe("Acme Inc");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.totalPages).toBe(1);
    expect(mockSearch).toHaveBeenCalled();
  });

  it("should pass status filter to search()", async () => {
    mockSearch.mockResolvedValue({
      data: [mockLead],
      total: 1,
      page: 1,
      totalPages: 1,
      limit: 25,
    });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/leads?status=Nuevo")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ status: 'Nuevo' }));
    expect(body.data[0].status).toBe("Nuevo");
  });

  it("should pass search query q to search()", async () => {
    mockSearch.mockResolvedValue({
      data: [mockLead],
      total: 1,
      page: 1,
      totalPages: 1,
      limit: 25,
    });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/leads?q=acme")
    );
    await GET(request);

    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ query: 'acme' }));
  });

  it("should return paginated empty result when no leads match", async () => {
    mockSearch.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
      limit: 25,
    });

    const request = new NextRequest(
      new URL("http://localhost:3000/api/leads?q=nonexistent")
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });
});

describe("POST /api/leads (existing backward compat)", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockSearch.mockClear();
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
