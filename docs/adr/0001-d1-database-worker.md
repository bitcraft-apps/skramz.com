# 0001: D1 database + single Worker

- Status: accepted
- Date: 2026-10-13 (issue #1)

## Context

Catalog API needs a free-tier store with relational joins and small,
`LIMIT`-bounded reads. Staging must not need a second environment.

## Decision

Single D1 database (`skramz`), one Worker. Staging rides the free
`workers.dev` preview URL. `GET /healthz` proves a live D1 round-trip
(`SELECT 1`), failures use `{error:{code,message}}`. Real IDs live in
GitHub secrets / `wrangler secret`, never in git.

## Consequences

Mechanics (bindings, migrations, local workflow) live in `infra/d1.md`.
Free-tier walls (100k req/day, 10ms CPU, 5M row-reads/day) bound every
query. No second database or environment without a new ADR.
