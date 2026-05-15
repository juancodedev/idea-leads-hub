"use server";

import { createClient } from "@/infrastructure/database/server";
import { SupabaseProfileRepository } from "@/infrastructure/repositories/SupabaseProfileRepository";
import { UpdateProfile } from "@/core/application/profile/ProfileUseCases";
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
    return profile;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
