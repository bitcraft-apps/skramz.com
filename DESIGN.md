# Design decisions

## Issue #1 — D1 database + wrangler project + local/dev workflow

- Single D1 database, one Worker; staging rides the free `workers.dev`
  preview URL (no second environment).
- `GET /healthz` proves a live D1 round-trip, not a static string;
  failures use the uniform shape `{error:{code,message}}`.
- Real IDs live in GitHub secrets / `wrangler secret` — never in git.
- Mechanics (bindings, migrations, local workflow): `infra/d1.md`.

## API route layout (issue #32, follow-up from #7)

- `api/src/index.ts` outgrew a single file (623 lines, 15 routes in one
  `createApp()` body as of #31). New endpoints go into route modules:
  `src/lib/db.ts` (D1 types + `Bindings`), `src/lib/http.ts` (parsing,
  auth, envelopes), one `registerX(app)` per resource under `src/routes/`
  (`bands`, `members`, `releases`, `media-links`, `search`, `health`).
- `src/index.ts` stays thin wiring and keeps exporting `createApp()` so
  the existing test imports keep working; splits must be
  behavior-preserving (full `api/` suite + typecheck green).
