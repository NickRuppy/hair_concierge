#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

test_workspace="$(mktemp -d "${TMPDIR:-/tmp}/personal-plan-stage5-browser.XXXXXX")"
test_project_root="$test_workspace/project"
test_project_id="hc_personal_plan_stage5_browser"
server_log="$test_workspace/next.log"
server_pid=""
started_by_this_script=false

cleanup() {
  exit_status=$?
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" >/dev/null 2>&1 || true
    wait "$server_pid" >/dev/null 2>&1 || true
  fi
  if [[ "$started_by_this_script" == "true" ]]; then
    npm exec -- supabase --workdir "$test_project_root" stop \
      --project-id "$test_project_id" --no-backup >/dev/null 2>&1 || true
  fi
  rm -rf -- "$test_workspace"
  exit "$exit_status"
}
trap cleanup EXIT INT TERM

mkdir -p "$test_project_root/supabase/migrations" "$test_project_root/supabase/templates"

node "$repository_root/scripts/ci/prepare-personal-plan-db-transition.mjs" \
  --metadata "$repository_root/supabase/tests/baselines/personal_plan_production_baseline.json" \
  --baseline "$repository_root/supabase/tests/baselines/20260808_production_public_schema.sql" \
  --migrations "$repository_root/supabase/migrations" \
  --output "$test_project_root/supabase/migrations" \
  --reference-seed "$repository_root/supabase/tests/baselines/personal_plan_reference_seed.sql"

cp "$repository_root/supabase/config.toml" "$test_project_root/supabase/config.toml"
cp "$repository_root"/supabase/templates/*.html "$test_project_root/supabase/templates/"
perl -0pi -e \
  's/^project_id = "hair_conscierge"$/project_id = "hc_personal_plan_stage5_browser"/m; s/port = 54321/port = 55521/g; s/port = 54322/port = 55522/g; s/shadow_port = 54320/shadow_port = 55520/g; s/port = 54329/port = 55529/g; s/port = 54323/port = 55523/g; s/port = 54324/port = 55524/g; s/port = 54327/port = 55527/g; s/inspector_port = 8083/inspector_port = 18085/g' \
  "$test_project_root/supabase/config.toml"

supabase=(npm exec -- supabase --workdir "$test_project_root")
"${supabase[@]}" stop --project-id "$test_project_id" --no-backup >/dev/null 2>&1 || true
started_by_this_script=true
"${supabase[@]}" start >"$test_workspace/supabase.log"

status_environment="$("${supabase[@]}" status -o env)"
eval "$status_environment"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export PERSONAL_PLAN_APP_V1_ENABLED=true
export PERSONAL_PLAN_STAGE2_ENABLED=true
export PERSONAL_PLAN_STAGE3_ENABLED=true
export PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF=2026-08-01T00:00:00Z
export PERSONAL_PLAN_STAGE4_ENABLED=true
export PERSONAL_PLAN_STAGE5_ROLLOUT=all
export PERSONAL_PLAN_STAGE5_ISOLATED_BROWSER=1
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:3225"

npm run dev -- --hostname 127.0.0.1 --port 3225 >"$server_log" 2>&1 &
server_pid=$!

for _ in $(seq 1 120); do
  if curl --fail --silent --output /dev/null "$PLAYWRIGHT_BASE_URL/auth"; then
    break
  fi
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    tail -n 80 "$server_log" >&2
    exit 1
  fi
  sleep 1
done
curl --fail --silent --output /dev/null "$PLAYWRIGHT_BASE_URL/auth"

npm exec -- playwright test tests/personal-plan-stage5-application.spec.ts --project=chromium

if [[ "${STAGE5_BROWSER_INSPECTION:-0}" == "1" ]]; then
  printf 'Stage 5 browser inspection ready at %s/auth?next=/anwendung\n' "$PLAYWRIGHT_BASE_URL"
  while true; do sleep 1; done
fi
