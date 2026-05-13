"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity } from "../../../activities/domain/entities/Activity";
import { ActivityType } from "../../../activities/domain/enums/ActivityType";
import { getIdeaActivitiesAction } from "../../../activities/infrastructure/actions/activityActions";
import { ActivityItem } from "./ActivityItem";
import { AddActivityForm } from "./AddActivityForm";
import { Skeleton } from "@/ui/components/skeleton";
import { History, ListTodo } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/tabs";

import { AuditLogItem } from "./AuditLogItem";
import { getAuditLogsForParent } from "../../../shared/infrastructure/actions/auditActions";
import { AuditLog } from "../../../shared/domain/entities/AuditLog";

interface IdeaActivityFeedProps {
  ideaId: string;
}

export function IdeaActivityFeed({ ideaId }: IdeaActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    const result = await getIdeaActivitiesAction(ideaId);
    if (result.success) {
      setActivities(result.activities || []);
    }
  }, [ideaId]);

  const fetchAuditLogs = useCallback(async () => {
    const result = await getAuditLogsForParent(ideaId);
    if (result.success) {
      setAuditLogs(result.logs || []);
    }
  }, [ideaId]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchActivities(), fetchAuditLogs()]);
    setIsLoading(false);
  }, [fetchActivities, fetchAuditLogs]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-2">
        <History className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Actividad y Seguimiento</h2>
      </div>

      <AddActivityForm ideaId={ideaId} onSuccess={refreshAll} />

      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="bg-transparent h-9 p-0 gap-4 border-b w-full justify-start rounded-none">
            <TabsTrigger 
              value="all" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
            >
              Todo
            </TabsTrigger>
            <TabsTrigger 
              value="comments" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
            >
              Comentarios
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
            >
              Historial
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="pt-4 mt-0">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="divide-y">
              {activities.map((activity) => (
                <ActivityItem 
                  key={activity.id} 
                  activity={activity} 
                  onUpdate={refreshAll}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ListTodo className="h-12 w-12 mb-4 opacity-20" />
              <p>No hay actividades registradas aún.</p>
              <p className="text-sm">Registra tu primera acción o investigación arriba.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="comments" className="pt-4">
          <div className="divide-y">
            {activities
              .filter(a => a.type === ActivityType.NOTE)
              .map((activity) => (
                <ActivityItem 
                  key={activity.id} 
                  activity={activity} 
                  onUpdate={refreshAll}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <AuditLogItem key={log.id} log={log} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>No hay historial registrado aún.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
