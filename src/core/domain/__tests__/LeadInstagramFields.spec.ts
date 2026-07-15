/**
 * @jest-environment node
 *
 * Tests for Instagram fields on the Lead domain entity, Zod schemas,
 * and SupabaseLeadRepository mapping.
 */

import { Lead, CreateLeadDTO } from "../Lead";
import { LeadSchema, ApiCreateLeadSchema } from "../LeadSchema";

describe("Lead domain - Instagram fields", () => {
  describe("Lead interface", () => {
    it("should accept instagramHandle and instagramScopedId as optional strings", () => {
      const lead: Lead = {
        id: "lead-1",
        name: "John Doe",
        company: "Acme Inc",
        email: "john@acme.com",
        status: "Nuevo",
        userId: "user-1",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        instagramHandle: "@john_doe",
        instagramScopedId: "IGS-12345",
      };

      expect(lead.instagramHandle).toBe("@john_doe");
      expect(lead.instagramScopedId).toBe("IGS-12345");
    });

    it("should allow leads without instagramHandle or instagramScopedId", () => {
      const lead: Lead = {
        id: "lead-1",
        name: "John Doe",
        company: "Acme Inc",
        email: "john@acme.com",
        status: "Nuevo",
        userId: "user-1",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      expect(lead.instagramHandle).toBeUndefined();
      expect(lead.instagramScopedId).toBeUndefined();
    });
  });

  describe("CreateLeadDTO", () => {
    it("should accept instagramHandle and instagramScopedId as optional fields", () => {
      const dto: CreateLeadDTO = {
        company: "Acme Inc",
        email: "john@acme.com",
        instagramHandle: "@john_doe",
        instagramScopedId: "IGS-12345",
      };

      expect(dto.instagramHandle).toBe("@john_doe");
      expect(dto.instagramScopedId).toBe("IGS-12345");
    });

    it("should allow DTOs without instagram fields", () => {
      const dto: CreateLeadDTO = {
        company: "Acme Inc",
        email: "john@acme.com",
      };

      expect(dto.instagramHandle).toBeUndefined();
      expect(dto.instagramScopedId).toBeUndefined();
    });
  });
});

describe("LeadSchema (form validation) - Instagram fields", () => {
  it("should accept valid instagramHandle as optional string", () => {
    const result = LeadSchema.safeParse({
      name: "John Doe",
      company: "Acme Inc",
      email: "john@acme.com",
      status: "Nuevo",
      instagramHandle: "@john_doe",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instagramHandle).toBe("@john_doe");
    }
  });

  it("should accept valid instagramScopedId as optional string", () => {
    const result = LeadSchema.safeParse({
      name: "John Doe",
      company: "Acme Inc",
      email: "john@acme.com",
      status: "Nuevo",
      instagramScopedId: "IGS-12345",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instagramScopedId).toBe("IGS-12345");
    }
  });

  it("should succeed when instagramHandle is omitted", () => {
    const result = LeadSchema.safeParse({
      name: "John Doe",
      company: "Acme Inc",
      email: "john@acme.com",
      status: "Nuevo",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instagramHandle).toBeUndefined();
    }
  });

  it("should reject non-string instagramHandle", () => {
    const result = LeadSchema.safeParse({
      name: "John Doe",
      company: "Acme Inc",
      email: "john@acme.com",
      status: "Nuevo",
      instagramHandle: 123,
    });

    expect(result.success).toBe(false);
  });
});

describe("ApiCreateLeadSchema - Instagram fields", () => {
  it("should accept instagramHandle in API payload", () => {
    const result = ApiCreateLeadSchema.safeParse({
      company: "Acme Inc",
      email: "john@acme.com",
      source: "Web",
      instagramHandle: "@john_doe",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instagramHandle).toBe("@john_doe");
    }
  });

  it("should accept instagramScopedId in API payload", () => {
    const result = ApiCreateLeadSchema.safeParse({
      company: "Acme Inc",
      email: "john@acme.com",
      source: "Web",
      instagramScopedId: "IGS-12345",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instagramScopedId).toBe("IGS-12345");
    }
  });

  it("should succeed when instagram fields are omitted from API payload", () => {
    const result = ApiCreateLeadSchema.safeParse({
      company: "Acme Inc",
      email: "john@acme.com",
      source: "Web",
    });

    expect(result.success).toBe(true);
  });
});

describe("SupabaseLeadRepository - Instagram column mapping", () => {
  let mockSupabase: any;
  let repository: any;
  let queryChain: any;

  const mockLeadRow = {
    id: "lead-1",
    user_id: "user-1",
    name: "John Doe",
    company: "Acme Inc",
    email: "john@acme.com",
    phone: null,
    address: null,
    website: null,
    status: "Nuevo",
    source: "Web",
    notes: null,
    pipeline_id: null,
    stage_id: null,
    instagram_handle: "@john_doe",
    instagram_scoped_id: "IGS-12345",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    queryChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    mockSupabase = {
      from: jest.fn(() => queryChain),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
  });

  it("should map instagram_handle to instagramHandle in mapToDomain", async () => {
    const { SupabaseLeadRepository: Repo } = await import(
      "@/infrastructure/repositories/SupabaseLeadRepository"
    );
    repository = new Repo(mockSupabase);

    queryChain.maybeSingle.mockResolvedValue({
      data: mockLeadRow,
      error: null,
    });

    const lead = await repository.getById("lead-1");
    expect(lead?.instagramHandle).toBe("@john_doe");
    expect(lead?.instagramScopedId).toBe("IGS-12345");
  });

  it("should pass instagram_handle as null when instagramHandle is not provided in create", async () => {
    const { SupabaseLeadRepository: Repo } = await import(
      "@/infrastructure/repositories/SupabaseLeadRepository"
    );
    repository = new Repo(mockSupabase);

    queryChain.single.mockResolvedValue({
      data: { ...mockLeadRow, instagram_handle: null, instagram_scoped_id: null },
      error: null,
    });

    await repository.create({
      company: "Acme Inc",
      email: "john@acme.com",
    });

    const insertArg = queryChain.insert.mock.calls[0][0][0];
    expect(insertArg.instagram_handle).toBeNull();
    expect(insertArg.instagram_scoped_id).toBeNull();
  });
});
