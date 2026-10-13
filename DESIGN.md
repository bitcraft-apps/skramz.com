# Design decisions

## Issue #1 — D1 database + wrangler project + local/dev workflow

- Single D1 database `skramz`, bound as `DB`; R2 bucket `skramz-media`
  bound as `MEDIA` (hyphens are invalid in binding names).
- Hono Worker (`api/src/index.ts`); `GET /healthz` proves a live D1
  round-trip (`SELECT 1 AS ok` → `{"ok":true,"db":1}`); failures return the
  uniform shape `{error:{code,message}}` (`d1_unavailable`/500,
  `not_found`/404).
- Raw portable SQLite migrations in `api/migrations/` (bootstrap
  `0001_init.sql`); applied via `task migrate` (local) /
  `task migrate:prod` (remote, explicit-only).
- Local-first dev: `task dev:api` (`wrangler dev`, local D1, :8787); no
  Docker/server. Real IDs via GitHub secrets / `wrangler secret` only —
  `api/wrangler.toml` keeps a placeholder `database_id`.
- Staging rides the free `workers.dev` preview URL (`workers_dev = true`);
  one Worker, no second environment.
