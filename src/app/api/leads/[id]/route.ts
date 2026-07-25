import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';

export const runtime = 'nodejs';

const UpdateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  instagramHandle: z.string().optional(),
  instagramScopedId: z.string().optional(),
});

export const GET = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseLeadRepository(supabase);
  const lead = await repo.getById(id);

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json(lead, { status: 200 });
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = UpdateLeadSchema.parse(body);

  const repo = new SupabaseLeadRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Lead not found');

  const lead = await repo.update({ id, ...data });
  return NextResponse.json(lead, { status: 200 });
});

export const DELETE = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase } = await withAuth(request);
  const repo = new SupabaseLeadRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Lead not found');

  await repo.delete(id);
  return new NextResponse(null, { status: 204 });
});
