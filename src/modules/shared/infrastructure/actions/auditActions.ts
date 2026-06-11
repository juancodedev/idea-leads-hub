"use server";

import { createClient } from "@/infrastructure/database/server";
import { Database } from "@/infrastructure/database/database.types";
import { AuditLog, AuditAction, AuditEntityType } from "../../domain/entities/AuditLog";

type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'createdAt' | 'userId'>) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No authenticated user" };

  const { error } = await supabase.from('audit_logs').insert({
    entity_type: log.entityType,
    entity_id: log.entityId,
    parent_id: log.parentId,
    action: log.action,
    changes: log.changes,
    user_id: userData.user.id
  } as never);

  if (error) return { error: error.message };
  return { success: true };
}

export async function getAuditLogsForParent(parentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  const rows = (data ?? []) as unknown as AuditLogRow[];
  const logs: AuditLog[] = rows.map(row => ({
    id: row.id,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id,
    parentId: row.parent_id,
    action: row.action as AuditAction,
    changes: row.changes,
    userId: row.user_id ?? '',
    createdAt: new Date(row.created_at)
  }));

  return { success: true, logs };
}

export async function getAuditLogsForEntity(entityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  const rows = (data ?? []) as unknown as AuditLogRow[];
  const logs: AuditLog[] = rows.map(row => ({
    id: row.id,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id,
    parentId: row.parent_id,
    action: row.action as AuditAction,
    changes: row.changes,
    userId: row.user_id ?? '',
    createdAt: new Date(row.created_at)
  }));

  return { success: true, logs };
}
