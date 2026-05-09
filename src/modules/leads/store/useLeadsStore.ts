import { create } from 'zustand';
import { Lead } from '@/core/domain/Lead';

interface LeadsState {
  leads: Lead[];
  isLoading: boolean;
  setLeads: (leads: Lead[]) => void;
  updateLeadStatus: (leadId: string, status: Lead['status']) => void;
  setLoading: (loading: boolean) => void;
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: [],
  isLoading: false,
  setLeads: (leads) => set({ leads }),
  updateLeadStatus: (leadId, status) =>
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, status } : lead
      ),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
