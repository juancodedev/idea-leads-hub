'use client';

import * as React from 'react';
import { Input } from '@/ui/components/input';

interface InlineRenameProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
}

export function InlineRename({ value, onSave }: InlineRenameProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleStartEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleSave = async () => {
    if (saving) return;
    if (draft.trim() === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch {
      // Revert on error
      setDraft(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleCancel}
        disabled={saving}
        className="h-7 text-sm"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="text-sm font-medium hover:text-primary transition-colors text-left"
    >
      {value}
    </button>
  );
}
