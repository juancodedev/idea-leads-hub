import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { PipelineBoard } from "@/modules/leads/components/PipelineBoard";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = createClient();
  const leadRepo = new SupabaseLeadRepository(supabase);
  
  const leads = await leadRepo.getAll();

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full flex flex-col">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">
            Visualiza y gestiona el estado de tus oportunidades.
          </p>
        </div>

        <div className="flex-1 overflow-hidden">
          <PipelineBoard initialLeads={leads} />
        </div>
      </div>
    </DashboardLayout>
  );
}
