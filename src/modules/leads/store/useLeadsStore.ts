import { create } from 'zustand';
import { Lead, LeadStatus } from '@/core/domain/Lead';

export interface SearchParamsInput {
  q: string | null;
  status: string | null;
  source: string | null;
  sort: string | null;
  order: string | null;
  page: string | null;
}

const VALID_STATUSES = new Set([
  'Nuevo', 'Contactado', 'Interesado', 'Propuesta', 'Ganado', 'Perdido',
]);

function sanitizeSearch(value: string): string {
  // Strip HTML tags and trim
  return value.replace(/<[^>]*>/g, '').trim();
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

interface LeadsState {
  leads: Lead[];
  isLoading: boolean;

  // Filter/search state for URL sync
  search: string;
  statusFilter: string;
  sourceFilter: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  page: number;

  // Actions
  setLeads: (leads: Lead[]) => void;
  updateLead: (updatedLead: Lead) => void;
  updateLeadStage: (leadId: string, stageId: string, status?: string) => void;
  removeLead: (leadId: string) => void;
  setLoading: (loading: boolean) => void;

  // Search param actions
  setFromSearchParams: (params: SearchParamsInput) => void;
  setSearch: (search: string) => void;
  setStatusFilter: (status: string) => void;
  setSourceFilter: (source: string) => void;
  setSortField: (field: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: [],
  isLoading: false,

  // Filter/search state
  search: '',
  statusFilter: 'all',
  sourceFilter: 'all',
  sortField: 'createdAt',
  sortOrder: 'desc',
  page: 1,

  // Lead actions
  setLeads: (leads) => set({ leads }),
  updateLead: (updatedLead) =>
    set((state) => ({
      leads: state.leads.map((l) => (l.id === updatedLead.id ? updatedLead : l)),
    })),
  updateLeadStage: (leadId, stageId, status) =>
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, stageId, status: (status as LeadStatus) || lead.status } : lead
      ),
    })),
  removeLead: (leadId) =>
    set((state) => ({
      leads: state.leads.filter((l) => l.id !== leadId),
    })),
  setLoading: (loading) => set({ isLoading: loading }),

  // Search param actions
  setFromSearchParams: (params) =>
    set({
      search: params.q ? sanitizeSearch(params.q) : '',
      statusFilter: params.status && VALID_STATUSES.has(params.status) ? params.status : 'all',
      sourceFilter: params.source ?? 'all',
      sortField: params.sort ?? 'createdAt',
      sortOrder: params.order === 'asc' ? 'asc' : 'desc',
      page: parsePage(params.page),
    }),
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSourceFilter: (sourceFilter) => set({ sourceFilter }),
  setSortField: (sortField) => set({ sortField }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setPage: (page) => set({ page }),
}));
