# Personal Plan Stage 5 production activation

## Outcome

Make Anwendung and its V2 canonical application instructions the normal production behavior for
every eligible Personal Plan owner. Retire the top-level and per-stage launch flags instead of
leaving the completed five-stage journey dormant behind empty environment variables.

This is an activation amendment to
[`2026-08-12-personal-plan-routine-application-contract.md`](./2026-08-12-personal-plan-routine-application-contract.md).
Nick explicitly authorized full production activation on 2026-08-13. The V1-to-V2 German copy
change was already reviewed and approved on 2026-08-12 in
[`plans/evidence/2026-08-12-personal-plan-application-instruction-review.md`](./evidence/2026-08-12-personal-plan-application-instruction-review.md)
and the Stage 5 mockup/designed journey. Activation introduces no newly designed surface or
interaction, so no new mockup is required; rendered copy still receives preview verification.

## Current evidence

- PR #379 is deployed in production at merge SHA
  `6d1e30fc6c36a4528be3da235aeb55792e1e9438`.
- Production has both additive migrations, but zero active V2 family rows and zero V2 product
  payloads.
- Production has `PERSONAL_PLAN_STAGE5_ROLLOUT` unset/empty and no
  `PERSONAL_PLAN_STAGE5_V2_ENABLED`, so Stage 5 is hidden and the V2 resolver is inactive.
- Production also has `PERSONAL_PLAN_APP_V1_ENABLED` and `PERSONAL_PLAN_APP_V1_ROLLOUT` empty.
  Therefore flipping Stage 5 alone would still leave the entire journey unavailable. Stage 2–4
  flags are true, but are now obsolete launch controls for one released journey.
- The deterministic V2 artifact still passes its exhaustive audit and live read-only preflight:
  273 product-role rows, 224 products, 23 family templates, five exact workflows, 272 composable
  rows, and the one reviewed OLAPLEX No.0 blocker.
- The merged tree has a read-only V2 preflight but no guarded V2 apply command. Flipping the V2 flag
  before loading data would intentionally fail closed into unresolved instructions.

## Decisions

1. **Retire the journey launch flags.** Eligibility and accepted-Routine ownership remain the
   authorization boundary. The top-level app rollout and Stage 2–5 flags no longer control the
   released Personal Plan journey, and production always selects contract generation 2 for Stage 5.
   The new-buyer cutoff remains a source-eligibility boundary; the legacy-quiz cutover and initial
   Routine auto-activation remain independent write/authorization decisions, not visibility flags.
   This deliberately accepts revert-and-redeploy rollback latency and couples first exposure with
   flag cleanup because Nick explicitly requested that the completed feature be the default rather
   than another staged environment fork. Field-test owners reach Stage 5 under the same eligibility
   rule; that is intended.
2. **Use expand/backfill/verify/contract.** Keep V1 rows and the V1 compiler in storage/code for one
   rollback window, but do not leave a runtime environment fork in the normal path. A code revert is
   the rollback mechanism.
3. **Add one idempotent database apply boundary.** Mirror the proven
   `apply_personal_plan_stage5_protocol_batch_v1` shape. A new service-role-only,
   `SECURITY DEFINER`, empty-`search_path` RPC accepts the exact canonical artifact text, a fixed
   hard-coded batch ID, and SHA-256 of the exact UTF-8 bytes the CLI sends. The batch ID cannot be
   changed independently of the reviewed executor. It validates the artifact
   header/counts/scope/payload shapes,
   inserts or verifies the 23 immutable V2 family rows, fills only null matching
   `guidance_payload_v2` product columns, rejects divergence or partial state, and records an
   immutable per-product-role ledger in the existing catalog-enrichment ledger. The 23 family rows
   cannot use that ledger because its `product_id` is non-null; their idempotency is instead enforced
   by exact active-row comparison. Family IDs are deterministically derived from the guidance key;
   `verified_at` comes from the reviewed snapshot date; every relational column is derived from and
   compared with the typed payload. A recursive Postgres canonical-JSON helper matches the
   application serializer so the transaction rechecks every V1 source fingerprint after locking;
   TypeScript preflight is not the only authority-drift defense. One advisory-locked
   transaction makes the entire 296-row transition atomic.
4. **Add a guarded operator command.** Dry-run remains read-only. Apply requires the production
   project confirmation, an explicit production-write environment gate, the reviewed clean Git
   head, and the exact artifact fingerprint. A retry must return the same counts without changing
   established authority.
5. **Make V2 coverage a publication invariant in an immediate follow-up.** Extend the curated publication assertion and
   Product Intake canonical-protocol contract so a product cannot become active/recommended for a
   Stage 3 role without a valid scoped `guidance_payload_v2`. The deterministic pointer builder is
   shared by the artifact generator and Product Intake rather than copied. Current activation also
   runs the reverse query: no active curated Stage-3-reachable product-role may remain without V2.
   This assigns future coverage to Product Intake and prevents silent snapshot drift. It is a
   separate follow-up PR and migration applied only after V2 production activation is verified, so
   the activation PR remains revertible and today's deployed Product Intake cannot enter an
   incompatible pre-merge window.
6. **Remove duplicate targeted-shampoo timing guidance before activation.** When a typed exact
   contact time is rendered in the canonical step, do not also emit the generic
   `follow_label_time` caution. Keep the caution only where no exact reviewed duration is available;
   never discard a safety or frequency caution.
7. **Gate production promotion on the existing preview SLO.** Deploy the exact reviewed branch to a
   preview with only the privacy-safe application compute marker enabled, authenticate with a
   disposable field-test/test-owner session, and perform 30 fresh-context read-only navigations.
   Require Anwendung internal-compute p95 <= 1.5 s and meaningful-content p95 <= 2 s with zero write
   attempts. Retain the receipt, not the session.

## Implementation slices

### 1. Guarded V2 apply

- Create the migration with `supabase migration new`.
- Add the transactional `SECURITY DEFINER` service-role RPC, empty search path, explicit grants,
  hard-coded batch ID, deterministic family-ID derivation, and exact raw-text SHA-256 check.
- Extend V2 artifact application types with apply/readback adapters and exact post-apply counts.
- Add a `products:intake:stage5-v2-application:apply` command with dry-run and explicit apply gates.
- Test first: source drift, wrong fingerprint/reviewer/project/head, partial ledger, divergent active
  family payload, divergent product V2 payload, first apply, and idempotent retry.
- Add the repository-standard migration-source contract tests. The Docker-backed Personal Plan
  database suite was removed from the repository before this branch was published, so behavioral
  execution moves to the guarded production-first apply: migration, one exact apply, immediate
  readback, and exact idempotent retry before any application code is merged.
- Add a read-only reverse-coverage preflight before any write and require zero active curated
  Stage-3-reachable product-role gaps. A gap blocks activation and is repaired in the artifact; it
  is never narrowed away or solved by deactivating a product implicitly.

### 2. Contract the runtime forks

- Make the top-level Personal Plan app and Stages 2–4 released by default and ignore the obsolete
  launch environment values. Keep dependency-injected enablement only where it is a unit-test seam;
  production defaults are unconditional.
- Replace Stage-5 rollout parsing with unconditional eligible-owner access.
- Remove the V2 flag/parser, optional resolver dependency, and every `?? 1` production default;
  select generation 2 directly in the Anwendung composition root, adapter, and repository.
- Remove obsolete Stage 5 environment plumbing from the journey loader and browser harnesses; mark
  the top-level and Stage 2–4 environment entries for Vercel cleanup after the deployed code no
  longer reads them.
- Move route-test defaults and deterministic fixtures to V2. The Docker-backed persisted Stage 5
  and Stage 1-5 Playwright harnesses were removed on main and are not resurrected here.
- Preserve unauthenticated, ineligible, no-plan, and no-active-Routine fail-closed behavior.
- Update route/access tests so changing either retired environment variable cannot change behavior.
- Keep the V1 compiler, V1 repository adapter, and their direct tests as the code-revert rollback
  target, but remove dead V1/V2 ternaries from the production page composition root. A V2 adapter
  result must contain its pointer array; do not silently substitute `[]`.
- Regenerate the artifact after suppressing redundant `follow_label_time` cautions when an exact
  contact time exists, rerun the exhaustive visible-output audit, and add focused targeted-shampoo
  regression coverage.

### Follow-up PR — future catalog invariant

- Extract the deterministic single-product V2 pointer builder from the offline generator into the
  shared Product Intake catalog-enrichment module.
- Require Product Intake protocol operations for active curated products to carry a valid scoped V2
  pointer produced from the same reviewed V1 authority and typed product facts.
- Extend `assert_personal_plan_curated_publication` so deferred publication fails when any required
  product-role lacks a valid V2 pointer; keep the V1 checks during the rollback window.
- Add package, approval, SQL, and reverse-coverage regression tests. Create and apply this separate
  migration only after the activation PR is merged, deployed, and verified. Its rollback is a new
  forward migration restoring the prior publication assertion; reverting activation code alone is
  not presented as reverting this independent admin constraint.

### 3a. Release proof, no production contact

- Run focused Stage 5, access, migration, apply, and browser tests; then the full Personal Plan and
  repository readiness checks and whole-branch review.
- Produce ready-check and whole-branch review receipts for the exact clean head. Stop here on any
  code/product finding.

### 3b. Production foundation and V2 data apply

- Apply only the additive apply-RPC migration to production before using the command. The future
  publication invariant is not part of this pre-merge write.
- Run production-shaped read-only preflight, then explicitly cross the authorized production-write
  gate, apply the exact V2 artifact, and verify 23 active
  V2 families, 273 populated V2 product-role rows, schemaVersion 2 everywhere, five exact workflows,
  one explicit runtime blocker, and the already-proven zero reverse-coverage gaps for active curated
  Stage-3-reachable roles. Stop with the inert V2 data if any count differs.

### 3c. Preview SLO, publication, and live verification

- Deploy the exact reviewed branch to preview with the performance marker, run the 30-navigation
  read-only gate using `scripts/personal-plan/measure-read-only-transitions.mjs`, and write the
  performance receipt. Creating the disposable field-test owner/session is a separately identified
  production write; the 30-sample navigation itself must attempt zero writes.
- Commit/push/draft PR, obtain exact-head green checks, merge with the normal reviewed-head guard,
  confirm the merged production deployment, and verify an eligible owner reaches Anwendung on V2.
- Remove obsolete app rollout and Stage 2–5 environment entries if present and finish the merged
  worktree.

## Rollback and stop conditions

- Before merge, production main still reads V1 and Stage 5 remains hidden; the V2 backfill is inert.
- After merge, rollback is the exact PR revert/redeployment. V1 family rows and product payloads are
  retained, so the revert needs no destructive data rollback.
- Stop before merge if the apply is not exact/idempotent, any V2 count differs, preview p95 breaches
  either threshold, writes are attempted during the sampler, or the authenticated route does not
  preserve the accepted Routine pointer.
- Stop and leave the V2 data inert if any required check is red for a code/product reason. Provider
  network failures may be retried only after confirming the job never reached the check itself.

## Designed operator journey

1. Operator runs the command without apply flags: it verifies the production snapshot and reports
   the exact expected counts without writes.
2. Operator supplies the reviewed head, fingerprint, project confirmation, and write gate: the RPC
   validates and atomically loads V2, then returns exact family/product counts.
3. Operator reruns read-only preflight and database verification: all rows match the reviewed
   artifact; V1 remains present.
4. The exact branch preview renders Anwendung from V2 for a disposable eligible owner. Thirty fresh
   contexts stay under both SLOs and attempt no writes.
5. After reviewed merge, production makes the same V2 path unconditional for eligible owners.
   Ineligible/unauthenticated users still cannot reach protected plan data.
6. If verification fails, the branch is not merged. If a post-merge defect appears, revert and
   redeploy the prior V1 code while leaving the inert V2 rows intact for diagnosis.

- The separate future-publication invariant is not applied until activation is verified and owns an
  explicit forward rollback migration; it is not covered by the activation PR revert.
