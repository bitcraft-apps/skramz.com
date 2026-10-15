# Web hosting — Workers Static Assets (issue #55, ADR-0004)

## Worker

- **Name:** `skramz-web` — the system's only frontend host (Cloudflare
  Workers Static Assets, free tier; static-asset requests are
  free/unlimited, unlike SSR which would burn the 100k req/day + 10ms
  CPU budget).
- **Config:** `web/wrangler.toml` (TOML, mirroring `api/wrangler.toml`).
  Assets-only Worker: no `main` entry. `[assets] directory = "./dist"`
  with `not_found_handling = "single-page-application"`, so client-side
  routes (react-router) serve `index.html`.
- **Build:** `vite build` → `dist/` (the `@cloudflare/vite-plugin`
  `cloudflare()` plugin in `web/vite.config.ts` owns dev; deploy uploads
  `dist/`). Local check: `pnpm build` in `web/` + `wrangler deploy
  --dry-run`.
- **Deploy:** `.github/workflows/deploy-web.yml`. Push to `main`
  touching `web/**` (or `workflow_dispatch`) runs the `deploy` job to
  production — PRs are excluded by condition, so a PR can never promote
  to the custom domains. Every PR touching `web/**` runs the `preview`
  job instead: lint → test → build, then `wrangler versions upload`
  (a non-production version) with the preview URL published to the run
  summary; fork PRs without Cloudflare secrets skip only the upload.
  There is no Pages GitHub integration — do not re-add one (it would
  double-deploy). `deploy-api.yml` stays API-only.
- **Supersedes:** `infra/pages.md` (the `skramz-web` Pages project is
  deleted after cutover verification).

## Env vars (Production + Preview)

| Var | Value | Notes |
| --- | ----- | ----- |
| `VITE_API_URL` | `https://api.skramz.org` | API base (Worker custom domain). Baked at build time: set as the build env in `deploy-web.yml` **and** as the fallback in `web/.env.production` (public URL, safe in git). A preview built without it falls back to the same value. |

The `NEXT_PUBLIC_*` prefix died with Next.js (ADR-0004 Q3); no
`envPrefix`/`define` shim carries it forward. `api.ts` `API_URL` still
falls back to `https://api.skramz.org` when the var is unset (local dev
without env files).

Note: until data pages consume `src/hooks.ts`, the bundle tree-shakes
the API client out, so the URL is not greppable in `dist/` — the build
log's `VITE_API_URL=…` echo is the proof it resolved.

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

`api/src/index.ts` allows exactly `https://skramz.org` and
`https://www.skramz.org` via `hono/cors` (maintained proof:
`api/test/cors.test.ts`). Workers.dev preview origins are NOT allowed —
a preview deployment's browser fetches to the production API will not
carry an allow-origin header (accepted; follow-up in #55 if preview data
fetching is ever needed). Ingestion writes stay gated by
`INGESTION_TOKEN` regardless of origin.

## Notes

- No secrets in git or in build env values — this project needs none
  (`CLOUDFLARE_*` stay in GitHub secrets).
- Free tier: the frontend is fully static (no SSR/RSC/ISR — a future ADR
  re-opens that). API walls (100k req/day, 10ms CPU, 5M D1 row-reads/day)
  are recorded in `infra/d1.md` and bind the Worker/D1, not this project.
