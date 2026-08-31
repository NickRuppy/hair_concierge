# Universal paid entry and optional saved-data prefill

Date: 2026-08-28. Status: **approved for implementation, 2026-08-28**.
Branch/worktree/base: see [decision record](2026-08-28-unified-post-payment.md).
Scope revision: retain only work not owned by #478. Historical-buyer admission and
source binding are still required; do not redo chapters 1+2 or first_open routing.
Reviewer instruction: read-only terminal review; do not edit files or dispatch
another reviewer. Review this plan and its dependent chapter-retirement plan.

## Outcome and chosen direction

Every currently valid paid buyer receives the same Plan → Routine experience.
Convert owned historical quiz sources on the next visit. Carry legacy products
and reliable answers into optional refinement only. No bulk account migration,
extra confirmation screen, checkout, migration announcement, or reset of an
existing Personal Plan. Nick accepts the initial quiz-only Plan not considering
old inventory. Keep recommendation, access-period, and activation policy unchanged.

The small new persistence surface records migration admission/source ownership
and once-only prefill. It does not grant access. Separate quiz provenance from
admission provenance; no fabricated historical purchase or funnel association.

## Scope and non-goals

Includes historical provider subscriptions, one-time purchases, and the existing
legacy-profile paid fallback. Manual grants alone are not paid migration admission;
keep existing field-test routing intact. Preserve current billing grace semantics,
including legacy active/past_due null-period-end behavior. The paid-entitlement
bar and access duration remain unchanged; Personal Plan eligibility deliberately
broadens. This includes legacy-profile paid subscribers who previously had
membership/chat access but no Personal Plan enrollment, under Nick's confirmed
direction that all currently valid paid buyers get the same Plan.

No catalog/recommendation changes, provider/webhook changes, Customer.io operations,
production data writes, analytics rollout, account cleanup, or merged-tree cleanup.
Chapter UI retirement is the dependent [third plan](2026-08-28-chapter-retirement.md).

## Authoritative interfaces and invariants

Proposed new `migration-admission.ts` owns these interfaces:

```ts
type MigrationAdmissionKind =
  | "billing_subscription" | "one_time_purchase" | "legacy_profile";
type PaidMigrationAuthority = {
  kind: MigrationAdmissionKind;
  sourceId: string; // exact billing row ID; profiles.id for legacy_profile
};
type MigrationAdmission =
  | { status: "ineligible" }
  | { status: "candidate"; authority: PaidMigrationAuthority }
  | { status: "pending_source" | "ready"; enrollmentId: string;
      authority: PaidMigrationAuthority; leadId: string | null };
// GET/middleware read only; no enrollment or source writes:
resolvePersonalPlanMigrationAdmission(userId: string): Promise<MigrationAdmission>;
// Authenticated server mutation; revalidates access/ownership under a lock:
beginOrBindPersonalPlanMigration(input: {
  userId: string; ownedLeadId?: string;
}): Promise<MigrationAdmission>;
```

- New `personal_plan_migration_enrollments`: `id`, unique `user_id`,
  `admission_kind`, `admission_source_id`, `status` pending_source/ready,
  nullable `lead_id`, `admitted_at`, `bound_at`, timestamps. Ready requires a lead.
  RLS plus service-only write RPCs; SQL verifies owner and exact current authority.
- `sourceKind: migration` refers to enrollment. Stage-1 quiz source stays
  `legacy_quiz_lead` (or an existing supported prepared artifact, if that is the
  exact selected source); do not put migration into routine source-sync enums.
- Stage-1 RPC must verify enrollment owner, ready status and exact bound lead,
  in addition to existing lead/artifact ownership, source hash and version checks.
  A caller cannot turn an arbitrary enrollment UUID into authority.
- New migration/readiness GET paths never create migration records, project
  profiles, bind leads or compute.
  Use the existing preparation client/POST pattern, with no extra visible screen.
- Current owned Personal Plan wins before migration admission. Never reset it
  because its historical purchase predates a cutoff or uses a different catalog.
- Mutation revalidates current paid access. If the recorded authority ended but
  another current paid authority exists, re-admit against that exact source under
  the same lock; retain the bound lead and Plan. Never revive an expired source.
- Existing explicit payment/lead correlation remains authoritative where present.
  Migration may bind an owned saved lead as a NEW migration association: prefer
  an explicit validated entry lead, then an existing exact payment-linked owned
  source, then the sole owned `leads` row with linked status and supported quiz
  kind (read at most two to detect ambiguity). Legacy profile projection does not
  store a source-lead foreign key: do not invent one.
  Do not scan by fuzzy email or choose an arbitrary latest user lead. If neither
  a unique source nor an explicit source is available, collect a fresh authenticated
  quiz. A unique owned lead proves quiz ownership, not historical purchase; the new
  migration binding plus independently verified current paid access supplies admission.
- The signed/server-owned quiz migration context is user- and enrollment-bound;
  ordinary `mode=retake`, `returnTo`, or `lead` query strings grant no authority.
  Binding is immutable after successful Stage 1; ordinary later retakes use their
  existing explicit update path and must not overwrite an active routine silently.
- Add server-only `PERSONAL_PLAN_LEGACY_MIGRATION_ENABLED`, default false, to
  `release.ts`: gates NEW admission/source-binding starts only. Existing migration
  bindings and converted Plans remain readable/resumable when it is disabled.
  TS owner routing ignores raw migration_candidate DTOs while off; established
  migration DTOs still route normally. Existing app/stage switches still apply.
  Remove time/catalog cohort restrictions for migration admission, not stage
  readiness or paid-entitlement checks. No flag activation is authorized here.

## Target map

| Boundary | Files / exact responsibility |
| --- | --- |
| Paid source | `src/lib/billing/subscriptions.ts` current paid predicates; `src/lib/personal-plan/enrollment.ts`; new `migration-admission.ts`. Exclude manual-only access, retain exact source identity. |
| Owner routing | `journey-access-loader.ts`, `frontier-routing-loader.ts`, `frontier-routing.ts`; additive migration extends `personal_plan_get_own_routing_source()` from `20260827150340_personal_plan_moderator_organic_access.sql`. Add candidate and bound-enrollment shapes, nullable lead parsing. |
| Stage 1 | `persistence/stage1-service.ts`, `stage1-supabase.ts`; extend SQL `personal_plan_create_or_reuse_initial_need`, preserving immutable snapshots and idempotency. |
| Source recovery | `src/app/plan-bereit/{page.tsx,readiness.ts,status/route.ts}` and preparation POST; quiz/auth completion, `src/lib/quiz/{link-to-profile.ts,result-navigation.ts}`. Collect missing facts and retain safe retake returns. |
| Prefill | `persistence/stage2-refinement-{service,supabase}.ts`; `products/{stage3-persistence-supabase,production-persistence-gateway,contracts}.ts`; Stage2/Stage3 explicit module-opening actions; new pure `legacy-prefill.ts`. |
| Capture UI | `src/components/personal-plan-products/{index,stage3-products-flow}.tsx`: render prefilled saved rows and unresolved capture hints on existing screens. No new page or fit shortcut. |
| Direct acceptance guard | `direct-acceptance/accept.ts` uses both Stage2 and Stage3 loadOrCreate. Both calls must remain prefill-free. Regression proves equal baseline inputs/output for legacy inventory absent/present. |

## Optional saved-data prefill dependency

The [saved-data prefill plan](2026-08-28-legacy-refinement-prefill.md) owns exact
mappings, optional-entry POST, successor drafts, once-only receipts and inventory
capture hints. Generic baseline/acceptance loadOrCreate stays prefill-free.
Implement and verify it before broadly enabling historical migration; this split
is for bounded execution, not approval to omit or defer saved products.

## Designed user journey

1. A returning paid user opens any normal paid entry or old onboarding bookmark.
   Existing current Personal Plan resumes unchanged. Otherwise server admission
   resolves the existing paid authority and owned quiz; normal preparation POST
   creates/reuses the binding and computes a versioned quiz-only Plan.
2. The user sees the same Plan as a new buyer, then chooses “Zu deiner Routine”.
   Existing preview-readiness and acceptance guards apply. The resulting routine
   uses the normal quiz-only defaults; old products are not silently substituted.
3. Opening optional Products/Habits refinement prepares the relevant saved prefills.
   The existing questions show usable prior choices where no current user work
   takes precedence; unknown facts stay open.
   Exact eligible products are already selected with usable frequency. The user
   can press normal Weiter, change/remove/add, and proceeds through normal fit
   and routine activation decisions. No repeated identity confirmation.
4. A name-only/unavailable product starts in existing search/intake with its name
   filled. Only genuinely unresolved details need user input.
5. An incomplete legacy source uses existing hair-length repair if that is the only
   gap. For other missing facts, open the current authenticated quiz with reliable
   owned answers prefilled and route to unresolved questions. Do not synthesize
   missing facts; local drafts may be absent/expired and have a 14-day lifetime.
6. Preparation/import failure keeps original records, paid access and any current
   routine untouched. Keep preparation failures retryable; use the agreed compact
   in-flow retry for chapter-based product handoffs (owned by the chapter plan),
   not the chapter renderer slated for deletion. No second normal
   legacy onboarding. Failed optional import must not be marked consumed or render
   as a successful empty import. User can leave back to the current routine.
7. Finish on the current Routine/application frontier, with optional module progress
   reflecting real answers and existing acceptance semantics, not import itself.

## Planning evidence

See the decision record for current and proposed product-screen captures. Question:
“Can saved products be visible without an extra screen?” Selected: existing card,
frequency and ordinary Weiter. Name-only variant uses the same search/intake.
Desktop and 390px mobile visually inspected; no persistence or hosted claim.
No new Plan/recovery layout is proposed. Nick's evidence review and final journey
sign-off are **confirmed (2026-08-28)**. Conceptual first-return direction is confirmed.

## Ordered tasks and verification

1. **Admit all current paid historical authorities without granting access.**
   Consumes current paid predicates. Produces `MigrationAdmission`, table and owner
   routing DTO. Extend enrollment/frontier/journey-access tests and SQL fixtures:
   standard/non-launch/pre-cutoff subscription, one-time, legacy-profile null end/
   grace/future canceled period, manual-only, expired/revoked, wrong owner, missing
   correlation, read-only GET. Completion: same admission verdict in SQL and TS.
2. **Bind and compute exact owned sources safely.** Consumes admission + owned quiz.
   Produces a ready migration enrollment and immutable Stage1 version using its ID.
   Extend stage1/readiness/quiz-navigation tests: complete source, missing length,
   other missing facts, no linked lead → authenticated quiz, forged context, changed
   access between GET/POST, concurrent begin/bind/retry, failure after binding,
   source mismatch and retake return. Completion: one Plan generation, no provider
   event, no GET mutation, current Plans never reset, no unsafe source fallback.
3. **Normalize every paid entry and prove shared UX.** Consumes the admission,
   source and prefill contracts; produces shared Plan frontier for checkout/auth/
   result/onboarding/routine callers. Extend their existing tests plus fixture-backed
   browser journeys. Completion: Plan → normal CTA → optional prefilled module;
   reload/Back/unknown-product/retry work without extra migration screens.

Automated: extend `tests/personal-plan-enrollment.test.ts`,
`personal-plan-frontier-routing.test.ts`, `personal-plan-journey-access-loader.test.ts`,
`quiz-result-navigation.test.ts`, `auth-intake-state.test.ts`,
`checkout-success-redirect.test.ts`, `personal-plan-direct-acceptance.test.ts`,
`tests/personal-plan/persistence/{stage1-service,stage2-refinement-service}.test.ts`,
and `tests/personal-plan/products/stage3-persistence-supabase.test.ts`.
Use `tests/personal-plan-feinschliff-journey.spec.ts` and `personal-plan-start.spec.ts`
for the fixture-backed visible journey. Repository typecheck/lint and affected
Playwright journeys run through implementation-loop/ready-check. New pure mapper
tests have a natural fit beside these persistence tests; no redundant config tests.
SQL: isolated local test database, RLS/privilege checks, locks/CAS, source mismatch,
transaction rollback and SQL/TS paid-access parity. Never point fixture writes at
the copied production `.env.local`.
Browser: current lab is an in-memory UI fixture only. Full authenticated persistence
and provider behavior require separately authorized, isolated fixtures; do not claim
lab evidence proves those layers. Keep billing, provider and analytics proof distinct.

## Rollout, review and handoff

Additive schema first, then compatible readers and writers, then caller cutover.
Do not drop old rows or old decoding support during this deliverable. Disabling the admission switch
pauses NEW migrations and retains created Plan access and original records;
do not point already-converted users into a broken old source model.
Before activation, separately authorize a read-only production cohort preflight
and verify source/frequency coverage. No production accounts inspected in planning.

Counterpart review uses Claude once at high, read-only; findings reconciled here.
Then Nick reviews evidence and confirms the final journey. Implementation-loop
owns test-first execution, ready-check and final code review. Stop before publication:
commit/push/PR, merge, deploy and production activation need their named permissions.
Artifacts: plans, HTML and screenshots = commit; temporary review report = discard
after reconciled findings; local fixture servers = stop once no longer needed.

## Counterpart review reconciliation — 2026-08-28

Claude Opus 4.8 reviewed once at high, read-only. It did not approve implementation.
Codex verified the report against current code and Nick's recorded choices:

- Accepted: clarify broader Plan eligibility vs unchanged paid entitlement/duration.
  Legacy-profile paid subscribers are included under the already-agreed all-buyers
  scope; this is a new Plan admission source, not pre-existing Plan eligibility.
- Accepted: add the dedicated admission-only pause switch above. Existing global
  app switches alone cannot meet the promised pause-without-lockout behavior.
- Accepted as structure, not deferral: saved-data prefill gets its own detailed
  plan; all approved outcomes remain required before broad historical cutover.
- Rejected as unsupported: “most historical users will need a fresh quiz.” No
  production cohort counts were read. Missing purchase/funnel correlation alone
  does not prevent reuse of a unique owned linked quiz through the NEW migration
  binding. Zero or ambiguous owned sources do require fresh quiz recovery; exact
  proportions remain unknown until a separately authorized read-only preflight.
- Clarified: implementation tasks own named SQL/RPC protocols, tests and outputs.
  Production SQL bodies belong in test-first implementation, not speculative
  executable production code embedded in a planning document.

Admission lock protocol: service-only transaction takes a user-keyed advisory
transaction lock, re-reads current paid authority/owner, inserts or loads the
unique-user enrollment, validates/binds the lead and commits. No side effects
before validation. Stage1 rechecks source/current access and uses existing unique
initial-version/Plan guards. Concurrent mismatch returns a typed conflict rather
than replacing a ready binding. Existing Plan lookup precedes all new admission.

The review report is transient and discarded after this reconciliation. No second
review was run to obtain an approval sentence. Evidence review/journey sign-off are
confirmed (2026-08-28); final implementation/code-review gates remain in force.

## Implementation authorization

On 2026-08-28 Nick confirmed the contextual evidence and final journey and explicitly
requested implementation with workers and explorers. This supersedes earlier
planning-only status text. Publication and production changes remain separate.
