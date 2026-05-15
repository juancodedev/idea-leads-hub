"use server";

import { createClient } from "@/infrastructure/database/server";
import { SupabaseActivityRepository } from "../repositories/SupabaseActivityRepository";
import { CreateActivityDTO, UpdateActivityDTO } from "../../domain/entities/Activity";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/modules/shared/infrastructure/actions/auditActions";

export async function createActivityAction(data: CreateActivityDTO) {
  const supabase = await createClient();
  const repository = new SupabaseActivityRepository(supabase);

  try {
    const activity = await repository.create(data);
    
    await createAuditLog({
      entityType: 'ACTIVITY',
      entityId: activity.id,
      parentId: activity.ideaId || activity.leadId,
      action: 'CREATE',
      changes: {
        type: { new: activity.type },
        description: { new: activity.description }
      }
    });

    if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
    if (data.ideaId) revalidatePath(`/ideas/${data.ideaId}/edit`);
    return { success: true, activity };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateActivityAction(data: UpdateActivityDTO) {
  const supabase = await createClient();
  const repository = new SupabaseActivityRepository(supabase);

  try {
    const oldActivity = await repository.getById(data.id);
    const activity = await repository.update(data);

    if (oldActivity) {
      const changes: any = {};
      if (oldActivity.description !== activity.description) {
        changes.description = { old: oldActivity.description, new: activity.description };
      }
      if (JSON.stringify(oldActivity.attachments) !== JSON.stringify(activity.attachments)) {
        changes.attachments = { 
          old: oldActivity.attachments?.length || 0, 
          new: activity.attachments?.length || 0 
        };
      }

      if (Object.keys(changes).length > 0) {
        await createAuditLog({
          entityType: 'ACTIVITY',
          entityId: activity.id,
          parentId: activity.ideaId || activity.leadId,
          action: 'UPDATE',
          changes
        });
      }
    }

    revalidatePath("/ideas", "layout");
    revalidatePath("/leads", "layout");
    return { success: true, activity };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteActivityAction(id: string, path?: string) {
  const supabase = await createClient();
  const repository = new SupabaseActivityRepository(supabase);

  try {
    const activity = await repository.getById(id);
    await repository.delete(id);

    if (activity) {
      await createAuditLog({
        entityType: 'ACTIVITY',
        entityId: id,
        parentId: activity.ideaId || activity.leadId,
        action: 'DELETE',
        changes: { description: { old: activity.description } }
      });
    }

    if (path) revalidatePath(path);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getIdeaActivitiesAction(ideaId: string) {
  const supabase = await createClient();
  const repository = new SupabaseActivityRepository(supabase);

  try {
    const activities = await repository.getForIdea(ideaId);
    return { success: true, activities };
  } catch (error: any) {
    return { error: error.message };
  }
}
