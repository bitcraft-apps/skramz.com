# 0006: Evidence reader labels

- Status: proposed
- Date: 2026-10-17

## Context

ADR-0005 put claim evidence in a sidecar with `confirmed` / `unconfirmed` /
`disputed` statuses and tier 1/2/3. The web layer rendered those internals
verbatim: `UNCONFIRMED BAND_MEMBER · ROLE: BASS`, `rival: ~1997`, a `record
notes` ledger. Readers see database vocabulary, not an explanation. Worse, the
tier framing reads as a trust rank where community (T3) evidence is
second-class — but for underground hardcore, fan wikis, Discogs, and forums
are often all that exists, so "T3 never confirms" would leave pages
permanently gappy and dismiss the only people doing the documenting.

## Decision

Relabel the serving layer only. API statuses, tier definitions, the
T3-never-overrides rule, NULL-gap honesty, and the confirmation bar in the
content policy all stay exactly as they are.

- Plain language: `unconfirmed` → `not yet confirmed`, `disputed` →
  `sources disagree`, `rival: X` → `also reported as X`,
  `record notes` → `how we know this`, `last reviewed unknown` →
  `not yet reviewed`. Source links read `source: {domain}`
  (`source: discogs`) instead of a repeated bare `source`.
- Field sentences: never render `entity_type` / `field` identifiers. A small
  client-side map (`formed_year` → `formed`, `membership` → `member`, …,
  fallback `field.replace(/_/g, " ")`) turns rows into sentences:
  `sources disagree — formed: 1996, also reported as ~1997`.
- Tier kinds, not ranks: rows name the source kind — `official`,
  `press & archives`, `community` — with `community knowledge — not yet
  confirmed` phrasing for T3-only claims. Corroboration counts
  (`2 community sources agree`, every source linked) appear only in the
  detail layer, never as inline promotion.
- Disputes inline read `sources disagree — also reported as {value}` next to
  the displayed value; the detail section opens with one plain-words rule:
  `When sources disagree we show the strongest source and keep the other
  one here.` Tier numbers and mechanics stay hidden.
- Detail lives in a native `<details>` element (no dependency,
  keyboard-accessible); summary chips stay inline from the already-fetched
  rows — zero new fetches or endpoints. Internal `note` text never renders
  (default-closed; a curated-note allowlist is future work).
- Interpretive claims are evidence, not display candidates: a value derived
  by inference from a source (e.g. `~1997` computed from label copy saying
  "active seven years") keeps its tier as a source but cannot displace a
  directly attested display value. This settles the Yaphet Kotto
  formed-year conflict: 1996 (T2, directly attested) displays, ~1997 (T1,
  derived) stays a linked disagreeing row.

## Consequences

Readers get attributed, plain-words provenance; T3 work is credited as
`community knowledge` instead of dismissed. No schema, API, seed, or
migration change — this rides the existing `sources` payloads. Tests assert
the new strings. Corroboration counts must link every source and never
promote on count alone (counts can mirror one copied error).
