"use client";

import { useEffect, useState } from "react";
import { Lead } from "@/core/domain/Lead";
import { useLeadRepository } from "@/ui/providers/RepositoryProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/popover";
import { Button, buttonVariants } from "@/ui/components/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/ui/components/command";
import { Check, User, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/components/badge";

interface LeadSelectorProps {
  selectedLeadIds?: string[];
  onChange: (leadIds: string[]) => void;
}

export function LeadSelector({ selectedLeadIds = [], onChange }: LeadSelectorProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);

  const repository = useLeadRepository();

  useEffect(() => {
    repository.getAll().then(setLeads);
  }, [repository]);

  const selectedLeads = leads.filter((l) => selectedLeadIds.includes(l.id));

  const toggleLead = (leadId: string) => {
    if (selectedLeadIds.includes(leadId)) {
      onChange(selectedLeadIds.filter(id => id !== leadId));
    } else {
      onChange([...selectedLeadIds, leadId]);
    }
  };

  return (
    <div className="space-y-2">
      {selectedLeads.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedLeads.map((lead) => (
            <Badge key={lead.id} variant="secondary" className="gap-1 pl-2 pr-1.5">
              <User className="h-3 w-3" />
              <span className="text-xs">{lead.name}</span>
              <button
                type="button"
                onClick={() => toggleLead(lead.id)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
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
              <span className="truncate text-muted-foreground">
                {selectedLeads.length > 0
                  ? `${selectedLeads.length} lead(es) seleccionado(s)`
                  : "Seleccionar leads relacionados..."}
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
                {leads.map((lead) => {
                  const leadId = String(lead.id).trim();
                  const isSelected = selectedLeadIds.includes(leadId);
                  return (
                    <CommandItem
                      key={leadId}
                      onSelect={() => {
                        toggleLead(leadId);
                        // Keep open for multi-select
                      }}
                      className="cursor-pointer opacity-100! pointer-events-auto!"
                      style={{ opacity: 1, pointerEvents: 'auto' }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.name}</span>
                        <span className="text-xs text-muted-foreground">({lead.company})</span>
                      </div>
                      {isSelected && (
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
    </div>
  );
}
