// export const runtime = "edge";

import { createClient } from '@/infrastructure/database/server';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { notFound } from 'next/navigation';
import { Button } from '@/ui/components/button';
import Link from 'next/link';
import { Edit2, Phone, Mail, Building, Globe, MapPin, Calendar, ChevronLeft, Instagram, User, Linkedin, DollarSign } from 'lucide-react';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { LeadWorkspace } from '@/modules/leads/components/LeadWorkspace';
import { ScoreBadge } from '@/modules/leads/components/ScoreBadge';

interface LeadDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LeadDetailsPage({ params }: LeadDetailsPageProps) {
  const { id } = await params;
  
  const supabase = await createClient();
  const repository = new SupabaseLeadRepository(supabase);
  
  const lead = await repository.getById(id);

  if (!lead) {
    notFound();
  }

  const leadBreadcrumbLabel = lead.company || lead.name || lead.id;

  return (
    <DashboardLayout breadcrumbLabels={{ [`/leads/${lead.id}`]: leadBreadcrumbLabel }}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="rounded-full">
              <Link href="/leads">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{lead.name}</h1>
                <ScoreBadge lead={lead} showIcon size="md" />
              </div>
              <p className="text-muted-foreground">{lead.company}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/leads/${lead.id}/edit`}>
                <Edit2 className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {/* Info Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Contacto</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{lead.email}</span>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{lead.phone}</span>
                  </div>
                )}
                {lead.website && (
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                      {lead.website}
                    </a>
                  </div>
                )}
                {lead.instagramHandle && (
                  <div className="flex items-center gap-3">
                    <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col">
                      <a
                        href={`https://instagram.com/${lead.instagramHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        @{lead.instagramHandle}
                      </a>
                      {lead.instagramScopedId && (
                        <span className="text-xs text-muted-foreground">
                          ID: {lead.instagramScopedId}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{lead.company}</span>
                </div>
                {lead.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{lead.address}</span>
                  </div>
                )}
                {lead.jobTitle && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{lead.jobTitle}</span>
                  </div>
                )}
                {lead.linkedinUrl && (
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                      {lead.linkedinUrl}
                    </a>
                  </div>
                )}
                {lead.source && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{lead.source}</span>
                  </div>
                )}
                {lead.estimatedValue != null && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">${lead.estimatedValue.toLocaleString()}</span>
                  </div>
                )}
                {lead.nextFollowUp && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">Próximo: {new Date(lead.nextFollowUp).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">Creado {new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Workspace Area */}
          <div className="md:col-span-3">
            <LeadWorkspace lead={lead} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
