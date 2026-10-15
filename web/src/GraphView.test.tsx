import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphView } from "./GraphView";
import { createQueryClient } from "./queryClient";
import { useGraphUIStore } from "./stores/graphUIStore";

vi.mock("react-force-graph-2d", () => ({
  default: ({
    graphData,
    onNodeClick,
  }: {
    graphData: { nodes: { id: string; name: string }[]; links: unknown[] };
    onNodeClick: (node: { id: string }) => void;
  }) => (
    <div data-testid="force-graph">
      {graphData.nodes.map((n) => (
        <button key={n.id} type="button" onClick={() => onNodeClick(n)}>
          {n.name}
        </button>
      ))}
    </div>
  ),
}));

const fixture = {
  nodes: [
    { id: "a", type: "band", name: "Band A" },
    { id: "b", type: "band", name: "Band B" },
    { id: "c", type: "band", name: "Band C" },
  ],
  edges: [
    { from: "a", to: "b", via: "Shared One" },
    { from: "b", to: "c", via: "Shared Two" },
  ],
};

const calls: string[] = [];

function stubGraph(payload: unknown) {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      calls.push(String(input));
      return { ok: true, json: async () => payload } as Response;
    }),
  );
}

function renderView(id = "a") {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/bands/${id}`]}>
        <Routes>
          <Route path="/bands/:bandId" element={<GraphView id={id} />} />
          <Route path="/members/:memberId" element={<div>member page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useGraphUIStore.getState().reset();
});

describe("GraphView", () => {
  it("renders the 3-band fixture graph with correct edges and via-labels", async () => {
    stubGraph(fixture);
    renderView();
    expect(await screen.findByTestId("force-graph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Band A" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "graph connections" });
    expect(within(list).getByText("a to b via Shared One")).toBeInTheDocument();
    expect(within(list).getByText("b to c via Shared Two")).toBeInTheDocument();
    expect(calls[0]).toContain("/api/bands/a/graph?depth=3");
  });

  it("depth control refetches without remounting the rendered graph", async () => {
    stubGraph(fixture);
    const user = userEvent.setup();
    renderView();
    const graph = await screen.findByTestId("force-graph");
    await user.selectOptions(screen.getByRole("combobox", { name: "graph depth" }), "1");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/api/bands/a/graph?depth=1");
    // Same canvas node survived the refetch — no full-page reload.
    expect(screen.getByTestId("force-graph")).toBe(graph);
  });

  it("node click navigates to the band page", async () => {
    stubGraph(fixture);
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={["/bands/a"]}>
          <Routes>
            <Route path="/bands/a" element={<GraphView id="a" />} />
            <Route path="/bands/:bandId" element={<div>band page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId("force-graph");
    await user.click(screen.getByRole("button", { name: "Band B" }));
    expect(await screen.findByText("band page")).toBeInTheDocument();
  });

  it("shows an empty state when fewer than two nodes come back", async () => {
    stubGraph({
      nodes: [{ id: "solo", type: "band", name: "Solo Act" }],
      edges: [],
    });
    renderView("solo");
    expect(await screen.findByText("no connections yet")).toBeInTheDocument();
    expect(screen.queryByTestId("force-graph")).not.toBeInTheDocument();
  });

  it("caps rendering at 500 nodes", async () => {
    const nodes = Array.from({ length: 501 }, (_, i) => ({
      id: `b${i}`,
      type: "band",
      name: `Band ${i}`,
    }));
    stubGraph({ nodes, edges: [] });
    renderView();
    expect(await screen.findByTestId("force-graph")).toBeInTheDocument();
    expect(screen.getByText("showing first 500 of 501 bands")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(500);
  });
});
