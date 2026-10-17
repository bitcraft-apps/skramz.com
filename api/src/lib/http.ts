import type { Context, Hono } from "hono";
import type { Bindings, D1Database } from "./db";

export type App = Hono<{ Bindings: Bindings }>;

type AppContext = Context<{ Bindings: Bindings }>;

export const RELEASE_TYPES = ["LP", "EP", "Split", "Demo", "Single", "Compilation"] as const;

export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

export const DEFAULT_GRAPH_DEPTH = 3;
export const MAX_GRAPH_DEPTH = 4;
export const GRAPH_LIMIT = 500;

export function parseDepth(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return DEFAULT_GRAPH_DEPTH;
  return Math.min(Math.max(n, 1), MAX_GRAPH_DEPTH);
}

// Map raw SQLite/D1 engine errors to stable public responses.
// Never returns engine text; callers log the raw error server-side.
export function publicWriteError(
  err: unknown,
  op: "insert" | "update",
): { status: 409 | 422; code: string; message: string } {
  console.error(op === "insert" ? "Insert failed" : "Update failed", err);
  const raw = err instanceof Error ? err.message : (err as { message?: unknown } | null)?.message ?? err;
  const msg = String(raw ?? "");
  if (/unique constraint/i.test(msg)) {
    return { status: 409, code: "conflict", message: "Resource already exists" };
  }
  if (/check constraint/i.test(msg)) {
    return { status: 422, code: "invalid", message: "Value violates a database check" };
  }
  if (/foreign key/i.test(msg)) {
    return { status: 422, code: "invalid", message: "Referenced record does not exist" };
  }
  if (/not null/i.test(msg)) {
    return { status: 422, code: "invalid", message: "A required field is missing" };
  }
  return {
    status: 422,
    code: "invalid",
    message: op === "insert" ? "Insert failed" : "Update failed",
  };
}

export function publicInternalError(): { status: 500; code: string; message: string } {
  return { status: 500, code: "internal", message: "Internal server error" };
}

export function publicD1Unavailable(): { status: 500; code: string; message: string } {
  return { status: 500, code: "d1_unavailable", message: "D1 unavailable" };
}

// Freshness timestamp shared by every explicit writer: SQLite forbids
// expression defaults in ADD COLUMN on non-empty tables, so routes set
// updated_at in SQL instead of relying on a column DEFAULT.
export const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

// Freshness: a child write refreshes its owner's updated_at so a band page
// answers "how fresh is this" from one field. Best-effort by design — the
// write is the contract, the touch only feeds the badge — so a touch failure
// logs server-side and never fails the request. Table is a closed union, so
// the interpolated name cannot carry client input.
export async function fetchClaimSources(
  db: D1Database,
  refs: { entity_type: string; entity_id: string }[],
): Promise<Record<string, unknown>[]> {
  // One bounded query per entity type; callers pass only server-side type
  // literals, never client input. Empty in, empty out — no query at all.
  const byType = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref.entity_id) continue;
    const ids = byType.get(ref.entity_type) ?? [];
    if (!ids.includes(ref.entity_id)) ids.push(ref.entity_id);
    byType.set(ref.entity_type, ids);
  }
  const batches = [...byType].map(([type, ids]) => {
    if (ids.length === 0) return Promise.resolve([] as Record<string, unknown>[]);
    const placeholders = ids.map(() => "?").join(", ");
    return db
      .prepare(`SELECT * FROM claim_sources WHERE entity_type = ? AND entity_id IN (${placeholders}) ORDER BY entity_id, field`)
      .bind(type, ...ids)
      .all<Record<string, unknown>>()
      .then((rows) => rows.results);
  });
  const groups = await Promise.all(batches);
  return groups.flat();
}

export async function touchUpdatedAt(
  db: D1Database,
  table: "bands" | "members",
  id: string,
): Promise<void> {
  try {
    await db
      .prepare(`UPDATE ${table} SET updated_at = ${NOW_SQL} WHERE id = ?`)
      .bind(id)
      .run();
  } catch (err) {
    console.error(`Touch ${table} failed`, err);
  }
}

// Refresh owning bands after a child write that can move parents (release or
// media-link PATCH). Filters non-ids, dedupes, then reuses the best-effort
// touch so the badge never fails the write.
export async function touchBands(db: D1Database, ids: readonly unknown[]): Promise<void> {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    await touchUpdatedAt(db, "bands", id);
  }
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
export function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// Timing-safe string compare for the ingestion Bearer [REDACTED] Both sides
// are hashed to a fixed-length SHA-256 digest before comparing, so rejection
// cost does not depend on the presented token's length (no early length
// return). Async: crypto.subtle is Workers-safe.
const enc = new TextEncoder();

export async function tokensEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const xa = new Uint8Array(da);
  const xb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) {
    diff |= xa[i] ^ xb[i];
  }
  return diff === 0;
}

export function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export async function readBody(c: AppContext): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false }> {
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

// Writes require `Authorization: Bearer <INGESTION_TOKEN>` (timing-safe
// compare, 401 otherwise). Token comes from `wrangler secret` — never git.
export async function requireAuth(c: AppContext): Promise<Response | null> {
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
  if (!presented || !(await tokensEqual(presented, token))) {
    return c.json(
      { error: { code: "unauthorized", message: "Valid ingestion token required" } },
      401,
    );
  }
  return null;
}
