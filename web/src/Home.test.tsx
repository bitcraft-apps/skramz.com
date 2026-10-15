import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Home } from "./App";
import { API_URL } from "./api";
import { createQueryClient } from "./queryClient";

const BANDS = {
  data: [
    { id: "b1", name: "Band One" },
    { id: "b2", name: "Band Two" },
  ],
  nextCursor: null,
};

function renderHome(searchPayload: unknown, searchStatus = 200) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith(`${API_URL}/api/search`)) {
      if (searchStatus !== 200) {
        return {
          ok: false,
          status: searchStatus,
          json: async () => ({}),
        } as Response;
      }
      return { ok: true, json: async () => searchPayload } as Response;
    }
    return { ok: true, json: async () => BANDS } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const searches = () => calls.filter((u) => u.includes("/api/search"));
  return { calls, fetchMock, searches };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("homepage gateway", () => {
  it("shows an idle band strip from GET /api/bands without searching", async () => {
    const { calls, searches } = renderHome({ hits: [], nextCursor: null });

    expect(await screen.findByRole("link", { name: "Band One" })).toHaveAttribute(
      "href",
      "/bands/b1",
    );
    expect(calls[0]).toBe(`${API_URL}/api/bands?limit=8`);
    expect(searches()).toHaveLength(0);
  });

  it("only searches once the query reaches 2 characters", async () => {
    const { searches } = renderHome({ hits: [], nextCursor: null });
    await screen.findByRole("link", { name: "Band One" });

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "x");
    expect(await screen.findByText("keep typing")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 450));
    expect(searches()).toHaveLength(0);

    await user.type(screen.getByRole("searchbox"), "y");
    expect(await screen.findByText("no results")).toBeInTheDocument();
    expect(searches()).toEqual([`${API_URL}/api/search?q=xy`]);
  });

  it("groups hits into bands/members/releases capped at 5 with detail links", async () => {
    renderHome({
      hits: [
        ...[1, 2, 3, 4, 5, 6].map((n) => ({
          type: "band",
          id: `b${n}`,
          name: `Band ${n}`,
        })),
        { type: "member", id: "m1", name: "Member One" },
        { type: "release", id: "r1", name: "Release One" },
      ],
      nextCursor: null,
    });

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "bla");

    expect(
      await screen.findByRole("heading", { name: "bands" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "releases" }),
    ).toBeInTheDocument();
    // Sixth band hit stays out of the capped group.
    expect(screen.getAllByRole("link", { name: /Band \d/ })).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Band 1" })).toHaveAttribute(
      "href",
      "/bands/b1",
    );
    expect(screen.getByRole("link", { name: "Member One" })).toHaveAttribute(
      "href",
      "/members/m1",
    );
    expect(screen.getByRole("link", { name: "Release One" })).toHaveAttribute(
      "href",
      "/releases/r1",
    );
  });

  it("empty results offer a reset back to the idle strip", async () => {
    renderHome({ hits: [], nextCursor: null });

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "zz");
    expect(await screen.findByText("no results")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(await screen.findByRole("link", { name: "Band One" })).toBeInTheDocument();
  });

  it("failed searches offer retry and reset", async () => {
    const { searches } = renderHome(null, 500);

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "zz");
    // The client retries one transient 5xx before surfacing the error.
    expect(
      await screen.findByText("search failed", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    const before = searches().length;
    expect(before).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() =>
      expect(searches().length).toBeGreaterThan(before),
    );
    // The manual retry fails again (plus one automatic 5xx retry), so wait
    // for the error state to settle before asserting.
    expect(
      await screen.findByText("search failed", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "reset" })).toBeInTheDocument();
  });
});
