import { create } from "zustand";
import { Idea } from "../domain/entities/Idea";
import { IdeaStatus } from "../domain/enums/IdeaEnums";

interface IdeasState {
  ideas: Idea[];
  isLoading: boolean;
  error: string | null;
  setIdeas: (ideas: Idea[]) => void;
  addIdea: (idea: Idea) => void;
  updateIdea: (idea: Idea) => void;
  removeIdea: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useIdeasStore = create<IdeasState>((set) => ({
  ideas: [],
  isLoading: false,
  error: null,
  setIdeas: (ideas) => set({ ideas, isLoading: false }),
  addIdea: (idea) => set((state) => ({ ideas: [idea, ...state.ideas] })),
  updateIdea: (idea) => set((state) => ({ 
    ideas: state.ideas.map((i) => (i.id === idea.id ? idea : i)) 
  })),
  removeIdea: (id) => set((state) => ({ 
    ideas: state.ideas.filter((i) => i.id !== id) 
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
