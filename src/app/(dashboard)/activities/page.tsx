import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseActivityRepository } from "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";
import { ActivitiesList } from "./ActivitiesList";
import { resolveStatusIn } from "./statusFilter";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

export const dynamic = "force-dynamic";

interface ActivitiesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ActivitiesPage({ searchParams }: ActivitiesPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const activityRepo = new SupabaseActivityRepository(supabase);

  const typeParam = typeof params.type === 'string' ? params.type as ActivityType : undefined;
  const statusParam = typeof params.status === 'string' ? params.status : undefined;
  const query = typeof params.q === 'string' ? params.q : undefined;

  const { data: activities, total } = await activityRepo.search({
    userId: user.id,
    query,
    type: typeParam,
    statusIn: resolveStatusIn(statusParam),
    limit: 100,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Actividades</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'actividad' : 'actividades'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Actividades</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ActivitiesList
              activities={activities}
              searchParams={Object.fromEntries(
                Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ''])
              )}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
