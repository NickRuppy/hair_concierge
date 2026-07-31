# Personal Plan Analytics Simplification

## Outcome and source context

Make the Personal Plan analytics understandable and durable without renaming
historical identifiers or adding a parallel attribution system.

Source context:

- Nick approved the simplified model on 2026-07-31: one sticky Personal Plan
  journey, acquisition tracked separately, temporary commercial experiment
  arms, and one current page-diagnostics revision.
- Fresh base: `origin/main` at `30ce958f`.
- Current package registry: `meta_personal_plan_v1` bundles `/lp/haarplan`,
  `personal-plan-quiz-v1`, and the Personal Plan offer.
- Read-only live PostHog migration dry run on 2026-07-31 confirmed dashboard
  `859068` is still at the exact reviewed v2 insight fingerprints.
- A read-only 14-day PostHog query found 57 v1, 50 v2, and 110 v3
  `personal-plan-v1` offer sessions, plus three package/experience mismatches.
  No membership or one-time experiment-arm sessions were present.

## Chosen direction

Preserve the existing raw package and variant values as immutable historical
identifiers, but give each field exactly one job:

1. `funnel_package_key` is the durable journey boundary. The raw
   `meta_personal_plan_v1` key stays unchanged, while dashboards call it
   **Personal Plan**.
2. acquisition properties (`channel`, UTMs, click IDs, entry path, referrer)
   describe where the visitor came from and never select a product experience;
3. `offer_variant` identifies a real commercial experience or experiment arm;
4. `offer_revision` is used only where fine-grained browser-event semantics
   depend on the current page structure.

The primary business funnel becomes revision-independent and package/session
scoped. Current-page reach and CTA diagnostics remain explicitly v3-scoped.
The pricing experiment gets one compact overview insight rather than separate
conversion and journey tiles.

## Scope

- Replace the live O1 declaration with a Personal Plan package/session funnel
  that spans page revisions and offer arms.
- Keep O2 and O3 as current-page diagnostics, covering v3 plus the base,
  membership, and one-time Personal Plan offer variants.
- Make O5 package/session scoped across revisions while preserving the
  navigation-versus-checkout-intent distinction.
- Turn O6 into an identity/attribution guardrail that exposes current,
  historical, missing, and unexpected Personal Plan offer traffic.
- Consolidate the two not-yet-published pricing-experiment declarations into
  one operator table with counts and rates per arm.
- Add an idempotent, dry-run-by-default create-or-attach operator for that one
  experiment insight.
- Update the guarded v2-to-v3 PostHog migration fingerprints and tests.
- Document the versioning rules and dashboard ownership.

## Non-goals

- No rename or backfill of `meta_personal_plan_v1` or historical event values.
- No database migration or new analytics identity field.
- No instrumentation, checkout, billing, Meta, Customer.io, or product-flow
  change.
- No pricing-experiment flag activation.
- No deletion of historical PostHog insights or events.
- No application deployment, GitHub publication, or live PostHog write without
  its owning authorization gate.

## Target map

| Surface                                                                  | Intended change                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/analytics/personal-plan-offer-v3-dashboard.ts`                  | Define the overall, current-page, guardrail, and consolidated experiment queries                                                                                                                         |
| `scripts/posthog/update-personal-plan-offer-v3-dashboards.ts`            | Preserve the reviewed live v2 pre-state; migrate O1/O2/O3/O5/O6 plus inline B2 resource `5233190`; keep `5235351` and `5033903` unchanged; derive reviewed target fingerprints from exact live envelopes |
| `scripts/posthog/ensure-personal-plan-pricing-experiment-insight.ts`     | Dry-run-first, exact-title create-or-attach operator for the single experiment overview                                                                                                                  |
| `package.json`                                                           | Add one explicit operator command                                                                                                                                                                        |
| `tests/posthog-personal-plan-offer-v3-dashboard.test.ts`                 | Lock query scopes, allowed variants, labels, and experiment math                                                                                                                                         |
| `tests/posthog-personal-plan-offer-v3-dashboard-migration.test.ts`       | Lock guarded v2-to-target transforms and rollback behavior                                                                                                                                               |
| new focused ensure-insight test                                          | Lock no-write dry runs, idempotency, drift refusal, and exact project confirmation                                                                                                                       |
| `docs/analytics/offer-page-tracking.md` and `docs/funnel-attribution.md` | State the minimal versioning and dashboard rules                                                                                                                                                         |

## Designed operator journey

Actor: Nick or another product operator. Entry condition: the operator opens
PostHog dashboard `859068` for the desired time range.

1. **Overall funnel.** The first chart answers how the Personal Plan journey is
   performing from offer view through purchase. It counts unique
   `funnel_session_id` values for the package and does not silently stop at an
   old page revision.
2. **Pricing experiment.** One table compares membership and one-time sessions,
   pricing reach, checkout intent, checkout opening, provider initialization,
   payment-option visibility, purchases, and purchase conversion. An empty
   result means no eligible experiment sessions, not zero conversion.
3. **Current page.** The v3 section-reach chart shows what users actually saw in
   current visual order. The adjacent CTA diagnostic keeps pricing navigation
   separate from checkout intent.
4. **Checkout diagnosis.** The operator opens checkout-path detail only when the
   overall funnel shows a gap after intent.
5. **Quality guardrail.** The final compact table exposes historical revisions,
   missing attribution, and unexpected package/experience combinations instead
   of hiding them from the denominator.

Recovery and edge states:

- If no experiment arms have traffic, the insight description explicitly says
  that the experiment is not yet producing eligible sessions.
- Internal QA is excluded from business and experiment rates.
- A live insight with an unreviewed fingerprint or an exact-title experiment
  insight with different semantics aborts before writes.
- Existing sessions and historical dashboards remain recoverable through the
  external before-state backup; no historical event is rewritten.

Completion: the operator can answer overall performance, experiment
performance, current-page behavior, and data quality without interpreting raw
v1/v2/v3 labels as different products.

There is no end-customer journey change: no customer-facing surface, copy,
timing, feedback, offer, or checkout behavior changes.

## Mockup evidence

- Proposed operator layout:
  `plans/mockups/2026-07-31-personal-plan-analytics-dashboard.svg`
- Selected direction: one dashboard with an overall funnel first, one compact
  pricing-experiment table, current-page diagnostics, then supporting checkout
  and quality guardrails.
- Mockup review: **confirmed by Nick on 2026-07-31 after reviewing the rendered proposal**.
- Operator-journey sign-off: **confirmed by Nick on 2026-07-31 with the instruction to implement using workers and explorers**.

## Ordered tasks

1. Rewrite the existing per-insight test contract before adding assertions:
   carve O1 out of the exact-v3 loop as revision-independent, carve O6 out as a
   multi-revision identity guardrail, and replace the direct `armJourney`
   assertions with the single experiment-overview shape. Then add failing
   assertions for package/session scope, v3-only diagnostics, allowed
   experiment variants, the exact dual-type internal-QA predicate, payment
   option visibility, and purchase conversion. Complete when tests fail for
   the current exact-v3 O1/O5, v2-derived O6, and two-insight experiment model.
2. Author a fresh O1 query rather than using `revision3Insight`, because the
   primary funnel must not contain an exact revision filter. Author the
   consolidated experiment query with
   `offer_payment_option_viewed`; update O2/O3/O5/O6 declarations with the
   narrowest explicit transforms or fresh queries their scopes require.
   Complete when the focused declaration tests pass and no application event
   contract changes.
3. Update inline B2 resource `5233190` to current v3 section order, expected
   Personal Plan variants, canonical package `meta_personal_plan_v1`, non-empty
   `funnel_session_id` without a `distinct_id` fallback, and the same internal-QA
   exclusion used by O1 and the experiment. The reviewed live v2 pre-state
   incorrectly contains `meta_personal_plan_v2`; preserve that exact string only
   in the before fingerprint and replace it in the target. Keep `5235351` and
   `5033903` byte-identical. Complete when focused transform tests prove both
   changed and intentionally unchanged resources.
4. Fetch the exact live v2 insight JSON, run `transformInsight` against those
   envelopes, and calculate the new `afterFingerprints`. Treat the read-only
   live result as the authority: synthetic migration fixtures deliberately
   inject their own fingerprints and cannot validate the production constants.
   Keep every reviewed v2 `beforeFingerprint` unchanged. Complete when the
   live dry run classifies all eight resources and reports the intended targets
   without a write.
5. Run migration guard tests for partial retry, backup, restore, and
   no-write-on-drift behavior against the revised transform. Complete when all
   guard tests pass and a deliberately wrong production target fingerprint is
   shown to fail the live dry run.
6. Add the focused ensure-insight operator and tests. Complete when dry run,
   existing detached attach, new create, exact attached no-op, duplicate-title
   refusal, drift refusal, and project-confirmation behavior are covered.
7. Narrow the documentation change to the genuine delta: when a page revision
   is required, which dashboards may filter by it, and who owns the overall,
   experiment, and diagnostic views. Link to the existing identity model rather
   than duplicating it. Complete when no second terminology system is created.
8. Run the migration and ensure-insight operators against live PostHog in dry-run
   mode. Complete when the exact live pre-state is classified and all proposed
   writes are enumerated without mutation.
9. Run repository verification, `ready-check`, and whole-branch review. Complete
   when no supported blocking finding remains for the exact reviewed content.
10. After separate live-write authorization, capture an external before-state
    backup, apply the reviewed migration and experiment-insight operation,
    re-read every resource, reconcile current counts, and inspect the rendered
    dashboard. This task remains pending until that authorization is explicit.

## Verification

Automated:

- focused Node tests for dashboard declarations, migration guards, and the new
  ensure-insight operator;
- `npm run typecheck`;
- `npm run lint`;
- any additional `ready-check` commands required by the final tree.

Read-only live checks:

- run the v3 migration without `--apply`;
- run the pricing-experiment ensure operator without `--apply`;
- query 7-day counts by package, revision, and variant to reconcile O1, O2, and
  the guardrail;
- verify no membership/one-time rate is reported when no eligible arm exists.

Live-write checks, only after authorization:

- write a mode-`0600` before-state backup outside the repository;
- apply with exact project confirmation;
- re-read and fingerprint every changed insight;
- verify the experiment overview is attached exactly once;
- inspect the signed-in dashboard and compare the rendered values with direct
  HogQL results;
- preserve the backup and report the rollback command.

## Review and handoff

- Branch: `codex/personal-plan-analytics-simplification`.
- Worktree:
  `.worktrees/personal-plan-analytics-simplification`.
- Plan and mockup: commit with the implementation.
- Counterpart plan review: required before implementation.
- Mockup review and operator-journey sign-off: confirmed on 2026-07-31.
- `ready-check` and `request-code-review`: required before review-ready handoff.
- Commit, push, PR, deployment, production PostHog writes, and cleanup are not
  authorized by this plan alone.
- Residual risk: historical package names remain technically awkward, but a
  rename/backfill would add more operational risk and complexity than it
  removes. Dashboards use human labels while raw IDs remain auditable.

## Counterpart findings ledger

| ID  | Type     | Evidence                                                                                                                         | Decision           | Plan change                                                                                                                                                   | Revalidation                                                 |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| F1  | defect   | Existing test loops require every non-O7 insight to contain only `personal_plan_v3`                                              | accepted           | Rewrite O1/O6 exceptions before adding new assertions                                                                                                         | Focused declaration tests                                    |
| F2  | defect   | Existing test dereferences `experiment.insights.armJourney`                                                                      | accepted           | Replace the two-insight contract with one overview contract                                                                                                   | Focused declaration tests                                    |
| F3  | defect   | Production `afterFingerprints` include live names/query envelopes while tests inject synthetic hashes                            | accepted           | Make exact live transform/fingerprint calculation precede migration completion                                                                                | Live dry run plus negative drift check                       |
| F4  | defect   | `revision3Insight` cannot produce a revision-independent O1                                                                      | accepted           | Require a fresh O1 query                                                                                                                                      | Query contract tests                                         |
| F5  | defect   | Existing experiment journey omits `offer_payment_option_viewed` required by the selected operator journey                        | accepted           | Add payment-option visibility to the consolidated overview                                                                                                    | Query and rendered-table checks                              |
| F6  | defect   | Inline B2 resource `5233190` and unchanged resources were absent from the target map                                             | accepted           | Name all eight resources and their changed/unchanged intent                                                                                                   | Transform tests and live dry run                             |
| D1  | tradeoff | Overall package funnel can either span or split offer arms                                                                       | accepted: span     | Treat every package-assigned session as the Personal Plan journey; arm comparison stays separate                                                              | Direct HogQL reconciliation                                  |
| D2  | tradeoff | Apply already-reviewed v3 first or make one combined migration                                                                   | accepted: combined | One backup and one guarded write after review                                                                                                                 | Exact live pre-state fingerprint                             |
| D3  | tradeoff | Current-page reach can include or exclude internal QA                                                                            | accepted: exclude  | Reuse the canonical dual-type QA predicate in B2                                                                                                              | B2 query test and direct count                               |
| F7  | defect   | Live B2 `5233190` filters nonexistent package `meta_personal_plan_v2` and substitutes `distinct_id` for missing journey identity | accepted           | Target canonical package `meta_personal_plan_v1` and require non-empty `funnel_session_id`; retain the wrong value only in the reviewed pre-state fingerprint | B2 transform test, live dry run, direct HogQL reconciliation |
