# Trial activation to Personal Plan handoff

## Outcome and evidence

An admitted free-trial customer must resolve the exact quiz used at checkout, pass `/plan-bereit`, and reach the existing Personal Plan journey without a paid purchase or analytics delivery. Preserve access, ownership, source provenance, cohort rollout, pricing, and the deployed PayPal schedule.

The production test after PR #574 has an active PayPal trial and linked legacy quiz/hair profile, but no plan. Its billing metadata lacks the old `personal_plan_launch_v1` catalog and its funnel session has no paid purchase correlation. The enrollment resolver only recognizes the paid path and returns an empty source. A read-only invocation against the affected account reproduced this assertion failure (`/tmp/trial-plan-live-red.log`). Repeated HTTP200 status requests eventually exhaust the client polling limit; a browser console error is not required.

Timing is separate: PayPal's recorded authorization is 19:48:05Z; the verified ACTIVATED webhook reached/claimed app handling at 19:48:24.312Z, and the account existed at 19:48:25.748Z. An activation-status account-creation error overlaps that period. Competing webhook/browser identity writers are a supported race hypothesis; the exact database error cause has not been proven. Do not bypass provider evidence or claim a measured latency improvement from local tests.

## Decisions and journey

Decision coverage: confirmed for this contract-preserving repair and investigation.

- Confirmed with Nick: ongoing request to fix the trial journey sustainably, latest report that the PayPal redirect is slow and the post-login plan check fails.
- Inherited: active trials grant the promised app journey; an unpaid trial is not a paid purchase. Exact checkout source and current ownership are required, with existing new-buyer/cutover gates.
- Defaults: add an explicit `trial` source backed by the immutable trial enrollment ID; read-only SQL source resolver shared by the service reader and authenticated routing. Preserve existing recognized source precedence. Use the existing journey/copy and retry surface.
- Source identity remains `trial` after conversion/replacement; this names checkout provenance, not payment status. `paidAt` is null in this source reader; billing remains the authority for actual charges. Changing the pinned source at first payment would invalidate an existing plan. Trial follows the ordinary new-buyer cutoff and legacy cutover, never historical-paid migration exemptions. These are preservation of existing source and rollout contracts, not new rollout expansion.
- Open consequential assumptions: none affecting the confirmed readiness fix. Investigate latency/account race without speculative changes or a fabricated speed claim. If evidence supports a separate auth repair, add its concrete regression and scope before implementation.
- Coverage acknowledgement: the user's production test report continues the authorized debugging/repair. Publication/production of a new reviewed change still follows the repository release boundary.
- Internal revalidation: fresh worktree `codex/trial-plan-readiness-repair` on `origin/main` 2c2fd799; deployed scheduling implementation unchanged. Undiscussed consequential assumptions affecting this plan: none.

Existing journey: verified PayPal/Stripe trial → account/login → exact owned quiz/profile readiness → existing CTA → Stage 1 and later plan steps. The new source resolver removes the wait for a payment that has not happened. No new UI, copy, billing terms, manual access grants, fake purchase event, or alternate recovery journey is introduced; a separate visual proposal is unnecessary.

## Chosen implementation

1. SQL: add an INVOKER private helper and service-only public read RPC `personal_plan_resolve_trial_source(p_user_id uuid)`. Explicitly grant service_role EXECUTE on both helper and wrapper; deny arbitrary-user calls by anon/authenticated. Require an active owned `trial_enrollments` row, matching owned/provider billing link, `trial_enrollment_has_access`, and one exact checkout source. Stripe uses its frozen checkout metadata `lead_id`; PayPal uses its immutable attempt-to-intent link and that intent's resolved lead. Require current lead ownership and supported quiz kind. Missing, ambiguous, malformed, mismatched or revoked evidence returns no source. No email/latest-lead lookup. Return enrollment ID, lead ID, source kind and verified authorization time only; no provider tokens or identities.
2. Integrate the same helper into the existing owner-routing function after existing valid sources and before migration-candidate fallback. Preserve its `auth.uid()` guard, private security boundary and existing grants. Include current plan frontier only for its existing source contract. No new public SECURITY DEFINER entry point.
3. TypeScript: add `trial` source kind to enrollment/Stage1/routing contracts. For a current trial-backed subscription, consume the service RPC and validate returned enrollment against the current billing candidate. `sourceId` is the stable trial enrollment ID, `paidAt` stays null, `qualifiedAt` is verified authorization, and existing lead/cohort gates still apply. Do not add trial to historical-paid migration exemptions. Trace journey-access and middleware parsing as well as Stage1 creation. Preserve prior paid/field-test/partner/migration behavior.
4. Test-first: reproduce unpaid PayPal and Stripe fixtures without paid catalog/funnel correlation. Cover owner mismatch, missing exact source, inactive/revoked/expired trial, cutoff/cutover, ambiguity, and stable enrollment through replacement agreements. Exercise actual SQL roles and owner-routing, not only mocked JSON. Preserve Stage1 source identity and existing journey behavior.
5. Diagnose timing (non-blocking for the readiness slice): retain provider-arrival/account timestamps, examine create-user concurrency and distinguish the external webhook wait from app work. Add auth code only after an exact red-capable regression supports it; otherwise report the causal limit plainly. The corrected readiness path must no longer spend a minute polling for a paid purchase.

## Plan review disposition and consumer audit

Claude/high approved with specification revisions. Accepted explicit service-role grants, the separate frontier source parser/union, and enumeration of all consumers. Enrollment mismatch returns no source; RPC errors remain visible. Frontier accepts `trial` explicitly and does not apply the migration flag exemption. Stage1 and journey access retain the ordinary cutoff for trial. Stage1 Supabase adapter only forwards source identity. Routine source-sync/reconciler `sourceKind` describes product/need versions, not enrollment kinds, and is unrelated. Billing trial-identity rights uses a separate rights-source discriminator and is unrelated. The plan-ready page/status and partner activation consume the enrollment fields without source-kind branching; Stage1 and journey adapters forward them. The source ID stays stable after conversion to preserve the existing plan pin; pre-existing recognized sources retain precedence.

## Verification and handoff

Run targeted enrollment, readiness, routing, Stage1 and journey-access tests; actual migration execution/roles; broader relevant billing/plan suites; typecheck/lint/build. Run a local authenticated journey with the real trial-source resolver and stubbed provider history so `/plan-bereit` reaches its existing ready state. Production reads may verify the affected source after an authorized migration; do not write fabricated user/billing data to prove readiness.

One read-only Claude/high plan review and one full-branch correctness/structural review; root verifies findings. Record matching content fingerprints in external verification/review receipts. Migration precedes app deployment. After release, the existing affected trial should recover via reload/retry rather than buying again; verify that with the user's session when available. Incognito test tab is not exposed through the connected browser, so do not claim browser verification there.

Commit artifacts: chosen plan, source, migration, regression tests and any durable rollout note. Archive minimal incident/test/review receipts outside Git; discard temporary probes/redundant reports. No unrelated worktree cleanup or existing agreement cancellation.
