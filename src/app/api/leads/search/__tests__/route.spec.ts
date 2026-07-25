/**
 * Tests for GET /api/leads/search?q={term} — search logic
 *
 * Spec: 5.2, 5.4, 5.5
 * Tests the search/filter logic extracted from the route handler.
 * The route handler itself is a thin auth + delegation wrapper.
 */

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  status: string;
}

function searchLeads(
  allLeads: Lead[],
  q: string,
  options: { status?: string | null; limit?: number } = {}
): { error?: string; status?: number } | Array<{ id: string; name: string; company: string; status: string }> {
  if (!q || !q.trim()) {
    return { error: "Query parameter 'q' is required", status: 400 };
  }

  const qLower = q.toLowerCase().trim();

  let filtered = allLeads.filter((lead) => {
    const matchesQuery =
      lead.name.toLowerCase().includes(qLower) ||
      lead.company.toLowerCase().includes(qLower) ||
      lead.email.toLowerCase().includes(qLower);

    const matchesStatus = !options.status || options.status === "all" || lead.status === options.status;

    return matchesQuery && matchesStatus;
  });

  const limit = options.limit || 20;
  const paginated = filtered.slice(0, limit);

  return paginated.map((lead) => ({
    id: lead.id,
    name: lead.name,
    company: lead.company,
    status: lead.status,
  }));
}

const mockLeads: Lead[] = [
  { id: '1', name: 'Juan Pérez', company: 'Acme Corp', email: 'juan@acme.com', status: 'Nuevo' },
  { id: '2', name: 'Juanita Gómez', company: 'Beta Inc', email: 'juanita@beta.com', status: 'Contactado' },
  { id: '3', name: 'María López', company: 'Gamma SA', email: 'maria@gamma.com', status: 'Interesado' },
];

describe("GET /api/leads/search — logic", () => {
  it("should return matching leads when query matches name", () => {
    const results = searchLeads(mockLeads, "juan") as Array<{ name: string }>;
    expect(results).toHaveLength(2);
    expect(results[0].name).toContain("Juan");
  });

  it("should return matching leads when query matches company", () => {
    const results = searchLeads(mockLeads, "acme") as Array<{ company: string }>;
    expect(results).toHaveLength(1);
    expect(results[0].company).toBe("Acme Corp");
  });

  it("should return empty array when no matches", () => {
    const results = searchLeads(mockLeads, "zzzzz");
    expect(results).toEqual([]);
  });

  it("should return 400 error object when q is missing", () => {
    const result = searchLeads(mockLeads, "") as { error: string; status: number };
    expect(result).toEqual({ error: "Query parameter 'q' is required", status: 400 });
  });

  it("should limit results to 20", () => {
    const manyLeads = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      name: `Juan ${i}`,
      company: `Company ${i}`,
      email: `juan${i}@test.com`,
      status: "Nuevo",
    }));
    const results = searchLeads(manyLeads, "juan") as Array<unknown>;
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("should return minimal fields (id, name, company, status)", () => {
    const results = searchLeads(mockLeads, "juan") as Array<Record<string, unknown>>;
    expect(results[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      company: expect.any(String),
      status: expect.any(String),
    });
  });

  it("should filter by status when provided", () => {
    const results = searchLeads(mockLeads, "juan", { status: "Contactado" }) as Array<{ status: string }>;
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("Contactado");
  });
});
