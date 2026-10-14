-- Issue #51: normalized release-title search target (releases.title_norm).
-- Bands/members already LIKE on name_norm; releases still LIKE on the raw
-- title, so q=SAETIA missed "Saetia" and cursors had to bind the raw query
-- string. Server computes title_norm via normalizeName on writes (same as
-- name_norm); this backfill is approximate (lowercase + trim only — SQLite
-- has no regex replace, so de-punctuation needs the TS helper) and existing
-- rows converge on the next title write. Portable SQLite; no Postgres-isms.
ALTER TABLE releases ADD COLUMN title_norm TEXT NOT NULL DEFAULT '';
UPDATE releases SET title_norm = lower(trim(title)) WHERE title_norm = '';
CREATE INDEX IF NOT EXISTS idx_releases_title_norm ON releases(title_norm);
