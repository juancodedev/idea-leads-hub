'use client';

import { Lead } from '@/core/domain/Lead';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/ui/components/ui/table';

interface LeadsTableProps {
  leads: Lead[];
}

const statusColors: Record<Lead['status'], string> = {
  'Nuevo': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Contactado': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Interesado': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Propuesta': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Ganado': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Perdido': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No hay leads registrados aún.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white dark:bg-slate-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">{lead.name}</TableCell>
              <TableCell>{lead.company}</TableCell>
              <TableCell>{lead.email}</TableCell>
              <TableCell>
                <div className={statusColors[lead.status] + " inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"}>
                  {lead.status}
                </div>
              </TableCell>
              <TableCell className="text-slate-500">
                {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(lead.createdAt))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
