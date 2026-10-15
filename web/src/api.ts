// Public API base URL. Set to https://api.skramz.org in .env.production;
// override locally with a .env file if needed.
export const API_URL =
  import.meta.env.VITE_API_URL ?? "https://api.skramz.org";

// Fetch failure carrying the HTTP status so the QueryClient retry policy can
// tell persistent client errors (4xx: retrying only burns D1 row-reads) from
// transient ones (network / 5xx: worth one retry).
export class ApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`API ${status} for ${path}`);
    this.status = status;
  }
}
