import { Hono, type Context } from "hono";

type AppContext = Context<{ Bindings: Bindings }>;

// Minimal structural types for the Cloudflare bindings we use, so the Worker
// typechecks without depending on @cloudflare/workers-types.
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export type Bindings = {
  DB: D1Database;
  INGESTION_TOKEN?: string;
};

const RELEASE_TYPES = ["LP", "EP", "Split", "Demo", "Single", "Compilation"] as const;

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const DEFAULT_GRAPH_DEPTH = 3;
const MAX_GRAPH_DEPTH = 4;
const GRAPH_LIMIT = 500;

function parseDepth(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return DEFAULT_GRAPH_DEPTH;
  return Math.min(Math.max(n, 1), MAX_GRAPH_DEPTH);
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// Lowercase, de-punctuated search target for `name_norm` (LIKE-search target
// per the schema). Server-computed on writes; client-supplied values ignored.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Escape LIKE wildcards so `?search=` is a literal substring match.
function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// Timing-safe string compare for the ingestion bearer token.
function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

async function readBody(c: {
  req: { json(): Promise<unknown> };
}): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false }> {
  try {
    const parsed = await c.req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}

export function createApp() {
  const app = new Hono<{ Bindings: Bindings }>();

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

  // Writes require `Authorization: Bearer <INGESTION_TOKEN>` (timing-safe
  // compare, 401 otherwise). Token comes from `wrangler secret` — never git.
  async function requireAuth(c: AppContext): Promise<Response | null> {
    const token = c.env.INGESTION_TOKEN;
    if (!token) {
      return c.json(
        { error: { code: "server_misconfigured", message: "Ingestion token is not configured" } },
        500,
      );
    }
    const header = c.req.header("Authorization") ?? "";
    const prefix = "Bearer ";
    const presented = header.startsWith(prefix) ? header.slice(prefix.length) : "";
    if (!presented || !tokensEqual(presented, token)) {
      return c.json(
        { error: { code: "unauthorized", message: "Valid ingestion token required" } },
        401,
      );
    }
    return null;
  }

  // GET /api/bands?search=&limit=&cursor= — LIKE on name_norm (idx_bands_norm).
  // Cursor is the last-seen row id (`WHERE id > ? ORDER BY id`).
  app.get("/api/bands", async (c) => {
    const search = c.req.query("search") ?? "";
    const limit = parseLimit(c.req.query("limit"));
    const cursor = c.req.query("cursor") ?? "";
    const where: string[] = [];
    const vals: unknown[] = [];
    if (search) {
      where.push("name_norm LIKE (?) ESCAPE '\\'");
      vals.push(`%${escapeLike(normalizeName(search))}%`);
    }
    if (cursor) {
      where.push("id > ?");
      vals.push(cursor);
    }
    const rows = await c.env.DB.prepare(
      `SELECT * FROM bands${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY id LIMIT ${limit + 1}`,
    )
      .bind(...vals)
      .all<Record<string, unknown>>();
    const page = rows.results.slice(0, limit);
    const nextCursor = rows.results.length > limit ? String(page[page.length - 1].id) : null;
    return c.json({ data: page, nextCursor });
  });

  // GET /api/bands/:id — band + members + releases + media_links.
  app.get("/api/bands/:id", async (c) => {
    const id = c.req.param("id");
    const band = await c.env.DB.prepare("SELECT * FROM bands WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!band) {
      return c.json({ error: { code: "not_found", message: "Band not found" } }, 404);
    }
    const members = await c.env.DB.prepare(
      "SELECT m.*, bm.role, bm.joined_year, bm.left_year FROM members m JOIN band_members bm ON bm.member_id = m.id WHERE bm.band_id = ? ORDER BY m.id LIMIT 50",
    )
      .bind(id)
      .all<Record<string, unknown>>();
    const releases = await c.env.DB.prepare("SELECT * FROM releases WHERE band_id = ? ORDER BY id LIMIT 50")
      .bind(id)
      .all<Record<string, unknown>>();
    const media = await c.env.DB.prepare("SELECT * FROM media_links WHERE band_id = ? ORDER BY id LIMIT 50")
      .bind(id)
      .all<Record<string, unknown>>();
    return c.json({
      data: band,
      members: members.results,
      releases: releases.results,
      media_links: media.results,
    });
  });

  // GET /api/bands/:id/graph?depth=3 — multi-hop relationship tree as
  // { nodes: [{id,type,name}], edges: [{from,to,via}] }. One Recursive CTE
  // (SQLite, no graph DB): parameterized depth clamped to 1..4, path-string
  // cycle guard, LIMIT 500 to bound row-reads and the 10ms CPU budget.
  app.get("/api/bands/:id/graph", async (c) => {
    const id = c.req.param("id");
    const depth = parseDepth(c.req.query("depth"));
    const root = await c.env.DB.prepare("SELECT id, name FROM bands WHERE id = ?")
      .bind(id)
      .first<{ id: string; name: string }>();
    if (!root) {
      return c.json({ error: { code: "not_found", message: "Band not found" } }, 404);
    }
    const edgeRows = await c.env.DB.prepare(
      `WITH RECURSIVE tree(id, depth, path, from_id, via) AS (
        SELECT bm2.band_id, 1, '/' || b.id || '/' || bm2.band_id || '/', b.id, m.name
        FROM bands b
        JOIN band_members bm1 ON bm1.band_id = b.id
        JOIN members m ON m.id = bm1.member_id
        JOIN band_members bm2 ON bm2.member_id = m.id AND bm2.band_id <> b.id
        WHERE b.id = ?1
        UNION
        SELECT bm2.band_id, t.depth + 1, t.path || bm2.band_id || '/', t.id, m.name
        FROM tree t
        JOIN band_members bm1 ON bm1.band_id = t.id
        JOIN band_members bm2 ON bm2.member_id = bm1.member_id
          AND instr(t.path, '/' || bm2.band_id || '/') = 0
        JOIN members m ON m.id = bm1.member_id
        WHERE t.depth < ?2
      )
      SELECT from_id, id AS to_id, via, MIN(depth) AS depth
      FROM tree GROUP BY from_id, id, via LIMIT ${GRAPH_LIMIT}`,
    )
      .bind(id, depth)
      .all<{ from_id: string; to_id: string; via: string; depth: number }>();
    const depthById = new Map<string, number>([[root.id, 0]]);
    for (const row of edgeRows.results) {
      const prev = depthById.get(row.to_id);
      if (prev === undefined || row.depth < prev) depthById.set(row.to_id, row.depth);
    }
    const ids = [...depthById.keys()];
    const placeholders = ids.map(() => "?").join(", ");
    const nameRows = await c.env.DB.prepare(`SELECT id, name FROM bands WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all<{ id: string; name: string }>();
    const nameById = new Map(nameRows.results.map((r) => [r.id, r.name]));
    const nodes = [...depthById.entries()]
      .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
      .filter(([bandId]) => nameById.has(bandId))
      .map(([bandId]) => ({ id: bandId, type: "band", name: nameById.get(bandId) as string }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = edgeRows.results
      .filter((r) => nodeIds.has(r.from_id) && nodeIds.has(r.to_id))
      .map((r) => ({ from: r.from_id, to: r.to_id, via: r.via }))
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : a.via < b.via ? -1 : 1));
    return c.json({ nodes, edges });
  });

  // GET /api/members/:id — member + band history.
  app.get("/api/members/:id", async (c) => {
    const id = c.req.param("id");
    const member = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!member) {
      return c.json({ error: { code: "not_found", message: "Member not found" } }, 404);
    }
    const bands = await c.env.DB.prepare(
      "SELECT b.*, bm.role, bm.joined_year, bm.left_year FROM bands b JOIN band_members bm ON bm.band_id = b.id WHERE bm.member_id = ? ORDER BY b.id LIMIT 50",
    )
      .bind(id)
      .all<Record<string, unknown>>();
    return c.json({ data: member, bands: bands.results });
  });

  // GET /api/releases/:id — release + media_links.
  app.get("/api/releases/:id", async (c) => {
    const id = c.req.param("id");
    const release = await c.env.DB.prepare("SELECT * FROM releases WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!release) {
      return c.json({ error: { code: "not_found", message: "Release not found" } }, 404);
    }
    const media = await c.env.DB.prepare("SELECT * FROM media_links WHERE release_id = ? ORDER BY id LIMIT 50")
      .bind(id)
      .all<Record<string, unknown>>();
    return c.json({ data: release, media_links: media.results });
  });

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

  // POST /api/bands
  app.post("/api/bands", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok || typeof parsed.body.name !== "string" || !parsed.body.name.trim()) {
      return c.json({ error: { code: "invalid", message: "Field name is required" } }, 422);
    }
    const row = {
      id: crypto.randomUUID(),
      name: parsed.body.name.trim(),
      name_norm: normalizeName(parsed.body.name),
      formed_year: parsed.body.formed_year ?? null,
      disbanded_year: parsed.body.disbanded_year ?? null,
      location: parsed.body.location ?? null,
      bio: parsed.body.bio ?? null,
      photo_r2_key: parsed.body.photo_r2_key ?? null,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio, photo_r2_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.name, row.name_norm, row.formed_year, row.disbanded_year, row.location, row.bio, row.photo_r2_key)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Insert failed") } }, 422);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/bands/:id
  app.patch("/api/bands/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM bands WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Band not found" } }, 404);
    }
    const patch: Record<string, unknown> = {};
    if (parsed.body.name !== undefined) {
      if (typeof parsed.body.name !== "string" || !parsed.body.name.trim()) {
        return c.json({ error: { code: "invalid", message: "Field name must be a non-empty string" } }, 422);
      }
      patch.name = parsed.body.name.trim();
      patch.name_norm = normalizeName(parsed.body.name);
    }
    for (const key of ["formed_year", "disbanded_year", "location", "bio", "photo_r2_key"]) {
      if (parsed.body[key] !== undefined) patch[key] = parsed.body[key];
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    const sets = [...Object.keys(patch).map((k) => `${k} = ?`), "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"];
    try {
      await c.env.DB.prepare(`UPDATE bands SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Update failed") } }, 422);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM bands WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });

  // POST /api/members
  app.post("/api/members", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok || typeof parsed.body.name !== "string" || !parsed.body.name.trim()) {
      return c.json({ error: { code: "invalid", message: "Field name is required" } }, 422);
    }
    const row = {
      id: crypto.randomUUID(),
      name: parsed.body.name.trim(),
      name_norm: normalizeName(parsed.body.name),
      bio: parsed.body.bio ?? null,
    };
    try {
      await c.env.DB.prepare("INSERT INTO members (id, name, name_norm, bio) VALUES (?, ?, ?, ?)")
        .bind(row.id, row.name, row.name_norm, row.bio)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Insert failed") } }, 422);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/members/:id
  app.patch("/api/members/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Member not found" } }, 404);
    }
    const patch: Record<string, unknown> = {};
    if (parsed.body.name !== undefined) {
      if (typeof parsed.body.name !== "string" || !parsed.body.name.trim()) {
        return c.json({ error: { code: "invalid", message: "Field name must be a non-empty string" } }, 422);
      }
      patch.name = parsed.body.name.trim();
      patch.name_norm = normalizeName(parsed.body.name);
    }
    if (parsed.body.bio !== undefined) patch.bio = parsed.body.bio;
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    try {
      await c.env.DB.prepare(`UPDATE members SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Update failed") } }, 422);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });

  function invalidReleaseType(value: unknown): boolean {
    // DDL CHECK permits NULL, so a missing release_type is allowed; a present
    // value must be in the enum (issue #8: "validate release_type enum").
    if (value === undefined || value === null) return false;
    return !(typeof value === "string" && (RELEASE_TYPES as readonly string[]).includes(value));
  }

  // POST /api/releases
  app.post("/api/releases", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok || typeof parsed.body.band_id !== "string" || typeof parsed.body.title !== "string" || !parsed.body.title.trim()) {
      return c.json({ error: { code: "invalid", message: "Fields band_id and title are required" } }, 422);
    }
    if (invalidReleaseType(parsed.body.release_type)) {
      return c.json(
        { error: { code: "invalid", message: `release_type must be one of ${RELEASE_TYPES.join(", ")}` } },
        422,
      );
    }
    const row = {
      id: crypto.randomUUID(),
      band_id: parsed.body.band_id,
      title: parsed.body.title.trim(),
      release_type: parsed.body.release_type ?? null,
      release_year: parsed.body.release_year ?? null,
      cover_r2_key: parsed.body.cover_r2_key ?? null,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO releases (id, band_id, title, release_type, release_year, cover_r2_key) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.band_id, row.title, row.release_type, row.release_year, row.cover_r2_key)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Insert failed") } }, 422);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/releases/:id
  app.patch("/api/releases/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Release not found" } }, 404);
    }
    if (parsed.body.release_type !== undefined && invalidReleaseType(parsed.body.release_type)) {
      return c.json(
        { error: { code: "invalid", message: `release_type must be one of ${RELEASE_TYPES.join(", ")}` } },
        422,
      );
    }
    const patch: Record<string, unknown> = {};
    for (const key of ["band_id", "title", "release_type", "release_year", "cover_r2_key"]) {
      if (parsed.body[key] !== undefined) patch[key] = parsed.body[key];
    }
    if (typeof patch.title === "string") {
      if (!patch.title.trim()) {
        return c.json({ error: { code: "invalid", message: "Field title must be a non-empty string" } }, 422);
      }
      patch.title = patch.title.trim();
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    try {
      await c.env.DB.prepare(`UPDATE releases SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Update failed") } }, 422);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });

  function singleParentViolation(releaseId: unknown, bandId: unknown): boolean {
    // Exactly one parent required (mirrors the DDL CHECK at handler layer).
    const hasRelease = releaseId !== undefined && releaseId !== null;
    const hasBand = bandId !== undefined && bandId !== null;
    return hasRelease === hasBand;
  }

  // POST /api/media-links
  app.post("/api/media-links", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (
      !parsed.ok ||
      typeof parsed.body.provider !== "string" ||
      typeof parsed.body.url !== "string" ||
      !parsed.body.url.trim()
    ) {
      return c.json({ error: { code: "invalid", message: "Fields provider and url are required" } }, 422);
    }
    if (singleParentViolation(parsed.body.release_id, parsed.body.band_id)) {
      return c.json(
        { error: { code: "invalid", message: "Exactly one of release_id or band_id is required" } },
        422,
      );
    }
    const row = {
      id: crypto.randomUUID(),
      release_id: parsed.body.release_id ?? null,
      band_id: parsed.body.band_id ?? null,
      provider: parsed.body.provider,
      url: parsed.body.url.trim(),
      embed_url: parsed.body.embed_url ?? null,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO media_links (id, release_id, band_id, provider, url, embed_url) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.release_id, row.band_id, row.provider, row.url, row.embed_url)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Insert failed") } }, 422);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/media-links/:id — merges with the stored row before checking
  // the single-parent rule, so setting one parent while the other is stored
  // is still a 422 unless the stored one is cleared in the same patch.
  app.patch("/api/media-links/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM media_links WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Media link not found" } }, 404);
    }
    const mergedRelease = parsed.body.release_id !== undefined ? parsed.body.release_id : existing.release_id;
    const mergedBand = parsed.body.band_id !== undefined ? parsed.body.band_id : existing.band_id;
    if (singleParentViolation(mergedRelease, mergedBand)) {
      return c.json(
        { error: { code: "invalid", message: "Exactly one of release_id or band_id is required" } },
        422,
      );
    }
    const patch: Record<string, unknown> = {};
    for (const key of ["release_id", "band_id", "provider", "url", "embed_url"]) {
      if (parsed.body[key] !== undefined) patch[key] = parsed.body[key];
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    try {
      await c.env.DB.prepare(`UPDATE media_links SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      return c.json({ error: { code: "invalid", message: errMessage(err, "Update failed") } }, 422);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM media_links WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });

  // Uniform error shape for unknown routes: { "error": { "code", "message" } }.
  app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

  // Uniform error shape for thrown errors (Hono's default is plain-text 500).
  app.onError((err, c) => {
    const message = errMessage(err, "Internal server error");
    return c.json({ error: { code: "internal", message } }, 500);
  });

  return app;
}

const app = createApp();

export default app;
