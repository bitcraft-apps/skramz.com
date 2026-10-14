import { Hono } from "hono";
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

export function createApp(): App {
  const app = new Hono<{ Bindings: Bindings }>();

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
    return c.json({ error: { code: pub.code, message: pub.message } }, 500);
  });

  return app;
}

const app = createApp();

export default app;
