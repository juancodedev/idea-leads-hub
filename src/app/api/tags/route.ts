import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseTagRepository } from '@/infrastructure/repositories/SupabaseTagRepository';

export const runtime = 'nodejs';

const CreateTagSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  color: z.string().optional(),
});

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const repo = new SupabaseTagRepository(supabase);
  const tags = await repo.getAll();
  return NextResponse.json(tags, { status: 200 });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = CreateTagSchema.parse(body);
  const repo = new SupabaseTagRepository(supabase);
  const tag = await repo.create(data);
  return NextResponse.json(tag, { status: 201 });
});
