import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseProfileRepository } from '@/infrastructure/repositories/SupabaseProfileRepository';

export const runtime = 'nodejs';

const UpdateProfileSchema = z.object({
  fullName: z.string().optional(),
  avatarUrl: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
});

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const repo = new SupabaseProfileRepository(supabase);
  const profile = await repo.getProfile(user.id);
  return NextResponse.json(profile ?? {}, { status: 200 });
});

export const PUT = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const body = await request.json();
  const data = UpdateProfileSchema.parse(body);
  const repo = new SupabaseProfileRepository(supabase);
  const profile = await repo.updateProfile(user.id, data);
  return NextResponse.json(profile, { status: 200 });
});
