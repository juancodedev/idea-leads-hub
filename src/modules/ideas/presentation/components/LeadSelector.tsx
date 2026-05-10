"use client";

import { useEffect, useState } from "react";
import { Lead } from "@/core/domain/Lead";
import { createClient } from "@/infrastructure/database/client";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/popover";
import { Button, buttonVariants } from "@/ui/components/button";
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

  useEffect(() => {
    const supabase = createClient();
    const repository = new SupabaseLeadRepository(supabase);
    repository.getAll().then(setLeads);
  }, []);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal flex items-center px-3 h-10"
          )}
          role="combobox"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedLead ? `${selectedLead.name} (${selectedLead.company})` : "Seleccionar Lead relacionado..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar lead..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No se encontraron leads.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4" />
                  <span>Ninguno</span>
                </div>
                {selectedLeadId === null && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </CommandItem>
              {leads.map((lead) => {
                const leadId = String(lead.id).trim();
                return (
                  <CommandItem
                    key={leadId}
                    onSelect={() => {
                      onChange(leadId);
                      setOpen(false);
                    }}
                    className="cursor-pointer opacity-100! pointer-events-auto!"
                    style={{ opacity: 1, pointerEvents: 'auto' }}
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.name}</span>
                      <span className="text-xs text-muted-foreground">({lead.company})</span>
                    </div>
                    {selectedLeadId === leadId && (
                      <Check className="ml-auto h-4 w-4" />
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
