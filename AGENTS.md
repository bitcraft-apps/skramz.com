# skramz.org — agent conventions

Cost rule: Cloudflare free tier only; no VPS, no paid services.

## Commands

```bash
task dev          # API worker (wrangler dev) + web
task dev:api      # Worker on :8787 (wrangler dev, D1 local)
task dev:web      # Vite on :5173
task test         # all tests
task test:api     # vitest in api/
task test:web     # vitest in web/
task test:cli     # go test in cli-agent/
task migrate      # apply D1 migrations locally
```

## Constraints (binding)

- Prefer minimal, pragmatic solutions; avoid over-engineering.
- D1 binding named `DB`; raw-SQL migrations in `api/migrations/`, keep SQL portable — no Postgres-isms. Free limits are hard walls: 100k req/day, 10ms CPU, 5M D1 row-reads/day.
- Vite SPA with layout persistence (uninterrupted audio). TanStack Query for server state, Zustand for client UI state only. No Redux.
- Tailwind CSS v4, 90s DIY Zine Brutalism.
- Graph via WebGL (react-force-graph or Sigma.js), 500-node cap.
- Relationships via `band_members` join table + Recursive CTEs (SQLite `WITH RECURSIVE`). No graph DB.
- CLI must push art to R2, print JSON preview, and require human `[Y/n]` before any API write. `--yes` is forbidden; non-TTY aborts.
- No PR/issue references in code, comments, or tests; use `git blame` for history.
- Architecture decisions live in `docs/adr/` (numbered MADR records) — read the relevant ADR before changing its area. No other spec/design docs (`docs/specs/`, `.sf/`, root `DESIGN.md`); keep transient specs inline in chat or the PR body.
