# skramz.com — agent conventions

Monorepo: `web/` (Next.js) + `api/` (Go) + `cli-agent/` (Go) + `db/` (SQL migrations), orchestrated via Taskfile. Cost rule: maximize Cloudflare + Hetzner free tiers; no new paid services.

## Commands

```bash
task dev          # DB + API + web
task dev:api      # Go API on :8080
task dev:web      # Next.js on :3000
task test         # all tests
task test:api     # go test ./...
task test:web     # frontend tests
task migrate      # apply migrations locally
```

## Constraints (binding)

- Next.js App Router with layout persistence (uninterrupted audio). TanStack Query for server state, Zustand for client UI state only. No Redux.
- Tailwind CSS v4, 90s DIY Zine Brutalism, lightweight DOM.
- Graph via WebGL (react-force-graph or Sigma.js), 60fps target.
- Postgres on Hetzner; relationships via `band_members` join table + Recursive CTEs. No graph DB.
- CLI must push art to R2, print JSON preview, and require human `[Y/n]` before any DB write.
- API exposed only via Cloudflare Tunnel; no public VPS ports.

## CI/CD

CI detects changed areas (`api/`, `web/`, `cli-agent/`, `db/`, `docs/`) and runs only relevant checks. Release-please manages `api`/`web` versions independently.
