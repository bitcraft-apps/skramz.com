# Spec — Issue #6: Hono API skeleton (config, health, errors, scripts)

Source: https://github.com/bitcraft-apps/skramz.com/issues/6
(Hono API skeleton: config, health, errors, scripts — OPEN at time of work)

## Scope

Runnable Worker in `api/` (TS strict, Hono) with consistent config, errors,
and CI scripts. Gives every later backend issue a base to build on.

## Contract

1. **Env config** — `DB` D1 binding declared in `api/wrangler.toml`
   (`[[d1_databases]]`, `binding = "DB"`); `INGESTION_TOKEN` never in git:
   key-only placeholder in `.env.example`, runtime value via
   `wrangler secret` / GitHub secrets (see `infra/d1.md` "Secrets & rotation").
   No write routes in this issue, so the token is declared, not yet consumed.
2. **`GET /healthz`** — live D1 round-trip (`SELECT 1 AS ok`), responds
   `200 {"ok":true,"db":1}`; D1 failure responds
   `500 {"error":{"code":"d1_unavailable","message":...}}`.
3. **Uniform errors** — every error body is
   `{"error":{"code","message"}}`:
   - unknown routes → `404 not_found` (`app.notFound`),
   - thrown errors → `500 internal` (`app.onError`),
   - D1 failure on `/healthz` → `500 d1_unavailable` (handler try/catch).
4. **Scripts** (`api/package.json`) — `dev` (`wrangler dev` on :8787),
   `build` (`wrangler deploy --dry-run`), `typecheck` (`tsc --noEmit`),
   `test` (`vitest run`). CI (`api-ci` job) runs `pnpm typecheck` + `pnpm test`.
5. **FK/cascade gaps** — none left open for the skeleton: `infra/d1.md`
   records local-D1 enforcement proof; `api/test/migrations.test.ts`
   maintains it (cascade delete, single-parent CHECK, NOCASE unique,
   release_type CHECK). Skeleton adds no write paths, so no app-layer
   cascade logic is required.

## Acceptance criteria

- [x] `pnpm typecheck` and `pnpm test` pass (12 tests, incl. new onError test)
- [x] `pnpm build` (dry-run deploy) succeeds, shows DB + MEDIA bindings
- [x] `GET /healthz` returns 200 with D1 ok against local D1 (`task migrate` +
      `wrangler dev` + curl; see evidence)
- [x] Unknown route returns uniform 404 shape (live + unit)
- [x] Migrations/FK suite green — no cascade gap for skeleton to enforce
- [ ] `workers.dev` preview re-confirmation (needs deploy; out of scope locally)

## Touched files

- `api/src/index.ts` — `createApp()` factory, `onError` uniform-500 handler
- `api/package.json` — added `build` script
- `api/test/healthz.test.ts` — added thrown-error uniform-shape test
- `docs/specs/issue-6-skeleton.md` — this spec
