'use client';

import * as React from 'react';
import { Button } from '@/ui/components/button';
import { Textarea } from '@/ui/components/textarea';
import { useNoteRepository } from '@/ui/providers/RepositoryProvider';
import { toast } from 'sonner';

interface NoteFormProps {
  entityId: string;
  entityType: 'lead' | 'idea';
  onNoteCreated: () => void;
}

export function NoteForm({ entityId, entityType, onNoteCreated }: NoteFormProps) {
  const [content, setContent] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const repository = useNoteRepository();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      await repository.create({
        entityId,
        entityType,
        content: content.trim(),
      });
      setContent('');
      onNoteCreated();
      toast.success('Nota añadida');
    } catch (error: any) {
      toast.error('Error al añadir nota', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder="Escribe una nota rápida..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[100px] resize-none"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !content.trim()}>
          {loading ? 'Añadiendo...' : 'Añadir Nota'}
        </Button>
      </div>
    </form>
  );
}
