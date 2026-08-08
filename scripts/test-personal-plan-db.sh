#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

baseline_file="$repository_root/supabase/tests/baselines/20260808_production_public_schema.sql"
baseline_metadata_file="$repository_root/supabase/tests/baselines/personal_plan_production_baseline.json"
reference_seed_file="$repository_root/supabase/tests/baselines/personal_plan_reference_seed.sql"
transition_preparer="$repository_root/scripts/ci/prepare-personal-plan-db-transition.mjs"

for required_file in "$baseline_file" "$baseline_metadata_file" "$reference_seed_file" "$transition_preparer"; do
  if [[ ! -f "$required_file" ]]; then
    printf 'Missing Personal Plan database harness input: %s\n' "$required_file" >&2
    exit 2
  fi
done

test_workspace="$(mktemp -d "${TMPDIR:-/tmp}/personal-plan-db-contract.XXXXXX")"
test_project_root="$test_workspace/project"
test_project_id="hair_conscierge_personal_plan_contract"
mkdir -p \
  "$test_project_root/supabase/migrations" \
  "$test_project_root/supabase/templates" \
  "$test_project_root/supabase/tests"

# This validates the checked-in production baseline before any Docker command,
# then copies every repository migration newer than the recorded production
# head. The helper also proves the required Personal Plan migrations are
# present in their frozen relative order.
node "$transition_preparer" \
  --metadata "$baseline_metadata_file" \
  --baseline "$baseline_file" \
  --migrations "$repository_root/supabase/migrations" \
  --output "$test_project_root/supabase/migrations" \
  --reference-seed "$reference_seed_file"

cp "$repository_root/supabase/config.toml" "$test_project_root/supabase/config.toml"
perl -0pi -e \
  's/^project_id = "hair_conscierge"$/project_id = "hair_conscierge_personal_plan_contract"/m' \
  "$test_project_root/supabase/config.toml"
# Keep this disposable project isolated even when the normal developer stack
# is already running. Cleanup below still targets only the dedicated project.
perl -0pi -e \
  's/port = 54321/port = 55321/g; s/port = 54322/port = 55322/g; s/shadow_port = 54320/shadow_port = 55320/g; s/port = 54329/port = 55329/g; s/port = 54323/port = 55323/g; s/port = 54324/port = 55324/g; s/port = 54327/port = 55327/g; s/inspector_port = 8083/inspector_port = 18083/g' \
  "$test_project_root/supabase/config.toml"
cp "$repository_root"/supabase/templates/*.html "$test_project_root/supabase/templates/"

cp "$repository_root/supabase/tests/waitlist_signup_outbox.sql" \
  "$test_project_root/supabase/tests/waitlist_signup_outbox.sql"
cp "$repository_root/supabase/tests/personal_plan_stage1_3_foundation.sql" \
  "$test_project_root/supabase/tests/personal_plan_stage1_3_foundation.sql"
cp "$repository_root/supabase/tests/personal_plan_stage4_routine.sql" \
  "$test_project_root/supabase/tests/personal_plan_stage4_routine.sql"
cp "$repository_root/supabase/tests/personal_plan_stage4_source_reconciliation.sql" \
  "$test_project_root/supabase/tests/personal_plan_stage4_source_reconciliation.sql"

supabase=(npm exec -- supabase --workdir "$test_project_root")
started_by_this_script=false

cleanup() {
  exit_status=$?

  if [[ "$started_by_this_script" == "true" ]]; then
    "${supabase[@]}" stop --project-id "$test_project_id" --no-backup >/dev/null || true
  fi

  if [[ -n "${test_workspace:-}" && -d "$test_workspace" ]]; then
    rm -rf -- "$test_workspace"
  fi

  exit "$exit_status"
}

trap cleanup EXIT INT TERM

"${supabase[@]}" stop --project-id "$test_project_id" --no-backup >/dev/null 2>&1 || true
started_by_this_script=true
"${supabase[@]}" start

# `supabase start` creates the disposable database and applies the verified
# baseline, pre-transition reference seed, and every migration newer than the
# recorded production head. A second `db reset` would only replay the same
# inputs while restarting unrelated local services.
"${supabase[@]}" test db \
  "$test_project_root/supabase/tests/waitlist_signup_outbox.sql" \
  "$test_project_root/supabase/tests/personal_plan_stage1_3_foundation.sql" \
  "$test_project_root/supabase/tests/personal_plan_stage4_routine.sql" \
  "$test_project_root/supabase/tests/personal_plan_stage4_source_reconciliation.sql" \
  --local
