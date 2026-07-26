"use client";

import * as React from "react";
import { Search, Loader2, UserPlus } from "lucide-react";
import { Input } from "@/ui/components/input";
import { Button } from "@/ui/components/button";
import { Skeleton } from "@/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/dialog";

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  status: string;
}

interface LeadSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when a lead is selected */
  onSelect: (lead: Lead) => void;
}

interface LeadSearchResponse {
  data: Lead[];
}

export function LeadSearchModal({ open, onOpenChange, onSelect }: LeadSearchModalProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searchLeads = React.useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/leads?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as LeadSearchResponse | Lead[];
        setResults(Array.isArray(data) ? data : data.data ?? []);
      } else {
        setResults([]);
      }
    } catch {
      console.error("Failed to search leads");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchLeads(value), 250);
    },
    [searchLeads]
  );

  const handleSelect = React.useCallback(
    (lead: Lead) => {
      onSelect(lead);
      onOpenChange(false);
      setQuery("");
      setResults([]);
      setSearched(false);
    },
    [onSelect, onOpenChange]
  );

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular a un lead</DialogTitle>
          <DialogDescription>
            Buscá un lead existente para vincular los mensajes de esta conversación.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscá por nombre, empresa o email..."
            value={query}
            onChange={handleChange}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {loading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No se encontraron leads. {query.trim() ? "Probá con otro término." : "Escribí para buscar."}
            </p>
          )}

          {!loading &&
            results.map((lead) => (
              <button
                key={lead.id}
                onClick={() => handleSelect(lead)}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent transition-colors flex items-center gap-3"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {lead.company || lead.email || lead.status}
                  </p>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
