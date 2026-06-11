import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseNoteRepository } from '@/infrastructure/repositories/SupabaseNoteRepository';

export const runtime = 'nodejs';

const UpdateNoteSchema = z.object({
  content: z.string().min(1, 'El contenido es obligatorio'),
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = UpdateNoteSchema.parse(body);
  const repo = new SupabaseNoteRepository(supabase);
  const note = await repo.update({ id: context.params.id, content: data.content });
  return NextResponse.json(note, { status: 200 });
});

export const DELETE = apiHandler(async (request: NextRequest, context: { params: { id: string } }) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabaseNoteRepository(supabase);
  await repo.delete(context.params.id);
  return new NextResponse(null, { status: 204 });
});
