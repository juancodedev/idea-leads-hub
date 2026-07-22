"use client";

import { useEffect, useState } from "react";
import { Tag } from "@/core/domain/Tag";
import { useTagRepository } from "@/ui/providers/RepositoryProvider";
import { TagBadge } from "./TagBadge";
import { TagSelector } from "./TagSelector";

interface TagsInputProps {
  value: string[];
  onChange: (tagIds: string[]) => void;
}

export function TagsInput({ value, onChange }: TagsInputProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const repository = useTagRepository();

  useEffect(() => {
    // Fetch all tags to display names in badges
    repository.getAll().then(setTags);
  }, [repository]);

  const selectedTags = tags.filter(t => value.includes(t.id));

  const handleRemove = (tagId: string) => {
    onChange(value.filter(id => id !== tagId));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} onRemove={handleRemove} />
        ))}
      </div>
      <TagSelector selectedTagIds={value} onChange={onChange} />
    </div>
  );
}
