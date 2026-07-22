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
import { Skeleton } from '@/ui/components/skeleton';
import { EmptyState } from '@/ui/components/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/components/dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LeadQuickView } from './LeadQuickView';
import { useLeadRepository } from '@/ui/providers/RepositoryProvider';
import { useLeadsStore } from '../store/useLeadsStore';

interface LeadsTableProps {
  leads: Lead[];
  stages: PipelineStage[];
  allTags: Tag[];
}

export function LeadsTable({ leads: initialLeads, stages, allTags }: LeadsTableProps) {
  const { leads, setLeads, updateLead, removeLead, isLoading, setLoading } = useLeadsStore();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedStage, setSelectedStage] = React.useState<string>('all');
  const [selectedTag, setSelectedTag] = React.useState<string>('all');
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const router = useRouter();
  const leadRepository = useLeadRepository();

  // Sincronizar leads iniciales con el store si es necesario
  React.useEffect(() => {
    if (initialLeads && initialLeads.length > 0) {
      setLeads(initialLeads);
      setLoading(false);
    }
  }, [initialLeads, setLeads, setLoading]);

  const selectedLead = React.useMemo(() =>
    leads.find(l => l.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  const handleOpenQuickView = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setIsSheetOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    try {
      await leadRepository.delete(deleteConfirmId);
      removeLead(deleteConfirmId);
    } catch (error) {
      console.error('Error deleting lead:', error);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const refreshLead = async (leadId: string) => {
    try {
      const updatedLead = await leadRepository.getById(leadId);
      if (updatedLead) {
        updateLead(updatedLead);
      }
    } catch (error) {
      console.error('Error refreshing lead:', error);
    }
  };

  const filteredLeads = React.useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.website && lead.website.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.jobTitle && lead.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.phone && lead.phone.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStage = selectedStage === 'all' || lead.stageId === selectedStage;

      const matchesTag = selectedTag === 'all' || lead.tags?.some(t => t.id === selectedTag);

      return matchesSearch && matchesStage && matchesTag;
    });
  }, [leads, searchTerm, selectedStage, selectedTag]);

  // Skeleton de carga para la tabla
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-md border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 border-b p-4 last:border-0">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No hay leads registrados aún"
        description="Los leads que crees aparecerán aquí."
      />
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
          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las etapas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etapas</SelectItem>
              {stages.map(stage => (
                <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las etiquetas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etiquetas</SelectItem>
              {allTags.map(tag => (
                <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[250px]">Lead</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Etapa / Estado</TableHead>
              <TableHead>Etiquetas</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead) => {
              const stage = stages.find(s => s.id === lead.stageId);
              return (
                <TableRow
                  key={lead.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleOpenQuickView(lead)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">{lead.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      {lead.jobTitle && <span>{lead.jobTitle}</span>}
                      {lead.phone && <span>{lead.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full bg-[var(--tag-color)]"
                        style={{ '--tag-color': stage?.color || '#cbd5e1' } as React.CSSProperties}
                      />
                      <span className="text-sm font-medium">{lead.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {lead.tags?.map(tag => (
                        <div
                          key={tag.id}
                          className="h-2 w-2 rounded-full bg-[var(--tag-color)]"
                          style={{ '--tag-color': tag.color } as React.CSSProperties}
                          title={tag.name}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {lead.estimatedValue != null
                      ? `$${lead.estimatedValue.toLocaleString()}`
                      : '—'}
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
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteConfirmId(lead.id)}
                        >
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

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar lead</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que querés eliminar este lead? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="sm:max-w-2xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Información del Lead</SheetTitle>
          </SheetHeader>
          {selectedLead && (
            <LeadQuickView 
              lead={selectedLead} 
              stages={stages} 
              onUpdate={() => refreshLead(selectedLead.id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
