"use server";

import { createClient } from "@/infrastructure/database/server";
import { SupabaseIdeaRepository } from "../repositories/SupabaseIdeaRepository";
import { CreateIdea } from "../../application/use-cases/CreateIdea";
import { UpdateIdea } from "../../application/use-cases/UpdateIdea";
import { IdeaSchemaType } from "../schemas/IdeaSchema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAuditLog } from "@/modules/shared/infrastructure/actions/auditActions";

export async function createIdeaAction(data: IdeaSchemaType) {
  const supabase = createClient();
  const repository = new SupabaseIdeaRepository(supabase);
  const useCase = new CreateIdea(repository);

  try {
    const idea = await useCase.execute(data);
    await createAuditLog({
      entityType: 'IDEA',
      entityId: idea.id,
      parentId: idea.id,
      action: 'CREATE',
      changes: {
        title: { new: idea.title },
        status: { new: idea.status }
      }
    });
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
    const oldIdea = await repository.getById(id);
    const idea = await useCase.execute({ id, ...data });
    
    if (oldIdea) {
      const changes: any = {};
      if (oldIdea.title !== idea.title) changes.title = { old: oldIdea.title, new: idea.title };
      if (oldIdea.status !== idea.status) changes.status = { old: oldIdea.status, new: idea.status };
      if (oldIdea.priority !== idea.priority) changes.priority = { old: oldIdea.priority, new: idea.priority };
      
      // Checking for new attachments
      if (JSON.stringify(oldIdea.attachments) !== JSON.stringify(idea.attachments)) {
        changes.attachments = { 
          old: oldIdea.attachments?.length || 0, 
          new: idea.attachments?.length || 0 
        };
      }

      if (Object.keys(changes).length > 0) {
        await createAuditLog({
          entityType: 'IDEA',
          entityId: idea.id,
          parentId: idea.id,
          action: 'UPDATE',
          changes
        });
      }
    }
  } catch (error: any) {
    return { error: error.message };
  }

  revalidatePath("/ideas");
  redirect("/ideas");
}
