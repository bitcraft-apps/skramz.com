// Minimal structural types for the Cloudflare bindings we use, so the Worker
// typechecks without depending on @cloudflare/workers-types.
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

// Opaque handle for the MEDIA R2 bucket (skramz-media). Reads go straight
// to the public host, so no route calls R2 yet; keep this opaque and grow
// structural members when the first R2 route needs them.
export type R2Bucket = unknown;

export type Bindings = {
  DB: D1Database;
  MEDIA?: R2Bucket;
  INGESTION_TOKEN?: string;
};
