# Manual end-to-end verification — issue #1

Prerequisite: fresh clone + `pnpm install` from `api/`.

## AC1 — `task dev:api` serves `GET /healthz` from local D1

1. `task dev:api` (starts `wrangler dev` on :8787 with local D1).
2. `curl localhost:8787/healthz`
3. Expect HTTP 200 `{"ok":true,"db":1}` — a live D1 round-trip
   (`SELECT 1`), not a static string.

## AC2 — migrations apply cleanly

1. `task migrate` (runs `wrangler d1 migrations apply DB --local`
   from `api/`).
2. Expect `0001_init.sql` applied; re-run reports no migrations to apply.
3. `task migrate:prod` is explicit-only (`--remote`, same
   `api/migrations/` directory).

## AC3 — infra doc

1. Open `infra/d1.md`; confirm database name, bindings table
   (`DB` → `skramz`, `MEDIA` → `skramz-media`), local workflow, and
   secrets/rotation via GitHub secrets / `wrangler secret` with
   placeholder IDs (no real values in git).

## Gates

- `cd api && pnpm typecheck` clean; `pnpm test` 3/3 pass.
