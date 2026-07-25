'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/ui/components/command';
import { 
  Users, 
  LayoutDashboard, 
  Plus, 
  Lightbulb, 
  Settings,
  Search
} from 'lucide-react';

interface LeadSearchResult {
  id: string;
  name: string;
  company: string;
  status: string;
}

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<LeadSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  // Reset search when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [open]);

  // Debounced lead search
  React.useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Error searching leads:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Escribe un comando o busca..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>

        {searchQuery.length >= 2 ? (
          <CommandGroup heading="Leads">
            {isSearching && searchResults.length === 0 && (
              <CommandItem disabled>
                <Search className="mr-2 h-4 w-4 animate-pulse" />
                <span>Buscando...</span>
              </CommandItem>
            )}
            {searchResults.map((lead) => (
              <CommandItem
                key={lead.id}
                onSelect={() => runCommand(() => router.push(`/leads/${lead.id}`))}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>{lead.name}</span>
                {lead.company && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {lead.company}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {lead.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
            <CommandGroup heading="Sugerencias">
              <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/leads'))}>
                <Users className="mr-2 h-4 w-4" />
                <span>Leads</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/ideas'))}>
                <Lightbulb className="mr-2 h-4 w-4" />
                <span>Ideas</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Acciones Rápidas">
              <CommandItem onSelect={() => runCommand(() => router.push('/leads/new'))}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Nuevo Lead</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
