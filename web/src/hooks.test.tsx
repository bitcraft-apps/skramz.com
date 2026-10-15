import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "./api";
import { useBand, useBandGraph, useSearch } from "./hooks";
import { createQueryClient } from "./queryClient";

function BandProbe({ id }: { id: string }) {
  const { data, isSuccess } = useBand(id);
  return (
    <div>{isSuccess ? `band:${String((data.data as { id?: string }).id ?? id)}` : "loading"}</div>
  );
}

function GraphProbe({ id, depth }: { id: string; depth?: number }) {
  const { data, isSuccess } = useBandGraph(id, depth);
  return (
    <div>{isSuccess ? `nodes:${data.nodes.length}` : "loading"}</div>
  );
}

function SearchProbe({ q }: { q: string }) {
  const { data, isSuccess } = useSearch(q);
  return (
    <div>{isSuccess ? `hits:${data.hits.length}` : "loading"}</div>
  );
}

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn(async (input: unknown) => {
    expect(String(input).startsWith(API_URL)).toBe(true);
    return { ok: true, json: async () => payload } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server-state hooks", () => {
  it("two mounts of useBand share one request against VITE_API_URL", async () => {
    const fetchMock = stubFetch({
      data: { id: "b1", name: "Probe Band" },
      members: [],
      releases: [],
      media_links: [],
    });

    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <BandProbe id="b1" />
        <BandProbe id="b1" />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText("band:b1")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_URL}/api/bands/b1`);
  });

  it("two mounts of useBandGraph share one request with the depth param", async () => {
    const fetchMock = stubFetch({ nodes: [{ id: "b1", type: "band", name: "Root" }], edges: [] });

    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <GraphProbe id="b1" depth={2} />
        <GraphProbe id="b1" depth={2} />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText("nodes:1")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${API_URL}/api/bands/b1/graph?depth=2`,
    );
  });

  it("two mounts of useSearch share one encoded request", async () => {
    const fetchMock = stubFetch({ hits: [], nextCursor: null });

    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <SearchProbe q="black metal" />
        <SearchProbe q="black metal" />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText("hits:0")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${API_URL}/api/search?q=${encodeURIComponent("black metal")}`,
    );
  });
});
