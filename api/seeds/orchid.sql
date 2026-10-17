-- Orchid seed: second curated record, proving the Yaphet Kotto conventions
-- transfer to a band with thinner sources. Same rules: display tables keep
-- winning values only (NULL = visible gap); every claim has evidence in
-- claim_sources; bio is own words. Only Jayson Green and Will Killingsworth
-- clear the T1/T2 bar (Discogs member pages name their Orchid roles); the
-- rest are community leads, and Brad Wallace is disputed (one community
-- source lists a fifth member; peer lists name four).
-- Apply once per database with `task seed SEED=orchid.sql`. Plain INSERTs:
-- a UNIQUE conflict means the record exists — merge by hand, never
-- INSERT OR IGNORE under foreign keys. Fixed ids. Portable SQLite.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-orchid', 'Orchid', 'orchid', NULL, NULL,
   'Amherst, Massachusetts',
   'Emotive hardcore band from Amherst, Massachusetts. Three LPs on Ebullition plus splits and EPs.');

INSERT INTO members (id, name, name_norm) VALUES
  ('oc-m-jayson-green', 'Jayson Green', 'jayson green'),
  ('oc-m-will-killingsworth', 'Will Killingsworth', 'will killingsworth'),
  ('oc-m-jeff-salane', 'Jeff Salane', 'jeff salane'),
  ('oc-m-geoff-garlock', 'Geoff Garlock', 'geoff garlock'),
  ('oc-m-brad-wallace', 'Brad Wallace', 'brad wallace');

INSERT INTO band_members (id, band_id, member_id, role, joined_year, left_year) VALUES
  ('oc-bm-jayson-green', 'band-orchid', 'oc-m-jayson-green', 'vocals', NULL, NULL),
  ('oc-bm-will-killingsworth', 'band-orchid', 'oc-m-will-killingsworth', 'guitar', NULL, NULL),
  ('oc-bm-jeff-salane', 'band-orchid', 'oc-m-jeff-salane', NULL, NULL, NULL),
  ('oc-bm-geoff-garlock', 'band-orchid', 'oc-m-geoff-garlock', NULL, NULL, NULL),
  ('oc-bm-brad-wallace', 'band-orchid', 'oc-m-brad-wallace', NULL, NULL, NULL);

INSERT INTO claim_sources (id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at, note) VALUES
  ('cs-oc-name', 'band', 'band-orchid', 'name', 'Orchid', 'confirmed', 2,
   'https://musicbrainz.org/label/bd2c9ba4-c4c6-4829-a2e7-b4942bd26871', '2026-10-17',
   'Label discography page lists Orchid releases on Ebullition.'),
  ('cs-oc-location', 'band', 'band-orchid', 'location', 'Amherst, Massachusetts', 'confirmed', 2,
   'https://www.loudersound.com/features/this-is-hardcore-orchid-chaos-is-me', '2026-10-17',
   'Press feature: formed while members were in college; drummer at UMass in Amherst.'),
  ('cs-oc-formed', 'band', 'band-orchid', 'formed_year', '1997', 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('cs-oc-disbanded', 'band', 'band-orchid', 'disbanded_year', '2002', 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('cs-oc-bio', 'band', 'band-orchid', 'bio', NULL, 'confirmed', 2,
   'https://musicbrainz.org/label/bd2c9ba4-c4c6-4829-a2e7-b4942bd26871', '2026-10-17',
   'Own-words summary of the label discography spine.'),
  ('cs-oc-mb-jayson-green', 'band_member', 'oc-bm-jayson-green', 'membership', 'Jayson Green', 'confirmed', 2,
   'https://www.discogs.com/artist/751217-Jayson-Green', '2026-10-17',
   'Member page: vocalist for Orchid.'),
  ('cs-oc-mb-will-killingsworth', 'band_member', 'oc-bm-will-killingsworth', 'membership', 'Will Killingsworth', 'confirmed', 2,
   'https://www.discogs.com/artist/495765-Will-Killingsworth', '2026-10-17',
   'Member page: played guitar in Orchid.'),
  ('cs-oc-mb-jeff-salane', 'band_member', 'oc-bm-jeff-salane', 'membership', 'Jeff Salane', 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Community lead only.'),
  ('cs-oc-mb-geoff-garlock', 'band_member', 'oc-bm-geoff-garlock', 'membership', 'Geoff Garlock', 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Community lead only.'),
  ('cs-oc-mb-brad-wallace', 'band_member', 'oc-bm-brad-wallace', 'membership', 'Brad Wallace', 'disputed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Only this community source lists a fifth member; peer lists name four. Row stays disputed.'),
  ('cs-oc-role-jayson', 'band_member', 'oc-bm-jayson-green', 'role', 'vocals', 'confirmed', 2,
   'https://www.discogs.com/artist/751217-Jayson-Green', '2026-10-17', NULL),
  ('cs-oc-role-will', 'band_member', 'oc-bm-will-killingsworth', 'role', 'guitar', 'confirmed', 2,
   'https://www.discogs.com/artist/495765-Will-Killingsworth', '2026-10-17', NULL),
  ('cs-oc-role-jeff', 'band_member', 'oc-bm-jeff-salane', 'role', 'drums', 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('cs-oc-role-geoff', 'band_member', 'oc-bm-geoff-garlock', 'role', 'bass', 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('cs-oc-role-brad', 'band_member', 'oc-bm-brad-wallace', 'role', 'guitar', 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Orchid_(screamo_band)', '2026-10-17',
   'Community lead only; membership itself is disputed, so this stays buried until confirmed.');

-- Last-reviewed stamp for every row this seed owns (the review date doubles
-- as the freshness badge until a later write touches the row).
UPDATE bands SET updated_at = '2026-10-17T00:00:00.000Z' WHERE id = 'band-orchid';
UPDATE members SET updated_at = '2026-10-17T00:00:00.000Z' WHERE id LIKE 'oc-m-%';
UPDATE band_members SET updated_at = '2026-10-17T00:00:00.000Z' WHERE band_id = 'band-orchid';
UPDATE claim_sources SET updated_at = '2026-10-17T00:00:00.000Z' WHERE entity_id = 'band-orchid' OR entity_id LIKE 'oc-%';
