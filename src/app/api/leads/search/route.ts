import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";

const VALID_STATUSES = new Set([
  "Nuevo", "Contactado", "Interesado", "Propuesta", "Negociación",
  "Cerrado Ganado", "Cerrado Perdido",
]);

const VALID_SORT_FIELDS = new Set([
  "createdAt", "name", "company", "email", "status",
]);

export async function GET(request: NextRequest) {
  const { supabase } = await withAuth(request);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const sort = searchParams.get("sort");
  const order = searchParams.get("order") || "desc";
  const pageStr = searchParams.get("page");

  if (!q) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const repo = new SupabaseLeadRepository(supabase);
  const allLeads = await repo.getAll();

  // Client-side filtering for simplicity (leads are cached)
  let filtered = allLeads.filter((lead) => {
    const qLower = q.toLowerCase();
    const matchesQuery =
      lead.name.toLowerCase().includes(qLower) ||
      lead.company.toLowerCase().includes(qLower) ||
      lead.email.toLowerCase().includes(qLower);

    const matchesStatus = !status || status === "all" || lead.status === status;
    const matchesSource = !source || source === "all" || lead.source === source;

    return matchesQuery && matchesStatus && matchesSource;
  });

  // Sorting
  const sortField = VALID_SORT_FIELDS.has(sort || "") ? sort : "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    const aVal = ((a as unknown as Record<string, unknown>)[sortField as string] as string) || "";
    const bVal = ((b as unknown as Record<string, unknown>)[sortField as string] as string) || "";
    return aVal.localeCompare(bVal) * sortOrder;
  });

  // Pagination
  const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);
  const limit = 20;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  // Return minimal fields
  const results = paginated.map((lead) => ({
    id: lead.id,
    name: lead.name,
    company: lead.company,
    status: lead.status,
  }));

  return NextResponse.json(results);
}
