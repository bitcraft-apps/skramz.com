import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type D1Database, type D1PreparedStatement } from "../src/index";

// Issue #7: band-graph endpoint tests. Same real-SQL harness as crud.test.ts:
// actual api/migrations/*.sql applied to node:sqlite, Hono app through a
// D1-shaped adapter, so the Recursive CTE is observed, not mocked.
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

function adapter(db: Db): D1Database {
  return {
    prepare: (query: string): D1PreparedStatement => {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values;
          return stmt;
        },
        async first<T>() {
          const row = db.prepare(query).get(...params) as T | undefined;
          return row ?? null;
        },
        async all<T>() {
          const rows = db.prepare(query).all(...params) as T[];
          return { results: rows };
        },
        async run() {
          return db.prepare(query).run(...params);
        },
      };
      return stmt;
    },
  };
}

const app = createApp();
const ENV = { DB: null as unknown as D1Database };

// A–B share m1, B–C share m2 → C is depth 2 from A.
function seedChain(db: Db) {
  for (const [id, name] of [["a", "Band A"], ["b", "Band B"], ["c", "Band C"]] as const) {
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run(id, name, name.toLowerCase());
  }
  db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m1", "Shared One", "shared one");
  db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m2", "Shared Two", "shared two");
  db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm1", "a", "m1");
  db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm2", "b", "m1");
  db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm3", "b", "m2");
  db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm4", "c", "m2");
}

let db: Db;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  seedChain(db);
  ENV.DB = adapter(db);
});

type Graph = {
  nodes: { id: string; type: string; name: string }[];
  edges: { from: string; to: string; via: string }[];
};

describe("issue #7: GET /api/bands/:id/graph", () => {
  it("finds C at depth 2 from A with via member labels", async () => {
    const res = await app.request("/api/bands/a/graph?depth=3", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Graph;
    const ids = new Set(json.nodes.map((n) => n.id));
    expect(ids).toEqual(new Set(["a", "b", "c"]));
    for (const n of json.nodes) {
      expect(n.type).toBe("band");
      expect(typeof n.name).toBe("string");
    }
    const edgeKeys = new Set(json.edges.map((e) => `${e.from}->${e.to} via ${e.via}`));
    expect(edgeKeys.has("a->b via Shared One")).toBe(true);
    expect(edgeKeys.has("b->c via Shared Two")).toBe(true);
    // Shape guard: exact keys on nodes/edges.
    expect(Object.keys(json.nodes[0]).sort()).toEqual(["id", "name", "type"]);
    expect(Object.keys(json.edges[0]).sort()).toEqual(["from", "to", "via"]);
  });

  it("respects depth=1 (C unreachable)", async () => {
    const res = await app.request("/api/bands/a/graph?depth=1", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Graph;
    const ids = new Set(json.nodes.map((n) => n.id));
    expect(ids).toEqual(new Set(["a", "b"]));
  });

  it("defaults a missing/invalid depth to 3 and floors 0 to 1", async () => {
    const def = (await (await app.request("/api/bands/a/graph", {}, ENV)).json()) as Graph;
    expect(new Set(def.nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "c"]));
    const bad = (await (await app.request("/api/bands/a/graph?depth=nope", {}, ENV)).json()) as Graph;
    expect(new Set(bad.nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "c"]));
    const zero = (await (await app.request("/api/bands/a/graph?depth=0", {}, ENV)).json()) as Graph;
    expect(new Set(zero.nodes.map((n) => n.id))).toEqual(new Set(["a", "b"]));
  });

  it("clamps depth > 4", async () => {
    // Linear chain of 7 bands: d0..d6, each adjacent pair sharing a member.
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("d0", "Chain Zero", "chain zero");
    for (let i = 1; i <= 6; i++) {
      db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run(`d${i}`, `Chain ${i}`, `chain ${i}`);
      db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run(`dm${i}`, `Chain Member ${i}`, `chain member ${i}`);
      db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run(`dbm${i}a`, `d${i - 1}`, `dm${i}`);
      db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run(`dbm${i}b`, `d${i}`, `dm${i}`);
    }
    const clamped = (await (await app.request("/api/bands/d0/graph?depth=99", {}, ENV)).json()) as Graph;
    const ids = new Set(clamped.nodes.map((n) => n.id));
    // Clamped to 4: d4 reachable, d5/d6 not.
    expect(ids.has("d4")).toBe(true);
    expect(ids.has("d5")).toBe(false);
    expect(ids.has("d6")).toBe(false);
  });

  it("cyclic lineups terminate", async () => {
    // Close the triangle: A–C share a third member, so every pair links both ways.
    db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m3", "Cyclical Sal", "cyclical sal");
    db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm5", "a", "m3");
    db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm6", "c", "m3");
    const res = await app.request("/api/bands/a/graph?depth=4", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Graph;
    expect(new Set(json.nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "c"]));
  });

  it("returns an isolated band as a single node with no edges", async () => {
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("solo", "Solo Act", "solo act");
    const res = await app.request("/api/bands/solo/graph", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Graph;
    expect(json.nodes).toEqual([{ id: "solo", type: "band", name: "Solo Act" }]);
    expect(json.edges).toEqual([]);
  });

  it("returns 404 for a missing band", async () => {
    const res = await app.request("/api/bands/nope/graph", {}, ENV);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });
});

describe("issue #7: GET /api/bands/:id detail shape", () => {
  it("returns band + members + releases + media_links", async () => {
    db.prepare("INSERT INTO releases (id, band_id, title, release_type) VALUES (?, ?, ?, ?)").run("r1", "a", "First Tape", "Demo");
    db.prepare("INSERT INTO media_links (id, band_id, provider, url) VALUES (?, ?, ?, ?)").run(
      "x1",
      "a",
      "bandcamp",
      "https://example.com/a",
    );
    const res = await app.request("/api/bands/a", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { id: string };
      members: { name: string }[];
      releases: { id: string }[];
      media_links: { id: string }[];
    };
    expect(json.data.id).toBe("a");
    expect(json.members.map((m) => m.name)).toContain("Shared One");
    expect(json.releases.map((r) => r.id)).toEqual(["r1"]);
    expect(json.media_links.map((m) => m.id)).toEqual(["x1"]);
  });
});
