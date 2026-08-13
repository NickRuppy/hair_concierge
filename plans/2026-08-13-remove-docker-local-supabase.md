# Remove Docker-backed local Supabase testing

## Outcome

The repository no longer starts, depends on, or schedules Docker-backed local Supabase services for development or verification. Normal hosted-Supabase application code, migrations, Edge Functions, templates, and linked-project CLI operations remain supported.

This is tooling and test-infrastructure cleanup only. It does not change the user-facing product, production data, migrations, feature flags, or deployment configuration.

## Scope

1. Remove the disposable local-Supabase database harness, production-schema test baseline, pgTAP suites, and helper generators used only by that harness.
2. Remove the Stage 4, Stage 5, and Stage 1-to-5 Playwright harnesses/specs that start local Supabase and call Docker directly.
3. Remove legacy local-Supabase UX-audit seed/user helpers and their current workflow reference.
4. Remove the database and persisted-journey CI jobs, the obsolete `personal_plan_db` path-classification output, and Docker-backed commands from `package.json` and `test:contracts`.
5. Remove the dedicated local-Supabase planning artifact and manual backfill fixture that only targets a reset local database.
6. Update CI contract tests with negative assertions that prevent the removed jobs, outputs, and commands from returning. Clarify the README's ambiguous test-user wording.

## File inventory

| Remove                                                                                                                                             | Keep                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `scripts/test-personal-plan-db.sh`                                                                                                                 | `supabase/migrations/**`                                                                                  |
| `scripts/ci/prepare-personal-plan-db-transition.mjs`                                                                                               | `supabase/functions/**`                                                                                   |
| `scripts/ci/generate-catalog-enrichment-heat-db-contract.ts`                                                                                       | `supabase/templates/**`                                                                                   |
| `scripts/ci/generate-catalog-enrichment-scalp-db-contract.ts`                                                                                      | `supabase/config.toml` and the Supabase CLI dependency for hosted-project operations                      |
| `supabase/tests/**`                                                                                                                                | `tests/personal-plan-stage4-*.test.ts` and `tests/personal-plan-stage5-*.test.ts[x]` unit/contract suites |
| `tests/personal-plan-db-harness.test.ts`                                                                                                           | `tests/personal-plan-stage3.spec.ts` and its fixture-backed CI command                                    |
| `scripts/test-personal-plan-stage4-browser.sh` and `tests/personal-plan-stage4-routine.spec.ts`                                                    | `test:personal-plan-stage5` (the non-browser Node suite)                                                  |
| `scripts/test-personal-plan-stage5-browser.sh` and `tests/personal-plan-stage5-application.spec.ts`                                                | Hosted-secret Playwright smoke jobs                                                                       |
| `scripts/test-personal-plan-stage1-5-browser.sh` and `tests/personal-plan-stage1-5.spec.ts`                                                        | Historical plans and receipts that truthfully record prior verification                                   |
| `tests/personal-plan-browser-harness.test.ts` and its harness-only diagnostic branch in `playwright.config.ts`                                     | Application Supabase clients and production integration                                                   |
| `scripts/ux-audit-create-test-user.mjs` and `scripts/ux-audit-seed.mjs`                                                                            | Current authenticated review guidance without legacy helper references                                    |
| `supabase/manual-test-backfills/20260730_funnel_session_quiz_variant.sql` and only its manual-proof assertions in `tests/funnel-migration.test.ts` | The other manual test/backfill SQL files and the migration's source-level contract assertions             |
| `plans/2026-07-28-local-supabase-personal-plan-testing.md`                                                                                         | This plan as the durable cleanup record                                                                   |

`personal_plan_db` is removed from CI path classification because it only schedules the retired local database job. `personal_plan_journey` stays because it still gates the retained Stage 3 fixture-backed browser contracts.

## Explicitly retained

- `@supabase/supabase-js`, `@supabase/ssr`, and application integration with hosted Supabase.
- The Supabase CLI dependency and `supabase/config.toml`, because they predate this testing layer and remain useful for linked-project migration/config operations; neither causes Docker to run unless a local-service command is invoked.
- `supabase/migrations/**`, `supabase/functions/**`, and `supabase/templates/**`.
- Historical plans and receipts whose Docker/local-Supabase references truthfully record earlier work, except the dedicated plan being retired.
- The Stage 3 fixture-backed Playwright contracts and other test suites that do not start local Supabase.

## Verification

- Search all tracked executable/config/current-instruction paths for Docker and removed local-Supabase commands; remaining matches must be historical records or retained CLI/config context.
- Run the CI path-rule and workflow-orchestration contract tests.
- Run the Personal Plan browser-harness/static contracts affected by command removal, then the repository TypeScript and lint gates.
- Run the relevant broader test/build checks required by `ready-check`, recording any environment-only blockers separately.
- Review the complete diff for orphaned scripts, stale CI outputs, and accidental removal of hosted-Supabase assets.

## Stop boundary

Leave a verified local worktree on `codex/remove-docker-local-supabase`. Do not commit, push, open a PR, deploy, or perform a database write without separate authorization.
