import type { App } from "../lib/http";
import { MAX_LIMIT, escapeLike, normalizeName, parseLimit } from "../lib/http";

type SearchCursor = {
  v: 1;
  q: string;
  band: string | null;
  member: string | null;
  release: string | null;
};

const b64enc = new TextEncoder();
const b64dec = new TextDecoder();

function encodeCursor(cursor: SearchCursor): string {
  const bytes = b64enc.encode(JSON.stringify(cursor));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(raw: string): SearchCursor | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed: unknown = JSON.parse(b64dec.decode(bytes));
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (p.v !== 1 || typeof p.q !== "string") return null;
    for (const k of ["band", "member", "release"] as const) {
      if (p[k] != null && typeof p[k] !== "string") return null;
    }
    return {
      v: 1,
      q: p.q,
      band: typeof p.band === "string" ? p.band : null,
      member: typeof p.member === "string" ? p.member : null,
      release: typeof p.release === "string" ? p.release : null,
    };
  } catch {
    return null;
  }
}

export function registerSearch(app: App): void {
  // GET /api/search?q=&limit=&cursor= — unified band/member/release hits.
  // Each type paginates independently (up to `limit` hits per type) with
  // positions tracked in an opaque composite cursor; a page is terminal
  // (nextCursor null) only when no table overflows its per-type limit.
  app.get("/api/search", async (c) => {
    const q = c.req.query("q") ?? "";
    if (!q.trim()) {
      return c.json({ error: { code: "missing_query", message: "Query param q is required" } }, 400);
    }
    const normQ = normalizeName(q);
    const rawCursor = c.req.query("cursor") ?? "";
    let pos: SearchCursor | null = null;
    if (rawCursor) {
      pos = decodeCursor(rawCursor);
      if (!pos) {
        return c.json({ error: { code: "invalid_cursor", message: "Cursor is malformed or tampered" } }, 400);
      }
      if (pos.q !== normQ) {
        return c.json({ error: { code: "invalid_cursor", message: "Cursor does not match query q" } }, 400);
      }
    }
    const perType = Math.min(parseLimit(c.req.query("limit")), MAX_LIMIT);
    // Exactly 3 D1 queries per page (free-tier bound), each LIMIT perType+1
    // so one overflow row marks a non-terminal page without a 4th query.
    async function fetchPage<T extends { id: string }>(
      whereSql: string,
      pattern: string,
      after: string | null,
    ): Promise<{ page: T[]; overflow: boolean; last: string | null }> {
      const rows = await c.env.DB.prepare(
        `${whereSql}${after ? " AND id > ?" : ""} ORDER BY id LIMIT ${perType + 1}`,
      )
        .bind(pattern, ...(after ? [after] : []))
        .all<T>();
      const page = rows.results.slice(0, perType);
      return {
        page,
        overflow: rows.results.length > perType,
        last: page.length > 0 ? String(page[page.length - 1].id) : after,
      };
    }
    const pattern = `%${escapeLike(normQ)}%`;
    const band = await fetchPage<{ id: string; name: string }>(
      `SELECT id, name AS name FROM bands WHERE name_norm LIKE (?) ESCAPE '\\'`,
      pattern,
      pos?.band ?? null,
    );
    const member = await fetchPage<{ id: string; name: string }>(
      `SELECT id, name AS name FROM members WHERE name_norm LIKE (?) ESCAPE '\\'`,
      pattern,
      pos?.member ?? null,
    );
    const release = await fetchPage<{ id: string; name: string; band_id: string }>(
      `SELECT id, title AS name, band_id FROM releases WHERE title LIKE (?) ESCAPE '\\'`,
      `%${escapeLike(q.trim())}%`,
      pos?.release ?? null,
    );
    const hits = [
      ...band.page.map((r) => ({ type: "band", ...r })),
      ...member.page.map((r) => ({ type: "member", ...r })),
      ...release.page.map((r) => ({ type: "release", ...r })),
    ];
    // An overflowing table always leaves a full page behind, so hits is
    // non-empty whenever hasMore is true — no extra guard needed.
    const hasMore = band.overflow || member.overflow || release.overflow;
    const nextCursor = hasMore
      ? encodeCursor({ v: 1, q: normQ, band: band.last, member: member.last, release: release.last })
      : null;
    return c.json({ hits, nextCursor });
  });
}
