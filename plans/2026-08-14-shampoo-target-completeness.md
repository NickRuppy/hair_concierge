# Shampoo target completeness and matrix alignment

## Outcome and source context

Every concrete Shampoo and Oil property shown in the Stage 3 comparison has a real, confirmed target. Shampoo authority evaluates cleansing intensity instead of accepting any non-null value, hair thickness is projected from the refined profile, and each relation mark is derived from the observation displayed beside it. Shampoo aggregate fit status stays in the heading rather than appearing as a duplicate `Zielprofil-Eignung` property row. Conditioner retains its aggregate target-fit evidence until a separately designed complete concrete matrix replaces its current thickness/protein coverage. Unexpected targetless evidence makes the comparison unassessable; it is never silently hidden from an apparently complete matrix.

Source context: Nick's 2026-08-14 screenshot of the active OGX Shampoo state, the production-source read-only catalog check, and the existing Chaarlie Shampoo target mapping.

## Chosen direction

Derive the Shampoo cleansing target from the already-confirmed Shampoo task: `trocken` and `irritationen` require `gentle`; `normal`, `dehydriert-fettig`, and `schuppen` require `regular`. This is the existing recommendation-engine behavior, promoted into one shared deterministic helper for Stage 3 authority and evidence projection. Use the signed Stage 3 authority input's `hairThickness` as the suitable-thickness target.

An exact Shampoo bucket/scalp/thickness match with a different confirmed cleansing intensity is `supportive`, matching existing Chaarlie behavior; it is not `ideal` and not a hard mismatch. Missing required facts remain `unknown`. Bump only the Shampoo authority version because the verdict semantics change.

This supportive rule applies only to an owned Shampoo being assessed. An uncovered or missing-product Shampoo remains strict: only an ideal candidate may be planned. Stage 1 product examples use that same strict-ideal selection while preserving PR #411's dedicated bounded preview loader/source boundary. A merely supportive Shampoo is not auto-selected in either path.

Make relation-mark alignment caller-owned so the owned grid centers the mark beneath its value while horizontal comparison cells retain their end alignment.

Remove the aggregate `Zielprofil-Eignung` evidence row from Shampoo only. The Shampoo authority already owns `passt`, `passt mit Einschränkung`, or `passt nicht` above the table; its matrix is reserved for concrete properties. Preserve Conditioner aggregate target-fit evidence in this task. Project refined hair thickness as the target for both Shampoo and Oil thickness rows. Do not globally filter targetless or `.target_fit` rows in the component; an unexpected targetless row must fail the matrix closed as unassessable.

Retire the former complete-catalogue environment gate completely. Complete-catalogue Stage 3 behavior is canonical, with no environment reader, runtime branching, gateway/persistence option, CI/build mode, or rollback semantics left behind. PR #411's dedicated direct-preview source boundary remains explicit: direct callers stay bounded by default and Stage 1 opts into the complete loader at that boundary. Any future rollback is a code revert and redeploy, not an environment toggle; no environment write is part of this task.

## Scope and non-goals

In scope:

- one shared Shampoo-bucket-to-cleansing-target helper;
- Shampoo authority evaluation and allowed actions for a cleansing-intensity caution;
- target-bearing cleansing-intensity and suitable-thickness evidence rows;
- removal of the Shampoo aggregate fit-status row while retaining Conditioner target-fit evidence;
- target-bearing Oil thickness evidence for pre-wash, leave-on conditioning, and dry-finish roles so `kein Ziel` cannot move to another category;
- Shampoo authority-version bump and stale-snapshot/recovery verification;
- relation-mark alignment;
- observation-owned relation markers when display observations differ from authority spec facts;
- strict-ideal missing-product and Stage 1 preview selection;
- complete retirement of the complete-catalogue feature flag while preserving bounded direct previews;
- deterministic regressions and browser evidence for the OGX-shaped state.

Non-goals:

- changing the production `ReviewHeader`, `OverallVerdict`, product-card hierarchy, or their styling/copy mappings;
- changing production catalog rows or product-intake data;
- inventing a `clarifying` everyday-Shampoo target;
- changing Conditioner or specialist-category authority beyond preserving existing Conditioner evidence;
- application deployment, further production writes, or environment/config writes. The already
  applied `20260815110000` refresh RPC is historical release state; this follow-up adds an
  unapplied forward replacement migration to correct its lock order.

## Target map

- `src/lib/shampoo/constants.ts`: shared deterministic cleansing target by Shampoo bucket.
- `src/lib/recommendation-engine/categories/shampoo.ts`: consume the shared helper instead of retaining a duplicate private mapping.
- `src/lib/personal-plan/products/authority/categories/shampoo.ts`: emit supportive authority when a complete cleansing value differs from target; preserve fail-closed missing facts.
- `src/lib/personal-plan/products/authority/catalog-facts.ts`: use the same derived Shampoo route in complete and bounded catalogue-loading modes.
- `src/lib/personal-plan/products/fit-comparison.ts`: project Shampoo/Oil thickness and Shampoo cleansing intensity with real targets; stop emitting aggregate fit status as an evidence property.
- `src/lib/personal-plan/products/production-persistence-gateway.ts`: send the same derived Shampoo route to catalogue search regardless of pagination mode.
- `src/lib/personal-plan/products/stage3-persistence-supabase.ts` and `src/lib/personal-plan/release.ts`: remove the retired complete-catalogue flag and make complete Stage 3 loading canonical.
- `src/lib/personal-plan/product-previews.ts`: preserve PR #411's bounded source while keeping example selection strict ideal.
- `src/lib/personal-plan/products/authorities.ts`: Shampoo authority version bump only.
- `src/components/personal-plan-products/product-fit-comparison.tsx`: contextual relation-mark alignment and fail-closed handling for unexpected targetless evidence; no global evidence filtering.
- focused Shampoo authority, fit-comparison, component, persistence/recovery, and recommendation-engine tests.

## Designed user journey

1. A customer opens the owned OGX Shampoo review for a confirmed balanced/normal-hair context.
2. The product card remains unchanged.
3. Chaarlie evaluates the concrete Shampoo properties against confirmed targets: cleansing intensity, scalp focus, and suitable hair thickness. The overall fit state remains only in the heading above.
4. For the production-shaped OGX facts, `sanft` is compared with the `regulär` target. The row is supportive, and the overall heading becomes `Dein Shampoo passt mit Einschränkung` instead of `Dein Shampoo passt`.
5. `Kopfhaut-Fokus` compares `ausgeglichen` with `ausgeglichen`, and `Geeignete Haardicke` compares `mittel` with `mittel`.
6. Every known relation mark is centered directly beneath the value it qualifies. No Shampoo row displays `kein Ziel`.
7. The partial-fit marker is calculated from the displayed `sanft` observation itself, even if a separate authority spec value differs.
8. If cleansing intensity or another required Shampoo fact is missing, or if any unexpected targetless evidence reaches the component, the state is unassessable and cannot look like a complete comparison.
9. Existing keep/leave-open actions follow the supportive owned verdict. If Shampoo is missing, only an ideal recommendation may be planned; a merely supportive product remains available through search or continue-without behavior rather than being auto-selected.
10. Stage 1 follows the same strict-ideal example rule through its bounded preview loader. Oil shows the refined hair-thickness target for pre-wash, leave-on conditioning, and dry finish.

The top status treatment is not redesigned. Production commit `7aa3c6b5` confirms that fit-only reviews use the existing `ReviewHeader` title/description mapping and comparison reviews use the existing `OverallVerdict`. Implementation changes only the evaluated verdict supplied to those components.

User-journey sign-off: reconfirmed by Nick on 2026-08-15 for this consolidated package, including strict missing-product/preview selection, Conditioner preservation, observation-owned markers, all three Oil roles, and full retirement of the complete-catalogue flag. The already reviewed OGX mockup remains the signed-off visual evidence because these corrections do not change its approved surface.

## Planning evidence

- [Revised rendered before/after matrix](./artifacts/2026-08-14-owned-shampoo-matrix-fix.html) and [captured review image](./artifacts/2026-08-14-owned-shampoo-matrix-fix.png)
  - Question: Should empty-looking target cells be hidden, or should the authority project and evaluate the targets that already exist?
  - Rejected direction: hide targetless rows in the owned-only matrix.
  - Selected direction: every Shampoo/Oil concrete property remains visible with its real target, the owned cleansing mismatch changes the verdict to supportive, and Shampoo aggregate state stays only in the heading. Conditioner retains its existing aggregate evidence.
  - Feedback incorporated: `kein Ziel` must be impossible; do not hide the underlying authority defect; do not add an aggregate status as an extra property row.
  - Evidence review: reconfirmed by Nick on 2026-08-15 for the corrected consolidated direction; no new variant is required.

Production-source and code-path evidence:

- The active OGX record is complete: normal thickness, normal Shampoo bucket, balanced scalp route, gentle cleansing intensity, active/recommendable lifecycle, and canonical everyday-Shampoo guidance.
- A similarly named incomplete record is discontinued, inactive, and non-recommendable; it cannot reach the shown state.
- Existing Chaarlie recommendation logic maps the normal bucket to regular cleansing and treats a same-bucket cleansing mismatch as supportive.
- Stage 3 currently selects a Shampoo semantic match on thickness + bucket + scalp route, then requires only that cleansing intensity be non-null. It therefore misclassifies this complete but nonmatching OGX value as ideal.
- The matrix independently hard-codes null targets for cleansing intensity and suitable thickness, producing `kein Ziel` despite both targets being derivable from confirmed context.
- The live READY production deployment is sourced from `7aa3c6b5`; its Stage 3 header and verdict components are byte-identical to this plan's original base. The fix preserves those components and their placement.

## Ordered tasks

1. Add red authority regressions for normal/regular target versus gentle product, missing cleansing facts, and matching regular facts. Add projection regressions requiring all Shampoo rows to have targets derived from bucket and refined hair thickness. Complete when the current implementation fails on supportive verdict and target completeness.
2. Centralize the bucket-to-cleansing target helper and reuse it in the recommendation engine, Stage 3 Shampoo authority, and fit projection. Add supportive owned/candidate actions and bump only Shampoo authority to v4. Complete when authority returns supportive for the OGX-shaped mismatch, ideal for exact intensity, and unknown for missing intensity.
3. Remove only Shampoo aggregate target-fit evidence, preserve Conditioner aggregate evidence, project Shampoo and Oil hair thickness from the signed Stage 3 authority input, and make each mark follow the displayed observation. Complete when all three Oil roles are covered, an unexpected targetless row fails closed, and both owned and two-product layouts retain intended alignment.
4. Keep missing-product Shampoo and Stage 1 examples strict ideal. Preserve PR #411's bounded preview source and prove a merely supportive Shampoo is not selected in either path.
5. Retire the complete-catalogue feature flag from environment types/readers, runtime options, persistence/gateway branching, scripts, CI/build tests, and retained release text. Complete catalogue loading becomes canonical; direct preview remains explicitly bounded.
6. Keep malformed/source-stale snapshots fail closed. Refresh only the exact structurally valid,
   draft/snapshot-agreed Shampoo v3 to v4 transition through an owner-scoped server continuation;
   require every other category authority to be current and completed drafts/receipts to remain
   immutable without any evaluation call. The first refresh RPC migration is already live. Add a
   new forward replacement migration that acquires locks in canonical plan-then-draft order while
   preserving owner, status, refined-source, revision-CAS, payload-size, and privilege boundaries.
   Keep that forward migration local until a clean review and separate production authorization.
7. Run focused tests, the Personal Plan suite, browser verification, ready-check, and repository code review. Complete when no blocking finding remains and the exact content fingerprint is recorded.

## Adversarial review closure — 2026-08-15

- Active/resumable Shampoo v3 drafts are replaced through a narrow owner-scoped, revision-safe server continuation seeded from the current refined snapshot; completed v3 drafts are returned unchanged and are not re-evaluated.
- Unexpected targetless evidence outranks pending and known review states. It renders an unassessable state and suppresses keep, leave-open, replacement, and override actions.
- Current plans no longer describe complete catalogue loading as a runtime activation or rollback flag. The old catalogue-authority receipt remains unchanged; this task receives its own fresh receipt.
- Production-facing cleansing labels use `regulär` and `klärend`.
- The full Stage 3 catalogue remains canonical while the distinct bounded Stage 1 preview loader remains unchanged.

### Follow-up adversarial findings and remediation

- The earlier closure was superseded by a second adversarial pass: completed Shampoo v3 drafts
  could still fall through to route/gateway evaluation, refresh admission accepted broader version
  drift than the supported recovery, and the live RPC acquired draft then plan locks.
- Every route, production gateway, fixture gateway, and client review-bundle path now short-circuits
  non-active drafts before authority evaluation.
- Refresh admission now recognizes only an agreed, structurally valid Shampoo v3 snapshot with all
  other authorities current. Unknown versions/categories, cross-field disagreement, malformed or
  missing decisions, non-Shampoo drift, and invalid product-load overlays fail closed.
- The final adversarial pass exposed that the original structural decision check still accepted
  array-shaped but schema-invalid values. Refresh admission now parses the complete persisted
  category-decision contract: every category-specific target, allowed role, frequency variant,
  reason/evidence/value, deferred fact, need tier, and pause-state pairing must be valid, with target
  category and roles bound to the decision. Any tampering fails before refresh persistence is called.
- New local-only migration
  `20260815120000_personal_plan_stage3_authority_refresh_lock_order.sql` replaces the RPC definition
  with plan-then-draft locking and exact v3-to-v4 SQL admission. The applied
  `20260815110000_personal_plan_stage3_authority_resume_refresh.sql` remains byte-for-byte immutable.

## Verification

Automated:

- `node --import tsx --test tests/personal-plan/products/stage3-authority.test.ts`
- `node --import tsx --test tests/personal-plan/products/stage3-fit-comparison.test.ts`
- `node --import tsx --test tests/personal-plan-product-fit-comparison.test.tsx`
- focused production-persistence/recovery tests for the Shampoo authority-version boundary;
- `npm run test:personal-plan` and final commands required by `ready-check`.

Manual/browser:

- render the production-shaped owned OGX state at desktop and mobile widths;
- confirm the supportive heading and `sanft` versus `regulär` row;
- confirm the header/status layout and copy treatment are unchanged from production apart from the verdict selected by corrected authority;
- confirm `mittel` versus `mittel` thickness row;
- confirm there is no `Zielprofil-Eignung` property row, no `kein Ziel` text, and status marks are centered;
- confirm an exact regular-intensity Shampoo still renders ideal.

Live-state:

- `20260815110000_personal_plan_stage3_authority_resume_refresh.sql` was previously applied under
  Nick's explicit authorization and remains unchanged;
- the corrective `20260815120000` replacement migration is local-only and has not been applied;
- no application deployment, owner-draft mutation, environment/config write, or second migration
  application is part of this follow-up;
- any further release action remains behind the fresh-review and explicit-authorization gates.

## Review and handoff

- Branch: `codex/stage3-owned-matrix-cleanup`
- Worktree: `.worktrees/stage3-owned-matrix-cleanup`
- Counterpart plan review: unavailable on 2026-08-14 because Claude Code reported its weekly usage limit was reached; no verdict was produced.
- Evidence review: confirmed for the revised production-preserving artifact.
- User-journey sign-off: confirmed; implementation is authorized despite the unavailable Claude review lane.
- Artifact disposition: revised plan, HTML, and PNG are durable; the rejected hide-rows direction is removed from the retained plan.
- Stop point: verified local changes only; no commit, push, PR, deploy, production write, or cleanup without separate authorization.
