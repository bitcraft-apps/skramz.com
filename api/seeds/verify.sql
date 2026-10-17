-- Seed verification: every statement below must return zero rows.
-- Apply a seed, then run this file against the SAME database:
--   pnpm exec wrangler d1 execute DB --local --file seeds/verify.sql
-- SELECT-only; writes nothing. Portable SQLite.
--
-- With plain INSERTs, orphan rows fail loudly at apply time; these queries
-- exist to catch smuggled OR IGNOREs and hand-merge mistakes at band #200.

-- Orphan edges: a child row whose parent is missing.
SELECT 'orphan band_member' AS violation, bm.id AS row_id
FROM band_members bm
LEFT JOIN bands b ON b.id = bm.band_id
LEFT JOIN members m ON m.id = bm.member_id
WHERE b.id IS NULL OR m.id IS NULL;

SELECT 'orphan release' AS violation, r.id AS row_id
FROM releases r
LEFT JOIN bands b ON b.id = r.band_id
WHERE b.id IS NULL;

SELECT 'orphan media_link' AS violation, l.id AS row_id
FROM media_links l
LEFT JOIN releases r ON r.id = l.release_id
LEFT JOIN bands b ON b.id = l.band_id
WHERE (l.release_id IS NOT NULL AND r.id IS NULL)
   OR (l.band_id IS NOT NULL AND b.id IS NULL);

-- Orphan evidence: a claim_sources row pointing at no content row.
-- entity_id is polymorphic by design (no FOREIGN KEY), so check per type.
SELECT 'orphan claim_source' AS violation, cs.id AS row_id
FROM claim_sources cs
WHERE (cs.entity_type = 'band' AND NOT EXISTS (SELECT 1 FROM bands WHERE id = cs.entity_id))
   OR (cs.entity_type = 'member' AND NOT EXISTS (SELECT 1 FROM members WHERE id = cs.entity_id))
   OR (cs.entity_type = 'band_member' AND NOT EXISTS (SELECT 1 FROM band_members WHERE id = cs.entity_id))
   OR (cs.entity_type = 'release' AND NOT EXISTS (SELECT 1 FROM releases WHERE id = cs.entity_id))
   OR (cs.entity_type = 'media_link' AND NOT EXISTS (SELECT 1 FROM media_links WHERE id = cs.entity_id));

-- Curator-note hygiene (§8): short, plain words, no pasted source text.
SELECT 'note too long' AS violation, cs.id AS row_id
FROM claim_sources cs
WHERE cs.note IS NOT NULL AND length(cs.note) > 140;

SELECT 'note pastes source text' AS violation, cs.id AS row_id
FROM claim_sources cs
WHERE cs.note IS NOT NULL AND cs.note LIKE '%http%';
