"use client";

import { useEffect, useState } from "react";
import { Lead } from "@/core/domain/Lead";
import { createClient } from "@/infrastructure/database/client";
import { SupabaseLeadRepository } from "@/infrastructure/repositories/SupabaseLeadRepository";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";
import { User, Building, Mail, Phone, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/ui/components/skeleton";

interface RelatedLeadCardProps {
  leadId: string;
}

export function RelatedLeadCard({ leadId }: RelatedLeadCardProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();
  const repository = new SupabaseLeadRepository(supabase);

  useEffect(() => {
    setIsLoading(true);
    repository.getById(leadId)
      .then(setLead)
      .finally(() => setIsLoading(false));
  }, [leadId]);

  if (isLoading) {
    return <Skeleton className="h-[120px] w-full" />;
  }

  if (!lead) return null;

  return (
    <Card className="overflow-hidden border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Lead Relacionado
          </CardTitle>
          <Link 
            href={`/leads/${lead.id}`}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            Ver detalle <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {lead.name}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Building className="h-3 w-3" /> {lead.company}
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" /> {lead.email}
          </div>
          {lead.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {lead.phone}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
