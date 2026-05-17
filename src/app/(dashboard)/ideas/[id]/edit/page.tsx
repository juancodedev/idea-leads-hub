import { createClient } from "@/infrastructure/database/server";
import { SupabaseIdeaRepository } from "@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository";
import { EditIdeaView } from "@/modules/ideas/presentation/views/EditIdeaView";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { notFound } from "next/navigation";

// export const runtime = "edge";

interface EditIdeaPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditIdeaPage({ params }: EditIdeaPageProps) {
  // Ahora debes await los params
  const { id } = await params;
  
  const supabase = await createClient();
  const repository = new SupabaseIdeaRepository(supabase);

  const idea = await repository.getById(id);

  if (!idea) {
    notFound();
  }

  return (
    <DashboardLayout>
      <EditIdeaView idea={JSON.parse(JSON.stringify(idea))} />
    </DashboardLayout>
  );
}