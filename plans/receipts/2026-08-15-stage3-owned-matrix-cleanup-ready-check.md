# Stage 3 owned Shampoo/Oil matrix cleanup — ready-check and review receipt

## Review identity

- Branch: `codex/stage3-owned-matrix-cleanup`
- Base and local HEAD: `c6b12b490dda57512b35fb5d454f3701aa6408ed`
- Integrated upstream: current `origin/main` at the same SHA, including PRs #412, #416, #417,
  and #418 after semantic and path-overlap inspection. PR #418 changes the shared view-transition
  component and its journey tests but no task-owned path; the full Personal Plan and browser gates
  were refreshed after its clean fast-forward integration.
- Canonical content fingerprint: `1ed5ea7b2939812dfb7deb56ecc2cbea37d71eed0c22ee0af7bee07a2ae22aea`
- Fingerprint scope: 37 task-owned code, test, migration, plan, HTML, and PNG paths. This receipt is excluded from its own recursive fingerprint.
- Reviewed tree: all committed-base-to-working-tree changes plus every task-owned untracked or ignored artifact.

## Closed adversarial findings

1. Active/resumable Shampoo v3 authority is refreshed to v4 through an owner-scoped, revision-safe server continuation seeded from the current refined snapshot. Completed v3 drafts remain immutable and are not re-evaluated.
2. Unexpected targetless evidence outranks pending and known states, renders an unassessable review, and exposes no keep, leave-open, select-replacement, or override action.
3. Current plans and runtime plumbing no longer retain the retired complete-catalogue flag. The unrelated historical catalogue-authority receipt was restored unchanged; this is the new task-owned receipt.
4. Production-facing cleansing labels are `regulär` and `klärend`.

The previously accepted behavior remains covered: strict ideal selection for missing-product Shampoo and Stage 1 previews, OGX `sanft` versus target `regulär` as supportive, observation-owned relation marks, target-bearing Shampoo and all three Oil-role rows, retained Conditioner aggregate evidence, exact-product fingerprints, and the bounded direct-preview loader.

## Follow-up adversarial remediation

1. Completed/non-active drafts now short-circuit before review or evaluation in the API route,
   production gateway, fixture gateway, and client review-bundle loader. The API regression makes both
   review and evaluation hooks throw if either is called.
2. Refresh admission now accepts only a structurally valid, draft/snapshot-agreed Shampoo v3 to v4
   continuation with every other signed authority current. Unknown versions/categories, disagreement,
   malformed or missing decisions, non-Shampoo drift, invalid ordering, and invalid product-load
   resolution remain on the fail-closed path without invoking refresh persistence.
3. New forward migration
   `20260815120000_personal_plan_stage3_authority_refresh_lock_order.sql` acquires the plan lock before
   the draft lock and retains owner checks, completed immutability, active/revision CAS, refined-source
   validation, payload limits, and service-role-only execution. It is local-only and unapplied; the
   already-live `20260815110000` migration is protected by an immutable SHA-256 test.
4. The final adversarial pass found that valid-shaped but schema-invalid decisions could still enter
   refresh. Admission now uses a strict persisted-decision schema covering every category-specific
   target and frequency variant, allowed roles, need tiers, reasons/evidence/values, deferred facts,
   and execution pause reasons. Target category/roles are bound to the owning decision. Invalid array
   roles, numeric or wrong-category targets, invalid need tiers, malformed frequencies/reasons/pause
   reasons, and extra fields all fail before `refreshAuthorityDraft` is invoked.
5. The subsequent semantic-authenticity pass found that schema-valid forged authority could still
   enter refresh. The gateway now re-derives the immutable authority snapshot from the same
   owner-scoped refined source and compares the complete canonical snapshot after normalizing only
   Shampoo authority `v3` to `v4`. A forged well-formed reason, unrelated valid deferred-fact ID,
   `not_needed` tier with active Shampoo roles/target, or valid Conditioner wash-total frequency all
   fail closed before refresh persistence. The local-only forward RPC independently compares the
   complete old and replacement JSON snapshots after the same single version normalization.

## Red and green proof

- Pre-fix focused guards failed at the intended seams: active v3 was rejected instead of refreshed, completed v3 GET returned 409, targetless pending/known evidence retained committing actions, flag-retirement absence checks failed, and ASCII cleansing labels remained. The API lane was rerun with the repository's server-only register to isolate the intentional completed-draft failure (32/33 before the fix).
- Follow-up red proof failed at the new intended seams: completed v3 GET returned 503 after the throwing
  evaluator was reached; unknown/non-Shampoo/malformed refresh cases were admitted or not rejected;
  and the empty forward migration failed its plan-before-draft contract. The initial combined run was
  129/134 before remediation (two fixture-shape failures were then corrected so each guard measured
  its intended boundary).
- Follow-up focused route/gateway/persistence/migration suite: 134/134 passed.
- Final P1 red proof: the focused production-gateway suite was 49/50 because an array-shaped invalid
  role reached refresh admission. The other newly added target, need-tier, frequency, reason, and
  pause-reason mutations exercised the same unsupported boundary.
- Final P1 green proof: production-gateway suite 50/50; every tampered case rejected with zero refresh
  persistence calls.
- Semantic-authenticity red proof: production-gateway suite was 49/50 because a forged but
  schema-valid reason was admitted and refresh persistence ran; the forward-migration contract was
  3/4 because no complete old/new immutable-snapshot comparison existed.
- Semantic-authenticity green proof: combined gateway and migration suite 54/54. All four requested
  alterations are explicitly asserted to pass the persisted-decision schema before they reject with
  zero refresh-persistence calls. The Conditioner frequency uses the real `weekly_3_4x` vocabulary
  maximum, and the unapplied forward RPC enforces complete normalized snapshot equality.
- Proof-defect correction: adding the schema-precondition assertion first failed on the Conditioner
  fixture (`false !== true`) while it used the invalid `weekly_3x` bound. With `weekly_3_4x`, the
  affected semantic-authenticity test passes 1/1; formatting and typecheck also pass.
- Fresh affected API/UI/authority/projection/persistence/preview suite: 323/323 passed; overlapping
  Stage 3 flow and resume suite: 76/76 passed (399/399 combined).
- Post-#417 focused authority/UI/persistence/preview/API and overlapping Stage 3 flow suite: 376/376 passed.
- Full Personal Plan suite on the post-#418 integrated tree: 1617/1617 passed.
- Post-format affected release/migration guards: 11/11 passed; final plan absence guard: 9/9 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and four unrelated pre-existing warnings.
- `npm run build`: passed on Next.js 16.2.4.
- `npm run test:playwright:personal-plan-stage3`: passed; production-mode Stage 3 lab 4/4 and full Personal Plan journey 18/18, including PR #418's programmatic view-transition case.
- Prettier check across all changed TS/TSX/Markdown/HTML paths and `git diff --check`: passed.
- Migration source contract tests: passed. Production migration `20260815110000_personal_plan_stage3_authority_resume_refresh` was applied to project `pqdkhefxsxkyeqelqegq` as ledger version `20260815092626`. Post-apply proof confirms the function exists, `anon` and `authenticated` cannot execute it, `service_role` can, and a synthetic missing-source call returns `invalid_source`. Production's one active and ten completed Shampoo v3 drafts were unchanged by deployment.
- Fresh read-only `supabase migration list --linked` from the linked primary checkout confirms the
  remote ledger still ends at `20260815092626`; no second migration is present remotely. The first
  attempt from the task worktree failed because that worktree has no project-ref link, then the same
  read-only command succeeded from the linked root. No migration apply command was run.

## Review verdict history

Normal correctness/security/data-integrity and structural state-model/migration lenses were run because this change adds a server-owned recovery RPC and touches shared Stage 3 authority flow. The four supplied adversarial findings were reproduced and fixed. The final delta was inspected across the route, gateway, Supabase adapter, active-only CAS function, UI fail-closed boundary, callers, and regression tests.

The earlier no-blocker verdict was superseded by a later adversarial review that validated three
blocking issues: completed-draft evaluation fallthrough, over-broad refresh admission, and inverted
RPC lock order. Those findings are remediated in the current local tree and require a fresh exact-tree
adversarial Codex review before publication. Local correctness and structural review found no
additional material issue. The Claude counterpart CLI was not used as the review gate: one attempted
invocation exited immediately on the known session limit without changing repository content, and the
separate Codex adversarial task is the authorized substitute.

That verdict history was subsequently superseded once more by the valid-shaped decision-schema P1.
That verdict was superseded by the semantic-authenticity P1. It is remediated in this exact tree;
publication remains blocked pending the next exact-tree adversarial verdict.

## Exact changed paths

- `plans/2026-08-14-bedarf-preview-complete-catalog-regression.md`
- `plans/2026-08-14-personal-plan-complete-candidate-selection.md`
- `plans/2026-08-14-shampoo-target-completeness.md`
- `plans/2026-08-14-stage3-catalog-authority-repair.md`
- `plans/artifacts/2026-08-14-owned-shampoo-matrix-fix.html`
- `plans/artifacts/2026-08-14-owned-shampoo-matrix-fix.png`
- `scripts/personal-plan/audit-stage3-production-coverage.ts`
- `scripts/personal-plan/benchmark-stage3-review-readiness.ts`
- `src/app/api/personal-plan/stage-3/route.ts`
- `src/components/personal-plan-products/product-fit-comparison.tsx`
- `src/components/personal-plan-products/stage3-products-flow.tsx`
- `src/lib/personal-plan/product-previews.ts`
- `src/lib/personal-plan/products/authorities.ts`
- `src/lib/personal-plan/products/authority/catalog-facts.ts`
- `src/lib/personal-plan/products/authority/categories/shampoo.ts`
- `src/lib/personal-plan/products/authority/category-decision-schema.ts`
- `src/lib/personal-plan/products/authority/contracts.ts`
- `src/lib/personal-plan/products/authority/snapshot.ts`
- `src/lib/personal-plan/products/authority/supportive-owned-recommendation.ts`
- `src/lib/personal-plan/products/fit-comparison.ts`
- `src/lib/personal-plan/products/fixture-gateway.ts`
- `src/lib/personal-plan/products/production-persistence-gateway.ts`
- `src/lib/personal-plan/products/stage3-persistence-supabase.ts`
- `src/lib/personal-plan/release.ts`
- `src/lib/recommendation-engine/categories/shampoo.ts`
- `supabase/migrations/20260815110000_personal_plan_stage3_authority_resume_refresh.sql`
- `supabase/migrations/20260815120000_personal_plan_stage3_authority_refresh_lock_order.sql`
- `tests/personal-plan-api-stage3.test.ts`
- `tests/personal-plan-product-fit-comparison.test.tsx`
- `tests/personal-plan-stage3-release.test.ts`
- `tests/personal-plan-stage3.spec.ts`
- `tests/personal-plan/product-previews.test.ts`
- `tests/personal-plan/products/production-persistence-gateway.test.ts`
- `tests/personal-plan/products/stage3-authority-resume-refresh-migration.test.ts`
- `tests/personal-plan/products/stage3-authority.test.ts`
- `tests/personal-plan/products/stage3-fit-comparison.test.ts`
- `tests/personal-plan/products/stage3-persistence-supabase.test.ts`

These 37 paths plus this receipt are the 38 task-owned changed paths. This receipt is excluded from
the recursive fingerprint above.

## Artifact and stash disposition

- Commit when publication is authorized after clean review: all 37 fingerprinted paths plus this receipt, including the force-added durable PNG evidence.
- Durable PNG evidence hash: `9a8bb6e89591434ceb8ac2ca09f68ac8ab7f73cea800f442315a4ad8a40ec26e`; it is included in the canonical fingerprint.
- Latest recovery stash retained unchanged: `stash@{0}` /
  `c69841ca8f2d8b8042a79a870f06dde5d08501ee`, label
  `codex-stage3-owned-matrix-pre418-review-freeze`.
- Pre-#417 recovery stash retained unchanged: `stash@{1}` /
  `f29df5111ac0ada6fb95d67ec8aa60fcc5cbe500`, label
  `codex-stage3-owned-matrix-pre417-ship-cdb3c39c`.
- Earlier frozen task stash retained unchanged: `97af598a3dbcfe7dab90749554ef52d4894c9e84`, label `codex-stage3-owned-matrix-frozen-72e6981-pre416`.
- Older task recovery stashes remain untouched. No transient artifact was deleted and no cleanup ran.

## Residual risk and stop

- The first production migration is live and permission/no-op verified. Until the new forward
  replacement migration passes fresh review and receives separate authorization, production retains
  its draft-then-plan lock order and therefore a bounded deadlock risk when refresh races create/load.
- Migration `20260815120000` is local-only and was not applied to any Supabase project.
- The local Git maintenance warning about unreachable loose objects is external to this task and was not cleaned up.
- At receipt refresh time no commit, push, PR, merge, application deployment, environment/config write, owner-draft mutation, or cleanup had been performed. The separately authorized production migration is recorded above.
