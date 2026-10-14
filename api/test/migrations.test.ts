import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Applies the real api/migrations/*.sql files (in order) to a local SQLite
// database — the same engine D1/miniflare uses locally — via Node's built-in
// node:sqlite, so constraint/cascade semantics are observed, not mocked.
// Requires Node >= 22 (repo toolchain); FK enforcement is enabled explicitly
// because SQLite FKs are connection-scoped (PRAGMA foreign_keys).
const require = createRequire(import.meta.url);
type Db = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...p: unknown[]): unknown;
    all(...p: unknown[]): Record<string, unknown>[];
    get(...p: unknown[]): Record<string, unknown> | undefined;
  };
  close(): void;
};
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => Db;
};

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function migratedDb(): Db {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

function seed(db: Db) {
  db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b1", "Saetia", "saetia");
  db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m1", "Billy Werner", "billy werner");
  db.prepare("INSERT INTO band_members (id, band_id, member_id, role, joined_year) VALUES (?, ?, ?, ?, ?)").run("bm1", "b1", "m1", "vocals", 1997);
  db.prepare("INSERT INTO releases (id, band_id, title, release_type, release_year) VALUES (?, ?, ?, ?, ?)").run("r1", "b1", "Saetia", "LP", 1998);
}

const SIX_INDEXES = [
  "idx_band_members_band",
  "idx_band_members_member",
  "idx_bands_norm",
  "idx_media_band",
  "idx_media_release",
  "idx_releases_band",
];

describe("0002_five_tables migration (real DDL applied to local SQLite/D1-like DB)", () => {
  let db: Db;
  beforeEach(() => {
    db = migratedDb();
  });
  afterEach(() => {
    db.close();
  });

  it("creates all five tables", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["band_members", "bands", "media_links", "members", "releases"]));
  });

  it("has exactly the six named indexes", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(names).toEqual(SIX_INDEXES);
  });

  it("rejects a double-parent media_links insert", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO media_links (id, release_id, band_id, provider, url) VALUES (?, ?, ?, ?, ?)").run("x1", "r1", "b1", "bandcamp", "https://example.com"),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("rejects a neither-parent media_links insert", () => {
    expect(() =>
      db.prepare("INSERT INTO media_links (id, provider, url) VALUES (?, ?, ?)").run("x2", "bandcamp", "https://example.com"),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("accepts single-parent media_links inserts (release-only and band-only)", () => {
    seed(db);
    db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run("x3", "r1", "bandcamp", "https://example.com/r");
    db.prepare("INSERT INTO media_links (id, band_id, provider, url) VALUES (?, ?, ?, ?)").run("x4", "b1", "youtube", "https://example.com/b");
    expect(db.prepare("SELECT COUNT(*) AS n FROM media_links").get()?.n).toBe(2);
  });

  it("enforces ON DELETE CASCADE from bands to children when FKs are on", () => {
    seed(db);
    db.prepare("INSERT INTO media_links (id, band_id, provider, url) VALUES (?, ?, ?, ?)").run("x5", "b1", "youtube", "https://example.com/b");
    db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run("x6", "r1", "bandcamp", "https://example.com/r");
    db.prepare("DELETE FROM bands WHERE id = ?").run("b1");
    for (const table of ["band_members", "releases", "media_links"]) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n, table).toBe(0);
    }
    // members are not cascaded away by a band delete.
    expect(db.prepare("SELECT COUNT(*) AS n FROM members").get()?.n).toBe(1);
  });

  it("rejects duplicate band name differing only by case (COLLATE NOCASE unique)", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b2", "SAETIA", "saetia2"),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it("rejects an invalid release_type", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO releases (id, band_id, title, release_type) VALUES (?, ?, ?, ?)").run("r2", "b1", "Demo Tape", "7inch"),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("rejects a NULL release_type (NOT NULL since issue #21)", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO releases (id, band_id, title) VALUES (?, ?, ?)").run("r2", "b1", "Untyped Tape"),
    ).toThrow(/NOT NULL constraint failed/i);
    expect(() =>
      db.prepare("INSERT INTO releases (id, band_id, title, release_type) VALUES (?, ?, ?, ?)").run("r2", "b1", "Untyped Tape", null),
    ).toThrow(/NOT NULL constraint failed/i);
  });

  it("keeps media_links children across the 0003 rebuild", () => {
    seed(db);
    db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run("x1", "r1", "bandcamp", "https://example.com/r");
    expect(db.prepare("SELECT release_type AS t FROM releases WHERE id = ?").get("r1")?.t).toBe("LP");
    expect(db.prepare("SELECT COUNT(*) AS n FROM media_links").get()?.n).toBe(1);
  });
});
