import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { queryClient } from "./queryClient";
import { usePlayerStore } from "./stores/playerStore";

const bandPayload = {
  data: { id: "b1", name: "Probe Band", photo_r2_key: "bands/b1/photo.jpg" },
  members: [{ id: "m1", name: "Probe Member" }],
  releases: [{ id: "r1", title: "Probe Release", cover_r2_key: "releases/r1/cover.jpg" }],
  media_links: [],
};

// App binds the singleton queryClient, so clear its cache between tests —
// otherwise the first test's ["band","b1"] response serves every later test.
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
  localStorage.clear();
  usePlayerStore.setState({
    queue: [],
    current: null,
    isPlaying: false,
    volume: 0.8,
  });
});

function stubApi(payload: unknown = bandPayload) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload }) as Response),
  );
}

function renderBand() {
  render(
    <MemoryRouter initialEntries={["/bands/b1"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("encyclopedia band view", () => {
  it("renders the R2 band photo and release cover", async () => {
    stubApi();
    renderBand();
    const photo = await screen.findByAltText("Probe Band photo");
    expect(photo).toHaveAttribute(
      "src",
      "https://media.skramz.org/bands/b1/photo.jpg",
    );
    expect(screen.getByAltText("Probe Release cover")).toHaveAttribute(
      "src",
      "https://media.skramz.org/releases/r1/cover.jpg",
    );
  });

  it("links members and releases to their views", async () => {
    stubApi();
    renderBand();
    await screen.findByText("Probe Band");
    expect(screen.getByRole("link", { name: "Probe Member" })).toHaveAttribute(
      "href",
      "/members/m1",
    );
    expect(screen.getByRole("link", { name: "Probe Release" })).toHaveAttribute(
      "href",
      "/releases/r1",
    );
  });

  it("renders nothing image-like when keys are missing", async () => {
    stubApi({
      ...bandPayload,
      data: { ...bandPayload.data, photo_r2_key: null },
      releases: [{ id: "r1", title: "Probe Release", cover_r2_key: null }],
    });
    renderBand();
    await screen.findByText("Probe Band");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

const releasePayload = {
  data: { id: "r1", title: "Probe Release", cover_r2_key: null },
  media_links: [
    {
      id: "l1",
      provider: "bandcamp",
      url: "https://bandcamp.example/x",
      embed_url: "https://embed.example/bc",
    },
    {
      id: "l2",
      provider: "youtube",
      url: "https://youtube.example/y",
      embed_url: null,
    },
  ],
};

function renderRelease() {
  render(
    <MemoryRouter initialEntries={["/releases/r1"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("release listen section", () => {
  it("shows a graceful empty state when there are zero links", async () => {
    stubApi({ ...releasePayload, media_links: [] });
    renderRelease();
    expect(await screen.findByText("No streams yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play/ })).not.toBeInTheDocument();
  });

  it("dispatches play(embed_url) into the player store", async () => {
    const user = userEvent.setup();
    stubApi(releasePayload);
    renderRelease();
    await user.click(await screen.findByRole("button", { name: "play bandcamp" }));
    const s = usePlayerStore.getState();
    expect(s.current).toBe("https://embed.example/bc");
    expect(s.queue).toEqual(["https://embed.example/bc"]);
    expect(s.isPlaying).toBe(true);
    expect(screen.getByTestId("player-embed")).toHaveAttribute(
      "src",
      "https://embed.example/bc",
    );
  });

  it("renders a fallback outbound link when embed_url is missing", async () => {
    stubApi(releasePayload);
    renderRelease();
    const fallback = await screen.findByRole("link", { name: "youtube" });
    expect(fallback).toHaveAttribute("href", "https://youtube.example/y");
    // Only the embeddable link enters the queue.
    expect(usePlayerStore.getState().queue).toEqual([]);
  });
});
