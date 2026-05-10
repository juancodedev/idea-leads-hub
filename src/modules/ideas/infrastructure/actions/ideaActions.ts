"use server";

import { createClient } from "@/infrastructure/database/server";
import { SupabaseIdeaRepository } from "../repositories/SupabaseIdeaRepository";
import { CreateIdea } from "../../application/use-cases/CreateIdea";
import { UpdateIdea } from "../../application/use-cases/UpdateIdea";
import { IdeaSchemaType } from "../schemas/IdeaSchema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createIdeaAction(data: IdeaSchemaType) {
  const supabase = createClient();
  const repository = new SupabaseIdeaRepository(supabase);
  const useCase = new CreateIdea(repository);

  try {
    await useCase.execute(data);
  } catch (error: any) {
    return { error: error.message };
  }

  revalidatePath("/ideas");
  redirect("/ideas");
}

export async function updateIdeaAction(id: string, data: IdeaSchemaType) {
  const supabase = createClient();
  const repository = new SupabaseIdeaRepository(supabase);
  const useCase = new UpdateIdea(repository);

  try {
    await useCase.execute({ id, ...data });
  } catch (error: any) {
    return { error: error.message };
  }

  revalidatePath("/ideas");
  redirect("/ideas");
}
