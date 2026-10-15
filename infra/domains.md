# Domains — skramz.org (Cloudflare Registrar)

## Zone

- **Domain:** `skramz.org` — registered at Cloudflare Registrar
  (at-cost, auto-renew on; confirm in dashboard → Domain Registration).
- **Zone/account:** same Cloudflare account as Workers/D1/R2
  (free tier). Nameservers are Cloudflare-assigned; DNS is managed
  in dashboard → `skramz.org` → DNS.
- `skramz.com` was unavailable (registered 2007, parked); `.org` chosen
  2026-10-13. GitHub repo renamed to `bitcraft-apps/skramz.org`
  2026-10-15 (issue #57); the old slug redirects.

## Hostnames

| Host | Target | How attached | Status |
| ---- | ------ | ------------ | ------ |
| `skramz.org` | Worker `skramz-web` (web/, Static Assets) | `routes` custom_domain in `web/wrangler.toml` (deploy creates DNS) | Cutover from Pages — owner runbook in `infra/web-hosting.md` (issue #55) |
| `www.skramz.org` | Same Worker | Same `routes` entry | Same as above |
| `api.skramz.org` | Worker `skramz-api` | `routes` custom_domain in `api/wrangler.toml` (deploy creates DNS) | ✅ Live 2026-10-13 — `curl https://api.skramz.org/healthz` → 200 `{"ok":true,"db":1}` |
| `skramz-api.s-graczyk.workers.dev` | Worker staging | `workers_dev = true` in `api/wrangler.toml` | ✅ Live 2026-10-13 |

- Frontend origin is `https://skramz.org`; API base is
  `https://api.skramz.org` (`VITE_API_URL` in `.env.example`,
  baked at build time). API CORS allows exactly `https://skramz.org`
  + `https://www.skramz.org` (`api/src/index.ts`, tested in
  `api/test/cors.test.ts`).
- No mail on this domain; do not add MX records (keeps spoofing surface
  at zero). Add SPF/DKIM/DMARC only if mail is ever introduced.

## Deployed resources (2026-10-13)

- Worker `skramz-api` deployed; bindings `DB` (D1 `skramz`) and `MEDIA`
  (R2 `skramz-media`). Current version `fe732a7b-…`.
- D1 `skramz` created; remote migrations `0001_init.sql` +
  `0002_five_tables.sql` applied.
- R2 bucket `skramz-media` created.
- Real ids stay in `D1_DATABASE_ID` / secrets — never in git. For a
  manual remote run, paste the id into `api/wrangler.toml`
  (`database_id`) temporarily and restore the placeholder before commit.

## Manual dashboard steps (account owner only)

1. Registrar: confirm `skramz.org` auto-renew + registrant contacts.
2. ~~First Worker deploy~~ ✅ done 2026-10-13 — `api.skramz.org` DNS
   record + certificate created automatically. Re-verify with
   `curl https://api.skramz.org/healthz`.
3. Web Worker `skramz-web` — **cutover** (issue #55, ADR-0004):
   `skramz.org` + `www.skramz.org` move from the Pages project to the
   Worker via `web/wrangler.toml` `routes`, then the Pages project is
   deleted. Owner runbook + verify commands: `infra/web-hosting.md`.
   (`infra/pages.md` is superseded history — do not follow it.)
4. `workers.dev` subdomain: `skramz-api.s-graczyk.workers.dev`.
5. GitHub secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
   `D1_DATABASE_ID`) must be set for `.github/workflows/deploy-api.yml`
   (push to `main` touching `api/**`, or manual dispatch) to deploy.
   Check with `gh secret list --repo bitcraft-apps/skramz.org`.
