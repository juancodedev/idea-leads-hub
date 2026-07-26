import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { SupabasePipelineRepository } from "@/infrastructure/repositories/SupabasePipelineRepository";
import { SupabaseTagRepository } from "@/infrastructure/repositories/SupabaseTagRepository";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { LeadsTable } from "@/modules/leads/components/LeadsTable";
import { Button } from "@/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { LeadSearchParams } from "@/core/ports/LeadRepository";

// export const runtime = "edge";
export const dynamic = "force-dynamic";

interface LeadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const leadRepo = new SupabaseLeadRepository(supabase);
  const pipelineRepo = new SupabasePipelineRepository(supabase);
  const tagRepo = new SupabaseTagRepository(supabase);

  const searchParamsInput: LeadSearchParams = {
    query: typeof params.q === 'string' ? params.q : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
    source: typeof params.source === 'string' ? params.source : undefined,
    sort: typeof params.sort === 'string' ? params.sort : undefined,
    order: typeof params.order === 'string' && (params.order === 'asc' || params.order === 'desc')
      ? params.order : undefined,
    page: typeof params.page === 'string' ? parseInt(params.page, 10) || 1 : 1,
    limit: 25,
  };

  const [{ data: leads, total, page, totalPages }, pipelines, tags] = await Promise.all([
    leadRepo.search(searchParamsInput),
    pipelineRepo.getAll().catch(() => []),
    tagRepo.getAll().catch(() => [])
  ]);

  const allStages = pipelines.flatMap(p => p.stages || []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground">
              Gestiona tus prospectos y oportunidades de negocio.
            </p>
          </div>
          <Link href="/leads/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <LeadsTable
          leads={leads}
          stages={allStages}
          allTags={tags}
          total={total}
          page={page}
          totalPages={totalPages}
          searchParams={params as Record<string, string>}
        />
      </div>
    </DashboardLayout>
  );
}
