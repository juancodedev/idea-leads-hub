import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { ApiUpdateLeadSchema } from '@/core/domain/LeadSchema';

export const runtime = 'nodejs';

export const GET = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase, scopedUserId } = await withAuth(request, { allowApiKey: true });
  const repo = new SupabaseLeadRepository(supabase, scopedUserId);
  const lead = await repo.getById(id);

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json(lead, { status: 200 });
});

export const PATCH = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase, scopedUserId } = await withAuth(request, { allowApiKey: true });
  const body = await request.json();
  const data = ApiUpdateLeadSchema.parse(body);

  const repo = new SupabaseLeadRepository(supabase, scopedUserId);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Lead not found');

  const lead = await repo.update({ id, ...data });
  return NextResponse.json(lead, { status: 200 });
});

export const DELETE = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  // Destructive: session only, never an API key.
  const { supabase } = await withAuth(request);
  const repo = new SupabaseLeadRepository(supabase);
  const existing = await repo.getById(id);
  if (!existing) throw new NotFoundError('Lead not found');

  await repo.delete(id);
  return new NextResponse(null, { status: 204 });
});
