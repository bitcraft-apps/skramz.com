# Content policy — skramz.org

Binding rules for all band / member / release / media content. Humans and AI agents must follow this file. If in doubt, leave it unconfirmed or out.

## 1. Principles

- Every factual claim needs a source. No source = `unconfirmed`.
- Only legal sources. No pirated text, images, or audio.
- Legality outranks completeness, especially for media.
- Attribution is mandatory whenever a license requires it.
- Never present unconfirmed or disputed claims as fact.

## 2. Source tiers

- **Tier 1 — authoritative:** band / label official sites and official accounts, direct artist statement.
- **Tier 2 — reputable:** established press, books, venues, festivals, MusicBrainz / Discogs entries with history.
- **Tier 3 — community:** small press, zines, fan wikis, forums, user tips. Allowed, but never override T1/T2.

Each claim stores `source_url` + `accessed_at` (date seen). Prefer the highest tier available.

## 3. Verification statuses

Every factual field uses `status`: `confirmed | unconfirmed | disputed`.

- `confirmed` — backed by a cited source (T1 preferred, T2/T3 accepted with link).
- `unconfirmed` — no source yet, or only an anonymous tip. Show with a visible badge; agents must hedge ("reportedly", "unconfirmed").
- `disputed` — sources disagree; see §6. Show both claims with sources.

Agents must not write or upgrade a claim to `confirmed` without adding `source_url + accessed_at`.

## 4. Text rules

- Write bios in your own words. Never paste bios, articles, reviews, or lyrics without permission.
- Short quotes (a sentence or two) only with author + source link.
- No invented facts, lineup guesses, or genre padding to fill empty fields. Leave blank + `unconfirmed` instead.

## 5. Media rules (images, photos, audio)

Target schema per file: `license + author + source_url + attribution_text`.

- **Allowed:** own work / explicit permission, public domain, CC-BY / CC-BY-SA, licensed stock with receipt. Embedded streams only via the host platform (YouTube, Bandcamp, Spotify) — the host handles playback licensing.
- **Forbidden:** hotlinks, image-search scrapes, social-media re-uploads of unknown origin, ripped tracks / full copyrighted audio uploads.
- Attribution: render `attribution_text` wherever the file is shown. If author or license is unknown, do not publish.
- Photos of living people: need consent or a clearly licensed source. Remove on request (see §7).

`media_links` stays embed-only (provider + url); file uploads live in R2 with the provenance fields above. No `cover_r2_key` / `photo_r2_key` write without license + author on record.

## 6. Conflicts

Highest tier wins for the displayed value; the losing claim is kept as `disputed` with its source link, not deleted. If T1 is silent and T2/T3 conflict, show the newest with `disputed` and note the rival. Agents must present both sides, never silently overwrite.

## 7. Correction & takedown

Anyone can report a wrong claim or infringing file with a source or rights note. On valid report: flip the field to `disputed` / unpublish the file within the same change, keep the old source link for audit. Rights-holder takedowns win over completeness — remove first, discuss after.

## 8. Agent checklist (before any content write)

1. Is there a source? If no → `unconfirmed` + no public claim of fact.
2. Is the source legal? If no → drop it.
3. Is media licensed + attributed (`license + author + source_url`)? If no → do not upload.
4. Does a higher-tier source disagree? If yes → keep loser as `disputed`.
5. CLI writes need human `[Y/n]` preview per repo rules; non-TTY aborts.
