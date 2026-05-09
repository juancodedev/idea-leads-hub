import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseActivityRepository } from "@/infrastructure/repositories/SupabaseActivityRepository";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";
import { ActivityItem } from "@/modules/activities/components/ActivityItem";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const supabase = createClient();
  const activityRepo = new SupabaseActivityRepository(supabase);
  
  const activities = await activityRepo.getAllPending();

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
            {activities.length > 0 ? (
              <div className="flex flex-col">
                {activities.map((activity) => (
                  <ActivityItem 
                    key={activity.id} 
                    activity={activity} 
                    onToggle={() => {}} // Handle client side or with server actions
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No tienes actividades pendientes. ¡Buen trabajo!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
