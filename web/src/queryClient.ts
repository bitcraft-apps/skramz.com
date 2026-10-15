import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

// Shared QueryClient factory for server state. Server data (bands, graph,
// search) flows only through React Query; client UI state lives in Zustand
// stores (see src/stores/). `VITE_API_URL` is the Worker domain
// (https://api.skramz.org in production).
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep list/detail/search responses fresh for 30s so two mounts of
        // the same hook within that window share one network request
        // (dedupe), while staying far under the D1 free-tier row-read wall.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // One retry for transient failures only (network errors, 5xx).
        // Persistent 4xx responses never recover, so retrying them would
        // only burn D1 row-reads against the free-tier wall.
        retry: (failureCount, error) =>
          failureCount < 1 &&
          (!(error instanceof ApiError) || error.status >= 500),
        refetchOnWindowFocus: false,
      },
    },
  });
}

// App-wide singleton. Tests needing isolation call createQueryClient().
export const queryClient = createQueryClient();
