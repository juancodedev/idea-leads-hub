import { create } from 'zustand';
import { Lead, LeadStatus } from '@/core/domain/Lead';

interface LeadsState {
  leads: Lead[];
  isLoading: boolean;
  setLeads: (leads: Lead[]) => void;
  updateLead: (updatedLead: Lead) => void;
  updateLeadStage: (leadId: string, stageId: string, status?: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: [],
  isLoading: false,
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
  setLoading: (loading) => set({ isLoading: loading }),
}));
