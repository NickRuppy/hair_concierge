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
# head. The helper also proves the four required Personal Plan migrations are
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
cp "$repository_root"/supabase/templates/*.html "$test_project_root/supabase/templates/"

cp "$repository_root/supabase/tests/waitlist_signup_outbox.sql" \
  "$test_project_root/supabase/tests/waitlist_signup_outbox.sql"
cp "$repository_root/supabase/tests/personal_plan_stage1_3_foundation.sql" \
  "$test_project_root/supabase/tests/personal_plan_stage1_3_foundation.sql"

supabase=(npm exec -- supabase --workdir "$test_project_root")
repository_supabase=(npm exec -- supabase)
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

if "${repository_supabase[@]}" status --output json >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Refusing to reset an already-running local Supabase project.
Stop it first so this isolated contract owns the configured local ports.
EOF
  exit 2
fi

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
  --local
