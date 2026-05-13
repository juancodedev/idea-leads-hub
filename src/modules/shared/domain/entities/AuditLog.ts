export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditEntityType = 'IDEA' | 'ACTIVITY';

export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  parentId?: string | null;
  action: AuditAction;
  changes: Record<string, { old?: any; new?: any }>;
  userId: string;
  createdAt: Date;
}
