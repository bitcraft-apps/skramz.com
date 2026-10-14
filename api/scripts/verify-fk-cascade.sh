#!/usr/bin/env bash
# Verify FK enforcement + ON DELETE CASCADE on D1 (issue #23).
#
# Usage (run from api/ or via `task verify:remote-cascade`):
#   ./scripts/verify-fk-cascade.sh [--remote|--local]   # default: --remote
#
# --local is a dry run against local D1 (needs `task migrate` first).
# --remote needs Cloudflare auth (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
# and the real database_id pasted into wrangler.toml (uncommitted — never in git).
#
# Only sentinel rows (ids starting with __verify23_) are written and deleted,
# so a --remote run never touches real data. Exit 0 + PASS on success.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:---remote}"
if [[ "$MODE" != "--remote" && "$MODE" != "--local" ]]; then
  echo "usage: $0 [--remote|--local]" >&2
  exit 2
fi

if [[ "$MODE" == "--remote" ]] && grep -q 'database_id = "00000000-0000-0000-0000-000000000000"' wrangler.toml; then
  echo "refusing --remote run: wrangler.toml still has the placeholder database_id." >&2
  echo "paste the real ID temporarily (see infra/d1.md) and never commit it." >&2
  exit 2
fi

BAND="__verify23_band" MEMBER="__verify23_member"

exec_sql() {
  pnpm exec wrangler d1 execute skramz "$MODE" --json --command "$1"
}

count() { # $1 = table, $2 = WHERE clause
  exec_sql "SELECT COUNT(*) AS n FROM $1 WHERE $2" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].results[0].n))"
}

cleanup() {
  exec_sql "DELETE FROM bands WHERE id = '$BAND'" >/dev/null 2>&1 || true
  exec_sql "DELETE FROM members WHERE id = '$MEMBER'" >/dev/null 2>&1 || true
}
trap 'cleanup >/dev/null 2>&1 || true' EXIT

check() { # $1 = label, $2 = actual, $3 = expected
  echo "$1: $2 (expected $3)"
  [[ "$2" == "$3" ]] || FAIL=1
}

FAIL=0
cleanup
exec_sql "INSERT INTO bands (id, name, name_norm) VALUES ('$BAND', '__VERIFY23 Cascade Probe', '__verify23')" >/dev/null
exec_sql "INSERT INTO members (id, name, name_norm) VALUES ('$MEMBER', '__VERIFY23 Probe', '__verify23')" >/dev/null
exec_sql "INSERT INTO band_members (id, band_id, member_id) VALUES ('__verify23_bm', '$BAND', '$MEMBER')" >/dev/null
exec_sql "INSERT INTO releases (id, band_id, title) VALUES ('__verify23_rel', '$BAND', '__VERIFY23 Probe')" >/dev/null
exec_sql "INSERT INTO media_links (id, band_id, provider, url) VALUES ('__verify23_ml_b', '$BAND', 'youtube', 'https://example.com/b')" >/dev/null
exec_sql "INSERT INTO media_links (id, release_id, provider, url) VALUES ('__verify23_ml_r', '__verify23_rel', 'bandcamp', 'https://example.com/r')" >/dev/null

echo "--- before DELETE ---"
check "band_members" "$(count band_members "band_id = '$BAND'")" 1
check "releases" "$(count releases "band_id = '$BAND'")" 1
check "media_links" "$(count media_links "id LIKE '__verify23_ml%'")" 2

exec_sql "DELETE FROM bands WHERE id = '$BAND'" >/dev/null

echo "--- after DELETE ---"
check "band_members" "$(count band_members "band_id = '$BAND'")" 0
check "releases" "$(count releases "band_id = '$BAND'")" 0
check "media_links" "$(count media_links "id LIKE '__verify23_ml%'")" 0
check "members (survives)" "$(count members "id = '$MEMBER'")" 1

if [[ "$FAIL" == 0 ]]; then echo "PASS: FK + ON DELETE CASCADE enforced ($MODE)"; else echo "FAIL: cascade mismatch ($MODE)"; fi
exit "$FAIL"
