"use client";

import { useEffect, useState } from "react";
import { Lead } from "@/core/domain/Lead";
import { createClient } from "@/infrastructure/database/client";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/popover";
import { Button } from "@/ui/components/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/ui/components/command";
import { Check, User, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadSelectorProps {
  selectedLeadId?: string | null;
  onChange: (leadId: string | null) => void;
}

export function LeadSelector({ selectedLeadId, onChange }: LeadSelectorProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);

  const supabase = createClient();
  const repository = new SupabaseLeadRepository(supabase);

  useEffect(() => {
    repository.getAll().then(setLeads);
  }, []);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedLead ? `${selectedLead.name} (${selectedLead.company})` : "Seleccionar Lead relacionado..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar lead..." />
          <CommandList>
            <CommandEmpty>No se encontraron leads.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4" />
                  <span>Ninguno</span>
                </div>
                {selectedLeadId === null && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </CommandItem>
              {leads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  onSelect={() => {
                    onChange(lead.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.name}</span>
                    <span className="text-xs text-muted-foreground">({lead.company})</span>
                  </div>
                  {selectedLeadId === lead.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
