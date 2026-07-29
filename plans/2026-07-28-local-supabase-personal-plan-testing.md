# Local Supabase testing for the Personal Plan funnel

## Outcome and source context

Enable the Personal Plan quiz to be tested locally from quiz completion through the real prepared offer without changing the shared Supabase project.

Source context:

- Personal Plan implementation plan: `plans/2026-07-28-personal-plan-offer-integration.md`
- Target migrations:
  - `supabase/migrations/20260728120000_add_leads_quiz_kind.sql`
  - `supabase/migrations/20260728130000_add_personal_plan_prepared_artifacts.sql`
- Supabase recommends developing against a local CLI stack, replaying migrations locally, and only then deploying reviewed migrations to a linked project.

## Chosen direction

Use the Supabase CLI with a Docker-compatible local container runtime and add a guarded local-development launcher that points only the Personal Plan worktree at the local Supabase API.

The local stack must replay the complete migration chain. We will not apply only the final two migrations to an incomplete database, and we will not edit the shared `.env.local` to swap between local and production.

The shared hosted database remains a fallback only if the local migration chain cannot be made reproducible in the available implementation window.

## Scope and non-goals

In scope:

- Install and start one Supabase-supported local container runtime.
- Recreate the repository schema locally from the committed migration chain.
- Run the Personal Plan app against local Supabase credentials without changing `.env.local`.
- Suppress outbound vendor analytics and Customer.io delivery during the local funnel test.
- Verify the real quiz preparation, lead attachment, and personalized offer transition locally.
- Add a repeatable migration smoke check so future schema-dependent work does not discover this boundary manually.

Non-goals:

- No migration, seed, or test-row writes to the shared Supabase project in the preferred path.
- No Stripe or PayPal transaction testing.
- No production deployment, feature-flag enablement, commit, push, or merge as part of the local setup.
- No copy or layout changes to the quiz or offer.
- No production-data clone. The Personal Plan transition needs schema and test rows, not customer data.

## Target map

- `supabase/config.toml`
  - Confirm the local Postgres major version and add the Personal Plan worktree callback URL only if auth testing requires it.
  - Keep secrets referenced through environment variables.
- `supabase/migrations/**`
  - Replay the full chain with `db reset --local`.
  - Do not rewrite already-deployed migrations merely to make a failing reset disappear.
- `scripts/worktree-dev-local-supabase.mjs` (new)
  - Read local API URL, anon key, and service-role key from `supabase status -o env`.
  - Refuse to start unless the Supabase URL resolves to `localhost` or `127.0.0.1`.
  - Pass the local credentials directly to the existing worktree dev process.
  - Enable `PERSONAL_PLAN_QUIZ_V1_ENABLED=true`.
  - Disable local vendor analytics, funnel delivery, and Customer.io server delivery.
- `package.json`
  - Add a clear local-stack command such as `dev:worktree:local-db`.
  - Add a migration verification command that explicitly targets `--local`.
- `.github/workflows/ci.yml`
  - Follow-up hardening: start local Supabase and replay migrations in CI, subject to measured runtime.
- Personal Plan API and browser flow
  - `src/app/api/quiz/personal-plan-prepare/route.ts`
  - `src/app/api/quiz/personal-plan-lead/route.ts`
  - `/lp/haarplan`
  - `/lp/haarplan/angebot`

## Designed operator and test journey

There is no end-user production change in this plan.

1. A developer starts the supported container runtime.
2. From the Personal Plan worktree, the developer starts Supabase locally.
3. The CLI recreates the local database and applies every committed migration in timestamp order, including the two Personal Plan migrations.
4. A guarded launcher reads the local Supabase credentials and starts the worktree app with the Personal Plan flag enabled.
5. Browser analytics and server-side Customer.io delivery remain disabled for the localhost session.
6. A tester completes `/lp/haarplan` with a clearly synthetic email address.
7. The loading stage creates a prepared artifact in local Supabase.
8. Email completion attaches the artifact to a local lead and redirects to the real personalized offer route.
9. The tester reviews the offer but stops before initiating a real payment.
10. The test evidence confirms the local lead, artifact status, offer response, and absence of writes in the shared project.

Recovery:

- If the container runtime is stopped, the launcher exits with a local-stack instruction instead of falling through to production credentials.
- If the migration reset fails, stop and diagnose the first failing migration. Do not bypass the full-chain failure by applying only the final migrations.
- If a local migration-chain repair is not proportionate to the immediate funnel review, use the hosted fallback described below only after explicit approval.

## Mockup evidence

No mockup is required. This is a backend and developer-workflow change; the existing reviewed quiz and offer surfaces remain unchanged.

## Ordered tasks

### 1. Establish the local runtime

- Install Docker Desktop, the Supabase-documented preferred runtime, unless Nick explicitly prefers another supported runtime such as OrbStack.
- Start the runtime and verify that the Docker API is available.
- Run `npm exec -- supabase start`.

Completion criterion:

- `npm exec -- supabase status` reports healthy local API, database, Auth, and Studio services.

### 2. Prove the migration chain

- Run `npm exec -- supabase db reset --local --no-seed`.
- Run local database linting.
- Verify that `public.leads.quiz_kind`, `public.personal_plan_prepared_artifacts`, and all three Personal Plan functions exist with the intended service-role-only privileges.

Completion criterion:

- A clean local reset succeeds from the full committed migration history.
- The two Personal Plan migrations are present in local migration history.
- `anon` and `authenticated` cannot access the artifact table or execute its functions.

### 3. Add a guarded local launcher

- Add a launcher that maps Supabase CLI output to:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Preserve the existing dynamic worktree port behavior.
- Refuse non-local Supabase URLs.
- Disable external analytics and Customer.io delivery for this mode.

Completion criterion:

- The launched app reports a local Supabase host.
- Removing or stopping the local stack makes the launcher fail closed.
- `.env.local` remains unchanged.

### 4. Run automated and manual flow verification

- Run the Personal Plan unit and route suites.
- Add or run an integration smoke that creates an artifact, attaches it to a synthetic lead, loads the personalized offer, and cleans up its local rows.
- Complete the same journey manually in the browser at mobile and desktop widths.

Completion criterion:

- The quiz transitions to `/lp/haarplan/angebot` without the preparation error.
- The personalized offer is backed by the local prepared artifact.
- No checkout is initiated and no external vendor event is emitted.

### 5. Add migration regression protection

- Add a CI migration-reset job if its measured runtime is acceptable.
- If full Supabase startup is too expensive for every PR, run it only when `supabase/**` changes and on `main`.

Completion criterion:

- A broken migration chain fails before merge instead of during manual product testing.

## Hosted fallback

Use only if the local migration chain cannot be made reproducible in the immediate review window.

1. Recheck the linked migration history from the root checkout.
2. Do not use broad `db push`: the repository currently contains at least one local migration version that is absent remotely.
3. Re-review both target files for additive and backward-compatible behavior.
4. Apply only the two target SQL files, in order, to the shared Supabase project.
5. Record exactly those two versions in migration history.
6. Start the local app with external analytics and Customer.io disabled.
7. Test with a synthetic email, capture the created lead and artifact IDs, and remove only those test rows afterward.
8. Keep the Personal Plan production flag disabled until the application branch is reviewed and shipped.

This fallback changes shared production schema before application deployment, so it requires explicit authorization immediately before execution.

## Verification

Automated:

- `npm exec -- supabase db reset --local --no-seed`
- `npm exec -- supabase db lint --local`
- Personal Plan unit, persistence, route, and offer tests
- TypeScript and production build

Manual:

- Confirm the app process uses `127.0.0.1:54321`, not the hosted project.
- Complete the quiz, loading, email, and offer transition.
- Confirm retry behavior when the local database is intentionally stopped.
- Confirm no real payment action is performed.

Live-state:

- Preferred path: confirm the linked Supabase migration list and shared table counts are unchanged.
- Fallback path: verify exact target schema, function privileges, migration-history versions, feature-flag state, and test-row cleanup.

## Review and handoff

- Worktree: `.worktrees/personal-plan-quiz-v1`
- Preferred implementation stop point: local stack and local end-to-end offer transition verified; no publication.
- Mockup review: not applicable.
- Operator journey sign-off: pending.
- Counterpart review: attempted with Claude Opus/high effort on 2026-07-28, but blocked by the local Claude session limit until 00:50 Europe/Berlin. The blocked output is recorded in `plans/2026-07-28-local-supabase-personal-plan-testing.claude-review.md` and is not treated as approval.
- Main residual risk: the repository has not recently demonstrated that all 120 migrations replay successfully from an empty local database.
- Secondary residual risk: local Auth redirects are configured mainly for ports 3000 and 3449; post-payment Auth testing may require a separate callback adjustment, but it is not required for the quiz-to-offer test.
