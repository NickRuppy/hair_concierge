#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

test_workspace="$(mktemp -d "${TMPDIR:-/tmp}/personal-plan-stage1-5-browser.XXXXXX")"
test_project_root="$test_workspace/project"
test_project_id="hc_personal_plan_stage1_5_browser_$$"
port_seed=$((30000 + ($$ % 20000)))
api_port="$port_seed"
db_port=$((port_seed + 1))
shadow_port=$((port_seed + 2))
studio_port=$((port_seed + 3))
mailpit_port=$((port_seed + 4))
pooler_port=$((port_seed + 5))
analytics_port=$((port_seed + 6))
inspector_port=$((port_seed + 7))
app_port=$((20000 + ($$ % 10000)))
server_log="$test_workspace/next.log"
failure_server_log="$repository_root/test-results/personal-plan-stage1-5/server.log"
server_pid=""
started_by_this_script=false

stop_server() {
  if [[ -z "$server_pid" ]]; then
    return
  fi

  # The Python launcher creates a dedicated session/process group, so this can
  # stop only the Next tree started by this harness (npm -> next -> children).
  if kill -0 -- "-$server_pid" >/dev/null 2>&1; then
    kill -TERM -- "-$server_pid" >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 10); do
    if ! kill -0 -- "-$server_pid" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if kill -0 -- "-$server_pid" >/dev/null 2>&1; then
    kill -KILL -- "-$server_pid" >/dev/null 2>&1 || true
  fi
  wait "$server_pid" >/dev/null 2>&1 || true
  server_pid=""
}

cleanup() {
  exit_status=$?
  if [[ "$exit_status" -ne 0 && -f "$server_log" ]]; then
    mkdir -p "$(dirname "$failure_server_log")"
    cp "$server_log" "$failure_server_log"
    tail -n 120 "$server_log" >&2
  fi
  stop_server
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
PERSONAL_PLAN_TEST_PROJECT_ID="$test_project_id" \
PERSONAL_PLAN_API_PORT="$api_port" \
PERSONAL_PLAN_DB_PORT="$db_port" \
PERSONAL_PLAN_SHADOW_PORT="$shadow_port" \
PERSONAL_PLAN_STUDIO_PORT="$studio_port" \
PERSONAL_PLAN_MAILPIT_PORT="$mailpit_port" \
PERSONAL_PLAN_POOLER_PORT="$pooler_port" \
PERSONAL_PLAN_ANALYTICS_PORT="$analytics_port" \
PERSONAL_PLAN_INSPECTOR_PORT="$inspector_port" \
perl -0pi -e \
  's/^project_id = "hair_conscierge"$/q{project_id = "} . $ENV{PERSONAL_PLAN_TEST_PROJECT_ID} . q{"}/me; s/port = 54321/q{port = } . $ENV{PERSONAL_PLAN_API_PORT}/ge; s/port = 54322/q{port = } . $ENV{PERSONAL_PLAN_DB_PORT}/ge; s/shadow_port = 54320/q{shadow_port = } . $ENV{PERSONAL_PLAN_SHADOW_PORT}/ge; s/port = 54329/q{port = } . $ENV{PERSONAL_PLAN_POOLER_PORT}/ge; s/port = 54323/q{port = } . $ENV{PERSONAL_PLAN_STUDIO_PORT}/ge; s/port = 54324/q{port = } . $ENV{PERSONAL_PLAN_MAILPIT_PORT}/ge; s/port = 54327/q{port = } . $ENV{PERSONAL_PLAN_ANALYTICS_PORT}/ge; s/inspector_port = 8083/q{inspector_port = } . $ENV{PERSONAL_PLAN_INSPECTOR_PORT}/ge' \
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
export PERSONAL_PLAN_APP_V1_ROLLOUT=internal
export PERSONAL_PLAN_STAGE2_ENABLED=true
export PERSONAL_PLAN_STAGE3_ENABLED=true
export PERSONAL_PLAN_STAGE4_ENABLED=true
export PERSONAL_PLAN_STAGE5_ROLLOUT=internal
export PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF="2026-08-01T00:00:00Z"
export PERSONAL_PLAN_STAGE5_ISOLATED_BROWSER=1
export PERSONAL_PLAN_STAGE1_5_ISOLATED_BROWSER=1
export PERSONAL_PLAN_STAGE1_5_DB_CONTAINER="supabase_db_${test_project_id}"
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:$app_port"
export PERSONAL_PLAN_PLAYWRIGHT_DIAGNOSTICS=1

# NEXT_PUBLIC_* values are embedded in the browser bundle, so the production
# build must happen after the disposable Supabase environment is exported.
npm run build

# Run Next in an isolated session. Killing npm alone leaves its Next child
# behind, which can retain the port for the following browser harness.
python3 -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' \
  npm run start -- --hostname 127.0.0.1 --port "$app_port" >"$server_log" 2>&1 &
server_pid=$!

readiness_deadline=$((SECONDS + 180))
server_ready=false

while (( SECONDS < readiness_deadline )); do
  if curl --fail --silent --output /dev/null \
    --connect-timeout 2 --max-time 5 "$PLAYWRIGHT_BASE_URL/auth"; then
    server_ready=true
    break
  fi
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    tail -n 80 "$server_log" >&2
    exit 1
  fi
  sleep 1
done

if [[ "$server_ready" != "true" ]]; then
  echo "Next server did not become ready within 180 seconds." >&2
  tail -n 80 "$server_log" >&2
  exit 1
fi

npm exec -- playwright test tests/personal-plan-stage1-5.spec.ts \
  --project=chromium --workers=1
