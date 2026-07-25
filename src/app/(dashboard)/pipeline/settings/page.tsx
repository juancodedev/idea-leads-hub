import React from "react";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { PipelineSettings } from "@/modules/pipeline/components/PipelineSettings";

export const dynamic = "force-dynamic";

export default function PipelineSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Configuración de Pipeline
            </h1>
            <p className="text-muted-foreground">
              Administrá las etapas y el orden de tu pipeline.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <PipelineSettings />
        </div>
      </div>
    </DashboardLayout>
  );
}
