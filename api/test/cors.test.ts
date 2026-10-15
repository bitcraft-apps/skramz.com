import { describe, expect, it } from "vitest";
import { createApp, type D1Database, type D1PreparedStatement } from "../src/index";

// #55: the SPA fetches cross-origin; CORS must answer exactly apex + www.
function stmt(): D1PreparedStatement {
  const s: D1PreparedStatement = {
    bind(..._values: unknown[]) {
      return s;
    },
    first: async <T,>(): Promise<T | null> => ({ ok: 1 }) as T,
    all: async <T,>(): Promise<{ results: T[] }> => ({ results: [] }),
    run: async (): Promise<unknown> => ({}),
  };
  return s;
}

const db: D1Database = { prepare: (_query: string) => stmt() };
const app = createApp();

describe("CORS for the skramz.org frontend (#55)", () => {
  it.each(["https://skramz.org", "https://www.skramz.org"])(
    "echoes Access-Control-Allow-Origin for %s",
    async (origin) => {
      const res = await app.request("/healthz", { headers: { Origin: origin } }, { DB: db });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    },
  );

  it("answers preflight OPTIONS for the apex origin", async () => {
    const res = await app.request(
      "/healthz",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://skramz.org",
          "Access-Control-Request-Method": "GET",
        },
      },
      { DB: db },
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://skramz.org");
  });

  it("sets no allow-origin header for an unlisted origin", async () => {
    const res = await app.request(
      "/healthz",
      { headers: { Origin: "https://evil.example" } },
      { DB: db },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
