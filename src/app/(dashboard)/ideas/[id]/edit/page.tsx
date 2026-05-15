import { createClient } from "@/infrastructure/database/server";
import { SupabaseIdeaRepository } from "@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository";
import { EditIdeaView } from "@/modules/ideas/presentation/views/EditIdeaView";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { notFound } from "next/navigation";

export const runtime = "edge";

export default async function EditIdeaPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const repository = new SupabaseIdeaRepository(supabase);
  
  const idea = await repository.getById(params.id);

  if (!idea) {
    notFound();
  }

  return (
    <DashboardLayout>
      <EditIdeaView idea={JSON.parse(JSON.stringify(idea))} />
    </DashboardLayout>
  );
}
