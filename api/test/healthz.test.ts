import { describe, expect, it } from "vitest";
import app, { createApp, type D1Database, type D1PreparedStatement } from "../src/index";

function stmt(value: unknown): D1PreparedStatement {
  const s: D1PreparedStatement = {
    bind(..._values: unknown[]) {
      return s;
    },
    first: async <T,>(_column?: string): Promise<T | null> => {
      if (value instanceof Error) throw value;
      return value as T | null;
    },
    all: async <T,>(): Promise<{ results: T[] }> => {
      if (value instanceof Error) throw value;
      return { results: [] };
    },
    run: async (): Promise<unknown> => {
      if (value instanceof Error) throw value;
      return {};
    },
  };
  return s;
}

function stubDb(value: unknown): D1Database {
  return {
    prepare: (_query: string) => stmt(value),
  };
}

describe("GET /healthz", () => {
  it("returns 200 with a live D1 round-trip proof ({ ok: true, db: 1 })", async () => {
    let seenQuery = "";
    const db: D1Database = {
      prepare: (query: string) => {
        seenQuery = query;
        return stmt({ ok: 1 });
      },
    };
    const res = await app.request("/healthz", {}, { DB: db });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: 1 });
    // Must hit D1 with SELECT 1 — not a static string.
    expect(seenQuery).toMatch(/SELECT 1/i);
  });

  it("returns the uniform error shape with 500 when D1 fails", async () => {
    const db = stubDb(new Error("boom"));
    const res = await app.request("/healthz", {}, { DB: db });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "d1_unavailable", message: "D1 unavailable" },
    });
  });

  it("returns the uniform error shape with 500 for thrown errors", async () => {
    const fresh = createApp();
    fresh.get("/__test_throw", () => {
      throw new Error("kaboom");
    });
    const db = stubDb({ ok: 1 });
    const res = await fresh.request("/__test_throw", {}, { DB: db });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "internal", message: "Internal server error" },
    });
  });

  it("sanitizes engine text and logs raw server-side", async () => {
    const orig = console.error;
    let logged = "";
    console.error = (...args: unknown[]) => {
      logged += args.map(String).join(" ");
    };
    try {
      const db = stubDb(new Error("D1_ERROR: UNIQUE constraint failed: bands.name"));
      const res = await app.request("/healthz", {}, { DB: db });
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(res.status).toBe(500);
      expect(json.error.code).toBe("d1_unavailable");
      expect(json.error.message).not.toMatch(/unique|check constraint|sqlite/i);
      expect(json.error.message).toBe("D1 unavailable");
      expect(logged).toMatch(/D1 query failed/);
    } finally {
      console.error = orig;
    }
  });

  it("returns the uniform error shape with 404 for unknown routes", async () => {
    const db = stubDb({ ok: 1 });
    const res = await app.request("/nope", {}, { DB: db });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "not_found", message: "Not found" },
    });
  });
});
