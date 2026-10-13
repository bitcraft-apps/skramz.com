# Skramz-Graph — Engineering Plan

## Goal

Ship skramz.com: a cost-optimized encyclopedia + embedded-audio hub + visual relationship mapper for the Screamo/Skramz DIY scene, built as independent agent-executable issues. This plan is Part 1 (architecture) + Part 2 (agent-ready GitHub Issues) from the Principal Architect brief.

## Success Criteria

- Public repo `bitcraft-apps/skramz.com` mirrors bitcraft-apps conventions (Taskfile, CI change-detection, release-please, AGENTS.md) — done in this bootstrap.
- Each Part 2 issue below is creatable as-is in GitHub and executable by one autonomous agent with no missing contract.
- A user can go band page → relationship graph (multi-hop) → persistent audio playback without navigation interrupting audio.
- Total infra stays on free tiers + one Hetzner VPS; no open VPS ports.

## Context And Current Facts

- Workspace root `/Users/sgraczyk/Projects/bitcraft-apps/skramz.com` was empty; parent holds `spec-first/` and `vestimia/`.
- `gh auth status`: logged in as sgraczyk (ssh, `repo` scope). Org `bitcraft-apps` exists; repo `skramz.com` did not exist and has now been created public.
- Template source: `vestimia/` (Go + Postgres on Hetzner, web on Cloudflare, Taskfile orchestration, `.github` change-detection CI, release-please `api`/`web` packages). This repo replicates that shape adapted to Next.js → Cloudflare Pages, Go API + Postgres on Hetzner, R2 media, Tunnel networking.
- Stack is user-mandated (Next.js App Router, TanStack Query + Zustand, Tailwind v4, WebGL graph, Go API, Postgres + CTEs, Go CLI with R2 + `[Y/n]` gate). These are constraints, not recommendations — no external comparison needed.

## Constraints And Non-goals

- Binding: Cloudflare Pages (frontend), R2 (10GB art), Hetzner VPS (Go + Postgres), Cloudflare Tunnel only (no public VPS ports), join table + Recursive CTEs (no graph DB), TanStack Query + Zustand (Redux forbidden), Tailwind v4 DIY Zine Brutalism, WebGL graph, CLI `[Y/n]` human gate before DB writes, 2026 stack, free-tier maximization.
- Non-goals: no production code in this plan (scaffold only); no audio file hosting (embedded streams only — R2 holds images, not audio); no auth/user accounts; no migration off Postgres.

## Key Decisions

- **Go router: Fiber.** Matches brief's option, fastest agent velocity (built-in validation, error handling); stdlib remains an acceptable fallback inside Issue 5 if the agent justifies it.
- **Graph lib: react-force-graph (2D) default, Sigma.js fallback.** react-force-graph has the simplest Next.js dynamic-import story and suffices for 60fps node rendering at scene scale; Issue 13 lets the agent switch to Sigma.js on measured jank with evidence.
- **No graph DB.** Shared-member edges are a textbook join-table traversal; Recursive CTEs to depth 3–4 on indexed FKs satisfy the query load without operating a second database.
- **Tunnel over open ports / reverse proxy.** Zero Trust Tunnel keeps a single egress-only connection from Hetzner; Pages hits the public Tunnel hostname. No firewall rules to manage.
- **R2 for images only.** Covers bandwidth (the actual cost driver for cover art); audio stays embedded (Bandcamp/YouTube) to avoid licensing and egress liability.

## Recommended Approach — Part 1: System Architecture & Data Flow

### Infrastructure Map

```
Browser ──HTTPS──▶ Cloudflare Pages (Next.js, static + SSR)
   │                        │  NEXT_PUBLIC_API_URL=https://api.skramz.com
   │                        ▼
   │               Cloudflare Edge ──Tunnel──▶ cloudflared (Hetzner VPS) ─▶ Go API :8080
   │                                                                              │ ▲
   └──────── R2 public bucket (cover art / photos, <img src>)                      │ │ single egress conn
                                                                        Postgres :5432 (localhost-only)
Scraper path: cli-agent (any machine) ─▶ MusicBrainz/Discogs APIs ─▶ R2 upload ─▶ JSON preview ─▶ [Y/n] ─▶ Go API or direct Postgres write
```

Pages serves the shell; the API is never publicly dialable — all ingress arrives via the Tunnel hostname. R2 assets are referenced by key (`cover_r2_key`) and rendered through the public R2 hostname so image bandwidth never touches Hetzner. Local dev mirrors prod with `docker compose` Postgres.

### PostgreSQL Schema

```sql
CREATE TABLE bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name CITEXT UNIQUE NOT NULL,
  formed_year INT, disbanded_year INT,
  location TEXT, bio TEXT, photo_r2_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, bio TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE band_members ( -- THE join table; every edge lives here
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT, joined_year INT, left_year INT,
  UNIQUE (band_id, member_id, role, joined_year)
);
CREATE TABLE releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL, release_type TEXT CHECK (release_type IN ('LP','EP','Split','Demo','Single','Compilation')),
  release_year INT, cover_r2_key TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE media_links ( -- embedded streams only; exactly one parent
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, url TEXT NOT NULL, embed_url TEXT,
  CHECK (num_nonnulls(release_id, band_id) = 1)
);
CREATE INDEX idx_band_members_band ON band_members(band_id);
CREATE INDEX idx_band_members_member ON band_members(member_id);
CREATE INDEX idx_releases_band ON releases(band_id);
CREATE INDEX idx_media_release ON media_links(release_id);
CREATE INDEX idx_media_band ON media_links(band_id);
CREATE INDEX idx_bands_name ON bands(name);
```

Recursive CTE — relationship tree for one band (bands linked by shared members, 3 hops):

```sql
WITH RECURSIVE tree AS (
  SELECT bm2.band_id AS id, 1 AS depth,
         ARRAY[b.id] AS path, m.name AS via
  FROM bands b
  JOIN band_members bm1 ON bm1.band_id = b.id
  JOIN members m ON m.id = bm1.member_id
  JOIN band_members bm2 ON bm2.member_id = m.id AND bm2.band_id <> b.id
  WHERE b.id = $1
  UNION
  SELECT bm2.band_id, t.depth + 1, t.path || n.id, m.name
  FROM tree t
  JOIN band_members bm1 ON bm1.band_id = t.id
  JOIN band_members bm2 ON bm2.member_id = bm1.member_id AND bm2.band_id <> ALL (t.path)
  JOIN bands n ON n.id = bm2.band_id
  JOIN members m ON m.id = bm1.member_id
  WHERE t.depth < 3
) SELECT DISTINCT id, min(depth) AS depth FROM tree GROUP BY id;
```

Cycle-safe via `path` array; cap depth at 3–4; paginate or limit nodes for large scenes.

### API Contract (Go, JSON REST)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/healthz` | Tunnel + deploy health |
| GET | `/api/bands?search=` | Encyclopedia search |
| GET | `/api/bands/:id` | Band + members + releases + media_links |
| GET | `/api/bands/:id/graph?depth=3` | Nodes/edges from the CTE above |
| GET | `/api/members/:id` | Member + band history |
| GET | `/api/releases/:id` | Release + media_links |
| GET | `/api/search?q=` | Unified band/member/release search |
| POST/PATCH | `/api/bands`, `/api/members`, `/api/releases`, `/api/media-links` | Writes (ingestion-token auth; used by CLI after `[Y/n]`) |

All list endpoints paginate (`?limit=&cursor=`); errors are `{ "error": { "code", "message" } }`.

### State Architecture

```
Go API ──fetch──▶ TanStack Query (useBand, useBandGraph, useSearch; cache + dedupe + retries)
                              │
            ┌─────────────────┴──────────────────┐
            ▼                                    ▼
 WebGL Graph Component              Zustand audio-player store
 (reads useBandGraph data;               (current media_link,
  local zoom/filter toggles               queue, volume, play/pause —
  mirrored into Zustand)                  persists across route changes)
```

Server state never enters Zustand except UI mirrors (toggles, player queue). The audio `<audio>`/embed element lives in the root layout so App Router navigations never unmount it; band/release pages only dispatch `play(media_link)` actions. `Media_Links.embed_url` drives the player source; R2 keys drive `<img>` art.

## Work Plan — Part 2: Agent-Ready GitHub Issues

Create in order; each issue is one agent's autonomous unit. Numbers below are creation order (`#1` = first created).

### Epic 1: Infrastructure & Cloudflare Setup

### [Hetzner VPS baseline + Postgres 16 + Cloudflare Tunnel]
**Assignee Persona:** DevOps Agent
**Dependencies:** None
**Context:** The Go API and Postgres live on one Hetzner VPS, reachable only via Tunnel — this is the security and cost foundation everything else builds on.
**Technical Implementation:** Provision Hetzner VPS (smallest CX22-class), install Docker + Postgres 16 (compose from repo root), install `cloudflared`, create Zero Trust Tunnel `skramz-api`, route `api.skramz.com` to `localhost:8080`; store `TUNNEL_TOKEN` as a GitHub secret and document rotation in `infra/README.md`. No open inbound ports (verify with `ss -lnt`).
**Acceptance Criteria:**
- [ ] `curl https://api.skramz.com/healthz` returns 200 from outside the VPS
- [ ] `ss -lnt` on VPS shows no public listener for 8080/5432
- [ ] `infra/README.md` documents Tunnel setup + token rotation

### [Cloudflare Pages project + preview deploys]
**Assignee Persona:** DevOps Agent (with Next.js Frontend Agent support)
**Dependencies:** None (parallel with Hetzner issue)
**Context:** The Next.js shell must deploy to Pages free tier with preview URLs so frontend agents iterate safely.
**Technical Implementation:** Create Cloudflare Pages project `skramz-web` bound to `web/`, build `pnpm build`, env `NEXT_PUBLIC_API_URL=https://api.skramz.com`; wire Pages GitHub integration for `main` + PR previews; keep standard App Router build output. Record project settings in `infra/pages.md`.
**Acceptance Criteria:**
- [ ] Push to `main` deploys production; PRs get preview URLs
- [ ] Preview build log shows `NEXT_PUBLIC_API_URL` resolved
- [ ] `infra/pages.md` records project name, build cmd, env vars

### [R2 bucket + credentials + public art policy]
**Assignee Persona:** DevOps Agent
**Dependencies:** None (parallel with above)
**Context:** All cover art/band photos live in R2 so image bandwidth never touches Hetzner.
**Technical Implementation:** Create R2 bucket `skramz-media`, public-read dev prefix + custom hostname for `<img>`; issue least-privilege API token (write: bucket only) stored as `R2_*` GitHub secrets and `.env.example` keys; define key convention `bands/<id>/<file>`, `releases/<id>/<file>` in `infra/r2.md`.
**Acceptance Criteria:**
- [ ] `PUT` with token uploads; public `GET` serves the object URL
- [ ] `infra/r2.md` documents bucket, key convention, token scope
- [ ] `.env.example` R2 keys match the token names

### Epic 2: Database & Backend Core

### [DB migrations: bands/members/band_members/releases/media_links]
**Assignee Persona:** Golang Backend Agent
**Dependencies:** Hetzner VPS issue (needs target env), R2 key convention
**Context:** The five-table schema from Part 1 is the system's source of truth; every later issue migrates against it.
**Technical Implementation:** Write ordered SQL migrations in `db/migrations/` exactly per Part 1 DDL (CITEXT, FK cascades, `num_nonnulls` check, six indexes); add `db/migrate.sh` runnable via `task migrate`; include down-migrations and a seed-smoke test (`go test` or shell) asserting the `media_links` check rejects double-parent rows.
**Acceptance Criteria:**
- [ ] `task migrate` applies cleanly to empty local Postgres
- [ ] Double-parent `media_links` insert fails with check violation
- [ ] All six indexes present in `\di` output

### [Go API skeleton: router, config, health, Docker]
**Assignee Persona:** Golang Backend Agent
**Dependencies:** DB migrations issue
**Context:** Gives every backend issue a runnable server behind the Tunnel with consistent config/errors.
**Technical Implementation:** In `api/` (Go 1.22+, Fiber), implement env config (`DATABASE_URL`, `API_PORT`, `INGESTION_TOKEN`), `GET /healthz` (checks DB ping), uniform `{ "error": { "code", "message" } }` errors, `Dockerfile`, `go vet` + `go test ./...` green; wire `task dev:api` / `task build:api`. Keep `api/.env` out of git.
**Acceptance Criteria:**
- [ ] `go vet ./...` and `go test ./...` pass
- [ ] `GET /healthz` returns 200 with DB ok
- [ ] Dockerfile builds and serves on `$API_PORT`

### [Band graph endpoints + Recursive CTE queries]
**Assignee Persona:** Golang Backend Agent
**Dependencies:** API skeleton + migrations issues
**Context:** The relationship mapper's core — multi-hop band trees served as nodes/edges JSON.
**Technical Implementation:** Implement `GET /api/bands/:id/graph?depth=3` using the Part 1 CTE (parameterized depth, max 4, cycle-safe `path`, `LIMIT 500` nodes) plus `GET /api/bands/:id` (band + members + releases + media_links); add query-level tests with a 3-band shared-member fixture asserting hop depths.
**Acceptance Criteria:**
- [ ] Fixture: A–B share member, B–C share member → C appears at depth 2 from A
- [ ] `depth` > 4 is clamped; cyclic lineups terminate
- [ ] Response shape `{ nodes: [{id,type,name}], edges: [{from,to,via}] }`

### [CRUD endpoints + ingestion-token auth]
**Assignee Persona:** Golang Backend Agent
**Dependencies:** API skeleton + migrations issues
**Context:** Encyclopedia writes and the CLI's post-`[Y/n]` writes both flow through these authenticated endpoints.
**Technical Implementation:** `GET /api/bands?search=`, `GET /api/members/:id`, `GET /api/releases/:id`, `GET /api/search?q=` (paginated `limit`/`cursor`), `POST/PATCH /api/bands|members|releases|media-links` guarded by `Authorization: Bearer $INGESTION_TOKEN` (constant-time compare, 401 otherwise); validate `release_type` enum and single-parent rule at the handler layer too.
**Acceptance Criteria:**
- [ ] Unauthenticated POST returns 401; wrong token returns 401
- [ ] Invalid `release_type` returns 422 with error envelope
- [ ] Search returns band/member/release hits paginated

### Epic 3: CLI Ingestion Agent & R2 Integration

### [CLI skeleton: scrape command + MusicBrainz/Discogs clients]
**Assignee Persona:** Data Agent (Go)
**Dependencies:** API skeleton issue (for contract types only — no DB writes yet)
**Context:** `cli-agent scrape "Saetia"` is how the catalog grows; this issue builds read-only fetching.
**Technical Implementation:** In `cli-agent/` (Go, stdlib HTTP + retry/backoff, 1 rps courtesy limit), implement `scrape "<Band>"` hitting MusicBrainz (release-groups + artist-rels for members) and Discogs (images, year, label); normalize to the Part 1 structs; `--json` prints the normalized preview and exits. Respect `User-Agent` and rate limits. No DB code in this issue.
**Acceptance Criteria:**
- [ ] `go run ./cmd/cli-agent scrape "Saetia" --json` prints valid JSON with band, members, releases
- [ ] HTTP 429 triggers backoff + retry, not crash
- [ ] `go vet ./...` and `go test ./...` pass in `cli-agent/`

### [R2 uploader + JSON preview + [Y/n] gate + DB writer]
**Assignee Persona:** Data Agent (Go)
**Dependencies:** CLI skeleton + R2 bucket + CRUD endpoints issues
**Context:** The money-safety issue: art goes to R2, a human approves the exact payload, only then does anything touch Postgres.
**Technical Implementation:** Add `PutObject` upload of cover art/photos to R2 key convention (content-hash filenames, skip-if-exists), print the full structured JSON preview, prompt `[Y/n]` (default No; `--yes` forbidden; non-TTY aborts), then write via authenticated `POST` endpoints only. Log every write with returned IDs. Never write on `n`/EOF/timeout.
**Acceptance Criteria:**
- [ ] Answering `n` uploads nothing to R2 and writes nothing to DB (verified by test)
- [ ] Answering `Y` uploads art then creates rows; IDs logged
- [ ] Non-TTY stdin aborts before any network write

### Epic 4: Frontend Foundation

### [Next.js App Router scaffold + Zine design system + layout persistence]
**Assignee Persona:** Next.js Frontend Agent
**Dependencies:** Pages project issue
**Context:** The shell every page inherits: App Router, brutalist system, and a root layout that never unmounts the player.
**Technical Implementation:** Scaffold `web/` (Next.js 14+ App Router, TS, Tailwind v4): root `layout.tsx` holding the persistent player slot + nav, monospace + B&W + neon-accent tokens, sharp corners, halftone/dither image utility class, lightweight DOM budget (no heavy per-page libs); `pnpm lint` + `pnpm build` green; deploy preview works.
**Acceptance Criteria:**
- [ ] Navigating between two routes does not remount the player slot (React key/effect test or manual proof)
- [ ] `pnpm lint` and `pnpm build` pass
- [ ] Design tokens documented in `web/DESIGN.md` (fonts, colors, corner radius = 0)

### [TanStack Query client + Zustand stores (no Redux)]
**Assignee Persona:** Next.js Frontend Agent
**Dependencies:** Scaffold + CRUD endpoints issues
**Context:** Enforces the strict state split so server data and client UI never tangle.
**Technical Implementation:** Configure QueryClient (staleTime, retries, `NEXT_PUBLIC_API_URL` base) with hooks `useBand`, `useBandGraph`, `useSearch`; Zustand stores `usePlayerStore` (queue, current, volume) and `useGraphUIStore` (depth, toggles) only; add an ESLint/CI guard failing on `redux`/`react-redux` imports; unit-test the player store transitions.
**Acceptance Criteria:**
- [ ] No `redux` dependency in `web/package.json`; CI guard present
- [ ] Hooks hit the real API base URL with dedupe (two mounts → one request in test)
- [ ] Player store play/pause/volume/queue transitions unit-tested

### [Encyclopedia pages: band / member / release views]
**Assignee Persona:** Next.js Frontend Agent
**Dependencies:** State client + CRUD endpoints issues
**Context:** The readable half of the product — fast server-fed pages for every catalog entity.
**Technical Implementation:** Routes `/bands/[id]`, `/members/[id]`, `/releases/[id]` + search page, all fed by the Query hooks with loading/error/empty states, R2 art via `next/image` (dithered class), links into the graph view; keep per-page JS minimal (no graph lib on these routes).
**Acceptance Criteria:**
- [ ] Each route renders from live API data with loading + error states
- [ ] R2 images load via the public hostname with the dither filter class
- [ ] Search navigates to entity pages

### Epic 5: Graph & Audio UI

### [WebGL graph component wired to graph endpoint]
**Assignee Persona:** Next.js Frontend Agent
**Dependencies:** Encyclopedia pages + band-graph endpoint issues
**Context:** The visual mapper — 60fps relationship rendering of the CTE result.
**Technical Implementation:** `GraphView` component dynamically imported (SSR off) using react-force-graph-2D (fallback to Sigma.js only with measured jank evidence), fed by `useBandGraph(id, depth)`; node click navigates to entity, depth control + relation-type toggles via `useGraphUIStore`; virtualize/cap at 500 nodes, show empty-state under 2 nodes.
**Acceptance Criteria:**
- [ ] Renders the 3-band fixture graph with correct edges + via-labels
- [ ] Depth control refetches and re-renders without full-page reload
- [ ] No SSR crash (`dynamic(ssr:false)`), 500-node cap enforced

### [Persistent audio player + Media_Links integration]
**Assignee Persona:** Next.js Frontend Agent
**Dependencies:** State client + encyclopedia pages issues
**Context:** Uninterrupted playback is the headline UX — the player must survive navigation.
**Technical Implementation:** Player UI in root layout bound to `usePlayerStore`; band/release pages dispatch `play(media_link)` from `media_links.embed_url`; queue next/prev, volume persistence (localStorage), embed fallback link when no `embed_url`; never fetch audio bytes (embeds only).
**Acceptance Criteria:**
- [ ] Starting playback then navigating routes keeps audio playing
- [ ] Queue next/prev + volume survive reload (persisted)
- [ ] Release with zero links shows graceful empty state, no crash

### [Seed data + E2E smoke: search → graph → player]
**Assignee Persona:** Full-stack QA Agent
**Dependencies:** All issues above
**Context:** Proves the whole chain works end-to-end on one canonical band before launch.
**Technical Implementation:** Seed script (`db/seeds/001_saetia.sql` or CLI-driven) creating a 3-band shared-member fixture with releases + media_links; Playwright/Cypress smoke: search → band page → graph renders edges → press play → assert player state + persistence across navigation. Document run in `docs/e2e.md`.
**Acceptance Criteria:**
- [ ] Seed applies idempotently on fresh + existing DB
- [ ] E2E passes on Pages preview against Tunneled staging API
- [ ] `docs/e2e.md` records seed + smoke commands and expected evidence

## Validation Plan

- Bootstrap: `git status` clean after push; repo visible at `github.com/bitcraft-apps/skramz.com` (public); CI runs (and skips correctly) on first PR.
- Per-issue: the issue's own Acceptance Criteria are the gate — agents run the listed commands and paste evidence in the PR.
- System: seed + E2E issue is the release gate (search → graph → uninterrupted playback on a preview deploy).
- Highest-risk step: Tunnel + Pages wiring (Issues 1–2) — if `api.skramz.com` is unreachable from Pages, every downstream integration stalls; verify first.

## Risks / Rollback

- Tunnel misconfiguration blocks all API integration → mitigate by shipping Issues 1–3 first and verifying `curl` evidence before backend/frontend integration issues start.
- MusicBrainz/Discogs rate limits or ToS friction → CLI already backs off; fallback is manual JSON seeding (Issue 15 path).
- Graph perf on large scenes → 500-node cap + depth clamp; Sigma.js fallback pre-approved.
- Rollback: each epic merges independently; Pages instant-rollback + `db/migrate.sh` down-migrations cover retreat. No data-loss operations outside the `[Y/n]`-gated CLI.

## Open Questions

- Hetzner project/account + `HETZNER_HOST` value for deploy tasks? (Default: smallest VPS; confirm before Issue 1.)
- Cloudflare account ownership for Pages/R2/Tunnel hostnames (`api.skramz.com`, R2 public host)? (Default: bitcraft-apps account.)
- Discogs API token availability for the CLI? (Default: MusicBrainz-only until token exists.)
- Canonical audio embed providers (Bandcamp? YouTube?) for `media_links.provider` values? (Default: free-text provider + `embed_url`; enumerate later.)
- Staging vs prod split (one VPS + two Tunnel hostnames, or two VPSes)? (Default: one VPS, `api-staging.skramz.com` + `api.skramz.com`.)

