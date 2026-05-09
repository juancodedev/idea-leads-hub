import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { SupabaseIdeaRepository } from "@/infrastructure/repositories/SupabaseIdeaRepository";
import { SupabaseActivityRepository } from "@/infrastructure/repositories/SupabaseActivityRepository";
import { SupabasePipelineRepository } from "@/infrastructure/repositories/SupabasePipelineRepository";
import { DashboardStats } from "@/modules/dashboard/components/DashboardStats";
import { PipelineAnalytics } from "@/modules/dashboard/components/PipelineAnalytics";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  
  const leadRepo = new SupabaseLeadRepository(supabase);
  const ideaRepo = new SupabaseIdeaRepository(supabase);
  const activityRepo = new SupabaseActivityRepository(supabase);
  const pipelineRepo = new SupabasePipelineRepository(supabase);

  // Fetch data in parallel
  const [leads, ideas, pendingActivities, pipelines] = await Promise.all([
    leadRepo.getAll(),
    ideaRepo.getAll(),
    activityRepo.getAllPending(),
    pipelineRepo.getAll(),
  ]);

  const activePipeline = pipelines[0];
  const stages = activePipeline?.stages || [];

  // Calcular métricas
  const wonStageIds = stages.filter(s => s.isWon).map(s => s.id);
  const closedStageIds = stages.filter(s => s.isClosed).map(s => s.id);

  const activeLeads = leads.filter(l => !l.stageId || !closedStageIds.includes(l.stageId)).length;
  const wonLeads = leads.filter(l => l.stageId && wonStageIds.includes(l.stageId)).length;
  const activeIdeas = ideas.filter(i => i.status !== 'Descartada').length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido de nuevo. Aquí tienes un resumen de tu actividad.
          </p>
        </div>

        <DashboardStats 
          activeLeads={activeLeads}
          wonLeads={wonLeads}
          pendingActivities={pendingActivities.length}
          activeIdeas={activeIdeas}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <PipelineAnalytics stages={stages} leads={leads} />
          
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Actividad Reciente</h3>
            <div className="space-y-4">
              {leads.slice(0, 5).map(lead => (
                <div key={lead.id} className="flex items-center justify-between text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{lead.name}</span>
                    <span className="text-xs text-muted-foreground">{lead.company}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {leads.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No hay actividad reciente.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
