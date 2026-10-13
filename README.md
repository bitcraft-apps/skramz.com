# Skramz-Graph

Centralized encyclopedia, embedded audio streaming hub, and visual relationship mapper for the Screamo/Skramz DIY music scene — skramz.org.

## Stack ($0/month, all Cloudflare free tier)

- **Frontend:** Next.js (App Router) → Cloudflare Pages
- **Backend:** TypeScript Worker (Hono) + D1 (SQLite) → Cloudflare Workers
- **Media:** Cloudflare R2 (cover art, band photos)
- **State:** TanStack Query (server state) + Zustand (audio player, UI toggles). Redux forbidden.
- **Styling:** Tailwind CSS v4 — 90s DIY Zine Brutalism
- **Graph:** react-force-graph or Sigma.js (WebGL, 60fps)
- **Ingestion:** Go CLI (`cli-agent scrape "<Band>"` → R2 → JSON preview → `[Y/n]` → Worker API)

No VPS, no open ports, no Postgres: D1 speaks SQLite (recursive CTEs included).

## Dev

```bash
task dev          # API worker (wrangler) + web
task test         # vitest (api + web) + go test (cli-agent)
task migrate      # apply D1 migrations locally
```

See [AGENTS.md](AGENTS.md) for commands and conventions.

## Structure

```
web/          # Next.js frontend (Cloudflare Pages)
api/          # Hono/TS Worker + D1 migrations (Cloudflare Workers)
cli-agent/    # Go ingestion CLI (local tool: MusicBrainz/Discogs → R2 → API)
db/           # D1 seed data (migrations live in api/migrations/)
docs/plans/   # Architecture plans and agent-ready issue specs
```
