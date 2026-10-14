-- Issue #21: releases.release_type must be NOT NULL.
-- The 0002 CHECK only constrains non-NULL values, so untyped releases (NULL)
-- slipped through. SQLite cannot ALTER a column to add NOT NULL, so rebuild
-- the table and copy rows back. The copy INSERT fails on any pre-existing
-- NULL release_type — backfill those rows before applying.
-- No PRAGMA foreign_keys toggle here: it is connection-scoped (a no-op
-- inside D1's migration transaction) and would leak OFF state into harnesses
-- that apply these files with FKs on. Instead media_links rows are stashed
-- aside and restored, so DROP TABLE releases cannot cascade them away.
CREATE TABLE releases_new (
  id TEXT PRIMARY KEY,
  band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL CHECK (release_type IN ('LP','EP','Split','Demo','Single','Compilation')),
  release_year INTEGER, cover_r2_key TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO releases_new (id, band_id, title, release_type, release_year, cover_r2_key, created_at)
  SELECT id, band_id, title, release_type, release_year, cover_r2_key, created_at FROM releases;
CREATE TABLE _media_links_keep AS SELECT * FROM media_links;
DELETE FROM media_links;
DROP TABLE releases;
ALTER TABLE releases_new RENAME TO releases;
CREATE INDEX idx_releases_band ON releases(band_id);
INSERT INTO media_links (id, release_id, band_id, provider, url, embed_url)
  SELECT id, release_id, band_id, provider, url, embed_url FROM _media_links_keep;
DROP TABLE _media_links_keep;
