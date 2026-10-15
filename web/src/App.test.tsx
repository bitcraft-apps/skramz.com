import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";

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
    expect(
      await screen.findByText("home", { selector: "main" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("player-slot")).toBe(slot);
  });
});
