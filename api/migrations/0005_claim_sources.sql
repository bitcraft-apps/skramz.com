-- Claim-level sources for the content policy: every factual claim carries
-- source_url + accessed_at, a confirmed/unconfirmed/disputed status, and a
-- source tier. Display tables keep only winning values (NULL = visible gap);
-- this sidecar records why, including losing rivals. Portable SQLite, no
-- Postgres-isms. entity_id is polymorphic on purpose (one table for band /
-- member / band_member / release / media_link claims), so there is no
-- FOREIGN KEY here — writers must use a real row id from the owning table.
CREATE TABLE IF NOT EXISTS claim_sources (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('band', 'member', 'band_member', 'release', 'media_link')),
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'unconfirmed', 'disputed')),
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  source_url TEXT NOT NULL,
  accessed_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS claim_sources_lookup ON claim_sources(entity_type, entity_id);
