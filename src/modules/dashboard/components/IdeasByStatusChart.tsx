"use client";

import { Idea } from "@/modules/ideas/domain/entities/Idea";
import { IdeaStatus } from "@/modules/ideas/domain/enums/IdeaEnums";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";

interface IdeasByStatusChartProps {
  ideas: Idea[];
}

const STATUS_CONFIG: Record<IdeaStatus, { label: string, color: string }> = {
  [IdeaStatus.BACKLOG]: { label: "Backlog", color: "#94a3b8" },
  [IdeaStatus.RESEARCHING]: { label: "Investigando", color: "#60a5fa" },
  [IdeaStatus.PLANNED]: { label: "Planificado", color: "#a78bfa" },
  [IdeaStatus.IN_PROGRESS]: { label: "En Progreso", color: "#fbbf24" },
  [IdeaStatus.COMPLETED]: { label: "Completado", color: "#34d399" },
  [IdeaStatus.ARCHIVED]: { label: "Archivado", color: "#f43f5e" },
};

export function IdeasByStatusChart({ ideas }: IdeasByStatusChartProps) {
  const total = ideas.length;
  const maxCount = Math.max(...Object.values(IdeaStatus).map(s => ideas.filter(i => i.status === s).length), 1);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Distribución de Ideas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.values(IdeaStatus).map((status) => {
            const count = ideas.filter(i => i.status === status).length;
            const percentage = (count / maxCount) * 100;
            const config = STATUS_CONFIG[status];

            return (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>{config.label}</span>
                  <span className="text-muted-foreground">{count} ideas</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-500 ease-out" 
                    style={{ 
                      width: `${percentage}%`, 
                      backgroundColor: config.color,
                      opacity: 0.8
                    }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
