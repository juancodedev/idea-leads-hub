'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { PipelineStage } from '@/core/domain/Pipeline';
import { Lead } from '@/core/domain/Lead';

interface PipelineValueProps {
  stages: PipelineStage[];
  leads: Lead[];
}

export function PipelineValue({ stages, leads }: PipelineValueProps) {
  const stageValue = stages.map((stage) => {
    const stageLeads = leads.filter((l) => l.stageId === stage.id);
    const totalValue = stageLeads.reduce(
      (sum, l) => sum + (l.estimatedValue ?? 0),
      0
    );
    return { ...stage, count: stageLeads.length, totalValue };
  });

  const maxValue = Math.max(...stageValue.map((s) => s.totalValue), 1);
  const totalPipelineValue = stageValue.reduce((s, v) => s + v.totalValue, 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Valor del Pipeline</CardTitle>
        <p className="text-2xl font-bold text-primary">
          {formatCurrency(totalPipelineValue)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stageValue.map((stage) => (
            <div key={stage.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="font-medium">{stage.name}</span>
                </div>
                <span className="text-muted-foreground">
                  {formatCurrency(stage.totalValue)} ({stage.count} leads)
                </span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-full"
                  style={{
                    width: `${(stage.totalValue / maxValue) * 100}%`,
                    backgroundColor: stage.color,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
