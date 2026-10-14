import type { Hono } from "hono";
import type { Bindings } from "../lib/db";
import { errMessage } from "../lib/http";

export function registerHealth(app: Hono<{ Bindings: Bindings }>): void {
  // Deploy health: proves a live D1 round-trip (SELECT 1), not a static string.
  app.get("/healthz", async (c) => {
    try {
      const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return c.json({ ok: true, db: row?.ok ?? null });
    } catch (err) {
      const message = errMessage(err, "D1 query failed");
      return c.json({ error: { code: "d1_unavailable", message } }, 500);
    }
  });
}
