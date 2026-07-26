"use client";

import { useState, useEffect, useCallback } from "react";
import { AuditLog } from "../domain/entities/AuditLog";
import { getAuditLogsForParent } from "../infrastructure/actions/auditActions";
import { AuditLogItem } from "@/modules/ideas/presentation/components/AuditLogItem";
import { EmptyState } from "@/ui/components/EmptyState";
import { History } from "lucide-react";

interface AuditLogTimelineProps {
  parentId: string;
  title?: string;
}

export function AuditLogTimeline({ parentId, title = "Historial de Cambios" }: AuditLogTimelineProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const result = await getAuditLogsForParent(parentId);
    if (result.success) {
      setLogs(result.logs || []);
    }
    setLoading(false);
  }, [parentId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="font-semibold mb-6">{title}</h3>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin cambios registrados"
          description="El historial de cambios aparecerá aquí a medida que modifiques esta entidad."
        />
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <AuditLogItem key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
