# Web hosting — Workers Static Assets (issue #55, ADR-0004)

## Worker

- **Name:** `skramz-web` — the system's only frontend host (Workers
  Static Assets, free tier).
- **Config:** `web/wrangler.toml`. Assets-only Worker: no `main` entry.
  `[assets] directory = "./dist"` with
  `not_found_handling = "single-page-application"`, so client-side
  routes serve `index.html`.
- **Build:** `vite build` → `dist/`. Local check: `pnpm build` in `web/`
  + `wrangler deploy --dry-run`.
- **Deploy:** `.github/workflows/deploy-web.yml` — `deploy` job on `main`
  push to production, `preview` job on PRs (non-production version;
  fork PRs skip only the upload). No Pages GitHub integration.
- **Supersedes:** `infra/pages.md` (deleted after cutover verification).

## Env vars (Production + Preview)

| Var | Value | Notes |
| --- | ----- | ----- |
| `VITE_API_URL` | `https://api.skramz.org` | Baked at build time: build env in `deploy-web.yml` + fallback in `web/.env.production` (public URL, safe in git). |

The home route (`/`, search-first gateway in `src/App.tsx`) consumes
`src/hooks.ts` (`useBands` idle strip + `useSearch`), so the API client
is bundled and the URL is greppable in `dist/` — the build log's
`VITE_API_URL=…` echo remains the proof it resolved.

## Domains

| Host | How attached | Status |
| ---- | ------------ | ------ |
| `skramz.org` | Worker route (`custom_domain`) in `web/wrangler.toml` | Cutover from Pages — owner runbook below |
| `www.skramz.org` | Same Worker route | Same as above |

## Cutover runbook (account owner only, dashboard)

1. Deploy this branch to `main`; confirm the production deploy serves
   the SPA on `https://skramz-web.<subdomain>.workers.dev`.
2. In Pages → `skramz-web` → Custom domains, remove `skramz.org` and
   `www.skramz.org`.
3. Deploy the Worker (or wait for the deploy in step 1 if routes were
   already applied); the `routes` in `web/wrangler.toml` create the DNS
   records + certificates automatically.
4. Verify:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://skramz.org       # 200
   curl -s -o /dev/null -w '%{http_code}\n' https://www.skramz.org   # 200
   curl https://api.skramz.org/healthz  # 200 {"ok":true,"db":1} (unchanged)
   ```
5. Only then: delete the `skramz-web` Pages project (dashboard →
   Workers & Pages → `skramz-web` → Delete). No dual-host period beyond
   the cutover (ADR-0004 Q2).

## API CORS (verified in code, not dashboard)

Allows exactly apex + `www` (`api/src/index.ts`, tested in
`api/test/cors.test.ts`); preview origins are NOT allowed (#55 follow-up).
