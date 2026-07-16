'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { cn } from '@/lib/utils';

interface ConversationMessage {
  id: string;
  text: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
}

interface InstagramConversationProps {
  leadId: string;
}

export function InstagramConversation({ leadId }: InstagramConversationProps) {
  const [messages, setMessages] = React.useState<ConversationMessage[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchConversation = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/leads/${leadId}/instagram/conversation`
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch {
      // Silently fail — conversation display is secondary
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  React.useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Conversación</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="h-16 bg-slate-100 animate-pulse rounded-lg" />
            <div className="h-16 bg-slate-100 animate-pulse rounded-lg" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay mensajes aún. Enviá un DM para iniciar la conversación.
          </p>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  msg.direction === 'outbound'
                    ? 'justify-end'
                    : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                    msg.direction === 'outbound'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p>{msg.text}</p>
                  <p
                    className={cn(
                      'text-xs mt-1',
                      msg.direction === 'outbound'
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                    )}
                  >
                    {new Date(msg.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
