// Public R2 media host (set in .env.production; override locally with .env).
export const MEDIA_BASE_URL =
  import.meta.env.VITE_MEDIA_URL ?? "https://media.skramz.org";

// Map a stored R2 key (`bands/<id>/<file>`, `releases/<id>/<file>`) to its
// public URL. Null/blank keys have no art, so callers render nothing.
export function artUrl(key: unknown): string | null {
  if (typeof key !== "string") return null;
  const trimmed = key.trim().replace(/^\/+/, "");
  if (!trimmed) return null;
  return `${MEDIA_BASE_URL}/${encodeURI(trimmed)}`;
}
