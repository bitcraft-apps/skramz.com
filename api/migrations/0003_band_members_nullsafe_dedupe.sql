-- Issue #20: NULL-safe dedupe for band_members.
-- SQLite treats NULLs as distinct in UNIQUE constraints, so the
-- UNIQUE (band_id, member_id, role, joined_year) in 0002 allowed duplicate
-- rows when role and/or joined_year were NULL. This expression index closes
-- that gap: COALESCE maps NULL role/joined_year to sentinels ('' and -1,
-- neither valid real values) so duplicates are rejected in all NULL
-- combinations. Portable SQLite; no Postgres-isms. The original table-level
-- UNIQUE constraint stays (dropping it requires a table rebuild).
CREATE UNIQUE INDEX IF NOT EXISTS ux_band_members_nullsafe_dedupe
  ON band_members (band_id, member_id, COALESCE(role, ''), COALESCE(joined_year, -1));
