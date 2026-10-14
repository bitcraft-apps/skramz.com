import type { App } from "../lib/http";
import { publicD1Unavailable } from "../lib/http";

export function registerHealth(app: App): void {
  // Deploy health: proves a live D1 round-trip (SELECT 1), not a static string.
  app.get("/healthz", async (c) => {
    try {
      const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return c.json({ ok: true, db: row?.ok ?? null });
    } catch (err) {
      console.error("D1 query failed", err);
      const pub = publicD1Unavailable();
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
  });
}
