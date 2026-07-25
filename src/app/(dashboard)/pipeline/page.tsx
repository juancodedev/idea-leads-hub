import React from "react";
import Link from "next/link";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { SupabasePipelineRepository } from "@/infrastructure/repositories/SupabasePipelineRepository";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { PipelineBoard } from "@/modules/leads/components/PipelineBoard";
import { Button } from "@/ui/components/button";
import { Settings } from "lucide-react";

// export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();
  const leadRepo = new SupabaseLeadRepository(supabase);
  const pipelineRepo = new SupabasePipelineRepository(supabase);
  
  const [leads, pipelines] = await Promise.all([
    leadRepo.getAll(),
    pipelineRepo.getAll()
  ]);

  // Si no hay pipelines, mostramos un estado vacío o inicializamos (por ahora asumimos que existen o mostramos vacío)
  const activePipeline = pipelines[0];
  const stages = activePipeline?.stages || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {activePipeline ? activePipeline.name : 'Pipeline'}
            </h1>
            <p className="text-muted-foreground">
              {activePipeline ? activePipeline.description : 'Visualiza y gestiona el estado de tus oportunidades.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/pipeline/settings">
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <PipelineBoard initialLeads={leads} stages={stages} />
        </div>
      </div>
    </DashboardLayout>
  );
}
