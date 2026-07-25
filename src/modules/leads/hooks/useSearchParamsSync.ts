'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useLeadsStore } from '../store/useLeadsStore';

/**
 * Syncs the Leads store filter/search state with URL search params.
 * Call this once in the LeadsTable or leads page component.
 */
export function useSearchParamsSync() {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  const initialized = React.useRef(false);

  const search = useLeadsStore((s) => s.search);
  const statusFilter = useLeadsStore((s) => s.statusFilter);
  const sourceFilter = useLeadsStore((s) => s.sourceFilter);
  const sortField = useLeadsStore((s) => s.sortField);
  const sortOrder = useLeadsStore((s) => s.sortOrder);
  const page = useLeadsStore((s) => s.page);
  const setFromSearchParams = useLeadsStore((s) => s.setFromSearchParams);

  // On mount: read URL params and initialize store
  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setFromSearchParams({
      q: urlSearchParams.get('q'),
      status: urlSearchParams.get('status'),
      source: urlSearchParams.get('source'),
      sort: urlSearchParams.get('sort'),
      order: urlSearchParams.get('order'),
      page: urlSearchParams.get('page'),
    });
  }, [urlSearchParams, setFromSearchParams]);

  // When filter state changes: update URL
  React.useEffect(() => {
    if (!initialized.current) return;

    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (sortField !== 'createdAt') params.set('sort', sortField);
    if (sortOrder !== 'desc') params.set('order', sortOrder);
    if (page > 1) params.set('page', String(page));

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(url, { scroll: false });
  }, [search, statusFilter, sourceFilter, sortField, sortOrder, page, pathname, router]);
}
