# Personal Plan catalog enrichment — research and guarded follow-up

**Status:** Deliverable A implemented and locally review-ready with documented blockers

## 1. Outcome and source context

Prepare the Personal Plan launch catalog in parallel with the five-stage implementation, then make the eventual cross-category data follow-up fast, reviewable, and fail-closed.

This plan consumes, without redefining:

- `plans/2026-08-07-personal-plan-stage1-3-production-foundation.md` as the current production architecture and activation authority;
- `plans/2026-08-06-personal-plan-stage1-bedarf-implementation.md` for the coordinated enrichment boundary;
- `docs/personal-plan/categories/*/decision.md` for category-local product facts and launch gates;
- `docs/product-intake-research-ops.md` for identity, source, image, payload, review, and approval policy.

The current production snapshot on 2026-08-09 proves that migration `20260808065528_personal_plan_category_readiness` is not applied. Production has the legacy disabled `heat_protectant` identity row, no `scalp_care` identity row, none of the three new category/spec/protocol tables, no standalone Heat Protectant rows, and no canonical Scalp Care rows. Existing cohorts remain 35 active recommended Masks, 10 Dry Shampoos, five legacy-key Deep Cleansing rows, five Bondbuilders, 43 active recommended Conditioners, 49 Shampoos, 42 Leave-ins, and 41 Oils.

## 2. Chosen direction

Use two bounded deliverables rather than pretending research, tooling, schema deployment, and product publication are one reversible action.

### Deliverable A — independent research and catalog-enrichment workflow

Start now from the Personal Plan foundation branch. Produce:

1. source-backed, image-ready, validator-shaped local dossiers for the confirmed Heat cohort and provisional Scalp pool;
2. exact identity/spec/protocol gap manifests for the existing-product cohorts;
3. a dedicated internal catalog-enrichment workflow that can prepare and validate both new-product rows and updates to exact existing product IDs without creating `product_submissions`, linking users, or sending notifications;
4. a tracked, reviewable batch manifest containing no user data and no secrets.

The local evidence packages remain ignored operator artifacts under `ops/catalog-enrichment/<batch>/<product-key>/`. The tracked batch manifest records reviewed facts, source URLs, exact target identity, expected operations, asset hashes/paths, validation state, and the disposition of every cohort item.

The workflow wraps the existing `validateProductIntakeApprovalPayload`, `validateProductIntakeCategorySpecs`, and `ProductIntakeTargetSpecOperation` validation/operation-planning layer. It does not reimplement category validation. The genuinely new seams are internal-catalog identity/fingerprint handling, sanitized manifest persistence, and a non-submission executor that can never link or notify a user.

### Frozen manifest contract

Each product has one tracked record. Workers write disjoint product/cohort files and never append concurrently to a shared manifest. A deterministic indexer produces the batch summary.

| Field | Contract |
|---|---|
| `schema_version` | Exact supported manifest schema version; unknown versions fail closed |
| `batch_id` / `product_key` | Stable sanitized identifiers used for paths and fingerprints |
| `category_key` | Canonical supported category key |
| `lifecycle_classification` | `new_product`, `existing_product_enrichment`, `verification_only`, `provisional_candidate`, or `excluded` |
| `identity` | Canonical brand, optional line, clean name, category, size/variant, and reviewed identifiers |
| `target_product_id` | Required only for existing-row enrichment/verification; forbidden for new products |
| `target_fingerprint` | Canonical fingerprint of the exact current target fields/spec rows consumed by the proposed update |
| `duplicate_check` | Checked-at time, searched identity/identifiers, and exact candidate results including inactive/non-recommended rows |
| `sources` | Source label/type/URL, checked-at time, supported fields, and source-specific limitations |
| `commercial` | Purchase URL/status, price/currency, checked-at times, availability, and blockers |
| `image` | Source-page/image evidence, local relative asset paths, final asset hash, QA state, and review state; no signed URLs |
| `product_payload` | Exact validator-shaped product fields and field rationales |
| `category_payload` | Exact category spec/protocol rows consumed by the shared Product Intake validator |
| `planned_operations` | Allowlisted product insert/update and `ProductIntakeTargetSpecOperation` list; no free-form SQL |
| `validation` | State, errors/blockers, validator version, validated fingerprint, and validated-at time |
| `review` | `pending`, `approved`, `rework`, or `excluded`, reviewer/time/notes, and the exact reviewed content fingerprint |
| `disposition` | Final Deliverable-A state and whether the item may enter Deliverable B |

### Deliverable B — coordinated catalog-data follow-up

Start only after the accepted Personal Plan head contains the required category/runtime contracts and the target environment has applied the dependency migrations. Consume only reviewed, fingerprinted manifests from Deliverable A. It may contain the synchronized schema/consumer cutovers and catalog-data operations required by the category authorities, but it does not deploy, apply migrations, upload images, activate flags, or publish products merely because the PR exists.

Every product remains subject to its exact Product Intake review. Product publication, image upload, migration application, feature activation, and production verification are separate explicit approvals.

### Rejected paths

- Do not create synthetic user submissions for internal catalog work. The current approval path links a user and sends a notification.
- Do not treat the dated June catalog-additions script as a generic workflow; it is hard-coded to another cohort and three categories.
- Do not embed unreviewed product facts directly in an ad hoc SQL migration.
- Do not let research workers choose the Scalp Care launch cohort or reinterpret category policy.

## 3. Scope and non-goals

### In scope

| Lane | Cohort | Deliverable-A state |
|---|---|---|
| Heat Protectant | Six confirmed active seeds plus one pending Balea 2-Phasen candidate | Full new-product dossiers; pending candidate stays ineligible |
| Scalp Care | Eight provisional research fixtures, two per role | Full reconnaissance/dossiers; launch selection remains an explicit review decision |
| Mask | All 35 active recommended products | Exact ID manifest, `repair_support_level` evidence, critical protocol gaps |
| Deep Cleansing | NEQI, Swiss-O-Par, Balea Professional, ISANA Professional, Gliss Scalp Balance | Exact ID manifest, Reset-role and scalp-target facts |
| Dry Shampoo | All 10 active recommended products | Canonical-spec manifest; exact foam/liquid split verified |
| Bondbuilder | Epres, K18, OLAPLEX No.3PLUS primaries | Exact protocol manifest; No.0 remains companion, legacy No.3 remains ineligible |
| Conditioner | Current 43 active recommended products | Integrity/fingerprint re-verification only |
| Shampoo | Current active launch catalog | Coverage audit; no invented finite upload cohort |
| Leave-in | Current active launch catalog | Completeness and tri-state Heat/protocol audit; no invented cohort |
| Oil | Current active launch catalog | Canonical-role/spec/protocol coverage audit; no invented cohort |

### Explicit non-goals

- No category-policy, ranking, tier, role, cadence, or user-facing copy changes.
- No end-user surface or journey changes; no mockup is required.
- No feature-flag activation, deployment, migration application, production catalog write, image upload, user link, or notification.
- No recommendation confidence based on product names, ingredients, or marketing alone.
- No medical diagnosis or treatment claim. Scalp/density findings remain cosmetic positioning plus exact label instructions with the existing limited-evidence and escalation boundaries.
- No final Scalp Care launch cohort until Nick reviews the candidate evidence.
- No arbitrary SKU-count targets for Shampoo, Leave-in, or Oil where the authority defines coverage instead of a finite cohort.

## 4. Target map

Deliverable A is expected to touch:

- `plans/2026-08-09-personal-plan-catalog-enrichment.md` — durable execution authority and receipt;
- `.gitignore` — explicitly unignore `data/catalog-enrichment/**` while keeping all local evidence under ignored `ops/`;
- `src/lib/product-intake/catalog-enrichment/**` — manifest schemas, exact-target identity rules, operation planning, fingerprints, and fail-closed validation;
- `scripts/product-intake/catalog-enrichment/**` — prepare, inspect, validate, preview, and later guarded apply entry points;
- `tests/product-intake-catalog-enrichment*.test.ts` — new-row/existing-row, duplicate, stale-fingerprint, unsupported-table, and no-user-side-effect contracts;
- `docs/product-intake-research-ops.md` — internal catalog-enrichment operator path and current Heat/Scalp payload tables;
- `package.json` — discoverable dry-run-first command entry points;
- `data/catalog-enrichment/personal-plan-launch-v1/**` — tracked, sanitized batch manifests after review;
- ignored `ops/catalog-enrichment/personal-plan-launch-v1/**` — source evidence, raw images, processed images, and local review artifacts.

Deliverable B may additionally touch category migrations, generated types, readers/writers, selectors, approval RPCs, and category tests, but only after its exact target head and manifest fingerprints are frozen in a separate implementation contract. The plan must not guess those paths before the active Personal Plan integration is accepted.

## 5. Designed operator journey

There is no end-user journey change in this work.

1. The operator opens the batch overview and sees every category item classified as `new_product`, `existing_product_enrichment`, `verification_only`, `provisional_candidate`, or `excluded`.
2. A researcher claims one disjoint product group and records official/manufacturer evidence first, preferred German retailer evidence, identity/identifiers, current commercial state, exact application facts, and a reviewable raw image candidate.
3. The workflow checks the entire catalog, including non-recommended rows. A possible duplicate blocks new-row preparation; an existing-row enrichment must resolve to one exact product ID and frozen current-row fingerprint.
4. Validation shows the exact database-shaped values and planned operations. Missing schema, unsupported category, unresolved identity, unknown critical protocol, stale target fingerprint, unavailable purchase state, or failed image QA keeps the item blocked instead of inventing a value.
5. Scalp Care candidates retain provisional roles and cosmetic/medical-boundary notes. Nick chooses the launch cohort only after seeing the evidence; unselected candidates remain research evidence, not recommendations.
6. Nick reviews identity, properties, protocol, image, commercial state, and limitations per product. Review decisions bind to content fingerprints.
7. Deliverable A ends with a sanitized manifest and receipt. It performs no database or storage write.
8. After dependency migrations are merged and explicitly applied, Deliverable B rechecks live identities, target fingerprints, schema/readiness, availability, and asset hashes. Drift returns the item to review.
9. A dry-run lists exact inserts/updates/uploads and proves there are no submission, user-link, notification, activation, or unrelated-row operations.
10. Only a later exact product/batch approval may authorize guarded apply. Post-apply verification checks product rows, category specs, protocols, hosted images, coverage counts, and duplicate absence. Feature activation remains separate.

**Operator-journey sign-off:** confirmed by Nick on 2026-08-09 with no corrections.

## 6. Planning evidence

No user-facing mockup is required because this plan changes only internal research, validation, and catalog-data preparation.

Planning evidence gathered on 2026-08-09:

- repository authority map across all ten categories;
- live read-only Supabase snapshot proving the readiness migration/tables are absent and current cohort counts;
- Product Intake code audit proving Heat/Scalp validators exist locally while the live dependency is absent;
- tooling audit proving current packages are submission-centric and unsafe for synthetic internal submissions;
- current-source reconnaissance for all seven Heat products and the provisional eight-product Scalp pool.

### Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
|---|---|---|---|---|---|
| `CP-1` | defect | `data/catalog-enrichment/**` is matched by `.gitignore`'s `/data/*` rule | accepted | Added `.gitignore` to the target map and required an explicit narrow exception | `git check-ignore` reproduced the blocker |
| `CP-2` | defect | Manifest fields were spread across prose and worker tasks | accepted | Pinned the complete record contract above | Self-review checks every producer/consumer against one schema |
| `CP-3` | tradeoff | Existing dry-run and target-operation code already owns shared category validation | accepted | Wrap existing operation planning; implement only internal identity/fingerprint/executor seams | Verified named symbols in current repository |
| `CP-4` | tradeoff | Parallel cohorts would contend if they appended to one file | accepted | One product/cohort file per worker; deterministic read-only index generation | Worker briefs require disjoint paths |
| `CP-5` | tradeoff | Research workers could target an unstable schema if dispatched before tooling is proven | accepted | Added a hard Task-2 green gate before Tasks 3–5 may write packages/manifests | Execution order and acceptance checks updated |
| `CP-6` | defect | Live cohort counts could drift | accepted as existing verification dependency | Task 1 and Task 7 re-run live snapshots and fail on drift | Already present; made it a worker-dispatch gate |
| `CP-7` | tradeoff | Reviewer suggested a stale alternative final-review router | rejected | Retain current repository `ready-check` → `request-code-review` workflow | Current `AGENTS.md` remains authority |

## 7. Ordered tasks

### Task 1 — Freeze batch contract and baseline snapshots

**Consumes:** category authorities, live read-only catalog, active Personal Plan foundation head.

**Produces:** batch ID, exact cohort ledger, current product IDs/fingerprints, category/table readiness snapshot, exclusions, and a no-user-data manifest schema.

- Record exact Heat, Deep Cleansing, Dry Shampoo, Mask, Bondbuilder, and Conditioner cohorts.
- Treat Shampoo, Leave-in, and Oil as coverage audits, not invented product lists.
- Keep all eight Scalp products `provisional_candidate` and preserve two-per-role research coverage.
- Fail if a named new Heat product matches an existing catalog identity or identifier.

**Complete when:** deterministic tests reproduce the same cohort ledger and every item has one lifecycle classification, target identity state, and owner.

### Task 2 — Build the internal catalog-enrichment workflow test-first

**Consumes:** Task-1 manifest contract and the existing Product Intake payload validators.

**Produces:** preparation/validation/preview tooling for internal new rows and exact existing-row enrichment.

- Reuse identity, category validators, source/image contracts, and operation types where they are genuinely shared.
- Require `target_product_id` plus frozen target fingerprint for existing-row changes.
- Require duplicate-search evidence and no target ID for new rows.
- Model operation allowlists per category/table; reject unknown or unrelated tables.
- Prove that preview/apply planning cannot create submissions, mutate `user_product_usage`, link a user, or send notifications.
- Keep apply unavailable or separately guarded until Deliverable B defines the accepted live contract.
- Update the canonical runbook, including the Heat and Scalp payload matrices.
- Add the narrow `.gitignore` exception for tracked sanitized manifests and prove local `ops/` evidence remains ignored.

**Complete when:** focused tests cover new/existing branching, duplicate block, stale fingerprint, content fingerprint, unsupported schema, path traversal, secret/user-data rejection, and zero user-side-effect operations; all commands default to non-writing preview. This is a hard stop gate: Tasks 3–5 may not write dossiers or manifests against the new contract until these tests are green and the schema fingerprint is frozen.

### Task 3 — Research the confirmed Heat cohort in disjoint packages

**Consumes:** Heat authority, Task-2 package contract, official/retailer sources.

**Produces:** six launch-candidate dossiers and one explicitly pending dossier.

- Verify canonical identity, identifiers, German availability, price/link, binary finished-product Heat capability, exact protocol, and image candidate.
- Preserve current reconnaissance blockers: Taft Aloe Boost and Taft x Gliss Lovely Long were not deliverable on 2026-08-09; the pending Balea 2-Phasen remains ineligible; recheck at product review.
- Do not rank on maximum temperature; retain it only as sourced descriptive evidence when present.

**Complete when:** each item is either locally review-ready or has one concrete source/image/availability blocker; no item is published.

### Task 4 — Research and narrow the provisional Scalp Care pool

**Consumes:** Scalp Care authority, hair-care evidence boundary, Task-2 package contract.

**Produces:** eight source-backed dossiers and a separate candidate-comparison brief.

- Preserve two research candidates per role.
- Verify cosmetic status rather than inferring it from retailer placement, PZN, ingredients, or claims.
- Normalize exact manufacturer directions; do not manufacture repeat cadence.
- Keep Eucerin blocked pending explicit classification evidence if status remains unresolved.
- Keep density products behind limited-evidence/claim review; keep exfoliants from auto-stacking with Deep Cleansing.
- Present candidate evidence to Nick before any launch-set status changes.

**Complete when:** every candidate has exact identity, provisional role, format/rinse/protocol evidence, commercial/image status, medical-boundary notes, and an explicit readiness/blocker state; launch selection remains pending Nick review.

### Task 5 — Build existing-product enrichment manifests in parallel

**Consumes:** exact live product IDs/fingerprints and category authorities.

**Produces:** sanitized manifests for Mask, Deep Cleansing, Dry Shampoo, Bondbuilder, Conditioner, plus coverage audits for Shampoo, Leave-in, and Oil.

Partition workers by disjoint product/category manifests:

- Mask: 35 products, repair-support evidence and critical protocol facts.
- Deep Cleansing: five products, Reset roles and scalp targets.
- Dry Shampoo: 10 products, canonical specs including Balea foam and got2b liquid.
- Bondbuilder: three active primaries, exact executable protocols.
- Conditioner: integrity/fingerprint verification only.
- Shampoo/Leave-in/Oil: report exact missing coverage and propose a later finite enrichment cohort only when evidence establishes one.

Each worker owns a disjoint directory/file set. A separate integrator runs the deterministic indexer after workers finish; no worker edits a shared index.

**Complete when:** each existing row is `ready_for_review`, `blocked_missing_fact`, `blocked_schema`, or `out_of_scope`; coverage totals reconcile to the frozen cohort counts and no new row is proposed for an existing identity.

### Task 6 — Reconcile manifests and run evidence-sensitive review

**Consumes:** Tasks 3–5.

**Produces:** one coverage report, one missing-facts ledger, one source-provenance index, product fingerprints, and review decisions.

- Apply Product Intake source and image quality rules consistently.
- Run hair-care expert review on medical-adjacent Scalp/density claims and any other evidence-sensitive overreach.
- Require Nick review of the Heat products, proposed Scalp launch selection, images, exact properties, and critical protocols.
- Reopen only the affected product when a fingerprint changes.

**Complete when:** every item has a disposition and reviewer-bound fingerprint; no unresolved item is counted as launch-ready.

### Task 7 — Hand off Deliverable B against the accepted integration head

**Consumes:** reviewed manifests, accepted Personal Plan head, explicit migration/deployment state.

**Produces:** a new implementation contract for the coordinated schema/consumer/data follow-up.

- Re-audit the target branch because Stage 3–5 work may have changed readers, protocols, or migration order.
- Run linked read-only migration/table/category readiness checks.
- Name exact schema/consumer cutovers and data operations; do not assume the planning branch remains current.
- Freeze base SHA, manifest SHA, product target fingerprints, and later dry-run commands.
- Run normal ready-check and one whole-branch counterpart review before publication.

**Complete when:** the follow-up is review-ready and dry-run clean. Stop before commit/push/draft PR unless separately authorized; stop again before migration apply, image upload, catalog apply, deployment, or feature activation.

## 8. Verification

### Automated

- Manifest schema, path, fingerprint, duplicate, target-staleness, and allowlisted-operation tests.
- Existing Product Intake validator and review-workflow regressions.
- Category-specific exact payload tests for Heat and Scalp.
- Cohort count/fingerprint reconciliation for Mask 35, Dry Shampoo 10, Deep Cleansing 5, Bondbuilder primary 3, Conditioner 43.
- `npm run test:node`, `npm run typecheck`, `npm run lint`, and relevant Personal Plan/database gates on the exact Deliverable-B tree.

### Manual/operator

- Source URLs render and refer to the exact German-market product/variant.
- Raw and final image candidates are exact, product-only, front-facing, and pass magenta QA before approval.
- The batch overview never labels provisional/blocked items ready.
- Preview lists no user, submission, notification, activation, or unrelated-row side effects.

### Migration/live state

- Before Deliverable B, recheck remote migration history, category flags, tables/columns/RPC signatures, storage bucket, generated types, and unapplied migrations.
- Recheck exact catalog identities including non-recommended/inactive rows and identifiers.
- After any separately authorized apply, verify rows/specs/protocols/image URLs/coverage and duplicate absence.

### Evidence-sensitive

- Finished-product capability and protocol claims require explicit product/manufacturer evidence.
- Weak or mixed evidence remains a limitation, not a ranking or efficacy fact.
- Scalp/density products preserve cosmetic-versus-medical and escalation boundaries.

## 9. Review and handoff

- Planning worktree: `.worktrees/personal-plan-catalog-enrichment` on `codex/personal-plan-catalog-enrichment`, based on the current remote Personal Plan foundation head.
- Durable plan and sanitized manifests: `commit` when reviewed.
- Local source evidence and images under `ops/`: retain through review, then archive according to Product Intake operations; never commit user/private/signed data.
- Transient counterpart output: discard after findings reconciliation.
- No implementation worker edits persistent files until this plan passes counterpart review and Nick confirms the operator journey.
- Deliverable A stops at reviewed local dossiers, sanitized manifests, verified tooling, and an implementation-loop handoff.
- Deliverable B publication, production writes, and activation remain separate authorization boundaries.

**Counterpart review:** complete; approved with revisions and all material findings reconciled.
**Operator-journey sign-off:** confirmed by Nick on 2026-08-09 with no corrections.
**Recommended next loop after sign-off:** `implementation-loop` for Deliverable A, using explorers for current-state/source mapping and disjoint workers for tooling, Heat, Scalp, and existing-product manifests.

## 10. Deliverable-A implementation receipt

Implemented locally on 2026-08-09 after operator-journey sign-off.

- Frozen manifest schema SHA-256: `084f2808464758edae42b33696aa5b1095b6bad35c3a12860ebb3920c0a64145`.
- Integrated 114 unique preview-valid manifests: 6 `new_product`, 9 `provisional_candidate`, 96 `verification_only`, and 3 coverage-only `excluded` records.
- Exact existing-row cohorts reconciled: Mask 35, Conditioner 43, Deep Cleansing 5, Dry Shampoo 10, Bondbuilder primary 3.
- Coverage-only audits recorded the active recommended Shampoo 49, Leave-in 42, and Oil 41 populations without inventing finite enrichment cohorts.
- Heat contains six proposed new rows and one zero-operation pending candidate. The six planned spec/protocol operations now mirror the exact shared Product Intake validator shapes.
- Scalp contains eight zero-operation provisional candidates, two per role; no launch cohort was selected.
- The preview command has no apply mode. No database, storage, submission, user-link, notification, migration, image-upload, publication, deployment, or activation write occurred.
- Focused catalog-enrichment and Product Intake regression suite passed 47 tests after review fixes; targeted lint and `git diff --check` passed during integration.
- Full typecheck remains blocked by the dependency branch's unrelated `tests/stripe-offer-elements-checkout.test.tsx:40` `surcharge` mismatch. The broader node suite also encounters the unrelated missing `sharp` optional binary in `tests/product-intake-review-app.test.ts`.
- Final whole-diff review found two validation/readiness defects; both were fixed test-first. Delta review then reported no blocking findings.
- Final evidence-sensitive Heat/Scalp review reported no blocking Deliverable-A evidence findings and explicitly did not approve publication.

The tracked batch receipt is `data/catalog-enrichment/personal-plan-launch-v1/README.md`. Local source/image dossiers remain ignored under `ops/catalog-enrichment/personal-plan-launch-v1/`.
