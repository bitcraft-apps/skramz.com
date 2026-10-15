# Pages project + preview deploys (issue #3)

## Project

- **Name:** `skramz-web` — the system's only frontend host (Cloudflare
  Pages, free tier). Live at `https://skramz-web.pages.dev`, connected
  to `bitcraft-apps/skramz.com` (production branch `main`, PR previews
  on).
- **Root:** `web/` (Next.js App Router; scaffolded under issue #11).
  Status: **blocked** — `web/` holds only `.gitkeep`, so there is
  nothing to deploy yet (0 deployments; the first build will fail
  until #11 lands).
- **Created with:** dashboard → Workers & Pages → Create → Pages →
  Connect to Git. There is no GitHub workflow for Pages deploys; the
  Pages GitHub integration owns them — do not add one (it would
  double-deploy). `deploy-api.yml` stays Worker-only.
- **Build:** root directory `web/`, build command `pnpm build`
  (= `task build:web`), output directory `out`, build caching on.
  Node `22` + pnpm `9.15.4` (as `NODE_VERSION`/`PNPM_VERSION` on both
  Production and Preview) to match `web-ci`.

## Env vars (Production + Preview)

| Var | Value | Notes |
| --- | ----- | ----- |
| `NEXT_PUBLIC_API_URL` | `https://api.skramz.org` | API base (Worker custom domain). Set on **both** Production and Preview — `NEXT_PUBLIC_*` is baked at build time, so a preview built without it points at the wrong API. |

The issue text says `https://api.skramz.com`, but that host is stale:
`skramz.com` has been parked since 2007 and the live API is
`https://api.skramz.org` (see `infra/domains.md`, `.env.example`,
`api/wrangler.toml`). Use the `.org` value everywhere; anything pointing
at `api.skramz.com` will fail DNS.

## Domains

| Host | How attached | Status |
| ---- | ------------ | ------ |
| `skramz.org` | Pages → Custom domains (CNAME → `skramz-web.pages.dev`, proxied) | Attached; SSL auto-provisioning, not serving yet (no deployment) |
| `www.skramz.org` | Same Pages project | Attached; same as above |

Certificates are automatic (Google CA). Observed right after setup:
`skramz.org`, `www.skramz.org`, and `skramz-web.pages.dev` all return
HTTP 522 with a valid cert — expected with 0 deployments. Frontend
origin is `https://skramz.org`; it serves 200 only after the first
successful production build (needs #11).

## Preview behavior (ADR-0001 precedent)

Staging rides preview URLs — no second Pages environment, same pattern as
the Worker's `workers.dev` preview (ADR-0001). Push to `main` deploys
production; every PR gets a unique `*.pages.dev` preview URL. Previews
never clobber production, and a Preview env change never leaks into the
production build.

## Verify (maps 1:1 to the issue acceptance criteria)

```bash
# (1) push to main -> prod deploy live; open PR -> preview URL visible
# (2) preview build log shows NEXT_PUBLIC_API_URL resolved to
#     https://api.skramz.org
curl https://skramz.org            # 200 after first prod deploy
curl https://api.skramz.org/healthz  # 200 {"ok":true,"db":1}
# (3) this file exists with project/build/env/domain record
```

## Dashboard setup (done by account owner)

1. ✅ Pages project `skramz-web` created via Connect to Git;
   production branch `main`, PR previews on.
2. ✅ `NEXT_PUBLIC_API_URL=https://api.skramz.org` set for Production
   **and** Preview environments.
3. ✅ `skramz.org` and `www.skramz.org` attached under Pages →
   Custom domains (ahead of the first build; they serve traffic only
   after #11 lands and the first production build succeeds).

## Notes

- No secrets in git or in Pages env values — this project needs none
  (`CLOUDFLARE_*` / `D1_DATABASE_ID` stay in GitHub secrets).
- Free tier: keep the frontend static (Pages free builds/bandwidth).
  API walls (100k req/day, 10ms CPU, 5M D1 row-reads/day) are recorded
  in `infra/d1.md` and bind the Worker/D1, not this project.
