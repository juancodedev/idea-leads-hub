import { createClient } from "@/infrastructure/database/server";
import { SupabaseIdeaRepository } from "@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository";
import { IdeasView } from "@/modules/ideas/presentation/views/IdeasView";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { IdeaStatus } from "@/modules/ideas/domain/enums/IdeaEnums";

// export const runtime = "edge";
export const dynamic = "force-dynamic";

interface IdeasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const repository = new SupabaseIdeaRepository(supabase);
  
  const statusParam = typeof params.status === 'string' ? params.status as IdeaStatus : undefined;

  let ideas: any[] = [];
  try {
    ideas = await repository.getAll({ status: statusParam });
  } catch (error) {
    console.error("Error fetching ideas:", error);
  }

  return (
    <DashboardLayout>
      <IdeasView
        initialIdeas={JSON.parse(JSON.stringify(ideas))}
        searchParams={Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ''])
        )}
      />
    </DashboardLayout>
  );
}
