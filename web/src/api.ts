// Public API base URL. Set to https://api.skramz.org in .env.production;
// override locally with a .env file if needed.
export const API_URL =
  import.meta.env.VITE_API_URL ?? "https://api.skramz.org";
