import { create } from "zustand";

export type GraphUIState = {
  /** Graph traversal depth, clamped 1..4 to match the API parseDepth bound. */
  depth: number;
  showLabels: boolean;
  showReleases: boolean;
  setDepth: (d: number) => void;
  toggleLabels: () => void;
  toggleReleases: () => void;
  reset: () => void;
};

const clampDepth = (d: number): number =>
  !Number.isFinite(d) ? 3 : Math.min(4, Math.max(1, Math.floor(d)));

// Client-only graph presentation state. Graph PAYLOADS stay in React Query
// (useBandGraph); this store holds only depth + display toggles.
export const useGraphUIStore = create<GraphUIState>()((set) => ({
  depth: 3,
  showLabels: true,
  showReleases: true,

  setDepth: (d) => set({ depth: clampDepth(d) }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleReleases: () => set((s) => ({ showReleases: !s.showReleases })),
  reset: () => set({ depth: 3, showLabels: true, showReleases: true }),
}));
