'use client';

import * as React from 'react';
import { Button } from '@/ui/components/button';
import { Textarea } from '@/ui/components/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/ui/components/card';

interface InstagramSendDialogProps {
  leadId: string;
  leadName: string;
  instagramHandle?: string;
  instagramScopedId?: string;
}

type SendState = 'idle' | 'sending' | 'success' | 'error';

export function InstagramSendDialog({
  leadId,
  leadName,
  instagramHandle,
  instagramScopedId,
}: InstagramSendDialogProps) {
  const [text, setText] = React.useState('');
  const [state, setState] = React.useState<SendState>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const hasInstagram = !!(instagramHandle || instagramScopedId);

  const handleSend = async () => {
    if (!text.trim() || !hasInstagram) return;

    setState('sending');
    setErrorMessage('');

    try {
      const response = await fetch(`/api/leads/${leadId}/instagram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Error al enviar el mensaje');
      }

      setText('');
      setState('success');
    } catch (err) {
      setState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Error al enviar el mensaje'
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Instagram DM</CardTitle>
        {!hasInstagram && (
          <p className="text-sm text-muted-foreground">
            No hay Instagram conectado para {leadName}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasInstagram && (
          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            No hay Instagram conectado. Editá el lead para agregar un perfil de
            Instagram.
          </div>
        )}

        <Textarea
          placeholder="Escribí tu mensaje..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hasInstagram || state === 'sending'}
          className="min-h-[100px]"
        />

        <div className="flex items-center justify-between">
          <div className="flex-1">
            {state === 'success' && (
              <p className="text-sm text-green-600 font-medium">
                ✓ Mensaje enviado
              </p>
            )}
            {state === 'error' && (
              <p className="text-sm text-destructive font-medium">
                ✗ Error al enviar: {errorMessage}
              </p>
            )}
          </div>

          <Button
            onClick={handleSend}
            disabled={!hasInstagram || !text.trim() || state === 'sending'}
          >
            {state === 'sending' ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
