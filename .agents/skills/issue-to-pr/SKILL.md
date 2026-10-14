---
name: issue-to-pr
description: Reusable issue-to-PR pipeline for skramz.com — spec, implement, document, PR, bounded code-review loop, follow-up issues, deterministic + AI-agent tests, CI gate, merge and close. Invoke with an issue number.
---

# Issue to PR (skramz.com)

Run the full pipeline for one GitHub issue. Stop at the first failed gate; never skip a gate to reach merge.

## Parameters

| Param | Required | Example | Notes |
|---|---|---|---|
| `issue` | yes | `5` | GitHub issue number in `bitcraft-apps/skramz.com`. No default — ask if missing. |
| `base` | no | `main` | Branch to branch from. Override only when a dependency branch is unmerged (see Stage 0). |
| `max_review_passes` | no | `3` | Hard cap on code-review loop. Never exceed 3. |

Invocation: `/issue-to-pr 5` or "run issue-to-pr for #5".

## Hard gates (non-negotiable)

1. **Never merge on red CI.** All required checks for the PR must be green (`gh pr checks`).
2. **Never merge without an approved review.** The code-review loop (Stage 5) must end in APPROVED within `max_review_passes`; otherwise stop and report.
3. **Never `--yes` / `--force` a confirmation.** The CLI (`cli-agent/`) requires human `[Y/n]` before any API write; non-TTY aborts. Do not pass `--yes` (forbidden in `AGENTS.md`), do not pipe `yes`, do not set `CI=true` to bypass it.
4. **Secrets never in git.** `INGESTION_TOKEN`, R2 keys, and tokens go via `wrangler secret` / GitHub secrets only. If a secret appears in a diff, stop, remove it, and report.
5. **Free-tier walls.** Cloudflare free tier only (100k req/day, 10ms CPU, 5M D1 row-reads/day). No paid services, no VPS, no Postgres-isms — D1 migrations stay portable SQLite.
6. **No history rewrite.** No `filter-branch`, `rebase`/`amend` of pushed commits, `reset --hard`, or ref deletion unless the human explicitly asks.
7. **Scope = the issue.** Do not expand beyond the issue's acceptance criteria. Out-of-scope findings become follow-up issues (Stage 6), not drive-by fixes.

## Stage 0 — Preflight

```bash
gh issue view <issue> --json number,title,state,body,labels,url
git status --short && git branch --show-current
```

- Confirm the issue is OPEN and unambiguous; record title, acceptance criteria (verbatim), dependencies, and persona.
- Inspect the base: if a dependency issue is closed-but-unmerged (e.g. its `agent/issue-<n>` branch is ahead of `main` with no PR), branch from that dependency branch or merge it first — do not duplicate its scaffold from `main`. Name the choice in the spec.
- Read `AGENTS.md`, `Taskfile.yml`, `.github/workflows/ci.yml`, and `.github/path-filters.yml` so commands and CI expectations match the repo.
- Branch: `agent/issue-<issue>` from the chosen base. Never work on `main`.

## Stage 1 — Spec

Write `docs/plans/YYYY-MM-DD-issue-<issue>-<kebab-title>.md` (repo convention: date-prefixed kebab-case in `docs/plans/`, per `README.md`).

Required sections: Scope (in/out), Acceptance criteria (verbatim from the issue), Context and dependencies, Design, Data/API contracts (freeze downstream consumers), Test plan (each criterion maps to a named test), Risks/rollback, Open questions.

Gate: every acceptance criterion maps to ≥1 named test; branch plan resolves dependency state from Stage 0.

## Stage 2 — Implement

- Implement exactly the spec. Follow `AGENTS.md`: D1 binding `DB`, migrations in `api/migrations/` (ordered, never renumber applied ones), `band_members` + `WITH RECURSIVE`, Next.js App Router + TanStack Query/Zustand (no Redux), Tailwind v4.
- Run the area's own checks as you go: `task test:api` / `task test:web` / `task test:cli`, plus `pnpm typecheck` in `api/` when present.
- Commit in small, conventional commits on `agent/issue-<issue>`. Leave unrelated untracked files alone.

## Stage 3 — Document

- Update the spec doc with what actually shipped (deviations noted, not hidden).
- Update `README.md` / `docs/plans/` / `AGENTS.md` only if behaviour, commands, or conventions changed. No doc change is valid if nothing user-visible changed — say so in the PR instead.

## Stage 4 — Create PR

```bash
git push -u origin agent/issue-<issue>
gh pr create --title "<type>: <summary> (#<issue>)" --body "<summary, test evidence, Closes #<issue>>"
```

PR body must include: what changed, how each acceptance criterion is proven (command output, not checkbox alone), and `Closes #<issue>`. Record the PR number/URL.

## Stage 5 — Code-review loop (max 3 passes)

Use the `code-review` skill convention: one parent-owned loop, fresh read-only reviewer per pass scoped to the PR diff/SHAs, no session history.

1. Pass `n` (1..`max_review_passes`): review the diff for correctness, security, performance, maintainability, and spec compliance.
2. Disposition every finding: fix (in-scope), follow-up issue (Stage 6), or wontfix with reason.
3. After fixes, re-review only changed files plus direct dependencies.
4. Exit APPROVED only with zero blocking findings. If pass 3 still blocks: **stop — do not merge**, report findings, leave the PR open.

## Stage 6 — Follow-up issues from review

For each out-of-scope or deferred review finding:

```bash
gh issue create --title "<finding>" --body "From PR #<pr> review of #<issue>: <detail, file:line, suggested fix>"
```

Link follow-ups in the PR and in the original issue. Never silently drop a finding; never fix out-of-scope work in this PR.

## Stage 7 — Deterministic tests + AI-agent test, fix loop

1. Deterministic: run the touched area's suite — `task test` (or `task test:api` / `test:web` / `test:cli` per `.github/path-filters.yml`) — plus any migration/fresh-DB proof the spec requires (e.g. `task migrate` on a fresh local D1).
2. AI-agent test: exercise the change through its real public surface as an agent/user would (run the CLI preview, call the endpoint, drive the UI path) and record observed output. A unit-test pass alone does not satisfy this step.
3. Fix loop: on any failure, fix the root cause and re-run both. Loop until both are green; if a failure is pre-existing on the base branch, prove it (`git stash`-equivalent check on base) and report it as a finding — do not weaken tests to pass.

Gate: deterministic suite green AND AI-agent test evidence recorded.

## Stage 8 — CI check

```bash
gh pr checks <pr> --watch
```

- CI runs path-filtered jobs (`api-ci`: typecheck+test, `web-ci`: lint+build, `cli-ci`: vet+test). Wait for completion; do not merge on pending or failed checks.
- On red CI: pull the failing job log, fix, push, re-check. Red CI that is pre-existing on `main` is reported, not merged over.

## Stage 9 — Merge and close

Only when Stage 5 = APPROVED, Stage 7 green, and Stage 8 green:

```bash
gh pr merge <pr> --squash --delete-branch
gh issue close <issue> --comment "Shipped in PR #<pr>: <summary + evidence links>"
```

Verify the issue is CLOSED and the PR is MERGED, then report: PR URL, review passes used, follow-up issue numbers, test/CI evidence. If any gate failed, report the exact gate and stop — closing or merging anyway is a hard-gate violation.

## Toolset note

The generic loop (Stages 4–6, 8–9: `gh` PR/review/follow-up/CI/merge mechanics) is repo-agnostic and is a candidate for `sgraczyk/toolset` (`agents/skills/`). Stages 0–3 and 7 are skramz-specific (Taskfile, D1/`DB` binding, `docs/plans/` convention, `cli-agent` `[Y/n]` rule, free-tier walls) and stay local. Do not move anything without a separate, explicit task — this skill ships local-only.
