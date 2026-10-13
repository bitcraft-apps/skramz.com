# Skramz-Graph

Centralized encyclopedia, embedded audio streaming hub, and visual relationship mapper for the Screamo/Skramz DIY music scene — skramz.com.

## Stack

- **Frontend:** Next.js (App Router) → Cloudflare Pages
- **Backend:** Go (Fiber or stdlib net/http) → Hetzner VPS
- **DB:** PostgreSQL → Hetzner VPS (join table + Recursive CTEs, no graph DB)
- **Media:** Cloudflare R2 (cover art, band photos)
- **Networking:** Cloudflare Tunnel (Zero Trust) — no open VPS ports
- **State:** TanStack Query (server state) + Zustand (audio player, UI toggles). Redux forbidden.
- **Styling:** Tailwind CSS v4 — 90s DIY Zine Brutalism
- **Graph:** react-force-graph or Sigma.js (WebGL, 60fps)
- **Ingestion:** Go CLI (`cli-agent scrape "<Band>"` → R2 → JSON preview → `[Y/n]` → Postgres)

## Dev

```bash
task dev          # start DB, API, and web
task test         # run Go + frontend tests
task migrate      # apply SQL migrations locally
```

See [AGENTS.md](AGENTS.md) for commands and conventions.

## Structure

```
web/          # Next.js frontend (Cloudflare Pages)
api/          # Go API (Hetzner)
cli-agent/    # Go ingestion CLI (MusicBrainz/Discogs → R2 → Postgres)
db/           # SQL migrations
docs/plans/   # Architecture plans and agent-ready issue specs
```
