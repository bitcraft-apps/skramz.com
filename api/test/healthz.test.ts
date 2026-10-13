import { describe, expect, it } from "vitest";
import app, { type D1Database, type D1PreparedStatement } from "../src/index";

function stmt(value: unknown): D1PreparedStatement {
  if (value instanceof Error) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      first: async <T,>(_column?: string): Promise<T | null> => {
        throw value;
      },
    };
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    first: async <T,>(_column?: string): Promise<T | null> =>
      value as T | null,
  };
}

function stubDb(value: unknown): D1Database {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      error: { code: "d1_unavailable", message: "boom" },
    });
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
