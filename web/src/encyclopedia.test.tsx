import { cleanup, render, screen, within } from "@testing-library/react";
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

describe("band hero", () => {
  const heroPayload = {
    ...bandPayload,
    data: {
      ...bandPayload.data,
      location: "Portland",
      formed_year: 1998,
      disbanded_year: null,
      bio: "Loud basement trio.",
    },
    media_links: [
      {
        id: "l1",
        provider: "bandcamp",
        url: "https://bandcamp.example/x",
        embed_url: "https://embed.example/bc",
      },
    ],
  };

  it("shows location, years, and bio meta when present", async () => {
    stubApi(heroPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).getByText("Probe Band")).toBeInTheDocument();
    expect(within(hero).getByText(/Portland/)).toBeInTheDocument();
    expect(within(hero).getByText(/formed 1998/)).toBeInTheDocument();
    expect(
      within(hero).getByText("Loud basement trio."),
    ).toBeInTheDocument();
  });

  it("hides each meta line when its field is blank", async () => {
    stubApi(bandPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).queryByText(/Portland/)).not.toBeInTheDocument();
    expect(within(hero).queryByText(/formed/)).not.toBeInTheDocument();
    expect(within(hero).queryByText(/disbanded/)).not.toBeInTheDocument();
  });

  it("plays the first embed through the persistent player queue", async () => {
    const user = userEvent.setup();
    stubApi(heroPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    await user.click(within(hero).getByRole("button", { name: "play" }));
    const s = usePlayerStore.getState();
    expect(s.current).toBe("https://embed.example/bc");
    expect(s.queue).toEqual(["https://embed.example/bc"]);
    expect(s.isPlaying).toBe(true);
    expect(screen.getByTestId("player-embed")).toHaveAttribute(
      "src",
      "https://embed.example/bc",
    );
  });

  it("shows no play button and keeps the empty state with zero embeds", async () => {
    stubApi(bandPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(
      within(hero).queryByRole("button", { name: "play" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText("No streams yet."),
    ).toBeInTheDocument();
    expect(usePlayerStore.getState().current).toBeNull();
  });
});

describe("band evidence", () => {
  const evidencePayload = {
    data: { id: "b1", name: "Probe Band", photo_r2_key: null, updated_at: "2026-10-17T00:00:00.000Z" },
    members: [
      { id: "m1", name: "Probe Member", band_member_id: "bm1", role: "drums", joined_year: null, left_year: null },
      { id: "m2", name: "Gapped Member", band_member_id: "bm2", role: null, joined_year: null, left_year: null },
    ],
    releases: [],
    media_links: [],
    sources: [
      { id: "cs1", entity_type: "band_member", entity_id: "bm1", field: "role", value: "drums", status: "confirmed", tier: 1, source_url: "https://example.com/drums", accessed_at: "2026-10-17", note: null },
      { id: "cs2", entity_type: "band_member", entity_id: "bm2", field: "role", value: "bass", status: "unconfirmed", tier: 3, source_url: "https://example.com/bass", accessed_at: "2026-10-17", note: null },
      { id: "cs3", entity_type: "band", entity_id: "b1", field: "formed_year", value: "1997", status: "disputed", tier: 1, source_url: "https://example.com/rival", accessed_at: "2026-10-17", note: "rival copy" },
    ],
  };

  it("shows the freshness date in the hero", async () => {
    stubApi(evidencePayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).getByText(/last reviewed 2026-10-17/)).toBeInTheDocument();
  });

  it("badges the gapped member row unconfirmed and links the confirmed role", async () => {
    stubApi(evidencePayload);
    renderBand();
    const members = await screen.findByLabelText("members");
    expect(within(members).getByText("unconfirmed")).toBeInTheDocument();
    expect(within(members).getByText("drums")).toBeInTheDocument();
    const roleLink = within(members).getByRole("link", { name: "source" });
    expect(roleLink).toHaveAttribute("href", "https://example.com/drums");
  });

  it("lists disputed rivals with values and links in record notes", async () => {
    stubApi(evidencePayload);
    renderBand();
    const notes = await screen.findByLabelText("record notes");
    expect(within(notes).getByText("disputed")).toBeInTheDocument();
    expect(within(notes).getByText(/1997/)).toBeInTheDocument();
    expect(within(notes).getAllByText(/rival copy/).length).toBeGreaterThan(0);
    const hrefs = within(notes).getAllByRole("link", { name: "source" }).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://example.com/rival");
  });

  it("renders honest unknown freshness and no notes without sources", async () => {
    stubApi(bandPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).getByText(/last reviewed unknown/)).toBeInTheDocument();
    expect(screen.queryByLabelText("record notes")).not.toBeInTheDocument();
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
