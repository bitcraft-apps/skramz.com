import type { App } from "../lib/http";
import { NOW_SQL, publicWriteError, readBody, requireAuth, touchBands, touchUpdatedAt } from "../lib/http";
import type { D1Database } from "../lib/db";

// A media link belongs to exactly one parent; resolve the owning band so
// writes refresh its updated_at freshness badge.
async function owningBandId(
  db: D1Database,
  releaseId: unknown,
  bandId: unknown,
): Promise<string | null> {
  if (typeof bandId === "string" && bandId) return bandId;
  if (typeof releaseId === "string" && releaseId) {
    const release = await db
      .prepare("SELECT band_id FROM releases WHERE id = ?")
      .bind(releaseId)
      .first<Record<string, unknown>>();
    if (typeof release?.band_id === "string") return release.band_id;
  }
  return null;
}

function singleParentViolation(releaseId: unknown, bandId: unknown): boolean {
  // Exactly one parent required (mirrors the DDL CHECK at handler layer).
  const hasRelease = releaseId !== undefined && releaseId !== null;
  const hasBand = bandId !== undefined && bandId !== null;
  return hasRelease === hasBand;
}

export function registerMediaLinks(app: App): void {
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
        `INSERT INTO media_links (id, release_id, band_id, provider, url, embed_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ${NOW_SQL})`,
      )
        .bind(row.id, row.release_id, row.band_id, row.provider, row.url, row.embed_url)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "insert");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    const owner = await owningBandId(c.env.DB, row.release_id, row.band_id);
    if (owner) await touchUpdatedAt(c.env.DB, "bands", owner);
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
      await c.env.DB.prepare(
        `UPDATE media_links SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")}, updated_at = ${NOW_SQL} WHERE id = ?`,
      )
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "update");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM media_links WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    const ownerIds: string[] = [];
    for (const pair of [
      [existing.release_id, existing.band_id],
      [updated?.release_id, updated?.band_id],
    ] as const) {
      const owner = await owningBandId(c.env.DB, pair[0], pair[1]);
      if (owner) ownerIds.push(owner);
    }
    await touchBands(c.env.DB, ownerIds);
    return c.json({ data: updated });
  });
}
