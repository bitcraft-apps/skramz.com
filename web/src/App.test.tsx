import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { usePlayerStore } from "./stores/playerStore";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    async () =>
      ({ ok: true, json: async () => ({ data: [], nextCursor: null }) }) as Response,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  usePlayerStore.setState({
    queue: [],
    current: null,
    isPlaying: false,
    volume: 0.8,
  });
});

describe("layout persistence", () => {
  it("does not remount the player slot when navigating between routes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const slot = screen.getByTestId("player-slot");
    expect(slot).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "about" }));
    expect(
      await screen.findByText("about", { selector: "main" }),
    ).toBeInTheDocument();

    // Same DOM node survived navigation — the player never remounted.
    expect(screen.getByTestId("player-slot")).toBe(slot);

    await user.click(screen.getByRole("link", { name: "home" }));
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
    expect(screen.getByTestId("player-slot")).toBe(slot);
  });

  it("keeps the playing embed mounted across route changes", async () => {
    usePlayerStore.getState().play("https://embed.example/bc");
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const embed = screen.getByTestId("player-embed");
    expect(embed).toHaveAttribute("src", "https://embed.example/bc");

    await user.click(screen.getByRole("link", { name: "about" }));
    expect(
      await screen.findByText("about", { selector: "main" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("player-embed")).toBe(embed);
  });
});
