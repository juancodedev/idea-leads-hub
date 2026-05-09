import React from "react";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { LeadForm } from "@/modules/leads/components/LeadForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";

export const runtime = "edge";

export default function NewLeadPage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Lead</h1>
          <p className="text-muted-foreground">
            Completa la información para registrar un nuevo prospecto.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalles del Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
