import type { Hono } from "hono";
import type { Bindings } from "../lib/db";
import { MAX_LIMIT, escapeLike, normalizeName, parseLimit } from "../lib/http";

export function registerSearch(app: Hono<{ Bindings: Bindings }>): void {
  // GET /api/search?q=&limit=&cursor= — unified band/member/release hits.
  // Flat hits paginated by limit; cursor is a last-seen id applied per table.
  app.get("/api/search", async (c) => {
    const q = c.req.query("q") ?? "";
    if (!q.trim()) {
      return c.json({ error: { code: "missing_query", message: "Query param q is required" } }, 400);
    }
    const limit = parseLimit(c.req.query("limit"));
    const cursor = c.req.query("cursor") ?? "";
    const pattern = `%${escapeLike(normalizeName(q))}%`;
    const perType = Math.min(limit, MAX_LIMIT);
    const cursorClause = cursor ? " AND id > ?" : "";
    const bandRows = await c.env.DB.prepare(
      `SELECT id, name AS name FROM bands WHERE name_norm LIKE (?) ESCAPE '\\'${cursorClause} ORDER BY id LIMIT ${perType + 1}`,
    )
      .bind(pattern, ...(cursor ? [cursor] : []))
      .all<{ id: string; name: string }>();
    const memberRows = await c.env.DB.prepare(
      `SELECT id, name AS name FROM members WHERE name_norm LIKE (?) ESCAPE '\\'${cursorClause} ORDER BY id LIMIT ${perType + 1}`,
    )
      .bind(pattern, ...(cursor ? [cursor] : []))
      .all<{ id: string; name: string }>();
    const releaseRows = await c.env.DB.prepare(
      `SELECT id, title AS name, band_id FROM releases WHERE title LIKE (?) ESCAPE '\\'${cursorClause} ORDER BY id LIMIT ${perType + 1}`,
    )
      .bind(`%${escapeLike(q.trim())}%`, ...(cursor ? [cursor] : []))
      .all<{ id: string; name: string; band_id: string }>();
    const hits = [
      ...bandRows.results.slice(0, perType).map((r) => ({ type: "band", ...r })),
      ...memberRows.results.slice(0, perType).map((r) => ({ type: "member", ...r })),
      ...releaseRows.results.slice(0, perType).map((r) => ({ type: "release", ...r })),
    ].slice(0, limit);
    const hasMore =
      bandRows.results.length > perType ||
      memberRows.results.length > perType ||
      hits.length >= limit;
    const nextCursor = hasMore && hits.length > 0 ? String(hits[hits.length - 1].id) : null;
    return c.json({ hits, nextCursor });
  });
}
