"use server";

import { createClient } from "@/infrastructure/database/server";
import { SupabaseProfileRepository } from "@/infrastructure/repositories/SupabaseProfileRepository";
import { UpdateProfile, UploadAvatar } from "@/core/application/profile/ProfileUseCases";
import { UpdateProfileDTO } from "@/core/domain/Profile";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(dto: UpdateProfileDTO) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("No autorizado");
  }

  const repository = new SupabaseProfileRepository(supabase);
  const useCase = new UpdateProfile(repository);

  try {
    const profile = await useCase.execute(user.id, dto);
    revalidatePath("/settings/profile");
    // Return a plain object to ensure serialization works correctly
    return {
      success: true,
      data: JSON.parse(JSON.stringify(profile))
    };
  } catch (error: any) {
    console.error("Error in updateProfileAction:", error);
    throw new Error(error.message || "Error desconocido al actualizar el perfil");
  }
}

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("No autorizado");
  }

  const file = formData.get('file') as File;
  if (!file) throw new Error("No se proporcionó ningún archivo");

  const repository = new SupabaseProfileRepository(supabase);
  const useCase = new UploadAvatar(repository);

  try {
    const publicUrl = await useCase.execute(user.id, file);
    return publicUrl;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
