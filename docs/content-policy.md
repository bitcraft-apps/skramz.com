# Content policy — skramz.org

Binding for all band / member / release / media writes. If in doubt, leave it unconfirmed or out. Legality outranks completeness.

## 1. Sources

Every factual claim needs a legal source stored with `source_url + accessed_at`. No source = `unconfirmed`: show a visible badge and hedge ("reportedly", "unconfirmed"). No pirated text, images, or audio.

- **Tier 1 — authoritative:** band / label official sites and accounts, direct artist statement.
- **Tier 2 — reputable:** established press, books, venues, festivals, MusicBrainz / Discogs entries with history.
- **Tier 3 — community:** small press, zines, fan wikis, forums, user tips. Never overrides T1/T2.

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
