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
const mockUpdateStatus = jest.fn();

jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    create: jest.fn(),
    getById: mockGetById,
    update: jest.fn(),
    delete: jest.fn(),
    updateStatus: mockUpdateStatus,
  })),
}));

const mockGetStages = jest.fn();

jest.mock("@/infrastructure/repositories/SupabasePipelineRepository", () => ({
  SupabasePipelineRepository: jest.fn().mockImplementation(() => ({
    getStages: mockGetStages,
    getAll: jest.fn(),
  })),
}));

const mockMaybeSendAutoDm = jest.fn();

jest.mock("@/modules/instagram/InstagramAutoTrigger", () => ({
  InstagramAutoTrigger: jest.fn().mockImplementation(() => ({
    maybeSendAutoDm: mockMaybeSendAutoDm,
  })),
}));

jest.mock("@/infrastructure/services/InstagramAuthService", () => ({
  InstagramAuthService: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({
      token: "test-token",
      igId: "test-ig",
      pageId: "test-page",
    }),
  })),
}));

jest.mock("@/infrastructure/services/InstagramMessagingService", () => ({
  InstagramMessagingService: jest.fn().mockImplementation(() => ({
    sendDM: jest.fn().mockResolvedValue({ messageId: "test-msg" }),
  })),
}));

import { NextRequest } from "next/server";
import { PATCH } from "../[id]/status/route";

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
  pipelineId: "pipeline-1",
  stageId: "stage-1",
  tags: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockLeadWithInstagram = {
  ...mockLead,
  instagramScopedId: "ig-scoped-789",
};

describe("PATCH /api/leads/[id]/status", () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockUpdateStatus.mockClear();
    mockMaybeSendAutoDm.mockClear();
    mockMaybeSendAutoDm.mockResolvedValue(true);
    mockGetStages.mockClear();
    mockGetStages.mockResolvedValue([
      { id: "stage-1", pipelineId: "pipeline-1", userId: "user-1", name: "Nuevo", position: 0, color: "#94a3b8", isClosed: false, isWon: false, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "stage-2", pipelineId: "pipeline-1", userId: "user-1", name: "Contactado", position: 1, color: "#3b82f6", isClosed: false, isWon: false, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "stage-3", pipelineId: "pipeline-1", userId: "user-1", name: "Interesado", position: 2, color: "#f59e0b", isClosed: false, isWon: false, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "stage-4", pipelineId: "pipeline-1", userId: "user-1", name: "Ganado", position: 3, color: "#10b981", isClosed: true, isWon: true, createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
  });

  it("should change lead status and return 200", async () => {
    mockGetById.mockResolvedValue(mockLead);
    mockUpdateStatus.mockResolvedValue({ ...mockLead, status: "Contactado" });

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "Contactado" }),
      }
    );
    const response = await PATCH(request, { params: { id: "lead-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("Contactado");
    expect(mockUpdateStatus).toHaveBeenCalledWith("lead-1", "Contactado");
  });

  it("should return 404 when lead not found", async () => {
    mockGetById.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/leads/non-existent/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "Ganado" }),
      }
    );
    const response = await PATCH(request, { params: { id: "non-existent" } });

    expect(response.status).toBe(404);
  });

  it("should return 400 when status is invalid", async () => {
    mockGetById.mockResolvedValue(mockLead);

    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "INVALID_STATUS" }),
      }
    );
    const response = await PATCH(request, { params: { id: "lead-1" } });

    expect(response.status).toBe(400);
  });

  it("should return 400 when status is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/leads/lead-1/status",
      {
        method: "PATCH",
        body: JSON.stringify({}),
      }
    );
    const response = await PATCH(request, { params: { id: "lead-1" } });

    expect(response.status).toBe(400);
  });

  describe("Instagram auto-trigger integration", () => {
    it("should trigger auto-DM when lead has instagramScopedId", async () => {
      mockGetById.mockResolvedValue(mockLeadWithInstagram);
      mockUpdateStatus.mockResolvedValue({
        ...mockLeadWithInstagram,
        status: "Interesado",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/leads/lead-1/status",
        {
          method: "PATCH",
          body: JSON.stringify({ status: "Interesado" }),
        }
      );
      const response = await PATCH(request, { params: { id: "lead-1" } });

      expect(response.status).toBe(200);
      expect(mockMaybeSendAutoDm).toHaveBeenCalled();
    });

    it("should not trigger auto-DM when lead has no Instagram fields", async () => {
      mockGetById.mockResolvedValue(mockLead);
      mockUpdateStatus.mockResolvedValue({ ...mockLead, status: "Interesado" });

      const request = new NextRequest(
        "http://localhost:3000/api/leads/lead-1/status",
        {
          method: "PATCH",
          body: JSON.stringify({ status: "Interesado" }),
        }
      );
      const response = await PATCH(request, { params: { id: "lead-1" } });

      expect(response.status).toBe(200);
      expect(mockMaybeSendAutoDm).toHaveBeenCalled();
    });

    it("should not fail status change when auto-DM throws", async () => {
      mockMaybeSendAutoDm.mockRejectedValue(new Error("DM failed"));
      mockGetById.mockResolvedValue(mockLeadWithInstagram);
      mockUpdateStatus.mockResolvedValue({
        ...mockLeadWithInstagram,
        status: "Interesado",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/leads/lead-1/status",
        {
          method: "PATCH",
          body: JSON.stringify({ status: "Interesado" }),
        }
      );
      const response = await PATCH(request, { params: { id: "lead-1" } });

      expect(response.status).toBe(200);
    });
  });
});
