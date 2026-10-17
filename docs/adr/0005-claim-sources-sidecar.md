# 0005: Claim-level sources sidecar

- Status: proposed
- Date: 2026-10-17

## Context

The content policy requires `source_url + accessed_at` on every factual
claim plus `confirmed` / `unconfirmed` / `disputed` statuses, with losing
rivals kept, never silently overwritten. The five content tables hold only
display values (name, role, years, bio), so none of that evidence had a home:
a NULL year could mean "unknown" or "forgot to source it", and a dispute had
nowhere to keep its loser.

## Decision

One `claim_sources` sidecar table keyed by `(entity_type, entity_id, field)`,
holding `value`, `status`, `tier` (1/2/3), `source_url`, `accessed_at`, and an
optional `note`. Display tables keep only winning values; NULL stays a visible
gap. `entity_id` is polymorphic across the five content tables, so there is
deliberately no FOREIGN KEY — writers must use a real row id. No second
database; this rides the same D1 store from ADR-0001.

## Consequences

Every content write also writes its source rows, or the field stays
`unconfirmed`. Reads that must show badges join on
`(entity_type, entity_id)` via `claim_sources_lookup`. Row-read cost is one
small bounded lookup per page, inside the free-tier budget. The Yaphet Kotto
lineup is the first seeded consumer and sets the row conventions (member +
role + joined/left years + source per row, blanks allowed).
