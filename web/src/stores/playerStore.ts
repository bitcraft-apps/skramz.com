import { create } from "zustand";

export type PlayerState = {
  /** Ordered queue of track/band ids. */
  queue: string[];
  /** Currently selected id, always a member of queue or null. */
  current: string | null;
  isPlaying: boolean;
  /** 0..1, clamped on write. */
  volume: number;
  play: (id?: string) => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (v: number) => void;
  enqueue: (id: string) => void;
  dequeue: (id: string) => void;
  next: () => void;
  prev: () => void;
  clear: () => void;
};

const clampVolume = (v: number): number =>
  Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));

// Client-only playback UI state. Never holds server data — band/release
// payloads stay in React Query (see src/hooks.ts).
export const usePlayerStore = create<PlayerState>()((set, get) => ({
  queue: [],
  current: null,
  isPlaying: false,
  volume: 0.8,

  play: (id) =>
    set((s) => {
      if (id !== undefined) {
        const queue = s.queue.includes(id) ? s.queue : [...s.queue, id];
        return { queue, current: id, isPlaying: true };
      }
      if (s.current !== null) return { isPlaying: true };
      if (s.queue.length === 0) return {};
      return { current: s.queue[0], isPlaying: true };
    }),

  pause: () => set({ isPlaying: false }),

  toggle: () => {
    const { isPlaying, play, pause } = get();
    if (isPlaying) pause();
    else play();
  },

  setVolume: (v) => set({ volume: clampVolume(v) }),

  enqueue: (id) =>
    set((s) => (s.queue.includes(id) ? {} : { queue: [...s.queue, id] })),

  dequeue: (id) =>
    set((s) => {
      if (!s.queue.includes(id)) return {};
      const queue = s.queue.filter((t) => t !== id);
      if (s.current !== id) return { queue };
      return {
        queue,
        current: queue.length > 0 ? queue[Math.min(s.queue.indexOf(id), queue.length - 1)] : null,
        isPlaying: queue.length > 0 ? s.isPlaying : false,
      };
    }),

  next: () =>
    set((s) => {
      if (s.current === null || s.queue.length === 0) return {};
      const i = s.queue.indexOf(s.current);
      if (i < 0 || i >= s.queue.length - 1) return {};
      return { current: s.queue[i + 1] };
    }),

  prev: () =>
    set((s) => {
      if (s.current === null || s.queue.length === 0) return {};
      const i = s.queue.indexOf(s.current);
      if (i <= 0) return {};
      return { current: s.queue[i - 1] };
    }),

  clear: () => set({ queue: [], current: null, isPlaying: false }),
}));
