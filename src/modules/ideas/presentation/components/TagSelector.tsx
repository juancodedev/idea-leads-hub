"use client";

import { useEffect, useState } from "react";
import { Tag } from "@/core/domain/Tag";
import { createClient } from "@/infrastructure/database/client";
import { SupabaseTagRepository } from "@/infrastructure/repositories/SupabaseTagRepository";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/popover";
import { Button, buttonVariants } from "@/ui/components/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/ui/components/command";
import { Check, Plus, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;

}

export function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const supabase = createClient();
  const repository = new SupabaseTagRepository(supabase);

  useEffect(() => {
    repository.getAll().then(setAllTags);
  }, []);

  const toggleTag = (tagId: string) => {
    const isSelected = selectedTagIds.includes(tagId);
    if (isSelected) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!inputValue.trim()) return;
    try {
      const newTag = await repository.create({
        name: inputValue.trim(),
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
      });
      setAllTags([...allTags, newTag]);
      onChange([...selectedTagIds, newTag.id]);
      setInputValue("");
    } catch (error) {
      console.error("Error creating tag:", error);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-8 justify-start text-left font-normal flex items-center px-3"
          )}
        >
          <TagIcon className="mr-2 h-4 w-4" />
          {selectedTagIds.length > 0 ? `${selectedTagIds.length} etiquetas` : "Añadir etiquetas"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar etiqueta..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "w-full justify-start text-xs flex items-center px-2"
                )}
                onClick={handleCreateTag}
              >
                <Plus className="mr-2 h-3 w-3" />
                Crear "{inputValue}"
              </button>
            </CommandEmpty>
            <CommandGroup>
              {allTags.map((tag) => {
                const tagId = String(tag.id).trim();
                return (
                  <CommandItem
                    key={tagId}
                    onSelect={() => toggleTag(tagId)}
                    className="flex items-center justify-between cursor-pointer opacity-100! pointer-events-auto!"
                    style={{ opacity: 1, pointerEvents: 'auto' }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                    </div>
                    {selectedTagIds.includes(tagId) && (
                      <Check className="h-4 w-4" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
