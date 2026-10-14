# 0003: API error-message hygiene

- Status: proposed
- Date: 2026-10-14 (issue #36, closes #35, supersedes #27)

## Context

API is public and the repo is public. `INGESTION_TOKEN` Bearer on writes
is the entire write perimeter, so failure responses must not leak engine
internals (SQLite/D1 text, constraint names, table/column names) that aid
probing. Free-tier walls (ADR-0001) rule out a WAF; hygiene is code-level.

## Decision

Write failures map through `publicWriteError()` (`api/src/lib/http.ts`):
UNIQUE → 409 `conflict`, CHECK / FOREIGN KEY / NOT NULL → 422 `invalid`,
anything else → 422 `invalid` with an op-named fallback. Thrown errors use
`publicInternalError()` → 500 `internal` via `onError`; unknown routes 404
`not_found`; dead D1 500 `d1_unavailable`. Auth perimeter keeps its own
stable codes (`unauthorized` 401, `server_misconfigured` 500) and search
keeps `missing_query` 400. Every failure body is exactly
`{error:{code,message}}` with a stable code; raw `err.message` is only
`console.error`-logged server-side. Rate limiting stays a Cloudflare
dashboard rule on `/api/*` (no code). No CORS headers (safe default).

## Consequences

Clients can only match on stable codes, never engine substrings. Regression
cover lives in `api/test/crud.test.ts` (issue-#36 block). New failure modes
must add a mapping + test, not a new shape.

## Deployed rate-limit rule (2026-10-14)

Dashboard only, no code (`rg -i 'rate.?limit|throttl|429'` over `api/src`,
`api/test`, `api/migrations`, `api/wrangler.toml` returns zero matches).
Security → Rate limiting rules on zone `skramz.org`, rule `api-burst-guard`:
`(http.request.uri.path wildcard r"/api/*")`, per-IP, 100 requests / 10 s,
block with 429 for 60 s. Rule ID: _<paste from dashboard>_.
