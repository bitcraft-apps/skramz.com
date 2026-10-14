import type { Context, Hono } from "hono";
import type { Bindings } from "./db";

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

export function errMessage(err: unknown, fallback: string): string {
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
export function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// Timing-safe string compare for the ingestion Bearer [REDACTED]
export function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
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
  if (!presented || !tokensEqual(presented, token)) {
    return c.json(
      { error: { code: "unauthorized", message: "Valid ingestion token required" } },
      401,
    );
  }
  return null;
}
