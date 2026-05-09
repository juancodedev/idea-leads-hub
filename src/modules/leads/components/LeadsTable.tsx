'use client';

import * as React from 'react';
import { Lead } from '@/core/domain/Lead';
import { PipelineStage } from '@/core/domain/Pipeline';
import { Tag } from '@/core/domain/Tag';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/ui/components/table';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  ExternalLink,
  Trash2,
  Tag as TagIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/ui/components/sheet';
import Link from 'next/link';
import { LeadQuickView } from './LeadQuickView';

interface LeadsTableProps {
  leads: Lead[];
  stages: PipelineStage[];
  allTags: Tag[];
}

export function LeadsTable({ leads, stages, allTags }: LeadsTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedStage, setSelectedStage] = React.useState<string>('all');
  const [selectedTag, setSelectedTag] = React.useState<string>('all');
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  const handleOpenQuickView = (lead: Lead) => {
    setSelectedLead(lead);
    setIsSheetOpen(true);
  };

  const filteredLeads = React.useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStage = selectedStage === 'all' || lead.stageId === selectedStage;

      const matchesTag = selectedTag === 'all' || lead.tags?.some(t => t.id === selectedTag);

      return matchesSearch && matchesStage && matchesTag;
    });
  }, [leads, searchTerm, selectedStage, selectedTag]);

  if (leads.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No hay leads registrados aún.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, empresa o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">Todas las etapas</option>
            {stages.map(stage => (
              <option key={stage.id} value={stage.id}>{stage.name}</option>
            ))}
          </select>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">Todas las etiquetas</option>
            {allTags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-md border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-[250px]">Lead</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Etapa / Estado</TableHead>
              <TableHead>Etiquetas</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead) => {
              const stage = stages.find(s => s.id === lead.stageId);
              return (
                <TableRow
                  key={lead.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => handleOpenQuickView(lead)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">{lead.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>
                    {stage ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="text-sm font-medium">{stage.name}</span>
                      </div>
                    ) : (
                      <Badge variant="outline">{lead.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {lead.tags?.map(tag => (
                        <div
                          key={tag.id}
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                          title={tag.name}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(lead.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleOpenQuickView(lead)}>
                          <Eye className="mr-2 h-4 w-4" /> Vista Rápida
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/leads/${lead.id}`} className="flex items-center">
                            <ExternalLink className="mr-2 h-4 w-4" /> Ver Perfil
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/leads/${lead.id}/edit`} className="flex items-center">
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredLeads.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No se encontraron leads que coincidan con los filtros.
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="sm:max-w-2xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Información del Lead</SheetTitle>
          </SheetHeader>
          {selectedLead && (
            <LeadQuickView
              lead={selectedLead}
              stages={stages}
              onUpdate={() => {
                // Aquí podrías recargar los datos si fuera necesario
                // Por ahora el estado local se mantiene
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
