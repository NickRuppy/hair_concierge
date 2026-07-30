# Funnel Experience Attribution Alignment

**Status:** Implemented and reviewed; local database migration proof pending
**Date:** 2026-07-30
**Source context:** Follow-up to
[`plans/2026-07-09-funnel-attribution-infrastructure.md`](./2026-07-09-funnel-attribution-infrastructure.md),
[`docs/funnel-attribution.md`](../docs/funnel-attribution.md), and the in-progress Personal Plan
offer dashboard/payment-option work on `codex/offer-payment-option-exposure`.

## Outcome and source context

Keep the existing package/session architecture as the single attribution model, extend it so
multiple quiz flows and offer versions can run concurrently, and make confirmed purchases
queryable in PostHog by the exact stored experience without copying creative-version fields into
Stripe or PayPal metadata.

The review found:

- `utm_campaign` and the other UTM fields are acquisition metadata in
  `funnel_sessions.first_touch`; they describe the media source and never select product behavior.
- `funnel_package_key` is the immutable journey identity selected by an explicit entry URL. A new
  landing/quiz/offer combination must receive a new package key.
- `funnel_sessions` is the canonical detailed table. It stores the package plus immutable
  `landing_variant` and `offer_variant` snapshots and the first milestone timestamps.
- Live production data confirms the snapshot contract: historical sessions retain several offer
  variants under `default_organic`, including variants no longer selected by the current registry.
- The original package model assumed a shared quiz. The Personal Plan package now renders a
  different quiz inside its landing variant, but `funnel_sessions` has no independent quiz
  snapshot.
- `leads.quiz_kind` (`legacy` or `personal_plan`) and the Personal Plan submission envelope
  `version` (`2`) protect persistence/parsing. They are not campaign or experience identifiers.
- `offer_revision` is a semantic browser-diagnostics revision. The offer tracking contract
  explicitly says not to use it as a schema-version substitute.
- Stripe and PayPal correctly carry only `funnel_session_id` and `funnel_package_key`.
  Supabase purchase attribution resolves the canonical session. The PostHog billing destination
  currently forwards the provider/outbox payload without resolving the session snapshot.

## Chosen direction

Extend the existing explicit session snapshot with one required `quiz_variant`; do not add a second
campaign parameter and do not turn `offer_revision` into the journey identifier.

`quizVariant` is a validated attribution declaration, not a new runtime router. An owner-controlled
quiz registry maps each exact experience identity to its persistence family (`quizKind`) and its
current delivery seam:

- `legacy-quiz-v1` → `quizKind: legacy`, delivered through `/quiz`, compatible with the approved
  shared-quiz landing family;
- `personal-plan-quiz-v1` → `quizKind: personal_plan`, embedded by the
  `personal-plan-quiz` landing.

Packages may reference only registered, landing-compatible quiz variants. The funnel generator does
not create quiz implementations, and a contributor cannot declare an arbitrary quiz label that the
runtime does not render. Adding a new quiz implementation or changing its delivery remains an
owner-controlled follow-up.

Execute this as two reviewable slices in the same originating Codex task:

1. finish the already-scoped payment-option/dashboard work on
   `codex/offer-payment-option-exposure`, including the corrected eligible-cohort and historical
   purchase query contract;
2. implement the package/schema/PostHog enrichment on a fresh follow-up worktree after the first
   slice is preserved, so the production migration is not hidden inside an already broad UI and
   analytics diff.

Slice 2 is an intentional fast-follow, not a deferral until another quiz ships. Nick has confirmed
that parallel quiz and offer packages are a planned marketing capability, so adding the explicit
quiz dimension before the second live quiz avoids another ambiguous historical period.

The durable identity model will be:

| Dimension | Owner | Meaning | Mutation rule |
| --- | --- | --- | --- |
| `utm_campaign` and other UTM fields | Ad platform / inbound URL | Acquisition and creative reporting metadata | Stored as immutable first-touch data for the session; never selects a package |
| `funnel_package_key` | Funnel package registry | Immutable identity of one coherent landing + quiz + offer combination | Never rename or remap after traffic; create a new package for a new combination |
| `landing_variant` | Funnel package/session | Exact landing experience | Snapshot once on session creation |
| `quiz_variant` | Owner-controlled quiz registry plus funnel package/session | Exact quiz experience assigned to the journey; mapped to one `quiz_kind` and validated against its delivery seam | Snapshot once on session creation; actual exposure still requires `quiz_started` |
| `offer_variant` | Funnel package/session or existing sticky offer experiment | Exact offer experience/assigned arm | Snapshot on creation, with the existing pre-first-view sticky experiment assignment allowed |
| `quiz_kind` | Quiz registry plus lead persistence | Stable parser/domain family for stored quiz answers; several future variants may map to one kind | Stored on the lead and required to agree with the assigned registry entry; not used as acquisition attribution |
| quiz submission `version` | Quiz persistence contract | Schema version of the stored answer envelope | Stored inside the lead payload; not used as package identity |
| `offer_revision` | Browser analytics | Semantic revision for interpreting fine-grained offer events | Remains event-level; never sent to payment providers or used as the canonical experience version |

Provider metadata remains compact:

```text
funnel_session_id + funnel_package_key
```

At `purchase_completed` delivery, PostHog resolves the immutable experience snapshot from
`funnel_sessions` and adds the session/package/landing/quiz/offer dimensions to the server event.
This keeps Supabase authoritative, makes both Stripe and PayPal behave identically, and avoids
allowing client/provider metadata to disagree with the stored session.

UTM fields remain first-touch acquisition data in Supabase in this scope. They are not copied onto
the server purchase event. `funnel_package_key` supplies the coherent journey grouping in PostHog;
Meta/ad-platform reporting and Supabase first-touch reporting remain the acquisition views.

### Alternatives reviewed

1. **Use only `funnel_package_key`.** This is sufficient to identify a whole package, but it cannot
   compare a reused quiz across packages or describe an offer experiment arm independently. It also
   leaves the current landing/quiz conflation in place. Rejected.
2. **Add `quiz_variant` to the existing explicit snapshot.** This matches the existing
   `landing_variant`/`offer_variant` design, remains easy to query, and is the smallest extension
   needed for parallel quiz funnels. Chosen.
3. **Replace the explicit columns with a generic JSON experience snapshot.** This is flexible but
   weakens validation, indexing, contributor governance, and straightforward reporting. It is not
   justified for the three known experience dimensions. Rejected.

## Scope and non-goals

### In scope

- Add required `quizVariant` ownership to every funnel package and contributor/generator contract.
- Add one owner-controlled quiz registry that maps each variant to `quizKind` and validates how the
  current runtime delivers it.
- Add immutable `quiz_variant` to `funnel_sessions` and the transactional record RPC.
- Backfill existing rows deterministically from the package that created them.
- Resolve and attach the canonical funnel snapshot to PostHog `purchase_completed`.
- Align the Personal Plan dashboard query with the identity model:
  - exact package + offer variant + analytics revision define the eligible viewed cohort;
  - sticky pricing navigation remains separate from checkout intent;
  - authoritative journey counts and downstream joins require the eligible
    `funnel_session_id`; `distinct_id` is person identity and is never a fallback journey key;
  - revision-matched offer views missing the required session/package identity remain visible in a
    separate attribution-quality metric instead of being silently counted as funnel journeys;
  - confirmed purchases do not require an `offer_revision` property and use their resolved canonical
    session/variant properties.
- Update attribution, contributor, offer-analytics, and dashboard documentation and tests.

### Non-goals

- No end-user UI, copy, quiz-question, recommendation, offer-layout, pricing, checkout, entitlement,
  or payment-provider behavior changes.
- No new generic experimentation platform or quiz arm allocator.
- No refactor that makes `quizVariant` a runtime component/router selector in this change.
- No changes to existing package identities or historical offer assignments.
- No `offer_revision`, UTM values, quiz answers, or other expanded payload in Stripe/PayPal
  metadata.
- No dashboard publication, database migration application, commit, push, PR, merge, or deployment
  without the normal later gates.
- No attempt to make PostHog the canonical business ledger; Supabase remains authoritative.
- No UTM enrichment of `purchase_completed` in this change.

## Target map

### Package and contributor contract

- `src/funnels/packages.json`
- a new owner-controlled `src/funnels/quizzes/registry.ts` (exact filename may follow the existing
  landing/offer registry convention)
- `src/lib/funnel/packages.ts`
- `scripts/funnels/new-package.mjs`
- `.agents/skills/funnel-variant-creator/SKILL.md`
- `docs/funnel-contributions.md`
- `.github/workflows/ci.yml`
- `.github/PULL_REQUEST_TEMPLATE/funnel.md` if the package declaration table needs the quiz field
- `tests/funnel-packages.test.ts`
- `tests/funnel-generator.test.ts`
- `tests/funnel-variants.test.ts`
- focused quiz-registry/compatibility tests
- `tests/funnel-contributor-governance.test.ts`

### Canonical session snapshot

- a new additive migration after rechecking the latest timestamp in `supabase/migrations/`
- `supabase/migrations/20260711120000_funnel_attribution.sql` only as historical reference; do not
  edit an applied migration
- `src/lib/funnel/server.ts`
- `tests/funnel-migration.test.ts`
- `tests/funnel-server.test.ts`
- `tests/funnel-api.test.ts`

### Purchase delivery and dashboard

- `src/lib/billing/analytics-destinations/posthog-server.ts`
- a small shared read helper under `src/lib/funnel/` if needed to avoid duplicating session parsing
- `tests/billing-analytics-destinations.test.ts`
- `tests/billing-analytics-funnel-destination-migration.test.ts` only if the shared lookup changes
  its contract
- `scripts/analytics/personal-plan-offer-dashboard.ts`
- `tests/posthog-personal-plan-offer-dashboard.test.ts`
- `docs/analytics/offer-page-tracking.md`
- `docs/funnel-attribution.md`

Stripe/PayPal checkout creation and webhook files are verification targets, not intended edit
targets. Their compact metadata contract should remain unchanged.

## Designed operator and integration journey

There is no end-user journey change.

1. A marketer or contributor defines a new immutable package key and slug and selects one landing,
   one owner-approved compatible quiz declaration, and one offer variant. Reusing an approved
   component is allowed; changing any combination requires a new package. A new quiz implementation
   must first be registered by the owner with its `quizKind` and real delivery seam.
2. A visitor enters the explicit package URL. The signed cookie continues to store only visitor,
   session, and package identity; UTM parameters are captured separately as first-touch metadata.
3. The first recorded funnel milestone creates `funnel_sessions` with immutable landing, assigned
   quiz, and offer snapshots. The quiz snapshot says which lane was assigned; `quiz_started` is the
   separate proof that the visitor actually entered it. Returning visitors continue the stored lane
   even if the current registry later changes.
4. The current guided-story offer experiment may still replace the stored offer variant before the
   first offer view through its existing compare-and-set rule. This plan does not introduce a quiz
   experiment allocator.
5. Checkout creation sends only the session and package keys to Stripe or PayPal.
6. A confirmed provider webhook writes the durable billing outbox event. Supabase records the
   purchase against the referenced session.
7. The PostHog delivery resolves that session:
   - on success, it emits the canonical package, landing, quiz, and offer properties;
   - on a transient Supabase error, delivery remains retryable;
   - if the session is absent or the provider package mismatches it, it must not invent variant
     values. The event is delivered with a bounded attribution-status marker and the mismatch is
     observable.
8. An analyst can filter a PostHog dashboard by package and split by landing, quiz, or offer
   variant. UTM campaign remains a separate acquisition dimension in Supabase/ad-platform
   reconciliation rather than being conflated with the experience package.

Completion means one purchase can be traced consistently from its provider event to the canonical
session snapshot and then analyzed in PostHog without relying on `offer_revision`.

## Mockup evidence

No mockup is required because this plan changes only attribution schema, integration payloads,
query semantics, tests, and operator documentation. It does not change a rendered end-user surface.

## Ordered tasks

### Task 1: Lock the identity taxonomy in tests and documentation

1. Add the identity table above to `docs/funnel-attribution.md`.
2. Clarify in `docs/analytics/offer-page-tracking.md` that `offer_revision` helps interpret
   fine-grained browser events but is not the package, offer-version, or purchase-attribution key.
3. Add a regression assertion that UTM campaign fields remain reporting metadata and cannot select
   a package.

**Complete when:** the repo has one documented meaning and owner for package, UTM, variant, lead
kind, submission version, and offer revision, with no conflicting instruction in the contributor
workflow.

### Task 2: Add `quizVariant` to the package contract

1. Add an owner-controlled quiz registry whose entries define:
   - kebab-case `quizVariant`;
   - `quizKind` (`legacy` or `personal_plan` initially);
   - the current delivery seam (`/quiz` route or an explicit embedded landing);
   - allowed landing compatibility.
2. Require every `FunnelPackage` entry to reference one registered, landing-compatible quiz variant.
3. Use stable initial identities:
   - legacy/shared packages: `legacy-quiz-v1`;
   - `meta_personal_plan_v1`: `personal-plan-quiz-v1`.
   These are experience identities; they deliberately do not mirror the separate Personal Plan
   answer-envelope schema version `2`.
4. Add `--quiz <registered-variant>` to `npm run funnel:new`; reject unknown or
   landing-incompatible values and never generate quiz source files. Generated briefs and help text
   must show the selected approved identity.
5. Treat `quizVariant` as immutable in fork CI and contributor documentation. Keep the quiz registry
   and implementation outside contributor write scope.
6. Add compatibility tests that fail when:
   - a package references an unknown quiz;
   - its landing and quiz declaration are incompatible;
   - the registry maps a quiz variant to an unsupported `quizKind`;
   - the Personal Plan declaration no longer maps to `personal_plan`, or the shared declaration no
     longer maps to `legacy`.

**Complete when:** every package resolves one registered quiz identity whose kind and current
delivery seam match the real flow; the generator cannot invent a quiz; and CI protects the package
declaration and owner-controlled registry boundary.

### Task 3: Add the immutable session quiz snapshot

1. Create an additive migration that:
   - adds `quiz_variant text`;
   - aborts before mutation if production contains a package key outside the reviewed hardcoded
     mapping;
   - backfills all existing sessions through a hardcoded `CASE` keyed by immutable package identity;
   - applies a non-null constraint after the backfill;
   - documents the column as a historical snapshot independent of landing and offer;
   - drops the exact old 20-argument `record_funnel_event(...)` signature before recreating it with
     a defaulted `p_quiz_variant`, preventing ambiguous PostgREST overload resolution;
   - reissues the exact `REVOKE` and service-role `GRANT` for the new signature;
   - preserves the existing value on session conflict, just like landing/offer snapshots.
   Re-confirm the then-current function signature and grants from fresh `origin/main` before
   authoring the `DROP`; do not copy today's 20-argument signature blindly into the later slice.
2. Update `recordFunnelEventWithRpc` to pass the package quiz variant.
3. Do not edit the already-applied 2026-07-11 migration.
4. Sequence rollout as expand-first:
   - apply and verify the backward-compatible migration while old code still omits
     `p_quiz_variant`;
   - only then deploy code that sends the new named argument;
   - do not deploy the code first.
5. Test backfill mappings, fresh inserts, old 20-named-argument calls, new 21-named-argument calls,
   same-session retries, registry changes, grants, and purchase recording against an existing
   session on a real local Postgres/Supabase instance. This is an explicit manual local-Supabase
   verification outside CI: run `supabase db reset`, then execute a focused exercise SQL/script
   modeled on `supabase/manual-test-backfills/`. SQL text-regex tests alone are insufficient.

**Complete when:** new and historical sessions have a deterministic assigned quiz snapshot and no
later registry or event call can rewrite it, and both the pre-deploy and post-deploy RPC call shapes
have been executed successfully against a real database.

### Task 4: Enrich PostHog purchases from the canonical session

1. Add a bounded server-side loader for:
   - session ID and package key;
   - landing, quiz, and offer variants.
2. In the PostHog billing destination, resolve the snapshot only for events with a funnel session,
   verify the provider package against the stored package, and merge canonical snake-case
   properties into `purchase_completed`.
3. Define explicit status behavior:
   - `resolved` for a valid snapshot;
   - `missing` when no funnel session was attached;
   - `invalid` for a missing session or package mismatch, without fabricated variants or a
     canonical `funnel_package_key`; preserve any conflicting provider value only under a clearly
     non-canonical diagnostic name so exact-package dashboards cannot count it;
   - transient database errors remain retryable rather than emitting an incomplete resolved event.
4. Preserve the existing event key, timestamp, billing provider, and outbox deduplication.
5. Assert that Stripe Checkout and PayPal intent metadata still contain only the compact
   `funnel_session_id` and `funnel_package_key` attribution fields.

**Complete when:** equivalent Stripe and PayPal purchases produce the same resolved PostHog
experience properties and provider metadata has not expanded.

### Task 5: Align the Personal Plan dashboard query

1. Keep `funnel_package_key = 'meta_personal_plan_v1'` as the journey boundary.
2. Seed eligibility from `offer_viewed` with both:
   - durable `offer_variant = 'personal-plan-v1'` (kebab-case);
   - semantic `offer_revision = 'personal_plan_v1'` (snake-case).
   Keep these deliberately different values explicit in code/tests so a separator typo cannot
   silently empty the cohort. Adding the variant guard is a deliberate change from the current
   revision-only eligibility contract and must update its test explicitly.
3. Use `offer_revision` only on browser events or when comparing browser event semantics; do not
   require it on server-confirmed purchase rows.
4. Require a non-empty eligible `funnel_session_id` for authoritative journey counts. Do not use
   `coalesce(funnel_session_id, distinct_id)`: PostHog `distinct_id` represents a person across
   sessions, while this dashboard's unit is one assigned funnel journey.
5. Add a separate attribution-quality tile for Personal Plan `offer_viewed` events identified by
   the exact offer variant and analytics revision but missing `funnel_session_id` or
   `funnel_package_key`. Keep these rows out of conversion denominators and expose their count and
   rate so instrumentation loss cannot disappear behind a fallback.
6. Join checkout and payment-option events through eligible `funnel_session_id`, while retaining
   exact package/variant guards on events that carry those fields.
7. Join `purchase_completed` through eligible session membership and package key only. Resolved
   canonical landing/quiz/offer properties are additive diagnostics, never hard filters on purchase
   rows, so purchases captured before enrichment remain visible.
8. Keep sticky `destination = 'pricing'` navigation separate from checkout-intent
   `destination = 'checkout'`.
9. Add query-contract tests that fail if:
   - all CTA clicks are again treated as checkout intent;
   - `distinct_id` is reintroduced as a journey fallback;
   - revision-matched offer views with missing required attribution disappear instead of being
     reported by the quality metric;
   - purchase is filtered by `offer_revision`;
   - downstream events can leak in from another session/package;
   - the payment-option exposure stage loses its exact option/visibility contract.

**Complete when:** the dashboard can show reach, pricing navigation, checkout intent, checkout
open/start, payment-option exposure, and confirmed purchase for the exact Personal Plan cohort
without conflating campaign, package, variant, or analytics revision.

### Task 6: Reconcile historical and live-state behavior

1. Repeat the bounded pre-migration production query grouped by package, landing variant, and offer
   variant; save counts only, with no visitor/lead identifiers. The repeated 2026-07-30 preflight
   saw 1,628 rows: 1,428 `default_organic` sessions across six historical offer variants and 200
   `meta_personal_plan_v1` / `personal-plan-quiz` / `personal-plan-v1` sessions. No unregistered
   package key was present.
2. Finalize the hardcoded quiz backfill only after the repeated preflight:
   - `default_organic`, `meta_routine_v1`, and `scalp_check_placeholder` → `legacy-quiz-v1`;
   - `meta_personal_plan_v1` → `personal-plan-quiz-v1`;
   - any other live key aborts the migration for an owner decision.
3. After migration authorization and application in a later shipping session, rerun the same
   aggregate with `quiz_variant` and require:
   - row count unchanged;
   - no null quiz variants;
   - existing landing/offer snapshots unchanged;
   - purchase/session references unchanged.
4. Validate one Stripe and one PayPal fixture or safe non-production event path through PostHog
   payload construction.

**Complete when:** the schema expansion is additive and reconciled, with no historical attribution
rewrite.

## Verification

### Automated

- `npm run funnel:check`
- focused node tests for packages, generator, contributor governance, migration, funnel server/API,
  billing destinations, provider metadata, and dashboard query contract
- `npm run test:node`
- `npm run ci:verify`

### Manual/browser

- No new end-user browser acceptance flow is required.
- Re-run the existing Personal Plan offer browser checks only to ensure the attribution work did not
  alter the sticky pricing jump, checkout opening, or payment-option exposure behavior.

### Migration/live state

- Recheck the next unused migration timestamp immediately before implementation.
- Run the bounded aggregate/backfill preflight against production read-only.
- Exercise the old and new named-argument RPC calls against a real local Supabase/Postgres database.
  The implementation-session host had no Docker, Colima, Podman, OrbStack, `psql`, or local
  Postgres runtime, so this proof remains explicitly pending; the manual exercise SQL is included
  for the next environment with a disposable local database.
- Migration application remains a separate explicit production-write gate and must precede the
  application-code deployment.
- After any authorized application, reconcile counts and nulls before dashboard publication.

### Evidence-sensitive review

- Review the complete branch through `request-code-review`.
- Use one read-only Claude whole-plan review before implementation and one whole-branch review before
  any push, as required by the repo workflow.
- Verify reviewer findings against code, migration text, and tests; do not adopt new scope silently.

## Review and handoff

- Slice 1 worktree/branch:
  `.worktrees/offer-payment-option-exposure` / `codex/offer-payment-option-exposure`.
- Slice 2 worktree/branch:
  `.worktrees/funnel-experience-attribution` / `codex/funnel-experience-attribution`, created from
  the same reviewed `origin/main` base as Slice 1.
- Both slices remain owned by this originating Codex task, but the migration and package-contract
  change receive their own focused diff and production gate.
- Mockup review: not applicable; no end-user surface changes.
- Operator/integration journey sign-off: **confirmed by Nick on 2026-07-30**.
- Implementation may proceed through the repository's `implementation-loop`.
- Stop before commit, push, PR, merge, dashboard publication, migration application, or deployment
  unless separately authorized through the normal workflow.
