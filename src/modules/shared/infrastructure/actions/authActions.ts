"use server";

import { createClient } from "@/infrastructure/database/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
