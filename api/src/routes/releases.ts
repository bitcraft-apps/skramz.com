import type { Hono } from "hono";
import type { Bindings } from "../lib/db";
import { RELEASE_TYPES, errMessage, readBody, requireAuth } from "../lib/http";

function invalidReleaseType(value: unknown): boolean {
  // DDL CHECK permits NULL, so a missing release_type is allowed; a present
  // value must be in the enum (issue #8: "validate release_type enum").
  if (value === undefined || value === null) return false;
  return !(typeof value === "string" && (RELEASE_TYPES as readonly string[]).includes(value));
}

export function registerReleases(app: Hono<{ Bindings: Bindings }>): void {
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
}
