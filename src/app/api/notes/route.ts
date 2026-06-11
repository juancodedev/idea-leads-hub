import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseNoteRepository } from '@/infrastructure/repositories/SupabaseNoteRepository';

export const runtime = 'nodejs';

const CreateNoteSchema = z.object({
  content: z.string().min(1, 'El contenido es obligatorio'),
  entityId: z.string().uuid(),
  entityType: z.enum(['lead', 'idea']),
});

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entityId');
  const entityType = searchParams.get('entityType') as 'lead' | 'idea' | null;

  if (!entityId || !entityType || !['lead', 'idea'].includes(entityType)) {
    return NextResponse.json(
      { error: 'entityId y entityType (lead | idea) son requeridos' },
      { status: 400 }
    );
  }

  const repo = new SupabaseNoteRepository(supabase);
  const notes = await repo.getForEntity(entityId, entityType);
  return NextResponse.json(notes, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = CreateNoteSchema.parse(body);
  const repo = new SupabaseNoteRepository(supabase);
  const note = await repo.create(data);
  return NextResponse.json(note, { status: 201 });
});
