import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings, D1Database, D1PreparedStatement } from "./lib/db";
import { publicInternalError } from "./lib/http";
import type { App } from "./lib/http";
import { registerBands } from "./routes/bands";
import { registerHealth } from "./routes/health";
import { registerMediaLinks } from "./routes/media-links";
import { registerMembers } from "./routes/members";
import { registerReleases } from "./routes/releases";
import { registerSearch } from "./routes/search";

export type { Bindings, D1Database, D1PreparedStatement };
export type { App } from "./lib/http";
// Compat: normalizeName was exported from the pre-split module.
export { normalizeName } from "./lib/http";

// Browser entry point is the apex domain (ADR-0004); www serves the same
// SPA, so both origins are allowed. Workers.dev preview origins are NOT
// listed — preview builds point at the production API, and browser fetches
// from a preview origin will not carry an allow-origin header (see #55
// follow-up). All read endpoints are public; ingestion writes stay gated
// by INGESTION_TOKEN regardless of origin.
const FRONTEND_ORIGINS = ["https://skramz.org", "https://www.skramz.org"];

export function createApp(): App {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("/*", cors({ origin: FRONTEND_ORIGINS }));

  registerHealth(app);
  registerBands(app);
  registerMembers(app);
  registerReleases(app);
  registerMediaLinks(app);
  registerSearch(app);

  // Uniform error shape for unknown routes: { "error": { "code", "message" } }.
  app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

  // Uniform error shape for thrown errors (Hono's default is plain-text 500).
  app.onError((err, c) => {
    console.error("Internal server error", err);
    const pub = publicInternalError();
    return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
  });

  return app;
}

const app = createApp();

export default app;
