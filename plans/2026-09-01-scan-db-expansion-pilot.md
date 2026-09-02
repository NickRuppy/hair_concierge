# Scan DB Expansion — Selection + Pilot Wave (Batch 1) — Rev 2

Rev 2 (2026-09-01): reworked after Codex counterpart review (findings ledger §10). Rev 1's protocol write model and direct-writer executor were wrong; corrected against the live schema and `docs/catalog-authority.md`.

## 1. Outcome and source context

Expand the product catalog so popular dm/Rossmann products scan with an **immediate, non-degraded verdict**. This plan covers the program foundations plus the **pilot wave (~30 SKUs)** end-to-end; the main wave (~150–200 SKUs) is an explicit follow-up gated on the pilot retro.

Source decisions (Nick, 2026-09-01, this session):

- **R1 — Tooling branch is not a blocker.** `codex/scanner-catalog-coverage-plan` (29 commits, no PR; its 21 migrations incl. canonical GTIN-14 + backfill ledger are already applied in prod) lands on its own track. Hard constraint: it must be merged to main **before T5/T6** — it owns the readiness oracle (`evaluateScanCatalogReadiness`), the canonical-GTIN write guards, and the executor machinery this plan builds on. T1–T4 do not depend on it.
- **R2 — Scale: pilot ~30 SKUs → main wave ~150–200.** Big-five categories (shampoo, conditioner, leave_in, oil, mask), bestseller + private-label (Balea, Isana) weighted, fixed quota of 10–20 "neu bei Rossmann" SKUs across the whole batch. Count SKUs/EANs, not products.
- **R3 — Scannable-only default.** Every imported product lands `is_chaarlie_recommended = false`; promotion stays a manual per-product editorial decision by Nick. The pipeline must make auto-promotion impossible.
- **R4 — Protocols are template-stamped (refined by F-01/F-06).** Nick verifies ~15 category/family protocol **content templates** once. Templates are research accelerators, not evidence substitutes: each stamped per-product protocol row must still carry **product-specific source evidence** (packaging text or manufacturer URL) confirming the template applies, and the engine must flag deviations for individual review. No verdict-engine change.
- **R5 — Full image polish for every import (Nick, 2026-09-01).** Every imported product gets the full finalized image treatment (background-removed/deshadowed packshot, own-bucket asset with provenance, thumbnail) — the same standard as recommended products. A scan-only product therefore differs from a recommendable one **only** by `is_chaarlie_recommended=false`. Consequence: image finalization is the program's largest per-product workload; the pilot measures its true cost, and the retro must answer whether the image pipeline needs automation before the main wave.

**Corrected verdict/write model (F-01):** `product_application_protocols` has NO persisted `status`; "verified_complete" is **derived** at read time from a valid, product-scoped V1 `guidance_payload` (see `catalog-facts.ts:708/728`). `application_family` and `category_key` are generated columns — never written. Uniqueness is `(product_id, category, role, application_family)`. Role applicability is **derived from facts** via the intake helper (`src/lib/product-intake/shampoo-protocol-roles.ts` and category logic), not asserted from a template list. Current intake also derives a V2 payload pointer; the pipeline reuses that derivation.

**Verdict data bar (strict, per F-03):** a product counts as done only when the readiness oracle reports strict scan-ready — which additionally requires a non-null presentation image, no `personal_plan_product_search_dispositions` row, and **no unknown verdict for any applicable role across fine/normal/coarse profiles**. Nullable-but-runtime-consumed spec fields (e.g. shampoo cleansing intensity, mask balance direction) are treated as required by the expansion validator even where generic intake validation allows null.

## 2. Chosen direction

Reviewed data manifests flowing through the **canonical transactional publication boundary** (`docs/catalog-authority.md`: no new direct storage writers — F-02). Order: approved selection ledger → frozen research-engine contract → verified protocol content templates → engine-produced manifests validated in-repo → batch adapter invoking the publication boundary per product → prod apply → readiness-oracle verification at 100% → sampled expert QA → retro and main-wave go/no-go. No verdict-engine or UI change.

## 3. Scope and non-goals

**In scope:** selection ledger; expansion-manifest schema + validator (stricter than generic intake where runtime consumes the field); protocol content templates; batch publication adapter + runner (preflight/apply/verify); pilot prod apply; oracle verification report; docs update defining the `scan_result_ready` operational state (F-08, accepted); leakage regression tests (F-10); QA sample; retro.

**Non-goals:** the main wave; any promotion to `is_chaarlie_recommended=true`; verdict-engine, scan-UI, or ranking changes; taking scan out of stealth; the research engine's internals (only its output contract); landing the coverage branch (separate track, sequenced only).

## 4. Target map

- Selection ledger + retro: `plans/scan-db-expansion/` (`selection-batch1.{md,json}`).
- Manifest schema + validator: `src/lib/product-intake/expansion-manifest.ts` (zod; composes `schemas.ts` + `category-validators.ts`, tightened per F-03), CLI `scripts/product-intake/expansion/validate-manifest.ts`.
- Protocol templates: `plans/scan-db-expansion/protocol-templates.md` (content reference with stable IDs; stamped rows carry per-product sources).
- Batch adapter: extends the **transactional publication boundary** (`supabase/migrations/20260813085151_personal_plan_catalog_closure.sql` family) rather than inserting into storage tables; runner `scripts/product-intake/expansion/{preflight,apply,verify}.ts`; ledger via `catalog_enrichment_applied_items` with **full-bundle readback on replay** (F-07; pattern: `20260810090000_*_heat_v1_executor.sql`).
- Write guards inherited from coverage branch (F-05): canonical-owner validation, stable GTIN locks, global canonical-GTIN partial unique index, open-submission overlap checks, reviewed-head binding, immutable approved fingerprint, kill switch (`.worktrees/scanner-catalog-coverage-plan/supabase/migrations/20260826142*` + `20260826143000_*`).
- Verification: `evaluateScanCatalogReadiness` (coverage branch `src/lib/scan/catalog-readiness.ts`) + `readiness-export.ts` strict definition.
- Docs: `docs/product-intake-research-ops.md` gains the `scan_result_ready` state definition (F-08).

## 5. Designed user journey

**No end-user journey changes.** Operator journey (Nick):

1. Nick approves the selection ledger (T1 gate). Identity rule applied at selection time (F-09): a new size/EAN of an **unchanged formulation** already in the catalog becomes an additional identifier on the existing product, never a new product row; a new product row requires a formulation/authority difference.
2. Nick verifies the protocol content templates (T3 gate).
3. The research engine emits manifests; the validator passes them or names exact violations; deviation-flagged products and any product missing per-product protocol source evidence are listed for Nick's review.
4. `preflight` prints the full would-write diff + duplicate/identity-guard results; **products failing strict-readiness prediction are parked before apply** (F-04) — they are never sent to prod incomplete. Nick approves; `apply` publishes **one product per transaction** through the publication boundary (explicit semantics, F-04): a failing product fails alone and is reported; committed products are unaffected.
5. `verify` runs the readiness oracle over all applied SKUs. Acceptance: **100% of applied products strict scan-ready** (parked products are tracked separately with named gaps and either fixed in a follow-up sub-batch or dropped).
6. Nick reads the retro and rules go/no-go for the main wave.

## 6. Planning evidence

Backend/data-only: no user-facing surface, copy, timing, or feedback changes → no mockup evidence required. Decision evidence: rulings R1–R4, the 2026-09-01 live-DB audit, the scan-verdict code map, and the counterpart-review ledger (§10) with schema-verified corrections.

## 7. Ordered tasks

**T1 — Selection ledger (~30 pilot + ranked backlog to ~200).**
As Rev 1, plus the F-09 identity rule: candidate list distinguishes "new identifier for existing product" from "new product", checked against `products`, `brand_aliases`, and `product_identifiers.canonical_gtin14`. Completion: **Nick approves the pilot 30**. Produces `selection-batch1.{md,json}`.

**T2 — Research-manifest contract + validator.**
`expansionManifestSchema` per product: `final.product` (`origin='curated'`, `is_chaarlie_recommended=false` hard-pinned, **`image_url` required**), `final.identifiers[]` (EAN + GS1 check digit + cross-source agreement), `final.category_specs` with **runtime-consumed fields required non-null** (F-03 list: incl. shampoo `cleansing_intensity`, mask `balance_direction`), thickness/concern eligibility, protocol block = `{template_id, product_source: {label,url,text}, deviation: null | {reason, packaging_text}}` (F-01/F-06 — no `status`, no `application_family`), evidence rows for `personal_plan_catalog_fact_evidence`. Applicable roles are **derived** by the validator via the intake helpers, and the manifest must cover every derived role. Completion: schema + validator committed; sample passes; corrupted fixtures fail with named errors (incl. missing protocol source, missing runtime-consumed field, undeclared derived role). Tests: fixture-based.

**T3 — Protocol content-template set. ✅ DONE 2026-09-02** — restarted as a normative rulings session (P1–P9, see memory + template file header) after Nick rejected the data-derived draft; expert technique research pass (hair-care-expert lane) added evidence-backed application steps; Nick approved the final German copy incl. softened massage clause, mask "ausdrücken bis es nicht mehr tropft" middle way, and the irons-only-on-dry-hair sentence. 12 templates locked.
Original task description (for context):
≤15 German templates for the big five's (role × application-family) combinations, each defining the V1 `guidance_payload` content (stage, state, placement, contact time, rinse action, reapplication). Explicit note in the artifact: templates are content references; each stamped row still requires product-specific source evidence (F-06). Completion: **Nick verifies each template**; stable IDs referenced by T2.

**T4 — Pilot research run — SPLIT (Nick 2026-09-02):** Nick's research engine covers shampoo (+conditioner in progress) → engine lane researches the 14 shampoo/conditioner pilot products. The 16 mask/leave-in/oil products are researched by the Claude lane against the SAME T2 contract (mask first as calibration, output reviewed before leave-in/oil fan-out; drafts in plans/scan-db-expansion/research/, all subject to Nick's review and the same validator). Both lanes' manifests flow through identical validation and apply steps.
Original task description:
Engine researches the approved 30 against T2. Deliverables: validation report; deviation list; per-product protocol source evidence present for all; candidate manufacturer packshot per product; EANs failing cross-source agreement marked `unverified` and excluded. Additionally (F-06): a **blinded re-check of 5 randomly chosen "no deviation" products** against their packaging to measure deviation false negatives — result recorded for the retro. Completion: all 30 pass validation or are explicitly parked with reasons.

**T4b — Batch image pipeline + pilot finalization (R5; automation pulled forward by Nick 2026-09-01).**
Build `scripts/product-images/batch-run.ts`: input list of (product ref, packshot URL/file) → download → automated decision tree from `docs/product-image-background-removal.md` (Vision removebg → padded retry → rembg fallback → baked-shadow removal where flagged) → QA heuristics → one HTML contact sheet (original vs cutout on white + magenta) for Nick's per-image approve/flag → approved set batch-runs the existing finalize/upload/thumbnail/provenance scripts. Also ports `docs/product-image-background-removal.md` from the product-image-pilot worktree to `docs/` on this branch. Smoke test on ~10 existing pilot source images (no prod bucket writes in the smoke). Then run the pilot 30 through it. Completion: contact-sheet review done; every product headed for apply has a finalized own-bucket `image_url`; per-image cost recorded for the retro. Preflight (T5) rejects any product without a finalized image.

**T5 — Batch publication adapter.** *(Blocked on coverage branch merge — R1.)*
An expansion entry point layered on the transactional publication boundary (F-02) — one product per transaction — that: derives roles/families via intake logic and writes valid V1 payloads (+ derived V2 pointer) with per-product sources (F-01); enforces the full coverage-branch guard set (F-05: canonical-owner validation, GTIN locks, canonical partial unique index, open-submission overlap, reviewed-head binding, immutable fingerprint, kill switch); ledgers via `catalog_enrichment_applied_items` with **full-bundle readback replay comparison** (F-07: identifiers, facts, V1/V2 protocols, evidence, lifecycle, recommendation flag, fingerprints); and makes `is_chaarlie_recommended=true` unreachable from this path (R3). Runner: `preflight` (diff + duplicate/identity guards + strict-readiness prediction with parking, F-04) / `apply` / `verify`. Completion: postgres-level tests (pattern: `tests/scanner-existing-identifier-backfill-postgres.test.ts`) covering happy path, duplicate/canonical-GTIN rejection, incomplete-product parking, per-product failure isolation, replay readback, promotion-block, kill switch. Plus **leakage regression tests** (F-10): imported products never appear in Stage-3 candidates/alternatives; they surface only as scanned or explicitly owned products.

**T6 — Pilot apply + oracle verification.** *(Blocked on T5.)*
Preflight-park → apply → oracle over all applied SKUs. Acceptance (F-04): **100% of applied SKUs strict scan-ready** (oracle: facts present, protocols complete, image present, no disposition, no unknown for any applicable role × fine/normal/coarse); parked SKUs listed with named gaps and dispositions; the seeded deviation control from T4 caught, and the blinded false-negative sample result recorded. Completion: committed report + live spot check (scan 3 pilot EANs via dev login, immediate verdicts confirmed).

**T7 — Sampled verdict QA.**
`hair-care-expert` audit of 8–10 applied SKUs × representative profiles. Findings: data defect (fix) vs engine observation (ticket). Completion: audit note committed.

**T8 — Docs note + retro + go/no-go.**
Short note in `docs/product-intake-research-ops.md` (F-08, reduced by R5): a scan-only product is recommendable-grade in every respect (data, evidence, finalized image) with `is_chaarlie_recommended=false`; promotion = flip the flag after editorial review. Retro: contract changes, template gaps, deviation false-negative rate, per-product image-finalization cost and whether the image pipeline needs automation before the main wave (R5), overall cost per SKU, go/no-go for the 150–200 wave. Completion: **Nick's explicit go/no-go**.

## 8. Verification

- **Automated:** `npm run ci:verify`; T2 fixture tests; T5 postgres + leakage tests; oracle report script.
- **Manual:** Nick gates at T1, T3, T4 (deviation + source review), T6 (report), T8.
- **Migration/live-state:** T5 migration proven on a Supabase branch before prod; per-product transactional apply; post-apply 3-EAN live scan spot check.
- **Evidence-sensitive:** T7 audit; every authority fact and every protocol row carries product-specific source evidence (F-06) — no unsourced facts, no template-only protocol evidence.

## 9. Review and handoff

- Worktree `.worktrees/db-expansion-scan` on `codex/db-expansion-scan` (base verified = origin/main 7fddf869).
- Counterpart review: Codex lane completed 2026-09-01 (ledger §10); re-run only on material architectural change.
- Sequencing risk: coverage branch (R1) gates T5/T6; T1–T4 proceed regardless.
- Rollout risk: additive, per-product transactional, scannable-only; kill switches = executor guard + `is_active`.
- Evidence review: **not required** (backend/data-only, §6). Operator-journey sign-off: **confirmed** (Nick, 2026-09-01, incl. Rev 2 deltas: parking + 100% acceptance; per-product protocol sources; one-product-per-formulation identity rule with multiple barcodes; R5 full-image ruling; F-08 reduced to a docs note in T8).
- Artifacts: plan + ledger + templates + reports → **commit**; raw engine dumps → **discard** after validation; Codex transcript → **discard** (ledger below is the durable record).
- Stop point: nothing publishes without T1/T3 gates; prod apply only at T6 after preflight approval.

## 10. Counterpart-review findings ledger (Codex, 2026-09-01)

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F-01 | defect | Schema-verified: no `status` col; `application_family`/`category_key` generated; `verified_complete` computed (`catalog-facts.ts:708,728`) | accepted | §1 corrected model; T2/T3/T5 rewritten around V1 payload + derived roles/families | T5 postgres tests |
| F-02 | defect | `docs/catalog-authority.md` boundary rule verified | accepted | §2/T5: adapter over publication boundary, no direct writer | T5 tests + review |
| F-03 | defect | Strict oracle requires image/disposition/no-unknown; nullable runtime fields | accepted | §1 strict bar; T2 requires runtime-consumed fields + image | T6 oracle report |
| F-04 | defect | Deferred publication-gate triggers make "partial stays applied" unsafe; 90% bar contradicts goal | accepted | §5.4/T5/T6: preflight parking, per-product transactions, 100% acceptance | T5 failure-isolation test |
| F-05 | defect | Coverage-branch guard set (canonical owner, locks, invariant, kill switch) | accepted | T5 guard list expanded | T5 tests |
| F-06 | defect | Publication requires per-product source evidence; seeded deviation is only a positive control | accepted | R4 refined; T2 protocol source block; T4 blinded sample | T4/T6 reports |
| F-07 | defect | Existing executor does full-state readback on replay | accepted | T5 full-bundle readback specified | T5 replay test |
| F-08 | scope/product | Third operational state undocumented | accepted, reduced (Nick's R5 collapses the state to "recommendable-grade, flag off") | T8 docs note | T8 |
| F-09 | scope/product | Same-formulation GTIN attaches to existing product (coverage rule 2026-08-28) | accepted | §5.1/T1 identity rule | T1 ledger review |
| F-10 | tradeoff (hypothesis) | Owned-product chat assessment could read like recommendation; untested | accepted as test-only | T5 leakage regression tests; no chat-wording change | T5 tests |

Rejected findings: none. Codex note: no embedding work needed (matcher no longer uses embeddings for eligibility/ordering) — confirmed, kept as non-goal.
