import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { queryClient } from "./queryClient";

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
