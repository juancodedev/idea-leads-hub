import { create } from 'zustand';
import { Lead } from '@/core/domain/Lead';

interface LeadsState {
  leads: Lead[];
  isLoading: boolean;
  setLeads: (leads: Lead[]) => void;
  updateLeadStage: (leadId: string, stageId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: [],
  isLoading: false,
  setLeads: (leads) => set({ leads }),
  updateLeadStage: (leadId, stageId) =>
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, stageId } : lead
      ),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
