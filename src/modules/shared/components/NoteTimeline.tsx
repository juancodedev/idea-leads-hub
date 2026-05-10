'use client';

import * as React from 'react';
import { Note } from '@/core/domain/Note';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/ui/components/button';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseNoteRepository } from '@/infrastructure/repositories/SupabaseNoteRepository';
import { toast } from 'sonner';

interface NoteTimelineProps {
  notes: Note[];
  onNoteDeleted: () => void;
}

export function NoteTimeline({ notes, onNoteDeleted }: NoteTimelineProps) {
  const supabase = createClient();
  const repository = new SupabaseNoteRepository(supabase);

  const handleDelete = async (id: string) => {
    try {
      await repository.delete(id);
      onNoteDeleted();
      toast.success('Nota eliminada');
    } catch (error: any) {
      toast.error('Error al eliminar nota');
    }
  };

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-slate-50/50 rounded-lg border border-dashed">
        <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm">No hay notas registradas todavía.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
      {notes.map((note) => (
        <div key={note.id} className="relative pl-10">
          <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white border shadow-sm dark:bg-slate-950">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(note.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
