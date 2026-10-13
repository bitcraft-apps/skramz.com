# Design decisions

## Issue #1 — D1 database + wrangler project + local/dev workflow

- Single D1 database, one Worker; staging rides the free `workers.dev`
  preview URL (no second environment).
- `GET /healthz` proves a live D1 round-trip, not a static string;
  failures use the uniform shape `{error:{code,message}}`.
- Real IDs live in GitHub secrets / `wrangler secret` — never in git.
- Mechanics (bindings, migrations, local workflow): `infra/d1.md`.
