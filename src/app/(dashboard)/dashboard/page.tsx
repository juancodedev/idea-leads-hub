import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { SupabaseIdeaRepository } from "@/infrastructure/repositories/SupabaseIdeaRepository";
import { SupabaseActivityRepository } from "@/infrastructure/repositories/SupabaseActivityRepository";
import { DashboardStats } from "@/modules/dashboard/components/DashboardStats";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  
  const leadRepo = new SupabaseLeadRepository(supabase);
  const ideaRepo = new SupabaseIdeaRepository(supabase);
  const activityRepo = new SupabaseActivityRepository(supabase);

  // Fetch data in parallel
  const [leads, ideas, pendingActivities] = await Promise.all([
    leadRepo.getAll(),
    ideaRepo.getAll(),
    activityRepo.getAllPending(),
  ]);

  const activeLeads = leads.filter(l => l.status !== 'Ganado' && l.status !== 'Perdido').length;
  const wonLeads = leads.filter(l => l.status === 'Ganado').length;
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

        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent activities or leads could go here */}
        </div>
      </div>
    </DashboardLayout>
  );
}
