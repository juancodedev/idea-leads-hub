'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Lead } from '@/core/domain/Lead';

interface SourceBreakdownProps {
  leads: Lead[];
}

const SOURCE_COLORS: Record<string, string> = {
  instagram: '#ec4899',
  referral: '#8b5cf6',
  website: '#3b82f6',
  call: '#10b981',
  email: '#f59e0b',
  other: '#6b7280',
};

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  referral: 'Referido',
  website: 'Sitio Web',
  call: 'Llamada',
  email: 'Email',
  other: 'Otro',
};

export function SourceBreakdown({ leads }: SourceBreakdownProps) {
  const sources = new Map<string, number>();

  leads.forEach((lead) => {
    const source = lead.source || 'other';
    sources.set(source, (sources.get(source) || 0) + 1);
  });

  const sorted = Array.from(sources.entries()).sort((a, b) => b[1] - a[1]);
  const total = leads.length;
  const maxCount = Math.max(...sorted.map(([, c]) => c), 1);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Leads por Origen</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay datos de origen disponibles.
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map(([source, count]) => {
              const pct = ((count / total) * 100).toFixed(0);
              return (
                <div key={source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            SOURCE_COLORS[source] || SOURCE_COLORS.other,
                        }}
                      />
                      <span className="font-medium">
                        {SOURCE_LABELS[source] || source}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        backgroundColor:
                          SOURCE_COLORS[source] || SOURCE_COLORS.other,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
