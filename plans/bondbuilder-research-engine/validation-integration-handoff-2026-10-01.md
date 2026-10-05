# Bondbuilder — consolidated validation and integration handoff

Date: 2026-10-01. Task: `codex/bondbuilder-research-engine` in the existing task worktree.

2026-10-02 follow-on: Nick explicitly confirmed all eight initial rows as enrichment targets, preserving their agreed grades; low-trust OGX/Aveda are not thereby promoted. He invited additional-product engine checks. The [new validation slice](new-submission-validation-2026-10-02.md) owns that later authorized offline run. The stop contract below describes this completed Oct 1 pass, not a ban on that separately authorized research; database/apply/promotion and detailed integration execution remain separate gates.

2026-10-02 concrete follow-on: [storage contract](storage-contract-proposal-2026-10-02.md) and [implementation plan](implementation-plan-2026-10-02.md) specify the additive shape and versioned writer/protocol/readiness guards. Nick subsequently approved that implementation direction and required checking existing adapters and retaining all research properties. [Adapter grounding](adapter-grounding-2026-10-02.md) completes that check. These current records supersede the directional tasks/then-pending approval below, not historical research. No runtime implementation, live migration/apply, method lock or activation is implied.

## Outcome, scope and stop contract

Carry the reviewed eight-product pilot and final owner decisions into one consistent research contract, validate the review data without pretending to have run a new engine, and prepare the smallest database/intake integration path. The engine must research new submitted products fully while keeping their trust low and recommendation flag false until Nick reviews them.

This pass changes research/planning documents, the local review artifact and its read-only consistency verifier only. It does not implement production code, create/apply migrations, run a new classification batch, mark the method locked, approve products, commit/push, or activate anything. Stop after the consolidated draft, actual verification receipt and counterpart-reviewed integration proposal. Future execution consumes a newly frozen/validated contract, not this preview alone.

Authority: [final owner policy and source follow-up](application-followup-2026-10-01.md), [eight exact owner grades](owner-review-2026-09-30.md), [approved application review](application-review-2026-09-30.md), [synchronized standard](../../docs/research/bondbuilder-inci/draft-v0.4/standard.md), and [ordinary Product Intake](../../docs/product-intake-research-ops.md).

## Settled rules

- Retain the eight owner grades. No model-awarded trust promotion. A resolved in-scope new submission is `low / owner_default`, with ordinary intake `is_chaarlie_recommended=false`. Existing exact catalog matches are linked, not duplicated or reset. Only explicit owner review changes the applicable grade or recommendation flag.
- Category membership still requires recognized technology plus targeted treatment intent. Generic acid, protein and repair/plex branding do not suffice. Unresolved identity/category holds do not become approved membership through the default policy.
- No intensity property in new research. Preserve existing production intensity values; never invent new values to satisfy legacy NOT NULL/strict validation.
- Compact comparison: trust, technology, placement, applied format and contact/wait. Rich evidence and application facts remain available in the database; current Routine Plan depth and existing German customer surfaces remain unchanged.
- K18: shampoo without preceding conditioner, towel-dry, apply, wait the full four minutes, then optional usual conditioner. This is not a compulsory extra purchase or a standalone treatment-rinse instruction.
- epres: intended-bottle dilution to 150 ml finished mixture, dry hair saturation, minimum ten minutes / optional overnight, then usual wash/care. Première: five minutes, layer shampoo before rinsing. Neither creates extra wash days.
- Elvital Plus / selected DE Redken / DE Première local cadence remains unestablished. Cross-market recommendations stay complements. Aveda cadence is conditional, not absent; its moderate-damage overlap is retained. OGX guidance stays UK-bound.

## Current eight-product review state

| Review identity | Owner trust | Next operational treatment | Not claimed ready |
| --- | --- | --- | --- |
| P01 No.3PLUS | High | Reconcile exact existing catalog/pack and retain reviewed facts; do not assume a new row is needed. | Live catalog/protocol/version status not inspected in this pass. |
| P02 K18 mask | High | Preserve DE course variant and optional-after-wait sequence. | Existing scalar conditioner handling alone does not establish correct compiler output. |
| P03 epres | High | Preserve spray, dilution, minimum wait and optional overnight. | Strict executable facts need validated mapping. |
| P04 Elvital Plus 200 ml | Medium | Prepare exact candidate with five-minute pre-wash sequence. | Local cadence, new suitability and catalog reconciliation remain open. |
| P05 selected Douglas Redken 190 ml | Medium | Prepare the owner-selected formula, preserving displaced manufacturer evidence. | AU cadence is not binding DE cadence; new suitability remains open. |
| P08 Première Concentré 250 ml | Medium | Prepare source-version/pack reconciliation and shampoo-layering protocol. | DE dose complement, local cadence, physical texture and new suitability remain qualified/unresolved. |
| P06 OGX serum 50 ml | Low | Keep researched feedback/non-recommended intake path; no curated promotion. | UK/DE applicability, diameter fit and old enum mapping. |
| P07 Aveda pre-shampoo 150 ml | Low | Keep researched feedback/non-recommended intake path; no curated promotion. | Numerical dose unstated; attributed maker fit is not an independent weightlessness finding. |

Six rows meet only the owner trust floor. This is **not six promised new products**, six intake-ready packages, or six global recommendations. No live catalog lookup, commercial/image preparation or promotion preflight ran. `catalog_intake_ready` and `global_recommendation_ready` are **not evaluated** for each row; unverified prerequisites must not be reported as completed blockers with inferred live state.

## Storage proposal and compatibility

Proposed **new additive columns**, not fields already in the database: extend the existing Bondbuilder contract rather than build a second catalog framework. Existing mode/format/rinse and protocol rows below are current seams, not newly implemented research support.

| Target | Proposed values / responsibility |
| --- | --- |
| `product_bondbuilder_specs.technology_family` | Five standard families; nullable on unresolved applicability; no forced mapping to legacy disulfide/peptide axes. |
| `claim_trust_level`, `trust_basis` | Three levels plus `owner_anchor | owner_calibration | owner_default`; preserve null applicability states and explicit owner-decision/default reference. |
| `research_profile` | Strict versioned product-level projection: formula/source binding, standard/artifact hashes, checked/reviewed dates, bounded German concise/deeper explanation, evidence/source scope, limitations, applied physical format and researched application facts. No arbitrary instructions blob or potency field. |
| Existing mode/format/rinse fields | Reuse valid source-backed mappings. Unsupported old vocabulary is a compatibility gap; facts remain in the profile, never relabeled as unknown or forced to K18/OLAPLEX. |
| `product_application_protocols` | Exact product ID plus `specialized_bond_treatment`; runtime schema/pointer/steps must retain wait, optional conditioner, dilution, minimum time and shampoo layering. Unknown critical scheduling stays visibly non-executable. |
| Existing recommendation/lifecycle/eligibility | Independent authority. No adapter-owned promotion, deactivation, suitability fabrication or reset of existing owner approvals. |

Compatibility implementation must make legacy intensity/axis and unsupported placement/format fields nullable where a new reviewed assessment cannot populate them truthfully, without dropping or rewriting existing values. Relax validation only under the new versioned research contract, not a broad permissive legacy bypass. New curated eligibility still requires reviewed medium/high, current strict suitability and exact protocol gates. Low trust alone must not block non-recommended user intake.

The original migration requires intensity/application mode and later makes axis/format/usage NOT NULL. Current `category-validators.ts:665` and `src/lib/bondbuilder/constants.ts:12` still require the six old fields; admin validators/writers also consume them. This proposal is **not currently insert-ready**. Resolve generated/types/readers/writers/SQL and migration ordering together. Preserve existing intensity-dependent legacy behavior; it is not the authority for new product selection and must not manufacture a confident recommendation for an unmapped new product.

Introduce the previously proposed **new** `verified_product_protocol` compatibility selector, resolved by exact product and role. It does not currently exist in code or the database CHECK. Do not add a new product-name enum per bottle or fall back to a named competitor's instructions. The generic selector does not make a protocol complete: schema validation, source binding and actual compiler behavior remain required.

## Ordered next slices and owning seams

These slices are a directional dependency map, not executable worker briefs. Before a code/migration slice, concretize the strict stored shape, exact guards/nullability, effective migration lineage and protocol fixtures, and obtain the appropriate execution approval. No independent slice is authorized by this handoff alone.

### 1. Freeze and validate the synchronized research contract

Consumes: synchronized `draft-v0.4/{standard,runbook,researcher-prompt,blind-instructions}.md`, exact dated source registry and final owner-policy references. Produces: new create-only method/input receipts, strict envelope schema and independently assessed fact/boundary/policy results.

Keep the eight pilot products calibration. Reserve genuinely unused exact positive category examples plus boundary/identity negatives before labels; low-default positive products are valid coverage. No hunt for new high/medium tiers. Freeze cohort/reserve order and denominators, then use independent anonymous/named stages per runbook. Explicitly resolve a real family-coverage shortage before method lock; do not pass it using renamed pilot sizes or synthetic positives. Replay consistency and unseen applicability remain distinct.

Acceptance: exact deterministic facts, boundary/curated candidacy and owner/default compliance agree; no fabricated directions/promotions or unresolved critical protocol disagreement; source/seal hashes pass. Report holds/coverage, not an efficacy-validation score. Existing v0.3 verifier proves history only.

### 2. Pure adapter and compatibility contract

Consumes: locked versioned envelope and validated fixtures. Produces: a pure version/hash-pinned projection under `src/lib/bondbuilder-research/`, replay CLI under `scripts/bondbuilder-research/`, and a strict integration guide following the existing leave-in playbook.

Implement no network/database writes in the adapter. Explicitly distinguish property projection, non-recommended intake usability and curated candidacy. Fail closed on malformed source IDs, digest/version mismatch, identity conflict or unsupported mappings; retain known unrelated facts and structured reasons. Preserve the owner default and existing-decision applicability without promoting recommendation flags. Prove low/default inputs, exact owner-high/medium fixtures, incomplete/conflicting identity and ordinary acidic/protein false positives at this owning boundary.

### 3. Database, protocol and intake/consumer convergence

Consumes: verified projection and exact producer-bound application facts. Produces: additive schema compatibility, a Bondbuilder intake bridge and persisted/readable product facts; still no automatic publication.

Owning surfaces: `src/lib/product-intake/category-validators.ts`, `schemas.ts`, new `bondbuilder-research-adapter.ts`, `scripts/product-intake/codex-research-worker.ts`; `src/lib/product-specs/constants.ts`, `src/lib/bondbuilder/{constants,usage-protocols}.ts`, `src/lib/validators/index.ts` and admin product writers; `src/lib/routines/personal-plan/application/{contracts-v2,compiler-v2,product-protocol-adapter}.ts` and `src/lib/personal-plan/routine/application-adapter.ts`; catalog relationship/audit and Personal Plan catalog readers; named-product chat context `src/lib/agent-v2/named-product-context.ts`; active approval and catalog-enrichment SQL writers.

First refresh migration lineage and trace the latest effective SQL functions; create migrations with the normal CLI rather than invent filenames. Expand schema compatibly, deploy validating readers/writers, then prepare guarded backfill. Rollback preserves new research rows/data and refuses to silently restore restrictive legacy constraints while incompatible rows exist. Never replay the old rinse-to-axis/protocol guessing backfill.

Use existing exact-workflow/pointer capability where it genuinely supports the producer sequence, adding only required facts/semantics. Current compiler supports exact steps; it does **not** follow from a missing family template that all workflows need replacing. `conditioner_optional` currently maps to null in `compiler-v2.ts:110`; contact-time vocabulary lacks a minimum kind and fixed pump ranges cannot represent K18's open-ended starting dose. Validate rendered K18 ordering/optionalness, epres minimum/dilution and Première layering, not just a JSON flag. Shared schemas must be updated with consuming guides/tests, preserving other categories.

Prove persist/read round trips through actual approval and catalog-enrichment owners into chat allowlists, source/version guards, owner-only promotion, nullable legacy paths, existing flags preserved and unknown cadence producing no invented occurrence. Keep existing German layouts and Routine Plan depth. Use the previously reviewed application journey; any materially new customer copy/interaction needs its own concrete proposal, not approval inferred from the English Lab.

### 4. Exact catalog packages and final handoff

Consumes: locked results and implemented compatible intake/protocol path. Produces: delta-only exact candidate packages with duplicate reconciliation, canonical identity, current price/link, approved image, specs, protocols and two separate readiness reports.

Top-three references may already exist: reconcile before deciding insert/update. Prepare the three owner-medium candidates without assuming suitability or cadence completion. Report every source/applicability gap; do not claim recommendation readiness from trust alone. OGX/Aveda remain low non-recommended examples unless Nick changes their exact rulings. Run current guarded dry-run/preflight against the reviewed payload/head before requesting Nick's exact product/promotion handoff. No apply, upload, publish or activation follows merely from plan approval.

## Verification and authoring contract

Current-pass checks: parse eight review records and inline Lab JavaScript, source reference closure, known K18/epres/OGX/Aveda structured constraints and explicit three unknown local cadences; validate local Markdown links and named-data exclusion from the blind guide; rerun v0.3's completed hash verifier; whitespace check. These are review-artifact consistency checks, not fresh classifications or production tests. No browser check is claimed for this docs-only revision.

Future implementation tests belong to their strongest real boundary: one adapter suite, actual protocol compiler fixtures, actual persist/read transactions and publication/preflight transition cases. Test names/oracles are tied to observable outcomes above, not copied source strings or duplicate helper checks. No test-only production seam. Run focused owner/sibling suites plus `npm run ci:verify`, then implementation-loop's ready-check/review. Migration proof must cover current effective SQL, update concurrency/null guards, no lost owner approval, source/version fingerprints and data-preserving rollback. Require a seeded-prestate PGlite rehearsal of the actual migration/executor, rollback, reapply and tamper/concurrent-target refusal before any one-shot data apply; static review alone is insufficient. Fresh main/migration/live-state verification is required before execution; this worktree inspection is not a production-schema claim.

## Decision coverage, approval and journey

**Confirmed for this consolidation/planning pass, not an execution handoff.** Confirmed with Nick: eight grades, report technology boundary, no intensity, five compact comparison properties, fully researched other facts, default-low/non-recommended submissions, owner-only promotion, producer-backed application guidance and K18 optional conditioner. Inherited: blind/immutable methodology, source applicability, separate readiness/publication and existing preference/equal-shortlist/primary authority. Implementation defaults for this pass: reuse the existing task/docs/Lab and add a read-only consistency check. Open consequential assumptions affecting this pass: none.

**Resolve before implementation handoff:** present and review the exact stored profile shape and additive nullability/guard/rollout contract. Current preference is core scalar facts plus a strict versioned profile in the existing spec table, not a second normalized catalog; the concrete schema and compatibility safety are not yet approved for execution. The reviewer has not chosen an alternative architecture or waived migration risk on Nick's behalf. This gate concerns dependent implementation, not another trust/property interview or a request for Nick to invent database details.

Coverage acknowledgement: Nick approved the application summaries with “those sound fine to me if she checked them properly with the producers,” emphasized “For K18 the optional condition is an important step,” then requested “Go on please.” This carries settled choices into consolidation/validation preparation and the integration proposal; it does not grant new migration, production, catalog, publication or method-lock authority.

Internal revalidation: current standard/prompt/runbook/blind guide now agree on the final owner policy and no-intensity scope. Unchanged application journey was already reviewed in the English Lab and approved above. Separate design sign-off is not applicable to this internal docs-only pass. Future user-visible copy/behavior beyond that approval is not preapproved. Undiscussed consequential assumptions affecting this handoff: **none within this consolidation/planning scope**. Method freeze/unused coverage, data readiness and execution approvals remain dependent gates, not silently waived decisions.

Self-review: no empirical claim that no other effective products exist; no new trust-ranking rule, unknown-to-weekly fill, blind owner-table leakage, new catalog approval or destructive schema action. The proposal covers actual writer/readers and optional-care compilation, not just database columns. Retain durable plan, method, evidence and future receipts for the eventual PR; transient counterpart output stays outside the repository and is discarded after findings are recorded. Stop this pass at reviewed proposal; production execution is not authorized by it.

## Review receipt

Run from the task worktree:

```sh
node plans/bondbuilder-research-engine/verify-review-draft.mjs
node data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/verify.mjs --complete
git diff --check
```

Final rerun passed: eight review identities, source-reference closure, key K18/epres/OGX/Aveda application constraints, three unknown local cadences, 12 Markdown documents / 71 existing local links and no named-pilot leak in the blind guide. Inline Lab JavaScript parses. Historical verifier returned 56 matching hashes, eight products, 34 sources, six lane JSON files, no blind leakage and no activation. `git diff --check` passed. None of these commands classifies products or writes production. The review verifier consumes `lab-preview/{snapshot.json,review-values.en.json,index.html}` and the current draft/planning guides; it is not the future envelope/adapter validator. No browser/production CI, live catalog check or fresh classification was run.

One read-only Claude Opus 4.8 / high counterpart review: **approve with revisions; no blockers for the consolidation pass**. Findings verified locally and reconciled:

| Finding | Type / disposition | Revalidation |
| --- | --- | --- |
| New selector and columns looked pre-existing | Defect / accepted | Constants still expose five legacy protocol codes and no new research columns. Wording now explicitly proposed/new. |
| Verification needed exact commands | Handoff defect / accepted with corrected path | Commands above name the actual v0.3 verifier. Review's suggested `replay-…-v0.2/verify.mjs` path is incorrect; completed v0.3 command returned 56 matching hashes. |
| Add seeded-prestate migration rehearsal | Risk coverage / accepted | Explicit future migration/rollback/reapply/tamper proof added; no migration or rehearsal claimed here. |
| Detailed storage/nullability cannot be treated as execution-approved defaults | Scope/architecture / qualified | Concrete schema safety is a before-implementation review gate. Existing directional scalar/profile proposal retained; no reviewer-selected alternative or new user approval inferred. |
| Parent plan stale default-trust wording | Handoff clarity / qualified | Parent plan already has a top-level supersession pointer and current decision bullets. Older dated history stays historical; current standard/handoff own the latest policy. |

Internal decision revalidation after these revisions: approved product/application behavior unchanged; no new choices for this pass. No counterpart rerun solely for a cleaner verdict. Transient review file remains outside the repository as discardable evidence; verified findings are retained in this ledger. Future lock/code/migration/publication gates remain open.
