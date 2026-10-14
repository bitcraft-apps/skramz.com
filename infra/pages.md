# Pages project + preview deploys (issue #3)

## Project

- **Name:** `skramz-web` — the system's only frontend host (Cloudflare
  Pages, free tier).
- **Root:** `web/` (Next.js App Router; scaffolded under issue #11).
  Status: **blocked** — `web/` holds only `.gitkeep`, so there is
  nothing to deploy yet.
- **Created with:** dashboard → Workers & Pages → Create → Pages →
  Connect to Git (`bitcraft-apps/skramz.com`, production branch `main`).
  There is no GitHub workflow for Pages deploys; the Pages GitHub
  integration owns them — do not add one (it would double-deploy).
  `deploy-api.yml` stays Worker-only.
- **Build:** root directory `web/`, build command `pnpm build`
  (= `task build:web`), Node `22` + pnpm `9.15.4` to match `web-ci`.

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
| `skramz.org` | Pages → Custom domains | Blocked — needs #11 scaffold + first prod build |
| `www.skramz.org` | Same Pages project | Blocked — same as above |

Attach the domains only after the first successful production build;
certificates are automatic. Frontend origin is `https://skramz.org`.

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

## Manual dashboard steps (account owner only)

1. Create the Pages project as above; confirm production branch `main`
   and PR previews on.
2. Set `NEXT_PUBLIC_API_URL=https://api.skramz.org` for Production
   **and** Preview environments.
3. After the first successful prod build, attach `skramz.org` and
   `www.skramz.org` under Pages → Custom domains.

## Notes

- No secrets in git or in Pages env values — this project needs none
  (`CLOUDFLARE_*` / `D1_DATABASE_ID` stay in GitHub secrets).
- Free tier: keep the frontend static (Pages free builds/bandwidth).
  API walls (100k req/day, 10ms CPU, 5M D1 row-reads/day) are recorded
  in `infra/d1.md` and bind the Worker/D1, not this project.
