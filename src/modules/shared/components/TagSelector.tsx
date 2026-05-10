'use client';

import * as React from 'react';
import { Check, Plus, Tag as TagIcon, X } from 'lucide-react';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/ui/components/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/components/popover';
import { cn } from '@/lib/utils';
import { Tag } from '@/core/domain/Tag';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseTagRepository } from '@/infrastructure/repositories/SupabaseTagRepository';
import { toast } from 'sonner';

interface TagSelectorProps {
  selectedTags: Tag[];
  onAssign: (tag: Tag) => Promise<void>;
  onRemove: (tagId: string) => Promise<void>;
}

export function TagSelector({ selectedTags, onAssign, onRemove }: TagSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [allTags, setAllTags] = React.useState<Tag[]>([]);
  const [loading, setLoading] = React.useState(false);

  const supabase = createClient();
  const repository = React.useMemo(() => new SupabaseTagRepository(supabase), [supabase]);

  const fetchTags = React.useCallback(async () => {
    try {
      const tags = await repository.getAll();
      setAllTags(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }, [repository]);

  React.useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleCreateTag = async () => {
    if (!inputValue) return;
    setLoading(true);
    try {
      const newTag = await repository.create({ name: inputValue });
      await onAssign(newTag);
      await fetchTags();
      setInputValue('');
      toast.success('Etiqueta creada y asignada');
    } catch (error: any) {
      toast.error('Error al crear etiqueta', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = async (tag: Tag) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id);
    try {
      if (isSelected) {
        await onRemove(tag.id);
      } else {
        await onAssign(tag);
      }
    } catch (error: any) {
      toast.error('Error al actualizar etiquetas');
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="pl-2 pr-1 gap-1"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => onRemove(tag.id)}
            className="hover:bg-slate-200 rounded-full p-0.5 dark:hover:bg-slate-800"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="h-7 rounded-full border-dashed"
          >
            <Plus className="mr-2 h-3 w-3" />
            Etiqueta
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Buscar o crear..." 
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-xs h-8"
                  onClick={handleCreateTag}
                  disabled={loading}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Crear "{inputValue}"
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {allTags.map((tag) => {
                  const isSelected = selectedTags.some((t) => t.id === tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggleTag(tag)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className={cn("h-4 w-4")} />
                      </div>
                      <TagIcon className="mr-2 h-3 w-3" style={{ color: tag.color }} />
                      <span>{tag.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
