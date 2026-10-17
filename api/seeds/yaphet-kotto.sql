-- Yaphet Kotto seed: deepest-correct-record lineup template.
-- Display tables keep winning values only (NULL = visible gap, shown with an
-- unconfirmed badge); every claim below has its evidence in claim_sources.
-- Bio is own words, derived from the cited label/discography sources.
-- Apply once per database with `task seed SEED=yaphet-kotto.sql`. Plain
-- INSERTs on purpose: a UNIQUE conflict means the record already exists, and
-- failing loudly beats INSERT OR IGNORE, which would skip the parent while
-- inserting orphan edges under foreign keys. Merge by hand on conflict.
-- Fixed ids. Portable SQLite.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-yaphet-kotto', 'Yaphet Kotto', 'yaphet kotto', 1996, 2005,
   'Santa Cruz / San Francisco, California',
   'Emotive hardcore band from Santa Cruz, later based in San Francisco. Active 1996-2005. Three LPs on Ebullition plus splits and EPs.');

INSERT INTO members (id, name, name_norm) VALUES
  ('yk-m-austin-barber', 'Austin Barber', 'austin barber'),
  ('yk-m-casey-watson', 'Casey Watson', 'casey watson'),
  ('yk-m-chris-story', 'Chris Story', 'chris story'),
  ('yk-m-jose-palafox', 'Jose Palafox', 'jose palafox'),
  ('yk-m-keith-miller', 'Keith Miller', 'keith miller'),
  ('yk-m-luke-clements', 'Luke Clements', 'luke clements'),
  ('yk-m-mag-delana', 'Mag Delana', 'mag delana'),
  ('yk-m-pat-crowley', 'Pat Crowley', 'pat crowley'),
  ('yk-m-paul-cameron', 'Paul Cameron', 'paul cameron'),
  ('yk-m-scott-batiste', 'Scott Batiste', 'scott batiste');

-- Only Scott Batiste clears the T1/T2 bar for a role (label catalog names him
-- on drums). All other roles and every join/leave year are NULL gaps.
INSERT INTO band_members (id, band_id, member_id, role, joined_year, left_year) VALUES
  ('yk-bm-austin-barber', 'band-yaphet-kotto', 'yk-m-austin-barber', NULL, NULL, NULL),
  ('yk-bm-casey-watson', 'band-yaphet-kotto', 'yk-m-casey-watson', NULL, NULL, NULL),
  ('yk-bm-chris-story', 'band-yaphet-kotto', 'yk-m-chris-story', NULL, NULL, NULL),
  ('yk-bm-jose-palafox', 'band-yaphet-kotto', 'yk-m-jose-palafox', NULL, NULL, NULL),
  ('yk-bm-keith-miller', 'band-yaphet-kotto', 'yk-m-keith-miller', NULL, NULL, NULL),
  ('yk-bm-luke-clements', 'band-yaphet-kotto', 'yk-m-luke-clements', NULL, NULL, NULL),
  ('yk-bm-mag-delana', 'band-yaphet-kotto', 'yk-m-mag-delana', NULL, NULL, NULL),
  ('yk-bm-pat-crowley', 'band-yaphet-kotto', 'yk-m-pat-crowley', NULL, NULL, NULL),
  ('yk-bm-paul-cameron', 'band-yaphet-kotto', 'yk-m-paul-cameron', NULL, NULL, NULL),
  ('yk-bm-scott-batiste', 'band-yaphet-kotto', 'yk-m-scott-batiste', 'drums', NULL, NULL);

-- Evidence sidecar. Tiers: 1 label/official, 2 reputable with history,
-- 3 community (lead only, never confirms).
INSERT INTO claim_sources (id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at, note) VALUES
  ('cs-yk-formed', 'band', 'band-yaphet-kotto', 'formed_year', '1996', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-disbanded', 'band', 'band-yaphet-kotto', 'disbanded_year', '2005', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-location', 'band', 'band-yaphet-kotto', 'location', 'Santa Cruz / San Francisco, California', 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-17',
   'Label catalog: hails from Santa Cruz, now based in San Francisco.'),
  ('cs-yk-formed-rival', 'band', 'band-yaphet-kotto', 'formed_year', '~1997', 'disputed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-17',
   'Label copy on the 2004 LP says active for seven years, implying about 1997; kept as the losing rival.'),
  ('cs-yk-bio', 'band', 'band-yaphet-kotto', 'bio', NULL, 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-17',
   'Own-words summary of the label catalog discography spine.'),
  ('cs-yk-years', 'band', 'band-yaphet-kotto', 'lineup_years', NULL, 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Yaphet_Kotto_(band)', '2026-10-17',
   'No T1/T2 source gives join/leave years; community lists give names only.'),
  ('cs-yk-mb-austin-barber', 'band_member', 'yk-bm-austin-barber', 'membership', 'Austin Barber', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-casey-watson', 'band_member', 'yk-bm-casey-watson', 'membership', 'Casey Watson', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-chris-story', 'band_member', 'yk-bm-chris-story', 'membership', 'Chris Story', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-jose-palafox', 'band_member', 'yk-bm-jose-palafox', 'membership', 'Jose Palafox', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-keith-miller', 'band_member', 'yk-bm-keith-miller', 'membership', 'Keith Miller', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-luke-clements', 'band_member', 'yk-bm-luke-clements', 'membership', 'Luke Clements', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-mag-delana', 'band_member', 'yk-bm-mag-delana', 'membership', 'Mag Delana', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-pat-crowley', 'band_member', 'yk-bm-pat-crowley', 'membership', 'Pat Crowley', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-paul-cameron', 'band_member', 'yk-bm-paul-cameron', 'membership', 'Paul Cameron', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-mb-scott-batiste', 'band_member', 'yk-bm-scott-batiste', 'membership', 'Scott Batiste', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17', NULL),
  ('cs-yk-role-scott', 'band_member', 'yk-bm-scott-batiste', 'role', 'drums', 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-17',
   'Label catalog names Scott on drums.'),
  ('cs-yk-role-mag', 'band_member', 'yk-bm-mag-delana', 'role', 'guitar/vocals', 'unconfirmed', 3,
   'http://www.diymusicwiki.com/yaphet-kotto', '2026-10-17',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('cs-yk-role-chris', 'band_member', 'yk-bm-chris-story', 'role', 'bass', 'unconfirmed', 3,
   'http://www.diymusicwiki.com/yaphet-kotto', '2026-10-17',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('cs-yk-name-keith-a', 'member', 'yk-m-keith-miller', 'name', 'Keith Milller', 'disputed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-17',
   'Discogs spelling with three l-letters; kept as the losing rival.'),
  ('cs-yk-name-keith-b', 'member', 'yk-m-keith-miller', 'name', 'Keith Miller', 'disputed', 3,
   'https://en.wikipedia.org/wiki/Yaphet_Kotto_(band)', '2026-10-17',
   'Displayed spelling; community source, so the row stays disputed, not confirmed.');

-- Last-reviewed stamp for every row this seed owns (the review date doubles
-- as the freshness badge until a later write touches the row).
UPDATE bands SET updated_at = '2026-10-17T00:00:00.000Z' WHERE id = 'band-yaphet-kotto';
UPDATE members SET updated_at = '2026-10-17T00:00:00.000Z' WHERE id LIKE 'yk-m-%';
UPDATE band_members SET updated_at = '2026-10-17T00:00:00.000Z' WHERE band_id = 'band-yaphet-kotto';
UPDATE claim_sources SET updated_at = '2026-10-17T00:00:00.000Z' WHERE entity_id = 'band-yaphet-kotto' OR entity_id LIKE 'yk-%';
