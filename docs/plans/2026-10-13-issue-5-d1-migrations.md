# Issue #5 — D1 Migrations: bands / members / band_members / releases / media_links

- **Issue:** [bitcraft-apps/skramz.com#5](https://github.com/bitcraft-apps/skramz.com/issues/5) — OPEN, `D1 migrations: bands/members/band_members/releases/media_links`
- **Epic:** Epic 2: Worker API & D1 Schema
- **Persona:** TypeScript Backend Agent
- **Status:** Spec — ready for implementation
- **Source of truth:** `docs/plans/2026-10-13-skramz-graph.md` § SQLite Schema (D1), lines 56–101
- **Method note:** This doc follows the repo's existing convention — `docs/plans/` holds "Architecture plans and agent-ready issue specs" (per `README.md`), date-prefixed kebab-case, Markdown with `##` sections.

## Scope

Deliver the five-table D1 schema as an ordered, portable SQLite migration plus wrangler-local proof that the schema's two load-bearing invariants hold (or are honestly reported as D1 gaps):

1. `media_links` accepts exactly one parent (`release_id` XOR `band_id`).
2. The actual `ON DELETE CASCADE` behaviour of local D1 is observed, evidenced by a test, and documented.

In scope:

- One new migration file `api/migrations/0002_<five-tables>.sql` (see § Design → Branch & migration numbering).
- The five tables `bands`, `members`, `band_members`, `releases`, `media_links` exactly per Part 1 DDL.
- Exactly six named indexes (see § Data contracts).
- A wrangler-local / vitest test under `api/test/` proving double-parent rejection and cascade behaviour, plus index presence.
- Documentation of FK-cascade behaviour (test output quoted) and — if D1 does not enforce cascades — a filed blocker note for the skeleton issue (#6).
- Fresh-local-D1 evidence: `task migrate` applies cleanly to a fresh local database.

Out of scope is listed explicitly in § Out of scope — do not expand the change beyond it.

## Acceptance criteria (from #5, verbatim)

- [ ] `task migrate` applies cleanly to fresh local D1
- [ ] Double-parent `media_links` insert fails (DDL or app test)
- [ ] All six indexes present; FK-cascade behavior documented with test proof

These three lines are the ship gate. Each maps to at least one named test in § Test plan; a criterion is only "met" with the listed evidence pasted in the PR (command output, not a checkbox alone).

## Context and dependencies

- **Depends on #1** (`D1 database + wrangler project + local/dev workflow`): needs `wrangler.toml` (D1 binding `DB`, `database_name = skramz`, `migrations_dir = migrations`), `api/package.json` (hono / vitest / wrangler, `dev`/`build`/`typecheck`/`test` scripts), and `api/migrations/0001_init.sql` (bootstrap `_health` table only; its header already defers the five tables to this issue).
- **Depends on #4** (R2 key convention, still OPEN) only for column-name consistency: the DDL's `photo_r2_key` / `cover_r2_key` already encode `bands/<id>/<file>`, `releases/<id>/<file>`; this issue performs no R2 runtime work.
- **Ground rules (binding, from `AGENTS.md`):** D1 binding named `DB`; raw-SQL migrations in `api/migrations/`, portable SQLite (no Postgres-isms); `band_members` join table + `WITH RECURSIVE` (no graph DB); free-tier walls (100k req/day, 10ms CPU, 5M D1 row-reads/day).

## Design

### Branch and migration numbering (branch plan)

**Do not branch from `main`.** `main` is scaffold-only (`api/.gitkeep`, `web/.gitkeep`, `db/.gitkeep`); it has no `wrangler.toml`, `package.json`, or `0001_init.sql`, so `task migrate` cannot run there. Branching from `main` would duplicate the #1 scaffold and collide on migration numbering.

Recommended sequence (either is acceptable; the first is smaller):

1. Branch `agent/issue-5` **from `agent/issue-1`** (4 commits ahead of `main`, carries the full local D1 workflow this issue explicitly depends on), **or**
2. Merge / rebase `agent/issue-1` to `main` first, then branch `agent/issue-5` from `main`.

Either way the new migration is named **`api/migrations/0002_<five-tables>.sql`** — ordered after `0001_init.sql`, single-purpose, portable SQLite. Suggested description segment: `0002_five_tables.sql`. Never renumber or edit `0001_init.sql`; already-applied migrations are immutable.

### Migration content

Single ordered file, `CREATE TABLE` in dependency order (`bands`, `members` → `band_members` → `releases` → `media_links`), then the six indexes. Copy the Part 1 DDL **verbatim** (see § Data contracts for the exact statements). Exactness is load-bearing, not cosmetic: downstream #7 CTE and #8 `LIKE`-on-`name_norm` queries depend on the column names, the `COLLATE NOCASE` uniqueness, and the index names.

### Test harness

- Test lives under `api/test/` (e.g. `api/test/migrations.test.ts`) and runs in the existing harness: `pnpm test` → `vitest run` (`api/vitest.config.ts`, `environment: node`, `include: test/**/*.test.ts`), so `task test:api` and `api-ci` pick it up with no config change.
- It must run against a **wrangler-local / local-D1-like SQLite** (the issue asks for a "wrangler-local test"), not a hand-rolled mock: the point is to observe real SQLite/D1 constraint and cascade semantics. Seed only the fixture rows the assertions need (band + release + media_link / band_member).
- Order of proof: apply migrations to the scratch DB first, then run the assertions against that database. A test that re-implements the DDL in memory instead of applying `0002_*.sql` proves the wrong artifact.

### FK-cascade discovery and the blocker-note contract

SQLite enforces foreign keys **per connection** (`PRAGMA foreign_keys`); whether D1 turns that on is an empirical question, not an assumption (plan line 101: "the migrations issue must verify D1 behavior with a test and enforce cascades/single-parent in app code as well as DDL"). The cascade test must therefore:

- Delete a parent (`bands` row) with child rows (`band_members`, `releases`, `media_links`) and assert whether the children disappeared.
- Record the observed result verbatim in the PR / doc note — including the failing output if cascades are **not** enforced.
- If cascades are not enforced: file a blocker note for the skeleton issue (#6, whose AC already reads "Enforces any FK/cascade gap left open by the migrations issue") stating that app-layer code must delete children explicitly, and that `media_links` single-parent must also be re-checked at the handler layer (as #8 already specifies). This issue does **not** implement that app-layer enforcement itself.

Do not "fix" a cascade failure by weakening the DDL (dropping `ON DELETE CASCADE`); the DDL stays as specified and the gap, if any, is reported.

## Data contracts

### Tables (Part 1 DDL, verbatim — do not paraphrase)

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
```

Exactness notes (all verified against the plan):

- `bands.name` is `TEXT UNIQUE NOT NULL COLLATE NOCASE` — case-insensitive name uniqueness is a contract: `Saetia` vs `saetia` must not both insert.
- `name_norm` exists on `bands` and `members` and is `NOT NULL`; it is the `LIKE` search target (#8), so no renaming, no making it nullable.
- `releases.release_type` enum is exactly `LP, EP, Split, Demo, Single, Compilation`.
- `media_links` single-parent `CHECK ((release_id IS NULL) != (band_id IS NULL))` rejects **both** parents **and** neither parent. The test plan covers both; do not relax it to cover only the both-parents case.
- IDs are `TEXT` (generated in app via `crypto.randomUUID()`); no DB-side uuid functions in SQLite.
- FK columns on `band_members`, `releases`, `media_links` carry `ON DELETE CASCADE` as written, regardless of the observed D1 behaviour.

### Indexes (exactly six, exact names)

| Index | Definition |
|---|---|
| `idx_band_members_band` | `CREATE INDEX idx_band_members_band ON band_members(band_id);` |
| `idx_band_members_member` | `CREATE INDEX idx_band_members_member ON band_members(member_id);` |
| `idx_releases_band` | `CREATE INDEX idx_releases_band ON releases(band_id);` |
| `idx_media_release` | `CREATE INDEX idx_media_release ON media_links(release_id);` |
| `idx_media_band` | `CREATE INDEX idx_media_band ON media_links(band_id);` |
| `idx_bands_norm` | `CREATE INDEX idx_bands_norm ON bands(name_norm);` |

Presence is proven by querying `sqlite_master` (`type='index'`) on the migrated database and comparing the name set — not by grepping the migration file.

### API contracts

This issue changes no HTTP surface. It only freezes the data contracts the API consumers rely on:

- `GET /api/bands/:id/graph?depth=3` (#7) walks `band_members(band_id, member_id)` via `WITH RECURSIVE` — served by `idx_band_members_band` / `idx_band_members_member`.
- `GET /api/bands?search=` (#8) runs `LIKE` on `bands.name_norm` — served by `idx_bands_norm`.
- Writes (#8) re-validate `release_type` and single-parent at the handler layer; the DDL `CHECK`s here are the first line of defence, not the only one.

## Test plan

All tests are wrangler-local / vitest under `api/test/` and run via `task test:api` (`pnpm test`). Quote real output in the PR.

| # | Test | Pass condition |
|---|---|---|
| T1 | Fresh apply: reset local D1 state, run `task migrate` | Exit 0, no SQL errors; all five tables in `sqlite_master`. "Fresh" means a reset/cleared local DB — re-applying onto an already-migrated DB (idempotent no-op) does not satisfy this. |
| T2 | Double-parent: insert `media_links` with both `release_id` and `band_id` set | Insert fails (constraint error). |
| T3 | Neither-parent: insert `media_links` with both parents `NULL` | Insert fails (same `CHECK`); guards against narrowing the constraint to both-parents-only. |
| T4 | Single-parent happy paths: `release_id`-only and `band_id`-only inserts | Both succeed — the `CHECK` must not over-reject valid rows. |
| T5 | Index presence: select index names from `sqlite_master` | Exactly the six names in § Data contracts are present. |
| T6 | Cascade behaviour: delete a band with `band_members` / `releases` / `media_links` children; count children after | Children are gone (D1 enforces cascade) **or** the test records non-enforcement and the #6 blocker note is filed; either way the observed output is pasted in the PR. |
| T7 | Uniqueness/enum guards (exactness smoke): duplicate band name with different case; `release_type = '7inch'` | Duplicate insert fails (`COLLATE NOCASE` unique); bad enum fails the `CHECK`. |
| T8 | Regression: existing `api/test/healthz.test.ts` still passes | `pnpm test` fully green. |

## Out of scope

- Hono skeleton, `/healthz`, error envelope, `package.json` scripts beyond what #1 already provides — that is #6.
- Graph CTE endpoint (#7) and CRUD/search endpoints (#8) — this spec only freezes the columns/indexes they consume.
- App-layer FK/cascade enforcement, if D1 proves not to enforce it — filed here as a blocker note, implemented in #6.
- Seed data (`db/seeds/`, #16) and any R2 runtime/credentials work (#4) — only the `*_r2_key` column names are fixed here.
- Migrations to production (`task migrate:prod`) and any DDL beyond the five tables + six indexes above; no edits to `0001_init.sql`.
- `web/` and `cli-agent/` — downstream consumers, no changes in this issue.

## Risks / rollback

- **#1 closed in GitHub but unmerged** (no PR for `agent/issue-1`): branching off `main` duplicates the scaffold and risks a `0001_init.sql` collision — mitigated by the branch plan above. Confirm the base branch in the PR description before writing SQL.
- **D1 may silently ignore `ON DELETE CASCADE`:** SQLite FK enforcement is connection-scoped. The test must prove the behaviour either way; an assumed-pass is a spec failure.
- **Hand-rolled test doubles mask real semantics:** the test must apply the real `0002_*.sql` to a local SQLite/D1, not re-type the DDL in TypeScript.
- **Rollback:** D1 Time Travel / down-migration for data; the migration file itself is a single ordered unit — reverting the branch removes it cleanly since no later issue has migrated against it yet.

## Open questions

- Exact migration filename segment (`0002_five_tables.sql` proposed) — cosmetic, but fix it before the PR so later migrations stay readable.
- Where the FK-cascade finding is recorded for #6: a comment on #6, a section in `infra/d1.md`, or an appendix here? (Default: short note in the PR + a line appended to `infra/d1.md`, which #1 already owns.)

## Sources

- GitHub issue #5 (verified via `gh issue view 5`), `docs/plans/2026-10-13-skramz-graph.md` (Part 1 DDL, lines 56–101), `AGENTS.md`, `Taskfile.yml` (`migrate` = `pnpm exec wrangler d1 migrations apply DB --local`), branch `agent/issue-1` (`api/wrangler.toml`, `api/migrations/0001_init.sql`, `api/test/healthz.test.ts`, `infra/d1.md`).
