# 0002: API route-module layout

- Status: accepted
- Date: 2026-10-14 (issue #32, follow-up from #7)

## Context

`api/src/index.ts` is 623 lines with 15 routes sharing one `createApp()`
body (as of #31). Every new endpoint lands in the same file.

## Decision

New endpoints go into route modules: `src/lib/db.ts` (D1 types +
`Bindings`), `src/lib/http.ts` (parsing, auth, envelopes), one
`registerX(app)` per resource under `src/routes/` (`bands`, `members`,
`releases`, `media-links`, `search`, `health`). `src/index.ts` stays thin
wiring and keeps both the `createApp()` named export and the default `app`
export, so the existing test imports (`api/test/*`, including the default
import in `healthz.test.ts`) keep working.

## Consequences

Splits must be behavior-preserving: full `api/` suite + typecheck green,
no route-shape changes. If the layout deviates from this proposal, update
this ADR in the same PR.
