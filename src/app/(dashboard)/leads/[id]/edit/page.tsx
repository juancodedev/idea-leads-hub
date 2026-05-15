export const runtime = "edge";

import { createClient } from '@/infrastructure/database/server';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { LeadForm } from '@/modules/leads/components/LeadForm';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { notFound } from 'next/navigation';

interface EditLeadPageProps {
  params: {
    id: string;
  };
}

export default async function EditLeadPage({ params }: EditLeadPageProps) {
  const supabase = await createClient();
  const repository = new SupabaseLeadRepository(supabase);
  
  const lead = await repository.getById(params.id);

  if (!lead) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Lead</h1>
          <p className="text-muted-foreground">
            Modifica la información del lead seleccionado.
          </p>
        </div>
        <div className="max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
          <LeadForm initialData={lead} />
        </div>
      </div>
    </DashboardLayout>
  );
}
