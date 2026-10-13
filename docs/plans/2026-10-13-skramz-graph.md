# Skramz-Graph — Engineering Plan (Full Cloudflare, $0/month)

## Goal

Ship skramz.com: a cost-optimized encyclopedia + embedded-audio hub + visual relationship mapper for the Screamo/Skramz DIY scene, built as independent agent-executable issues. This plan is Part 1 (architecture) + Part 2 (agent-ready GitHub Issues) from the Principal Architect brief, revised to the Full-Cloudflare decision: Pages + Workers + D1 + R2, no VPS, no Postgres, no Tunnel. Go survives only as the local ingestion CLI.

## Success Criteria

- Public repo `bitcraft-apps/skramz.com` mirrors bitcraft-apps conventions (Taskfile, CI change-detection, release-please, AGENTS.md) — done in this bootstrap.
- Each Part 2 issue below is creatable as-is in GitHub and executable by one autonomous agent with no missing contract.
- A user can go band page → relationship graph (multi-hop) → persistent audio playback without navigation interrupting audio.
- Infra costs $0/month and every resource stays inside verified free limits (Workers 100k req/day + 10ms CPU; D1 5GB + 5M row-reads/100k row-writes per day; R2 10GB).

## Context And Current Facts

- Workspace root `/Users/sgraczyk/Projects/bitcraft-apps/skramz.com` was empty; parent holds `spec-first/` and `vestimia/`.
- `gh auth status`: logged in as sgraczyk (ssh, `repo` scope). Repo `bitcraft-apps/skramz.com` created public this session; bootstrap pushed to `main`.
- Template source: `vestimia/` (Taskfile orchestration, `.github` change-detection CI, release-please `api`/`web` packages) — replicated, then adapted from its Hetzner shape to Workers + D1.
- Architect Q&A this session: user asked whether the API could move to Cloudflare and whether Postgres is needed; free-tier limits verified via Cloudflare docs (see Sources); user selected **Full Cloudflare**. Prior stack mandates otherwise stand (App Router, TanStack Query + Zustand, Tailwind v4, WebGL graph, CLI `[Y/n]` gate).

## Constraints And Non-goals

- Binding: Cloudflare Pages (frontend), Workers + Hono (API), D1 bound as `DB` (SQLite), R2 (10GB art), join table + SQLite Recursive CTEs (no graph DB), TanStack Query + Zustand (Redux forbidden), Tailwind v4 DIY Zine Brutalism, WebGL graph with 500-node cap, CLI `[Y/n]` human gate, free-tier maximization.
- Free limits are hard walls (D1 fails closed past daily caps) — per-request row budgets stay tiny (indexed queries, `LIMIT 500`); growth path is Workers Paid ($5/mo), never a VPS.
- Non-goals: no production code in this plan (scaffold only); no audio file hosting (embeds only — R2 holds images, not audio); no auth/user accounts; no Postgres-isms in migrations (keep SQL portable for a possible return to Postgres).

## Key Decisions

- **Hono on Workers for the API.** Tiny bundle, fastest TS agent velocity; a raw fetch-handler is an acceptable fallback inside the skeleton issue. CPU waits on D1/R2 don't count toward the 10ms budget, so CRUD + small CTEs fit easily.
- **D1 over Postgres.** Catalog rows are tiny and art lives in R2; SQLite supports `WITH RECURSIVE` natively. The one deferred feature is `pg_trgm` fuzzy search — replaced by `LIKE` on a normalized column, acceptable at this scale.
- **Raw-SQL migrations in `api/migrations/` via wrangler; no ORM for schema.** Keeps every statement reviewable, portable, and the Postgres return path open.
- **TEXT ids generated in app (`crypto.randomUUID()`).** No DB-side uuid functions in SQLite.
- **One Worker, custom domain `api.skramz.com`; staging is the `workers.dev` preview URL.** No second environment to operate.
- **CLI stays Go.** It runs on a laptop (zero hosting cost); rewriting a good local scraper for purity would be waste.

## Recommended Approach — Part 1: System Architecture & Data Flow

### Infrastructure Map

```
Browser ──HTTPS──▶ Cloudflare Pages (Next.js, static + SSR)
   │                        │  NEXT_PUBLIC_API_URL=https://api.skramz.com
   │                        ▼
   │               api.skramz.com (Worker custom domain)
   │                        │  Hono + D1 binding `DB` + R2 binding (same account, no hop)
   │                        ▼
   └──────── R2 public hostname (cover art / photos, <img src>)
Scraper path: cli-agent (any laptop) ─▶ MusicBrainz/Discogs ─▶ R2 upload ─▶ JSON preview ─▶ [Y/n] ─▶ Worker POSTs (bearer INGESTION_TOKEN)
Local dev: `wrangler dev` (D1 local) + `pnpm dev` (web). No Docker, no Tunnel, no VPS.
```

There is nothing to expose and no server to patch: Pages serves the shell, the Worker serves the API on its custom domain, D1/R2 are bindings in the same account. Staging is the Worker's `workers.dev` preview URL against a Pages preview deploy.

### SQLite Schema (D1)

```sql
CREATE TABLE bands (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name_norm TEXT NOT NULL, -- lowercase, de-punctuated; LIKE-search target
  formed_year INTEGER, disbanded_year INTEGER,
  location TEXT, bio TEXT, photo_r2_key TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, name_norm TEXT NOT NULL, bio TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE band_members ( -- THE join table; every edge lives here
  id TEXT PRIMARY KEY,
  band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT, joined_year INTEGER, left_year INTEGER,
  UNIQUE (band_id, member_id, role, joined_year)
);
CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  release_type TEXT CHECK (release_type IN ('LP','EP','Split','Demo','Single','Compilation')),
  release_year INTEGER, cover_r2_key TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE media_links ( -- embedded streams only; exactly one parent
  id TEXT PRIMARY KEY,
  release_id TEXT REFERENCES releases(id) ON DELETE CASCADE,
  band_id TEXT REFERENCES bands(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, url TEXT NOT NULL, embed_url TEXT,
  CHECK ((release_id IS NULL) != (band_id IS NULL))
);
CREATE INDEX idx_band_members_band ON band_members(band_id);
CREATE INDEX idx_band_members_member ON band_members(member_id);
CREATE INDEX idx_releases_band ON releases(band_id);
CREATE INDEX idx_media_release ON media_links(release_id);
CREATE INDEX idx_media_band ON media_links(band_id);
CREATE INDEX idx_bands_norm ON bands(name_norm);
```

FK enforcement is connection-scoped in SQLite: the migrations issue must verify D1 behavior with a test and enforce cascades/single-parent in app code as well as DDL.

Recursive CTE — relationship tree for one band (SQLite dialect; cycle-safe via path string, 3 hops):

```sql
WITH RECURSIVE tree(id, depth, path, via) AS (
  SELECT bm2.band_id, 1, '/' || b.id || '/', m.name
  FROM bands b
  JOIN band_members bm1 ON bm1.band_id = b.id
  JOIN members m ON m.id = bm1.member_id
  JOIN band_members bm2 ON bm2.member_id = m.id AND bm2.band_id <> b.id
  WHERE b.id = ?1
  UNION
  SELECT bm2.band_id, t.depth + 1, t.path || n.id || '/', m.name
  FROM tree t
  JOIN band_members bm1 ON bm1.band_id = t.id
  JOIN band_members bm2 ON bm2.member_id = bm1.member_id
    AND instr(t.path, '/' || bm2.band_id || '/') = 0
  JOIN bands n ON n.id = bm2.band_id
  JOIN members m ON m.id = bm1.member_id
  WHERE t.depth < 3
)
SELECT id, MIN(depth) AS depth FROM tree GROUP BY id LIMIT 500;
```

Depth capped at 3–4 (`?2`, max 4); `LIMIT 500` bounds row-reads and the 10ms CPU budget.

### API Contract (Hono Worker, JSON REST, base `https://api.skramz.com`)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/healthz` | Deploy health (`SELECT 1` on D1) |
| GET | `/api/bands?search=` | Encyclopedia search (`LIKE` on `name_norm`) |
| GET | `/api/bands/:id` | Band + members + releases + media_links |
| GET | `/api/bands/:id/graph?depth=3` | Nodes/edges from the CTE above |
| GET | `/api/members/:id` | Member + band history |
| GET | `/api/releases/:id` | Release + media_links |
| GET | `/api/search?q=` | Unified band/member/release search |
| POST/PATCH | `/api/bands`, `/api/members`, `/api/releases`, `/api/media-links` | Writes (bearer `INGESTION_TOKEN`; used by CLI after `[Y/n]`) |

All list endpoints paginate (`?limit=&cursor=`); errors are `{ "error": { "code", "message" } }`.

### State Architecture

```
Worker API ──fetch──▶ TanStack Query (useBand, useBandGraph, useSearch; cache + dedupe + retries)
                              │
            ┌─────────────────┴──────────────────┐
            ▼                                    ▼
 WebGL Graph Component              Zustand audio-player store
 (reads useBandGraph data;               (current media_link,
  local zoom/filter toggles               queue, volume, play/pause —
  mirrored into Zustand)                  persists across route changes)
```

Server state never enters Zustand except UI mirrors (toggles, player queue). The audio element lives in the root layout so App Router navigations never unmount it; band/release pages only dispatch `play(media_link)` actions. `media_links.embed_url` drives the player source; R2 keys drive `<img>` art.

## Work Plan — Part 2: Agent-Ready GitHub Issues

Create in order; each issue is one agent's autonomous unit.

### Epic 1: Cloudflare Foundation

### [D1 database + wrangler project + local/dev workflow]
**Assignee Persona:** TypeScript Backend Agent (with DevOps support)
**Dependencies:** None
**Context:** D1 is the system's only database — this issue creates it and makes local development work without Docker or any server.
**Technical Implementation:** In `api/`, create the D1 database `skramz` (`wrangler d1 create`), write `wrangler.toml` with D1 binding `DB` and R2 binding `skramz-media`, wire `task dev:api` (`wrangler dev`, D1 local) and `task migrate` / `migrate:prod` (`d1 migrations apply DB --local` / `--remote`); document account/IDs/rotation in `infra/d1.md` (IDs as placeholders — real values via GitHub secrets).
**Acceptance Criteria:**
- [ ] `task dev:api` serves `GET /healthz` from local D1
- [ ] `task migrate` applies pending migrations to local D1 cleanly
- [ ] `infra/d1.md` documents database name, bindings, and secret handling

### [Worker custom domain api.skramz.com + staging URL]
**Assignee Persona:** DevOps Agent
**Dependencies:** D1/wrangler project issue
**Context:** The Worker needs a stable public hostname for the frontend; staging rides the free `workers.dev` preview so there is no second environment.
**Technical Implementation:** Deploy the skeleton Worker, attach custom domain `api.skramz.com` (zone route), confirm the `workers.dev` preview URL as the staging endpoint; store `CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID` as GitHub secrets; record both URLs in `infra/domains.md`.
**Acceptance Criteria:**
- [ ] `curl https://api.skramz.com/healthz` returns 200 from outside Cloudflare
- [ ] Staging `workers.dev` URL serves the same build
- [ ] `infra/domains.md` records prod + staging URLs

### [Cloudflare Pages project + preview deploys]
**Assignee Persona:** DevOps Agent (with Next.js Frontend Agent support)
**Dependencies:** None (parallel with D1 issue)
**Context:** The Next.js shell deploys to Pages free tier with preview URLs so frontend agents iterate safely.
**Technical Implementation:** Create Cloudflare Pages project `skramz-web` bound to `web/`, build `pnpm build`, env `NEXT_PUBLIC_API_URL=https://api.skramz.com`; wire Pages GitHub integration for `main` + PR previews; keep standard App Router build output. Record project settings in `infra/pages.md`.
**Acceptance Criteria:**
- [ ] Push to `main` deploys production; PRs get preview URLs
- [ ] Preview build log shows `NEXT_PUBLIC_API_URL` resolved
- [ ] `infra/pages.md` records project name, build cmd, env vars

### [R2 bucket + credentials + public art policy]
**Assignee Persona:** DevOps Agent
**Dependencies:** None (parallel with above)
**Context:** All cover art/band photos live in R2 so image bandwidth never touches compute.
**Technical Implementation:** Create R2 bucket `skramz-media` with public-read hostname for `<img>`, bind it to the Worker in `wrangler.toml`; issue least-privilege API token (write: bucket only) stored as `R2_*` GitHub secrets matching `.env.example`; define key convention `bands/<id>/<file>`, `releases/<id>/<file>` in `infra/r2.md`.
**Acceptance Criteria:**
- [ ] `PUT` with token uploads; public `GET` serves the object URL
- [ ] `infra/r2.md` documents bucket, binding, key convention, token scope
- [ ] `.env.example` R2 keys match the token names

### Epic 2: Worker API & D1 Schema

### [D1 migrations: bands/members/band_members/releases/media_links]
**Assignee Persona:** TypeScript Backend Agent
**Dependencies:** D1/wrangler project issue (needs local workflow), R2 key convention
**Context:** The five-table schema from Part 1 is the system's source of truth; every later issue migrates against it.
**Technical Implementation:** Write ordered SQL migrations in `api/migrations/` exactly per Part 1 DDL (NOCASE unique, `name_norm` columns, single-parent `CHECK`, six indexes); add a wrangler-local test proving double-parent `media_links` insert fails and proving whether `ON DELETE CASCADE` is enforced by D1 — if not, file the app-layer enforcement as a blocker note for the skeleton issue.
**Acceptance Criteria:**
- [ ] `task migrate` applies cleanly to fresh local D1
- [ ] Double-parent `media_links` insert fails (DDL or app test)
- [ ] All six indexes present; FK-cascade behavior documented with test proof

### [Hono API skeleton: config, health, errors, scripts]
**Assignee Persona:** TypeScript Backend Agent
**Dependencies:** D1 migrations issue
**Context:** Gives every backend issue a runnable Worker with consistent config, errors, and CI scripts.
**Technical Implementation:** In `api/` (TS strict, Hono), implement env config (`DB` binding, `INGESTION_TOKEN` via `wrangler secret`), `GET /healthz` (`SELECT 1` on D1), uniform `{ "error": { "code", "message" } }` errors, `package.json` scripts `dev` (wrangler dev), `build`, `typecheck` (`tsc --noEmit`), `test` (vitest); `pnpm typecheck` + `pnpm test` green and matching CI. Keep secrets out of git.
**Acceptance Criteria:**
- [ ] `pnpm typecheck` and `pnpm test` pass
- [ ] `GET /healthz` returns 200 with D1 ok (local + workers.dev preview)
- [ ] Enforces any FK/cascade gap left open by the migrations issue

### [Band graph endpoints + SQLite Recursive CTE]
**Assignee Persona:** TypeScript Backend Agent
**Dependencies:** API skeleton + migrations issues
**Context:** The relationship mapper's core — multi-hop band trees served as nodes/edges JSON within the 10ms CPU budget.
**Technical Implementation:** Implement `GET /api/bands/:id/graph?depth=3` using the Part 1 SQLite CTE (parameterized depth, max 4, path-string cycle guard, `LIMIT 500`) plus `GET /api/bands/:id` (band + members + releases + media_links); build the `via` member labels into edges; add tests with a 3-band shared-member fixture asserting hop depths.
**Acceptance Criteria:**
- [ ] Fixture: A–B share member, B–C share member → C appears at depth 2 from A
- [ ] `depth` > 4 is clamped; cyclic lineups terminate
- [ ] Response shape `{ nodes: [{id,type,name}], edges: [{from,to,via}] }`

### [CRUD endpoints + ingestion-token auth]
**Assignee Persona:** TypeScript Backend Agent
**Dependencies:** API skeleton + migrations issues
**Context:** Encyclopedia writes and the CLI's post-`[Y/n]` writes both flow through these authenticated endpoints.
**Technical Implementation:** `GET /api/bands?search=` (`LIKE` on `name_norm`), `GET /api/members/:id`, `GET /api/releases/:id`, `GET /api/search?q=` (paginated `limit`/`cursor`), `POST/PATCH /api/bands|members|releases|media-links` guarded by `Authorization: Bearer INGESTION_TOKEN` (timing-safe compare, 401 otherwise); validate `release_type` enum and single-parent rule at the handler layer too.
**Acceptance Criteria:**
- [ ] Unauthenticated POST returns 401; wrong token returns 401
- [ ] Invalid `release_type` returns 422 with error envelope
- [ ] Search returns band/member/release hits paginated

### Epic 3: CLI Ingestion Agent & R2 Integration (Go, local tool — unchanged)

### [CLI skeleton: scrape command + MusicBrainz/Discogs clients]
**Assignee Persona:** Data Agent (Go)
**Dependencies:** API skeleton issue (for contract types only — no writes yet)
**Context:** `cli-agent scrape "Saetia"` is how the catalog grows; this issue builds read-only fetching.
**Technical Implementation:** In `cli-agent/` (Go, stdlib HTTP + retry/backoff, 1 rps courtesy limit), implement `scrape "<Band>"` hitting MusicBrainz (release-groups + artist-rels for members) and Discogs (images, year, label); normalize to the Part 1 structs (TEXT ids via `crypto.randomUUID`-equivalent `google/uuid`, `name_norm` computed); `--json` prints the normalized preview and exits. Respect `User-Agent` and rate limits. No write code in this issue.
**Acceptance Criteria:**
- [ ] `go run ./cmd/cli-agent scrape "Saetia" --json` prints valid JSON with band, members, releases
- [ ] HTTP 429 triggers backoff + retry, not crash
- [ ] `go vet ./...` and `go test ./...` pass in `cli-agent/`

### [R2 uploader + JSON preview + [Y/n] gate + Worker writer]
**Assignee Persona:** Data Agent (Go)
**Dependencies:** CLI skeleton + R2 bucket + CRUD endpoints issues
**Context:** The money-safety issue: art goes to R2, a human approves the exact payload, only then does anything touch D1 (via the Worker).
**Technical Implementation:** Add `PutObject` upload of cover art/photos to R2 key convention (content-hash filenames, skip-if-exists), print the full structured JSON preview, prompt `[Y/n]` (default No; `--yes` flag forbidden; non-TTY aborts), then write via authenticated Worker `POST` endpoints (local `wrangler dev` URL or prod domain) only. Log every write with returned IDs. Never write on `n`/EOF/timeout.
**Acceptance Criteria:**
- [ ] Answering `n` uploads nothing to R2 and writes nothing via the API (verified by test)
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
**Dependencies:** Scaffold + Worker custom-domain issues
**Context:** Enforces the strict state split so server data and client UI never tangle.
**Technical Implementation:** Configure QueryClient (staleTime, retries, `NEXT_PUBLIC_API_URL` = Worker domain) with hooks `useBand`, `useBandGraph`, `useSearch`; Zustand stores `usePlayerStore` (queue, current, volume) and `useGraphUIStore` (depth, toggles) only; add an ESLint/CI guard failing on `redux`/`react-redux` imports; unit-test the player store transitions.
**Acceptance Criteria:**
- [ ] No `redux` dependency in `web/package.json`; CI guard present
- [ ] Hooks hit the Worker base URL with dedupe (two mounts → one request in test)
- [ ] Player store play/pause/volume/queue transitions unit-tested

### [Encyclopedia pages: band / member / release views]
**Assignee Persona:** Next.js Frontend Agent
**Dependencies:** State client + CRUD endpoints issues
**Context:** The readable half of the product — fast server-fed pages for every catalog entity.
**Technical Implementation:** Routes `/bands/[id]`, `/members/[id]`, `/releases/[id]` + search page, all fed by the Query hooks with loading/error/empty states, R2 art via `next/image` (dithered class), links into the graph view; keep per-page JS minimal (no graph lib on these routes).
**Acceptance Criteria:**
- [ ] Each route renders from live Worker data with loading + error states
- [ ] R2 images load via the public hostname with the dither filter class
- [ ] Search navigates to entity pages

### Epic 5: Graph & Audio UI

### [WebGL graph component wired to graph endpoint]
**Assignee Persona:** Next.js Frontend Agent
**Dependencies:** Encyclopedia pages + band-graph endpoint issues
**Context:** The visual mapper — 60fps relationship rendering of the CTE result.
**Technical Implementation:** `GraphView` component dynamically imported (SSR off) using react-force-graph-2D (fallback to Sigma.js only with measured jank evidence), fed by `useBandGraph(id, depth)`; node click navigates to entity, depth control + relation-type toggles via `useGraphUIStore`; cap at 500 nodes, show empty-state under 2 nodes.
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
**Technical Implementation:** Seed script (`db/seeds/001_saetia.sql`, idempotent inserts) creating a 3-band shared-member fixture with releases + media_links, applied via wrangler to staging D1; Playwright smoke: search → band page → graph renders edges → press play → assert player state + persistence across navigation, running on Pages preview against the `workers.dev` staging Worker. Document run in `docs/e2e.md`.
**Acceptance Criteria:**
- [ ] Seed applies idempotently on fresh + existing D1
- [ ] E2E passes on Pages preview against staging Worker
- [ ] `docs/e2e.md` records seed + smoke commands and expected evidence

## Validation Plan

- Bootstrap: `git status` clean after push; repo visible at `github.com/bitcraft-apps/skramz.com` (public); CI runs (and skips correctly) on first PR.
- Per-issue: the issue's own Acceptance Criteria are the gate — agents run the listed commands and paste evidence in the PR.
- Highest-risk step: D1 semantics (FK enforcement) + free-limit walls — verified in the D1-foundation and migrations issues before any integration issue starts.
- System: seed + E2E issue is the release gate (search → graph → uninterrupted playback on preview deploys).

## Risks / Rollback

- D1 fails closed past daily caps → mitigate with tiny per-request row budgets (indexed queries, depth clamp, `LIMIT 500`) and the usage dashboard; growth path is Workers Paid ($5/mo), never a server.
- D1 per-database storage headroom → art lives in R2 and rows are tiny; years of headroom at scene scale.
- MusicBrainz/Discogs rate limits or ToS friction → CLI already backs off; fallback is manual JSON seeding (seed-data issue path).
- Graph perf vs 10ms CPU → depth clamp + node cap; Sigma.js fallback pre-approved.
- Rollback: Pages instant-rollback, `wrangler rollback` for the Worker, D1 Time Travel / down-migrations for data. No data-loss operations outside the `[Y/n]`-gated CLI.

## Open Questions

- Cloudflare account ownership for Pages/Worker/D1/R2 and the `skramz.com` zone? (Default: bitcraft-apps account.)
- Discogs API token availability for the CLI? (Default: MusicBrainz-only until token exists.)
- Canonical audio embed providers (Bandcamp? YouTube?) for `media_links.provider` values? (Default: free-text provider + `embed_url`; enumerate later.)
- Staging: `workers.dev` preview only, or a second custom subdomain later? (Default: preview URL only.)
- D1 backups: rely on Time Travel or add a periodic `d1 export`? (Default: Time Travel; decide in the E2E issue.)

## Sources

- [Hono](https://hono.dev/) — Web-Standards framework running on Workers, with bearer-auth middleware (inspected 2026-10-13)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) — 100k req/day, 10ms CPU, 128MB (inspected 2026-10-13)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) — 5GB storage, 5M rows read / 100k written per day (via official-docs excerpts inspected 2026-10-13)
