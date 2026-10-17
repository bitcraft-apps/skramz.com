-- updated_at on every content table so a band page can answer "how fresh is
-- this" from its parents. bands already had one (maintained by its PATCH
-- route); the child tables had created_at at best, band_members and
-- media_links had no timestamps at all. SQLite forbids expression defaults
-- in ADD COLUMN on non-empty tables, so there is deliberately no DEFAULT
-- here: writers set updated_at explicitly on every INSERT and PATCH (see the
-- write routes), and pre-existing rows backfill from created_at where it
-- exists, else stay NULL (unknown, never a fabricated now). Portable SQLite;
-- no Postgres-isms.
ALTER TABLE members ADD COLUMN updated_at TEXT;
ALTER TABLE band_members ADD COLUMN updated_at TEXT;
ALTER TABLE releases ADD COLUMN updated_at TEXT;
ALTER TABLE media_links ADD COLUMN updated_at TEXT;
ALTER TABLE claim_sources ADD COLUMN updated_at TEXT;
UPDATE members SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE releases SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE claim_sources SET updated_at = created_at WHERE updated_at IS NULL;
