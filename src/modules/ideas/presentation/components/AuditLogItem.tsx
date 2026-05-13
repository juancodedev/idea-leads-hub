"use client";

import { AuditLog } from "../../../shared/domain/entities/AuditLog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Edit, Trash, FileIcon, Settings } from "lucide-react";

interface AuditLogItemProps {
  log: AuditLog;
}

export function AuditLogItem({ log }: AuditLogItemProps) {
  const getActionIcon = () => {
    switch (log.action) {
      case 'CREATE': return <Plus className="h-3 w-3 text-emerald-500" />;
      case 'UPDATE': return <Edit className="h-3 w-3 text-blue-500" />;
      case 'DELETE': return <Trash className="h-3 w-3 text-rose-500" />;
      default: return <Settings className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getActionText = () => {
    const entityName = log.entityType === 'IDEA' ? 'la idea' : 'una actividad';
    switch (log.action) {
      case 'CREATE': return `creó ${entityName}`;
      case 'UPDATE': return `actualizó ${entityName}`;
      case 'DELETE': return `eliminó ${entityName}`;
      default: return `realizó una acción en ${entityName}`;
    }
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return "vacío";
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="flex gap-3 py-3 text-sm border-l-2 border-muted pl-4 ml-2 last:border-transparent">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted relative -left-[25px]">
        {getActionIcon()}
      </div>
      <div className="flex-1 space-y-1 -ml-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground/80">Tú</span>
          <span className="text-muted-foreground">{getActionText()}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: es })}
          </span>
        </div>
        
        {log.changes && Object.keys(log.changes).length > 0 && (
          <div className="mt-1 space-y-1 rounded-md bg-muted/40 p-2 text-[11px] border">
            {Object.entries(log.changes).map(([key, change]) => (
              <div key={key} className="flex flex-wrap items-center gap-x-2">
                <span className="font-bold text-muted-foreground uppercase text-[9px]">{key}:</span>
                {change.old !== undefined && (
                  <span className="line-through opacity-40 italic">{formatValue(change.old)}</span>
                )}
                {change.old !== undefined && <span className="text-muted-foreground">→</span>}
                <span className="text-foreground font-medium">{formatValue(change.new)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
