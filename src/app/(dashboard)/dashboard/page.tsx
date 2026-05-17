import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { SupabaseIdeaRepository } from "@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { SupabasePipelineRepository } from "@/infrastructure/repositories/SupabasePipelineRepository";
import { DashboardStats } from "@/modules/dashboard/components/DashboardStats";
import { PipelineAnalytics } from "@/modules/dashboard/components/PipelineAnalytics";
import { UpcomingActivities } from "@/modules/dashboard/components/UpcomingActivities";
import { IdeasByStatusChart } from "@/modules/dashboard/components/IdeasByStatusChart";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";

// export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const leadRepo = new SupabaseLeadRepository(supabase);
  const ideaRepo = new SupabaseIdeaRepository(supabase);
  const activityRepo = new SupabaseActivityRepository(supabase);
  const pipelineRepo = new SupabasePipelineRepository(supabase);

  // Fetch data in parallel
  const [leads, ideas, pendingActivities, pipelines] = await Promise.all([
    leadRepo.getAll(),
    ideaRepo.getAll(),
    activityRepo.getPending(user.id),
    pipelineRepo.getAll(),
  ]);

  const activePipeline = pipelines[0];
  const stages = activePipeline?.stages || [];

  // Calcular métricas
  const wonStageIds = stages.filter(s => s.isWon).map(s => s.id);
  const closedStageIds = stages.filter(s => s.isClosed).map(s => s.id);

  const activeLeads = leads.filter(l => !l.stageId || !closedStageIds.includes(l.stageId)).length;
  const wonLeads = leads.filter(l => l.stageId && wonStageIds.includes(l.stageId)).length;
  const activeIdeas = ideas.filter(i => i.status !== 'ARCHIVED').length;

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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <PipelineAnalytics stages={stages} leads={leads} />
            <IdeasByStatusChart ideas={ideas} />
          </div>
          
          <div className="space-y-6">
            <UpcomingActivities activities={pendingActivities.slice(0, 5)} />
            
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Leads Recientes</h3>
              <div className="space-y-4">
                {leads.slice(0, 5).map(lead => (
                  <div key={lead.id} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">{lead.company}</span>
                    </div>
                    <span className="text-xs text-muted-foreground italic">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {leads.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">No hay leads registrados.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
