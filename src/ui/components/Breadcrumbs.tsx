'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  pipeline: 'Pipeline',
  ideas: 'Ideas',
  activities: 'Actividades',
  messages: 'Mensajes',
  settings: 'Ajustes',
  profile: 'Perfil',
  new: 'Nuevo',
  edit: 'Editar',
};

function getBreadcrumbs(pathname: string): Array<{ label: string; href: string }> {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Array<{ label: string; href: string }> = [];
  let href = '';

  for (const segment of segments) {
    href += `/${segment}`;
    const label = LABEL_MAP[segment] || decodeURIComponent(segment);
    crumbs.push({ label, href });
  }

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();

  // Only show on sub-pages (not top-level routes)
  const crumbs = getBreadcrumbs(pathname);
  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      {crumbs.map((crumb, index) => (
        <React.Fragment key={crumb.href}>
          {index > 0 && <ChevronRight className="h-3 w-3" />}
          {index === crumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
