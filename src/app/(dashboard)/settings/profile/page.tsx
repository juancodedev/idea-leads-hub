import React from "react";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { ProfileForm } from "@/modules/shared/presentation/components/ProfileForm";
import { createClient } from "@/infrastructure/database/server";
import { SupabaseProfileRepository } from "@/infrastructure/repositories/SupabaseProfileRepository";
import { GetProfile } from "@/core/application/profile/ProfileUseCases";
import { redirect } from "next/navigation";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const repository = new SupabaseProfileRepository(supabase);
  const useCase = new GetProfile(repository);
  
  const profile = await useCase.execute(user.id);

  if (!profile) {
    // This shouldn't happen with the trigger, but as fallback:
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>No se pudo cargar el perfil.</p>
        </div>
      </DashboardLayout>
    );
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
