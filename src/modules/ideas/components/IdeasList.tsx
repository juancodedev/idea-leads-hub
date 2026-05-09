'use client';

import { Idea } from '@/core/domain/Idea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Lightbulb, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdeasListProps {
  ideas: Idea[];
}

const statusColors: Record<Idea['status'], string> = {
  'Borrador': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  'Investigando': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Validando': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Ejecutando': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Archivado': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function IdeasList({ ideas }: IdeasListProps) {
  if (ideas.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center">
        <Lightbulb className="mb-4 h-12 w-12 text-slate-300" />
        <p className="text-sm text-slate-500 dark:text-slate-400">¿Tienes alguna idea brillante? Regístrala ahora.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <Card key={idea.id} className="group transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                statusColors[idea.status]
              )}>
                {idea.status}
              </div>
              <div className="flex gap-1">
                {Array.from({ length: idea.priority }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </div>
            <CardTitle className="mt-2 line-clamp-1">{idea.title}</CardTitle>
            <CardDescription className="line-clamp-2 min-h-[2.5rem]">
              {idea.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-between text-xs text-slate-400">
               <span>{new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(idea.createdAt))}</span>
               {idea.potentialRevenue && (
                 <span className="font-medium text-green-600 dark:text-green-400">
                   ${idea.potentialRevenue.toLocaleString()}
                 </span>
               )}
             </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
