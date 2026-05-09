import React from "react";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { LeadsTable } from "@/modules/leads/components/LeadsTable";
import { Button } from "@/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createClient();
  const leadRepo = new SupabaseLeadRepository(supabase);
  
  const leads = await leadRepo.getAll();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground">
              Gestiona tus prospectos y oportunidades de negocio.
            </p>
          </div>
          <Link href="/leads/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Lead
            </Button>
          </Link>
        </div>

        <LeadsTable leads={leads} />
      </div>
    </DashboardLayout>
  );
}
