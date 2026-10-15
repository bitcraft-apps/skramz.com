import { useQuery } from "@tanstack/react-query";
import { API_URL, ApiError } from "./api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new ApiError(res.status, path);
  }
  return res.json() as Promise<T>;
}

export type BandDetail = {
  data: Record<string, unknown>;
  members: Record<string, unknown>[];
  releases: Record<string, unknown>[];
  media_links: Record<string, unknown>[];
};

export type BandGraph = {
  nodes: { id: string; type: string; name: string }[];
  edges: { from: string; to: string; via: string }[];
};

export type SearchResult = {
  hits: ({ type: "band" | "member" | "release" } & Record<string, unknown>)[];
  nextCursor: string | null;
};

// GET /api/bands/:id — band + members + releases + media_links.
export function useBand(id: string | undefined) {
  return useQuery({
    queryKey: ["band", id],
    enabled: !!id,
    queryFn: () => fetchJson<BandDetail>(`/api/bands/${encodeURIComponent(id!)}`),
  });
}

export type MemberDetail = {
  data: Record<string, unknown>;
  bands: Record<string, unknown>[];
};

export type ReleaseDetail = {
  data: Record<string, unknown>;
  media_links: Record<string, unknown>[];
};

// GET /api/members/:id — member + band history.
export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: ["member", id],
    enabled: !!id,
    queryFn: () => fetchJson<MemberDetail>(`/api/members/${encodeURIComponent(id!)}`),
  });
}

// GET /api/releases/:id — release + media_links.
export function useRelease(id: string | undefined) {
  return useQuery({
    queryKey: ["release", id],
    enabled: !!id,
    queryFn: () => fetchJson<ReleaseDetail>(`/api/releases/${encodeURIComponent(id!)}`),
  });
}

// GET /api/bands/:id/graph?depth= — multi-hop relationship tree.
export function useBandGraph(id: string | undefined, depth = 3) {
  return useQuery({
    queryKey: ["band-graph", id, depth],
    enabled: !!id,
    queryFn: () =>
      fetchJson<BandGraph>(
        `/api/bands/${encodeURIComponent(id!)}/graph?depth=${depth}`,
      ),
  });
}

// GET /api/search?q= — unified band/member/release hits.
export function useSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["search", query],
    enabled: query.length > 0,
    queryFn: () =>
      fetchJson<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`),
  });
}
