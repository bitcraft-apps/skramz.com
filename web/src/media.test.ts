import { describe, expect, it } from "vitest";
import { MEDIA_BASE_URL, artUrl } from "./media";

describe("artUrl", () => {
  it("joins a stored key onto the public R2 host", () => {
    expect(artUrl("bands/b1/photo.jpg")).toBe(
      `${MEDIA_BASE_URL}/bands/b1/photo.jpg`,
    );
    expect(MEDIA_BASE_URL).toBe("https://media.skramz.org");
  });

  it("returns null when there is no art", () => {
    expect(artUrl(null)).toBeNull();
    expect(artUrl(undefined)).toBeNull();
    expect(artUrl("")).toBeNull();
    expect(artUrl("   ")).toBeNull();
  });

  it("strips stray leading slashes and encodes the key", () => {
    expect(artUrl("/releases/r1/my cover.jpg")).toBe(
      `${MEDIA_BASE_URL}/releases/r1/my%20cover.jpg`,
    );
  });
});
