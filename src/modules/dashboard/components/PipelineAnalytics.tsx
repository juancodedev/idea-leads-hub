'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { PipelineStage } from '@/core/domain/Pipeline';
import { Lead } from '@/core/domain/Lead';

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  leads: Lead[];
}

export function PipelineAnalytics({ stages, leads }: PipelineAnalyticsProps) {
  const maxLeads = Math.max(...stages.map(s => leads.filter(l => l.stageId === s.id).length), 1);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Embudo de Ventas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage) => {
            const count = leads.filter(l => l.stageId === stage.id).length;
            const percentage = (count / maxLeads) * 100;

            return (
              <div key={stage.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span>{stage.name}</span>
                  </div>
                  <span className="text-muted-foreground">{count} leads</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-500 ease-out" 
                    style={{ 
                      width: `${percentage}%`, 
                      backgroundColor: stage.color,
                      opacity: 0.7 
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
