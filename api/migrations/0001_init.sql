-- Issue #1 bootstrap migration: proves `task migrate` applies cleanly to a fresh
-- local D1. The full five-table schema (bands/members/band_members/releases/
-- media_links) lands in the later D1-migrations issue; keep this portable
-- SQLite with no Postgres-isms.
CREATE TABLE IF NOT EXISTS _health (
  id INTEGER PRIMARY KEY,
  checked_at TEXT NOT NULL
);
