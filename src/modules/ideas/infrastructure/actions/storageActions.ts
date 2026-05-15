"use server";

import { createClient } from "@/infrastructure/database/server";

export async function uploadFileAction(formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("file") as File;
  const bucket = "idea-attachments";

  if (!file) {
    return { error: "No se proporcionó ningún archivo" };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Usuario no autenticado" };
  }

  const userId = userData.user.id;
  // Create a clean file name
  const cleanFileName = file.name.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");
  const fileName = `${userId}/${crypto.randomUUID()}-${cleanFileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { error: error.message };
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    success: true,
    file: {
      name: file.name,
      url: publicUrl,
      path: data.path,
      size: file.size,
      type: file.type,
    },
  };
}

export async function deleteFileAction(path: string) {
  const supabase = await createClient();
  const bucket = "idea-attachments";

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
