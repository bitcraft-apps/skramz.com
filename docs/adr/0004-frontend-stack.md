# 0004: Frontend stack — Vite + React SPA on Workers Static Assets

- Status: accepted
- Date: 2026-10-15 (owner interview, all three questions settled + contract accepted)

## Context

`web/` is empty (0 deployments) and the Pages project `skramz-web` serves
HTTP 522 on all hosts. A multi-agent research pass (Oct 2026, web sources)
found: Cloudflare directs new projects to Workers instead of Pages;
`@cloudflare/next-on-pages` is deprecated/archived in favor of `vinext`
(beta); `@cloudflare/vite-plugin` is the officially invested integration;
static-asset requests are free/unlimited while SSR burns the 100k req/day +
10ms CPU budget. Full findings live in the session research summary.

Constraints carried forward: Cloudflare free tier only; split Hono + D1
API at `https://api.skramz.org` stays unchanged; persistent audio across
navigation; WebGL graph (500 nodes / 60fps); Tailwind v4; TanStack Query
for server state, Zustand for UI state; lightweight DOM.

## Decision

**Decided (Q1, accepted by owner): Vite + React SPA (TypeScript) on
Workers Static Assets.** The split Hono + D1 API at
`https://api.skramz.org` is unchanged. Next.js is out for this project;
no `next-on-pages` / `vinext` / OpenNext SSR unless a future ADR
re-opens server rendering.

**Decided (Q2, accepted by owner): retire the `skramz-web` Pages
project once the Workers deployment is verified.** Sequence: detach
`skramz.org` + `www.skramz.org` from Pages, attach to the Worker,
confirm HTTP 200 on both, then delete the Pages project. No dual-host
period beyond the cutover.

## Decision (cont.)

**Decided (Q3, accepted by owner): the public API base URL var is
`VITE_API_URL`.** Value stays `https://api.skramz.org`, set on both
Production and Preview. The `NEXT_PUBLIC_*` prefix dies with Next.js;
no `envPrefix`/`define` shim to carry it forward.

## Consequences

- `web/` scaffolds as Vite + React + TypeScript (issue #11 gets
  rewritten, not patched); build output is `dist/`, not `out/`.
- `Taskfile.yml` `build:web` / `dev:web` / `test:web` and the CI web
  job target the Vite scaffold.
- `infra/pages.md` is superseded by a Workers Static Assets record;
  `infra/domains.md` moves `skramz.org` + `www` to the Worker.
- API CORS must allow origin `https://skramz.org` (verify, currently
  noted in `infra/domains.md`).
- The `skramz-web` Pages project is deleted after cutover verification.
- Non-goals: no SSR/RSC/ISR (a future ADR re-opens that); no API, D1,
  R2, or CLI changes; no editorial content work.

## Open questions

None. All three settled: Vite + React SPA on Workers Static Assets;
retire Pages after verified cutover; `VITE_API_URL`.
