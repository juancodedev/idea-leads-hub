'use server';

import { createClient } from '@/infrastructure/database/server';
import { SupabaseProfileRepository } from '@/infrastructure/repositories/SupabaseProfileRepository';
import { UpdateProfile, UploadAvatar } from '@/core/application/profile/ProfileUseCases';
import { UpdateProfileDTO } from '@/core/domain/Profile';
import { revalidatePath } from 'next/cache';

export async function getProfileData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single() as unknown as { data: { full_name: string | null; avatar_url: string | null } | null; error: unknown };

  return {
    email: user.email ?? '',
    name: profiles?.full_name ?? user.email?.split('@')[0] ?? '',
    avatar_url: profiles?.avatar_url ?? undefined,
  };
}

export async function updateProfileAction(dto: UpdateProfileDTO) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('No autorizado');
  }

  const repository = new SupabaseProfileRepository(supabase);
  const useCase = new UpdateProfile(repository);

  try {
    const profile = await useCase.execute(user.id, dto);
    revalidatePath('/settings/profile');
    return {
      success: true,
      data: JSON.parse(JSON.stringify(profile))
    };
  } catch (error: any) {
    console.error('Error in updateProfileAction:', error);
    throw new Error(error.message || 'Error desconocido al actualizar el perfil');
  }
}

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('No autorizado');
  }

  const file = formData.get('file') as File;
  if (!file) throw new Error('No se proporcionó ningún archivo');

  const repository = new SupabaseProfileRepository(supabase);
  const useCase = new UploadAvatar(repository);

  try {
    const publicUrl = await useCase.execute(user.id, file);
    return publicUrl;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
