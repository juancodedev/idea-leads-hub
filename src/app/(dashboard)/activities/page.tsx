import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";
import { ActivitiesList } from "./ActivitiesList";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const activityRepo = new SupabaseActivityRepository(supabase);
  
  const activities = await activityRepo.getPending(user.id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Actividades</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tareas Pendientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ActivitiesList activities={activities} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
