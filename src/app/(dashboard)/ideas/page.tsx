import { createClient } from "@/infrastructure/database/server";
import { SupabaseIdeaRepository } from "@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository";
import { IdeasView } from "@/modules/ideas/presentation/views/IdeasView";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const supabase = await createClient();
  const repository = new SupabaseIdeaRepository(supabase);
  
  let ideas: any[] = [];
  try {
    ideas = await repository.getAll();
  } catch (error) {
    console.error("Error fetching ideas:", error);
  }

  return (
    <DashboardLayout>
      <IdeasView initialIdeas={JSON.parse(JSON.stringify(ideas))} />
    </DashboardLayout>
  );
}
