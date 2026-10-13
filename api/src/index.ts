import { Hono } from "hono";

// Minimal structural types for the Cloudflare bindings we use, so the Worker
// typechecks without depending on @cloudflare/workers-types.
export interface D1PreparedStatement {
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Deploy health: proves a live D1 round-trip (SELECT 1), not a static string.
app.get("/healthz", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return c.json({ ok: true, db: row?.ok ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "D1 query failed";
    return c.json({ error: { code: "d1_unavailable", message } }, 500);
  }
});

// Uniform error shape for unknown routes: { "error": { "code", "message" } }.
app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

export default app;
