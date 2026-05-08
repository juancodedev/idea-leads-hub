import { createClient } from '@/infrastructure/database/server';
import { SupabaseIdeaRepository } from '@/infrastructure/repositories/SupabaseIdeaRepository';
import { IdeasList } from '@/modules/ideas/components/IdeasList';
import { Button } from '@/ui/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function IdeasPage() {
  const supabase = createClient();
  const repository = new SupabaseIdeaRepository(supabase);
  
  let ideas = [];
  try {
    ideas = await repository.getAll();
  } catch (error) {
    console.error('Error fetching ideas:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ideas</h1>
          <p className="text-slate-500">Gestiona y valida tus próximos proyectos.</p>
        </div>
        <Button asChild>
          <Link href="/ideas/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Idea
          </Link>
        </Button>
      </div>

      <IdeasList ideas={ideas} />
    </div>
  );
}
