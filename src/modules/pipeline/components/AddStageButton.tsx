'use client';

import * as React from 'react';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Plus } from 'lucide-react';

interface AddStageButtonProps {
  onAdd: (name: string) => Promise<void>;
  disabled?: boolean;
}

export function AddStageButton({ onAdd, disabled }: AddStageButtonProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const handleAdd = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd(name.trim());
      setName('');
      setExpanded(false);
    } catch {
      // Keep input open on error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      setExpanded(false);
      setName('');
    }
  };

  if (expanded) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!name.trim()) {
              setExpanded(false);
            }
          }}
          placeholder="Nombre de la etapa..."
          disabled={saving}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!name.trim() || saving}
        >
          Guardar
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setExpanded(true)}
      disabled={disabled}
      className="w-full gap-2"
    >
      <Plus className="h-4 w-4" />
      Añadir Etapa
    </Button>
  );
}
