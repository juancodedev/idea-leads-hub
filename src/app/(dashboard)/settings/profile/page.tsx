import React from "react";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { ProfileForm } from "@/modules/shared/presentation/components/ProfileForm";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseProfileRepository } from "@/infrastructure/repositories/SupabaseProfileRepository";
import { GetProfile } from "@/core/application/profile/ProfileUseCases";
import { redirect } from "next/navigation";

// export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const repository = new SupabaseProfileRepository(supabase);
  const useCase = new GetProfile(repository);
  
  let profile = await useCase.execute(user.id);

  if (!profile) {
    // If profile doesn't exist yet, provide a default skeleton
    profile = {
      id: user.id,
      updatedAt: new Date().toISOString(),
    };
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">
            Administra los ajustes de tu cuenta y preferencias.
          </p>
        </div>
        <ProfileForm initialData={profile} />
      </div>
    </DashboardLayout>
  );
}
