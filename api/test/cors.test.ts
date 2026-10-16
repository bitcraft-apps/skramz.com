import { describe, expect, it } from "vitest";
import { createApp, type D1Database, type D1PreparedStatement } from "../src/index";

// The SPA fetches cross-origin; CORS must answer exactly apex + www.
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

describe("CORS for the skramz.org frontend", () => {
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

  // Version preview URLs look like
  // https://<version>-skramz-web.s-graczyk.workers.dev and call the
  // production API, so they are allowed.
  it.each(["https://abc123-skramz-web.s-graczyk.workers.dev"])(
    "echoes Access-Control-Allow-Origin for preview %s",
    async (origin) => {
      const res = await app.request("/healthz", { headers: { Origin: origin } }, { DB: db });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    },
  );

  it("answers preflight OPTIONS for a preview origin", async () => {
    const res = await app.request(
      "/healthz",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://abc123-skramz-web.s-graczyk.workers.dev",
          "Access-Control-Request-Method": "GET",
        },
      },
      { DB: db },
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://abc123-skramz-web.s-graczyk.workers.dev",
    );
  });

  it.each([
    "https://xyz-skramz-api.s-graczyk.workers.dev",
    "https://abc123-skramz-web.other.workers.dev",
    "https://skramz-web.s-graczyk.workers.dev",
    "http://abc123-skramz-web.s-graczyk.workers.dev",
    "https://abc123-skramz-web.s-graczyk.workers.dev.evil.example",
    "not-a-url",
  ])("sets no allow-origin header for lookalike %s", async (origin) => {
    const res = await app.request("/healthz", { headers: { Origin: origin } }, { DB: db });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  // Local dev loopback (Vite :5173 → worker :8787, plain http). Reads are
  // public and writes stay bearer-gated.
  it.each(["http://localhost:5173", "http://127.0.0.1:8787"])(
    "echoes Access-Control-Allow-Origin for loopback %s",
    async (origin) => {
      const res = await app.request("/healthz", { headers: { Origin: origin } }, { DB: db });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    },
  );

  it("sets no allow-origin header for a localhost lookalike", async () => {
    const res = await app.request(
      "/healthz",
      { headers: { Origin: "http://localhost.evil.example" } },
      { DB: db },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
