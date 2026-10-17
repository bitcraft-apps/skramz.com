# Content policy — skramz.org

Binding for all band / member / release / media writes. If in doubt, leave it unconfirmed or out. Legality outranks completeness.

## 1. Sources

Every factual claim needs a legal source stored with `source_url + accessed_at`. No source = `unconfirmed`: show a visible badge and hedge ("reportedly", "unconfirmed"). No pirated text, images, or audio.

- **Tier 1 — authoritative:** band / label official sites and accounts, direct artist statement.
- **Tier 2 — reputable:** established press, books, venues, festivals, MusicBrainz / Discogs entries with history.
- **Tier 3 — community:** small press, zines, fan wikis, forums, user tips. Never overrides T1/T2.

### Tier assignment rubric

- **"Entry with history" (T2)** means a Discogs / MusicBrainz entry with
  visible submission history plus real catalogue depth (releases with
  multiple versions, reviews, or lists). A bare stub with no history is T3.
- **Press (T2)** means an established outlet with editorial history.
  Small zines, blogs, and fan wikis are T3 even when long-running.
- **Bare tips (T3, lead only):** a single forum/social comment, an
  uncorroborated user tip, a one-line wiki addition with no source.
- **Derived values are evidence, never display candidates:** arithmetic or
  inference from a source (e.g. "~1997" computed from label copy saying
  "active seven years") keeps its tier as a source row but cannot displace
  a directly attested display value. The display keeps the directly
  attested value; the derivation stays as a linked disagreeing row.

### Settled source register (first consumers: Yaphet Kotto, Orchid)

These sources are agreed T1/T2 for the first seeds. Anything else starts
at T3 until a curator argues it up in the PR body.

- T1: `ebullition.com` label catalog + official band/artist statements.
- T2: `discogs.com` artist entries with history (band pages and member
  pages that name roles), `musicbrainz.org` entries with history,
  established press (`loudersound.com` and equivalents).
- T3: `wikipedia.org` band pages, `diymusicwiki.com`, forums, user tips.

## 2. Statuses

`confirmed` (has source) | `unconfirmed` (no source) | `disputed` (sources disagree).

Never write or upgrade to `confirmed` without `source_url + accessed_at`. Never present `unconfirmed` / `disputed` as fact. Highest tier wins the displayed value; the loser stays as `disputed` with its source link, never silently overwritten or deleted. Same-tier conflict: show the newest, note the rival.

## 3. Text

Own words only — never paste bios, articles, reviews, or lyrics. Short quotes (a sentence or two) with author + source link. No invented facts, lineup guesses, or genre padding; leave blank + `unconfirmed` instead.

## 4. Media (images, photos, audio)

Record `license + author + source_url` per file and render the attribution wherever the file is shown. Unknown license or author = do not publish.

- **Allowed:** own work / explicit permission, public domain, CC-BY / CC-BY-SA, licensed stock with receipt, platform embeds (YouTube, Bandcamp, Spotify).
- **Forbidden:** hotlinks, image-search scrapes, unknown-origin re-uploads, ripped tracks / full copyrighted audio uploads.
- Photos of living people need consent or a clearly licensed source; remove on request.
- No `cover_r2_key` / `photo_r2_key` write without license + author on record; `media_links` stays embed-only (provider + url).

## 5. Corrections

Anyone can report a wrong claim or infringing file with a source or rights note. Valid report: flip the field to `disputed` / unpublish the file, keep the old source link. Rights-holder takedowns remove first, discuss after.

## 6. Agent checklist (before any content write)

1. Source? If no → `unconfirmed`, no public claim of fact.
2. Legal? If no → drop it.
3. Media licensed + attributed? If no → do not upload.
4. Higher-tier source disagrees? Keep the loser as `disputed`.

## 7. Seeds

Seeds are per-environment starter records, applied explicitly with
`task seed` — never via migrations. Conventions:

- Fixed ids with a per-band prefix (`band-`, `yk-m-`, `oc-`); plain
  INSERTs only, so a UNIQUE conflict fails loudly and means the record
  exists — merge by hand, never INSERT OR IGNORE under foreign keys.
- NULL is an honest gap: blanks allowed wherever no source clears the bar.
- Every display value needs a source row or it stays `unconfirmed`.
  Corrections follow §5.

## 8. Curator notes

`claim_sources.note` is a working note for future curators reading the
database, never rendered in the UI. Keep it under ~140 characters, in
plain words a stranger understands — no cryptic fragments, no pasted
source text. Record quirks that matter later ("page spells 'Jeffrey
Salane'"). Seed-file header comments say what the seed owns, how to
apply it, and what a conflict means — nothing more.
