'use client';

import * as React from 'react';
import { Activity } from '@/modules/activities/domain/entities/Activity';
import { ActivityType } from '@/modules/activities/domain/enums/ActivityType';
import { useActivityRepository } from '@/ui/providers/RepositoryProvider';
import { Mail, Loader2 } from 'lucide-react';
import { Skeleton } from '@/ui/components/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailTimelineProps {
  leadId: string;
  refreshKey?: number;
}

export function EmailTimeline({ leadId, refreshKey = 0 }: EmailTimelineProps) {
  const [emails, setEmails] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const activityRepository = useActivityRepository();

  React.useEffect(() => {
    async function fetchEmails() {
      setLoading(true);
      try {
        const all = await activityRepository.getForLead(leadId);
        const emailActivities = all.filter((a) => a.type === ActivityType.EMAIL);
        setEmails(emailActivities);
      } catch (err) {
        console.error('Error fetching email history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEmails();
  }, [leadId, refreshKey, activityRepository]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No se enviaron emails todavía</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {emails.map((email) => {
        let parsed: { to?: string; subject?: string; html?: string } = {};
        try {
          if (email.description) parsed = JSON.parse(email.description);
        } catch {
          parsed = {};
        }

        return (
          <div
            key={email.id}
            className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-medium text-sm truncate">{parsed.subject ?? email.title}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {format(new Date(email.createdAt), 'dd MMM HH:mm', { locale: es })}
              </span>
            </div>
            {parsed.to && (
              <p className="text-xs text-muted-foreground mb-2">
                Para: {parsed.to}
              </p>
            )}
            {parsed.html && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {parsed.html.replace(/<[^>]*>/g, '')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
