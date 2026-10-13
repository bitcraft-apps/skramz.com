-- Issue #5: five-table schema (bands/members/band_members/releases/media_links)
-- exactly per docs/plans/2026-10-13-skramz-graph.md Part 1 DDL.
-- Portable SQLite only; no Postgres-isms. Do not edit 0001_init.sql.
CREATE TABLE bands (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name_norm TEXT NOT NULL, -- lowercase, de-punctuated; LIKE-search target
  formed_year INTEGER, disbanded_year INTEGER,
  location TEXT, bio TEXT, photo_r2_key TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, name_norm TEXT NOT NULL, bio TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE band_members ( -- THE join table; every edge lives here
  id TEXT PRIMARY KEY,
  band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT, joined_year INTEGER, left_year INTEGER,
  UNIQUE (band_id, member_id, role, joined_year)
);
CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  release_type TEXT CHECK (release_type IN ('LP','EP','Split','Demo','Single','Compilation')),
  release_year INTEGER, cover_r2_key TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE media_links ( -- embedded streams only; exactly one parent
  id TEXT PRIMARY KEY,
  release_id TEXT REFERENCES releases(id) ON DELETE CASCADE,
  band_id TEXT REFERENCES bands(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, url TEXT NOT NULL, embed_url TEXT,
  CHECK ((release_id IS NULL) != (band_id IS NULL))
);
CREATE INDEX idx_band_members_band ON band_members(band_id);
CREATE INDEX idx_band_members_member ON band_members(member_id);
CREATE INDEX idx_releases_band ON releases(band_id);
CREATE INDEX idx_media_release ON media_links(release_id);
CREATE INDEX idx_media_band ON media_links(band_id);
CREATE INDEX idx_bands_norm ON bands(name_norm);
