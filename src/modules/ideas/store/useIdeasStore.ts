import { create } from 'zustand';
import { Idea } from '@/core/domain/Idea';

interface IdeasState {
  ideas: Idea[];
  setIdeas: (ideas: Idea[]) => void;
  addIdea: (idea: Idea) => void;
}

export const useIdeasStore = create<IdeasState>((set) => ({
  ideas: [],
  setIdeas: (ideas) => set({ ideas }),
  addIdea: (idea) => set((state) => ({ ideas: [idea, ...state.ideas] })),
}));
