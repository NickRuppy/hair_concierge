# Conditioner INCI research and catalog-enrichment program

> Program history and original Stage A plan. The seven-field v1.4/v1.5 wording below records the earlier calibration decisions. The active research contract is Conditioner Standard v1.6-rc1, which extends the profile with `care_direction` and `repair_support_level`; do not use historical wording here as the current classification or review contract.

## Outcome and source context

Create a conditioner-specific, ingredient-informed research standard and shadow research workflow for Charlie's current German/EU rinse-out conditioner catalog. The program must preserve the proven shampoo identity/evidence/calibration method while rebuilding the conditioner science, direct product properties, user-fit derivations, calibration set, and failure rules from first principles.

The output is a reviewable research authority and a complete shadow analysis of the eligible current conditioner cohort. It is not a direct rewrite of current catalog fields and it does not authorize Supabase writes, production matching, Product Intake activation, deployment, or publication.

Primary source context:

- Original shampoo work session: `codex://threads/019f65c4-e918-7ea3-a74d-adb8de039de8`.
- Shampoo worked example in the existing research worktree:
  - `.worktrees/shampoo-inci-research-engine/docs/research/shampoo-inci/v1.3/02_Classification_Standard_Agent_Context_v1.3.md`
  - `.worktrees/shampoo-inci-research-engine/docs/research/shampoo-inci/v1.3/03_German_Calibration_and_Matching_Workbook_v1.3.xlsx`
  - `.worktrees/shampoo-inci-research-engine/docs/research/shampoo-inci/v1.3/04_Lean_Explainable_Matching_Quick_Reference_v1.3.md`
  - `.worktrees/shampoo-inci-research-engine/docs/research/shampoo-inci/v1.3/charlie-integration-contract.md`
  - `.worktrees/shampoo-inci-research-engine/plans/2026-08-10-shampoo-v13-research-engine.md`
- Shampoo engine code/test prior art, currently present only in the unmerged and dirty sibling worktree:
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/contracts.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/formula.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/audit.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/fit.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/ranking.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/repository.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/fixtures.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/generated-artifact-index.ts`
  - `.worktrees/shampoo-inci-research-engine/src/lib/shampoo-research/legacy-comparison.ts`
  - `.worktrees/shampoo-inci-research-engine/scripts/shampoo-research/**`
  - `.worktrees/shampoo-inci-research-engine/tests/shampoo-research-*.test.ts`
- Canonical Drive folder: [Ingredient-Based Product Research Framework v1.0](https://drive.google.com/drive/folders/1aem0YB8jeNOXiTO456eBCiwU0f5zPVvR).
- Canonical Drive sources selected from the newer duplicate set in that folder:
  - [Cross-Category Agent Context v1.0](https://drive.google.com/file/d/1Zvius16RmjK5oH51lNMq9l0cqNl2qkab/view)
  - [New Category Kickoff Prompt v1.0](https://drive.google.com/file/d/1iBlU8QOZcmw7e4MCwXx8vkDH62L4J6Di/view)
  - [Conditioner Pilot Brief v1.0](https://drive.google.com/file/d/1aPYHfc1-4T14P4r61hOmHSTzeNHkX09K/view)
  - [Generic Product Research Schema v1.0](https://drive.google.com/file/d/10VbP9DSN4infkpfhneFUIOhwyEmd-kD0/view)
- Current internal Conditioner authority and runtime seams:
  - `docs/personal-plan/categories/conditioner/decision.md`
  - `docs/personal-plan/categories/conditioner/evidence.md`
  - `src/lib/personal-plan/categories/conditioner.ts`
  - `src/lib/recommendation-engine/categories/conditioner.ts`
  - `src/lib/conditioner/constants.ts`
  - `scripts/product-intake/codex-research-worker.ts`
  - `scripts/backfill-conditioner-rerank-specs.ts`

Initial external research anchors, to be expanded into the governed conditioner corpus rather than treated as a complete standard:

- [EU Cosmetics Regulation 1223/2009, Article 19](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32009R1223) for the limits of INCI ordering and sub-1% inference.
- [Characterizing the rheology, slip, and velocity profiles of lamellar gel networks](https://doi.org/10.1122/8.0000011) for model cationic-surfactant/fatty-alcohol/water conditioner networks.
- [Microstructure design of CTAC:FA and BTAC:FA lamellar gels](https://pubmed.ncbi.nlm.nih.gov/32037558/) for the relationship among conditioner microstructure, dilution, wet combing, and wet lubrication.
- [Electrokinetic analysis of conditioner ingredient interactions with hair](https://pmc.ncbi.nlm.nih.gov/articles/PMC13068045/) for conditioner-formulation deposition and wet-combing evidence.

### Planning contract

- **Outcome:** a researcher can classify an exact eligible rinse-out conditioner formula, inspect the evidence for each direct product property, derive cautious profile fit, compare it with today's catalog labels, and review or block the result through versioned artifacts and reproducible validation commands.
- **Constraints:** exact formula/version identity; one reliable identifier per researched product while allowing multiple identifiers per canonical product; German/EU market focus; formula analysis before claim interpretation; property-specific evidence and uncertainty; independent blind calibration; no ingredient-to-user-fit shortcut; no medical or structural-repair overclaim.
- **Non-goals:** masks, leave-ins, co-washes, color-depositing products, medicated/scalp-treatment products, catalog identity cleanup, comprehensive barcode expansion, production schema migration, automatic Product Intake publication, live matcher replacement, or user-facing Personal Plan changes.
- **Done when:** the versioned Conditioner v1.0 authority is checked in; a 10-12-product pilot and 3-5 stress products pass independent calibration; every eligible active catalog product has a valid analysis or one precise blocker; a reproducible shadow comparison against current Conditioner fields exists; the artifact-review journey and complete artifact validation pass; no production write occurred.

## Chosen direction

Use a **two-stage, artifacts-first program**:

- **Stage A:** Tasks 0-5 build, blindly calibrate, and stress-test the Conditioner authority. The current v1.4-rc1 checkpoint freezes a seven-field comparison profile without changing the historical direct-property metrics; exact use directions remain protocol metadata.
- **Mandatory checkpoint:** Nick reviews the pilot products, classifications, evidence, disagreements, and stress-test result in a local Conditioner Research Lab before the full cohort is authorized.
- **Stage B:** Tasks 6-9 add artifact validators/replay, research the full eligible cohort, and produce the current-catalog delta only after that checkpoint.

The original artifacts-only checkpoint is superseded by Nick's 2026-08-24 correction: the spreadsheet remains an audit/export artifact, but the primary review surface is a development-only Conditioner Research Lab modeled on the existing Shampoo Research Lab. The Conditioner Lab is deliberately narrower than the Shampoo implementation: it reads the locked pilot artifacts, provides queue-and-product audit plus calibration/uncertainty review, and never persists approvals or talks to Product Intake, Supabase, or the catalog.

This is preferred over either copying the Shampoo engine across all current products immediately or treating documents and sheets as the operator experience:

| Approach | What gets easier | What gets harder | Residual risk |
|---|---|---|---|
| Full 49-product clone first | Formula collection starts immediately | Shampoo assumptions and weak candidate fields can become expensive rework | High ontology and calibration drift |
| Documents/sheets only | Science and terminology can be refined cheaply | Product-by-product evidence review is cumbersome and disconnected | Review defects survive until later implementation |
| **10-12-product calibrated pilot, then full cohort** | Category science is tested early and the same validated contracts scale to the catalog | Requires an explicit calibration gate before bulk classification | Some products still expose new architectures after the pilot |

The program therefore runs in this order:

1. preserve and reconcile the source package;
2. freeze and boundary-audit the live cohort;
3. build the Conditioner v1.0 science and evidence authority;
4. calibrate a diverse pilot blindly;
5. tighten the rules with adversarial products;
6. present the 12-product pilot in the local Conditioner Research Lab and stop for the Stage A evidence checkpoint;
7. implement the artifact-backed shadow validation and replay workflow;
8. research the remaining eligible cohort in bounded parallel batches;
9. compare new ingredient-derived outputs with the current catalog without overwriting it;
10. define a separate, later graduation proposal for Product Intake and production data.

### Transfer invariants from Shampoo

Reuse these methods:

- exact product, market, pack-size, and formula-version identity;
- canonical formula-source hierarchy and source-conflict preservation;
- raw INCI plus normalized formula fingerprint;
- formula observations separated from direct product properties;
- direct product properties separated from derived user fit;
- E0-E5 evidence level, evidence scope, and property-specific confidence;
- supporting signals, counter-signals, `derived_from`, sources, and shared mechanism IDs;
- provisional/blocking states for unresolved identity, formula, evidence, or category boundaries;
- a detailed research trace plus compact application-facing projection;
- blind calibration, disagreement analysis, stress tests, versioning, and human-review triggers.

Do not transfer these Shampoo-specific conclusions:

- cleansing strength, scalp route, dandruff support, or Shampoo focus values;
- Shampoo surfactant scoring or dilution/coacervation rules as Conditioner scoring;
- Shampoo profile fixtures or ranking weights;
- the assumption that silicone, oil, protein, or fatty alcohol presence alone determines weight, repair, texture fit, or strand-thickness fit.

### Conditioner candidate ontology to test, not pre-approve

The full research trace should be capable of representing:

- conditioning/deposition architecture;
- wet slip and detangling;
- dry combability;
- softness and lubrication;
- smoothing/frizz-control route;
- shine/deposition route;
- net weight and cumulative-buildup potential;
- rinseability;
- body/lightness route;
- lubrication/protection, surface-film, bond-specific, and color/chemical-damage routes;
- scalp/root exposure and fragrance/sensitivity flags;
- usage role.

The pilot must consolidate overlapping properties before freezing the lean profile. In particular:

- `rinseability` must describe rinse behavior, not be an alias for richness;
- `weight_potential` and `buildup_potential` may remain separate if calibration shows distinct evidence and decisions;
- `wet_slip_detangling` and `dry_slip_combability` may remain separate because their evidence and user jobs differ;
- repair must preserve distinct lubrication/protection, surface-film, and bond-specific routes rather than collapse to one marketing-derived level;
- texture fit must derive from slip, weight, damage, desired definition, and routine context—not from curl pattern alone;
- `protein/moisture balance` is an existing Charlie profile heuristic, not an ingredient-diagnosed deficiency and not automatic product truth.

The provisional lean profile should remain smaller than the trace:

```text
conditioning_level
weight_potential
primary_focus
secondary_focus

hair_thickness_fit
damage_fit
texture_fit
```

Final values and confidence ceilings are frozen only after pilot calibration and the findings ledger records why.

## Scope and non-goals

### In scope

- Conventional short-contact rinse-out conditioners sold for lengths and ends in Germany/EU.
- Current active catalog discovery, exact identity/formula research, and honest boundary exclusions.
- Primary/authoritative formulation, measurement, regulatory, and claim-scope research.
- Conditioner-specific formula architecture, performance routes, false-signal rules, gates, caps, and evidence ceilings.
- A 10-12-product pilot spanning the category and 3-5 adversarial stress products.
- Independent blind classification and per-property disagreement metrics.
- Local, versioned JSON/Markdown/XLSX research artifacts and validation.
- Artifact-backed validation, review sheets, deterministic fixture replay, and exports after the rules are calibrated.
- Full eligible-cohort research in parallel, disjoint product directories after shared contracts freeze.
- Shadow comparison with current `product_conditioner_specs` and `product_conditioner_rerank_specs`.
- A later Product Intake integration contract, without activating it.

### Out of scope

- Masks/deep treatments, leave-ins, co-washes/cleansing conditioners, two-phase sprays, color-depositing conditioners, medicated/scalp-treatment products, and salon chemical treatments.
- Quietly treating the active `category_key = conditioner` set as boundary-clean.
- Adding every regional or historical GTIN. The research program needs one reliable identifier per exact product; wider scan coverage is a separate workstream.
- Changing `products`, `product_identifiers`, current Conditioner spec tables, publication state, recommendation flags, or product category assignments.
- Applying a Supabase migration or writing research approvals remotely.
- Replacing current Personal Plan or recommendation-engine behavior.
- Treating current hand-authored fields, product names, front-label claims, reviewer agreement, or Shampoo labels as scientific ground truth.
- User-visible copy, UI, recommendation, or routine changes.

## Current-state findings that shape the process

The live read-only snapshot on 2026-08-23 found:

- 49 active, lifecycle-active `category_key = conditioner` rows; 43 are currently Chaarlie-recommended.
- All 49 have a `product_conditioner_rerank_specs` row and at least one `product_conditioner_specs` row; there are 81 fit rows total and eight products have multiple fit rows.
- Current distributions are `weight = 12 light / 22 medium / 15 rich`, `repair_level = 17 low / 20 medium / 12 high`, and `balance_direction = 14 protein / 16 balanced / 19 moisture`.
- Only 6 of 49 products have a stored EAN/GTIN/barcode identifier; 43 lack a scan identifier.
- Production has no raw INCI, formula-source, formula-fingerprint, property-evidence, or Conditioner research-trace fields.
- The existing rerank backfill is a hard-coded name-to-label map, while the Product Intake worker currently asks only for compact Conditioner specs and coarse ingredient flags. Its generator still filters the legacy `category = "Conditioner (Drogerie)"`; only 1 of the 49 live active rows retains that label, so the populated rerank table is a historical snapshot and is not reproducible from the current generator.
- The active cohort contains at least one obvious category-boundary candidate (`Cantu Leave-In Repair Cream`) and other review cases such as a dual conditioner/treatment product and package-size duplicates. The eligible research cohort must therefore be produced by a boundary audit, not by a category-key query alone.
- PR #190 (`codex/conditioner-category-label-cleanup`) remains open against the old `codex/product-identity-canonical-correction` base rather than `main`. Current live state already has 48 active Conditioner rows labelled `Conditioner` and one labelled `Conditioner (Drogerie)`. This research program does not adopt or wait on that old branch; Task 1 records it as overlap and freezes from fresh `main` plus the live read-only snapshot.

Interpretation:

- Existing fields are historical comparison labels and migration inputs, not the authority for the new standard; the old backfill script must not be rerun to regenerate the comparison baseline.
- Completing all legacy columns is not evidence that the products are ingredient-researched.
- Missing stored GTINs are identity-research work, but do not authorize scan-coverage backfills.
- Boundary resolution precedes classification; excluded items receive an explicit disposition instead of being forced into Conditioner rules.

## Authoritative data contracts

### Exact product and formula identity

The source package's single `gtin` field is a seed, not the final contract. Charlie allows several identifiers for one canonical product while requiring one global owner per identifier.

Each research identity must contain:

```text
product_id
category_key
brand
exact_name
market
pack_size
identifiers[]
  type
  value
  normalized_value
  source_id
  identity_confidence
formula_capture_date
formula_fingerprint
identity_status
category_boundary_status
source_ids[]
```

Identity states:

```text
verified
verified_with_minor_source_difference
provisional_formula_conflict
provisional_identity_conflict
insufficient_information
excluded_product_form
```

One reliable GTIN/EAN/barcode is the preferred exact-identity anchor. A missing catalog identifier may be retained in the local research artifact when supported, but production attachment remains a separate guarded write. Multiple known identifiers remain an array; the program must never collapse them to one string or create a duplicate product merely because packaging differs.

The "one identifier = one product" invariant is enforced by the read-only global collision preflight and later guarded application logic; the current database constraint does not guarantee cross-product uniqueness. An apparently unowned identifier must still be checked across normalized `ean`, `gtin`, and `barcode` spellings before it is proposed for attachment.

### Source hierarchy

Use this default order, while recording the exact evidence each source supports:

1. user-owned package label tied to exact GTIN/formula or manufacturer formula/version code;
2. current exact-market German/EU manufacturer or brand-owner formula;
3. exact-GTIN current German retailer formula;
4. other German/EU retailer or adjacent-market formula as provenance/conflict evidence;
5. secondary ingredient databases as discovery leads only.

Manufacturer priority does not erase a retailer or package conflict. Identity provenance and formula provenance remain separate. If a conflict changes a material Conditioner property and cannot be resolved at property level, the affected property or whole analysis stays provisional.

### Property evidence

Every direct property and derived fit records:

```text
value
decision_type
confidence
evidence_level
evidence_scope
rationale
formula_observations[]
product_inferences[]
supporting_signals[]
counter_signals[]
derived_from[]
profile_fact_ids[]
source_ids[]
shared_mechanism_ids[]
review_status
```

The executable contract is a strict Zod v4/TypeScript schema under `src/lib/conditioner-research/contracts.ts`. The portable `data/research/conditioner-inci/v1.0/schema.json` is a generated, validation-checked interchange artifact; it is not an independent source of enum or required-field truth.

The generic Drive schema must be adapted before use:

- replace singular `gtin` with `identifiers[]`;
- type formula-source, evidence-record, route-score, claim-audit, conflict, and review-event objects rather than leaving unconstrained arrays/objects;
- distinguish `formula_observations` from `product_inferences` consistently;
- include category-boundary and medical/claim-scope state;
- include standard version, analysis version, and content fingerprints;
- keep profile facts out of stable product truth;
- reject a derived user-fit record without `derived_from` and `profile_fact_ids`;
- validate every derived flag against raw INCI and the selected exact formula.
- reject drift between the Zod v4 contract, generated JSON schema, fixtures, workbook vocabulary, and generated documents.

### Evidence firewall

The required chain is:

```text
exact formula observation
-> plausible direct Conditioner behavior
-> context-specific user fit
```

Formula position can support broad architecture and concentration bands, but Article 19 does not support exact percentages and permits arbitrary ordering below 1%. Formula plausibility, finished-product test evidence, multi-product/routine evidence, and user-fit confidence remain separate. A routine-level test can raise routine evidence but cannot prove the conditioner's isolated effect.

## Target map

New task-owned surfaces:

- `docs/research/conditioner-inci/v1.0/README.md`
- `docs/research/conditioner-inci/v1.0/source-manifest.md`
- `docs/research/conditioner-inci/v1.0/conditioner-category-charter.md`
- `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`
- `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.docx`
- `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.pdf`
- `docs/research/conditioner-inci/v1.0/conditioner-agent-context.md`
- `docs/research/conditioner-inci/v1.0/conditioner-lean-matching-quick-reference.md`
- `docs/research/conditioner-inci/v1.0/conditioner-integration-contract.md`
- `docs/research/conditioner-inci/v1.0/conditioner-product-research-prompt.md`
- `docs/research/conditioner-inci/v1.0/conditioner-research-runbook.md`
- `docs/research/conditioner-inci/v1.0/conditioner-disagreement-log.md`
- `docs/research/conditioner-inci/v1.0/conditioner-rule-change-log.md`
- `docs/research/conditioner-inci/v1.0/conditioner-current-catalog-delta-report.md`
- `docs/research/conditioner-inci/v1.0/conditioner-calibration-workbook.xlsx`
- `data/research/conditioner-inci/v1.0/schema.json`
- `data/research/conditioner-inci/v1.0/cohort.json`
- `data/research/conditioner-inci/v1.0/evidence-sources.json`
- `data/research/conditioner-inci/v1.0/profile-fixtures.json`
- `data/research/conditioner-inci/v1.0/calibration-proposed-key.json`
- `data/research/conditioner-inci/v1.0/calibration-blind-review.json`
- `data/research/conditioner-inci/v1.0/products/<normalized-brand-name>--<full-product-uuid>/formula-source.json`
- `data/research/conditioner-inci/v1.0/products/<normalized-brand-name>--<full-product-uuid>/analysis.json` or `blocked.json`
- `scripts/conditioner-research/**`
- `src/lib/conditioner-research/**`
- `tests/conditioner-research-*.test.ts`

The full product UUID is the ownership and uniqueness key. The normalized brand/name prefix is human-readable only. Task 1 must reject duplicate directory keys before any parallel product work begins.

Existing comparison surfaces, unchanged in this program:

- `src/lib/recommendation-engine/categories/conditioner.ts`
- `src/lib/personal-plan/categories/conditioner.ts`
- `src/lib/conditioner/constants.ts`
- `scripts/product-intake/codex-research-worker.ts`
- `scripts/backfill-conditioner-rerank-specs.ts`
- `plans/2026-08-15-catalog-authority-architecture.md`
- `public.product_conditioner_specs`
- `public.product_conditioner_rerank_specs`
- `public.product_identifiers`

No Supabase migration belongs to this shadow program. A later graduation plan may propose additive, private research persistence only after the artifact model and review journey prove necessary and stable.

## Designed operator and integration journey

There is no end-user journey change in this program.

The artifact-review operator journey is:

1. Run the cohort/report command and see every active Conditioner candidate with its boundary status: eligible, excluded product form, identity rework, or formula rework.
2. Open one eligible product and verify exact brand, product, market, size, one reliable identifier, formula capture date, canonical formula source, fingerprint, and conflicts before seeing any fit result.
3. Review formula architecture and ingredient-family observations without marketing-derived fit labels influencing the analysis.
4. Review direct product properties with their mechanism route, evidence scope, confidence, supporting evidence, counter-signals, and caps.
5. Record approval, targeted rework, or a block in the versioned review sheet. Full-product approval is valid only when the validator proves all required properties and identity/formula gates pass.
6. Replay an approved or clearly marked provisional product against deterministic Conditioner profiles and see the exact direct properties and profile facts that produced the fit.
7. Compare the shadow output with current thickness/protein-moisture/weight/repair/balance/ingredient labels. Disagreement is visible evidence for review, never an automatic defect in either model.
8. Generate a deterministic export containing the same versioned identity, formula, analysis, review, and replay hashes as the validated source artifacts.
9. Complete the cohort with a report of approved, provisional, blocked, excluded, and conflicting products plus recurring disagreement reasons.
10. Stop. A later, separately approved plan decides whether any compact fields graduate into Product Intake or production matching.

Recovery and fallback states:

- Missing identifier or product-form ambiguity: no classification; explicit identity/boundary rework.
- Exact formula unavailable: blocked or provisional with no invented formula.
- Material formula-source conflict: property-specific `unknown` where possible; whole-product block only when the direct architecture cannot be resolved.
- Formula-only evidence insufficient: record `unknown` or a capped property, not a confident label.
- Proprietary bond/repair claim: retain the claim and known chemistry separately; no distinct route without evidence.
- Failed artifact validation: analysis is excluded from approval, replay, export, and full-cohort completion counts.
- Invalid or stale review sheet: the validator refuses approval/replay/export until it matches the current identity, formula, analysis, and standard fingerprints.

## Planning evidence

No end-user mockup is required because this program does not alter user-facing surfaces, copy, timing, recommendations, or feedback.

The planning evidence is:

- direct inspection of the complete Drive framework package and the Conditioner pilot brief;
- direct inspection of the shampoo thread and its checked-in v1.3 authority/engine artifacts;
- a live read-only snapshot of the Conditioner tables and identifier coverage;
- repository inspection of current Conditioner matching, Personal Plan authority, Product Intake research contract, and the hard-coded rerank backfill;
- primary/official research anchors showing why conditioner lamellar architecture, wet lubrication/combing, formula position limits, and finished-product evidence require dedicated treatment.

Evidence review status: **confirmed by Nick on 2026-08-23.**

## Ordered tasks

### Task 0 - Capture and reconcile the authority package

**Consumes:** canonical Drive IDs, the Shampoo v1.3 worked example, this plan.

**Produces:** checked-in Conditioner source manifest, hashes, authority order, and adapted schema baseline.

- Fetch the canonical newer Drive set read-only and record file IDs, titles, sizes, timestamps, and SHA-256 hashes.
- Confirm whether duplicate same-name Drive files are byte-identical; retain only one canonical source set and record duplicate disposition.
- Store the agent-context playbook, Conditioner pilot brief, kickoff prompt, and generic schema verbatim or as hash-grounded sources according to repository artifact policy.
- Do not retain editable DOCX/PDF/ZIP duplicates when the same authoritative content is already grounded; generate later human-readable artifacts from one source when needed.
- Create the Conditioner-specific schema delta described under **Authoritative data contracts**.

**Completion criterion:** a new researcher can identify the exact governing source bytes and cannot accidentally treat the Shampoo ontology, a duplicate Drive file, or the generic seed schema as Conditioner authority.

### Task 1 - Freeze and boundary-audit the current cohort

**Consumes:** current production schema/API, category charter, exact cohort query.

**Produces:** `cohort.json` with immutable source facts, boundary dispositions, identity readiness, and a content hash.

- Capture all active/lifecycle-active `category_key = conditioner` rows read-only.
- For each row, record current product identity, recommendation state, size, identifiers, current Conditioner spec rows, and rerank row.
- Apply the product-form boundary before formula classification.
- Explicitly resolve the known leave-in candidate, dual-use conditioner/treatment cases, package-size duplicates, and any product sold as mask/co-wash/leave-in in authoritative sources.
- Require one precise disposition for every starting row: `eligible`, `excluded_product_form`, `identity_rework`, or `formula_rework`.
- Preserve current spec labels as comparison data only.
- Store the query version, capture timestamp, row count, exclusions, and hash. Repeatable tests use this frozen artifact, not live credentials.

**Completion criterion:** all 49 starting rows are accounted for and no excluded product is silently forced through rinse-out Conditioner rules.

### Task 2 - Build Conditioner v1.0 science, routes, and evidence rules

**Consumes:** category charter, primary/official evidence corpus, current Charlie profile and Conditioner decisions.

**Produces:** classification standard, agent context, ingredient-family dictionary, route dictionary, lean-profile proposal, integration contract, and source register.

- Run four bounded read-only research lanes in parallel after the charter freezes: (A) cationic/amidoamine/fatty-alcohol architecture and dilution/rinse behavior; (B) silicone/lipid/polymer/protein deposition and false signals; (C) wet/dry combing, friction, softness, shine, rinseability, buildup, and finished-product test methods; (D) repair/bond/color claims, pH/acid/chelator context, fragrance/scalp exposure, and regulatory/medical boundaries. Each lane returns source records, supported claims, conflicts, evidence ceilings, and open questions; only the orchestrator edits the shared standard.
- For every proposed route, document supported endpoints, required delivery context, evidence methods, false signals, counter-signals, and maximum formula-only confidence.
- Separate bottle structure/rheology from fiber-deposited performance.
- Define operational direct properties without embedding a user profile.
- Define derived user-fit axes and list their exact upstream direct properties/profile facts.
- Reconcile with current Charlie inputs without declaring current `protein_moisture_balance`, `repair_level`, or ingredient flags scientifically validated.
- Encode claim and medical boundaries: ordinary cosmetic conditioning stays in scope; scalp reactions, hair loss, disease, and structural-regeneration claims do not become formula-derived suitability.
- Keep `conditioner-classification-standard.md` as the normative editable authority. Generate the DOCX and fixed-layout PDF reading copies from that source after it freezes, record their hashes, and reject content drift between formats.
- Produce the agent-context standard, lean quick reference, property-evidence schema/template, and ready-to-run Conditioner research prompt from the same frozen vocabulary.

**Completion criterion:** every candidate direct property has an operational definition, allowed values, evidence ceiling, false-signal rule, and abstention condition; every derived fit lists its upstream evidence.

### Task 3 - Select, research, and lock the 10-12-product calibration pilot

**Consumes:** eligible cohort, v1.0 draft standard, calibration-archetype matrix.

**Produces:** exact formula/source records, proposed key, blank blind-review sheets, and a calibration workbook.

- Fill each pilot archetype using the identity-ready eligible product with the strongest exact-market source evidence. Archetypes are lightweight, general, rich silicone repair, silicone-free strongly cationic, protein/film, oil/butter, volume/lightness, acidic/color-care, curl/coily rich, bond claim, sensitive/fragrance-free, and source/product-form conflict.
- Do not select from current ingredient flags alone. Verify the exact formula first.
- Allow one product to cover two adjacent archetypes only when the set still spans both clear anchors and hard boundaries; otherwise select another product.
- Lock exact identity and formula artifacts before creating the proposed key.
- Withhold the key from the blind reviewer.

**Completion criterion:** 10-12 identity-resolved products cover the planned archetypes, every formula has provenance/fingerprint/conflict status, and the reviewer packet contains no answer-key leakage.

### Task 4 - Run blind calibration and tighten the standard

**Consumes:** locked standard, locked pilot formulas, proposed key, blind-review packet.

**Produces:** independent classifications, agreement dashboard, disagreement log, accepted rule changes, and v1.0 release candidate.

- Reviewer A owns the proposed key; a zero-inheritance blind reviewer classifies independently without seeing it or Reviewer A's results. The accepted Stage A run is Reviewer C because the earlier Reviewer B attempt inherited key context and is quarantined.
- Compare completion, exact agreement, adjacent-band agreement where ordinal, mean absolute difference where numeric/ordinal, maximum difference, systematic drift by property, and coded disagreement causes.
- Treat agreement as rule-consistency evidence, not scientific validation.
- Investigate every material disagreement as source ambiguity, missing evidence, ambiguous rule, double counting, overconfident inference, or legitimate uncertainty.
- Convert systematic failures into a gate, cap, anti-double-count rule, required uncertainty, or specialist-review trigger.
- Do not silently turn a product/scope/risk tradeoff into a standard; record it for Nick when evidence cannot settle it.

**Completion criterion:** no material disagreement remains unexplained, every rule change has before/after evidence, and the standard is stable enough to face adversarial products.

### Task 5 - Attack the standard with 3-5 stress products

**Consumes:** v1.0 release candidate and remaining identity-ready cohort.

**Produces:** stress-test analyses, rule-change log, and final v1.0 authority.

- Include lightweight branding with a rich architecture, hero oil/protein with weak formula relevance, bond branding without a distinct route, silicone-free high-conditioning architecture, product-form ambiguity, and routine-level evidence leakage across 3-5 products.
- Validate that one mechanism cannot be double counted into several independent technologies.
- Validate that source/formula conflicts yield property-level unknown/provisional states when appropriate.
- Re-run the pilot after any systemic rule change.

**Completion criterion:** stress products create no unexplained systematic failure, pilot classifications remain reproducible after tightening, and remaining uncertainty is explicit.

### Stage A evidence checkpoint - mandatory stop

**Consumes:** Tasks 0-5 authority, cohort boundary report, pilot, blind review, disagreement dashboard, and stress-test log.

**Produces:** Nick's decision to approve, revise, narrow, or stop before Stage B.

Walk through the frozen direct properties, complete profile projection, calibration/stress evidence, unresolved scientific/product decisions, expected eligible-cohort size, estimated Stage B fan-out, reviewed Shampoo-engine source readiness, and catalog-authority coordination. Stage A approval does not authorize Stage B; Nick must explicitly approve proceeding with the full-cohort shadow run.

**Completion criterion:** evidence review and artifact-review journey are explicitly confirmed, required corrections are incorporated, a review-stable Shampoo source or explicit Task 6 deferral is recorded, catalog-authority sequencing is recorded, and Stage B is separately authorized.

### Task 6 - Implement the artifact-backed shadow research workflow

**Consumes:** final review-approved Conditioner standard, schema, validated pilot/stress artifacts, frozen cohort.

**Produces:** Conditioner research library, validators, deterministic fixtures/ranking, review-sheet tooling, scripts, generated index, and reproducible reports/exports.

- Precondition: resolve one review-stable Shampoo engine source. It must be either a merged commit on `main` or a clean reviewed commit/receipt with an exact content fingerprint from `.worktrees/shampoo-inci-research-engine`. Never copy or depend on its current dirty working tree. If neither source exists at the Stage B checkpoint, Task 6 is blocked while the artifact-only Conditioner authority remains usable.
- Perform an explicit module-by-module seam audit against Shampoo `contracts`, `formula`, `audit`, `fit`, `ranking`, `repository`, `fixtures`, `generated-artifact-index`, `legacy-comparison`, scripts, and focused tests named under **Outcome and source context**.
- Port proven identity/formula normalization, evidence records, review-state validation, deterministic index/export patterns, and test harnesses from the reviewed source into Conditioner-owned modules. Do not import sibling-worktree files at runtime and do not copy Shampoo-specific enums, scoring, fit rules, or product artifacts.
- Keep the Conditioner Zod v4 contract executable and authoritative; generate/validate the portable JSON schema from it.
- Defer a cross-category runtime abstraction until the second category proves which code is genuinely shared; Task 6 may extract only byte-for-byte generic helpers whose behavior is already covered by both Shampoo and Conditioner tests.
- Add strict validation for identity, category boundary, raw/normalized INCI, formula fingerprints, derived flags, property evidence, route caps, claim scope, profile inputs, and review status.
- Keep research artifacts and review decisions file-backed, versioned, and fingerprint-bound for this program; no remote persistence.
- Implement deterministic profile replay and ranking only from approved/provisional direct properties, with visible abstention and uncertainty.
- Emit current catalog fields solely as comparison columns and never let them influence ranking.
- Validate atomic full-product approval only if every property and global gate passes; preserve targeted rework and property review in the review sheet.
- Do not expand the Stage A Conditioner Lab into durable review persistence, authenticated access, a recommendation replay engine, or a full-cohort workflow. Those remain separate Stage B or later decisions.

**Completion criterion:** automated tests cover invalid schema, stale derived flags, category boundary, formula conflict, no-naked-fit enforcement, double counting, evidence caps, approval refusal, deterministic replay, current-label non-authority, review-fingerprint staleness, report determinism, and export parity; the artifact-review journey can be completed from documented commands.

### Task 7 - Research the full eligible cohort in bounded parallel batches

**Consumes:** frozen eligible cohort, final standard, stable schema/validator, generated index contract.

**Produces:** one formula-source plus analysis or blocked artifact per eligible product and per-batch validation receipts.

- The orchestrator owns the shared schema, cohort, source register, generated index, standard, and rule changes.
- Product researchers receive disjoint `products/<normalized-brand-name>--<full-product-uuid>/` ownership and may not edit shared contracts. The orchestrator assigns and validates the exact directory key before dispatch.
- Research identity/formula first, then formula observations/direct properties, then profile fit.
- Process remaining products in batches of at most eight. Validate every product and the whole index after each batch.
- Pause bulk classification after more than two failures with the same root cause; repair the shared rule before continuing.
- A blocked product gets one exact blocker and required evidence, not a generic incomplete state.

**Completion criterion:** every eligible product validates or has one precise blocker; every starting cohort row remains accounted for; aggregate counts are reproducible from the artifact tree.

### Task 8 - Produce the current-catalog shadow comparison and graduation brief

**Consumes:** complete research cohort, current frozen Conditioner specs, deterministic fixtures.

**Produces:** delta report, recurring disagreement taxonomy, source/confidence coverage, and a separate graduation proposal.

- Compare ingredient-derived direct properties and context-specific fits with current weight, repair, balance, thickness/protein-moisture, and ingredient-flag labels.
- Classify divergence as identity/formula difference, boundary issue, direct-property disagreement, user-fit derivation difference, missing evidence, legacy coarse field, or vocabulary mismatch.
- Report formula-source coverage, identifier coverage, approval/provisional/block rates, confidence distribution, and common uncertainty.
- Do not use raw agreement percentage as the promotion criterion.
- Specify which compact fields could map to current runtime, which require new fields, which current fields should remain contextual heuristics, and which should be deprecated only in a later approved migration.
- Define Product Intake worker changes, human-review triggers, version/fingerprint requirements, guarded data backfill, and rollback as a future plan—not as work authorized here.
- Route any graduation proposal through the existing catalog-authority program in `plans/2026-08-15-catalog-authority-architecture.md`; do not create an independent competing identity/provenance publication boundary.

**Completion criterion:** Nick can review the exact scientific and catalog delta before deciding whether to plan production integration; no catalog or runtime value changed.

### Task 9 - Verify and hand off the complete shadow program

**Consumes:** final authority, complete artifacts, local workflow, delta report.

**Produces:** verification receipt, review ledger, artifact disposition, and implementation/graduation handoff.

- Run focused Conditioner research tests, artifact validation, deterministic report/export checks, and `npm run ci:verify` when application code exists.
- Verify the exact frozen cohort and complete outcome counts without live credentials.
- Verify source links/fingerprints and inspect a sample from every archetype plus every blocked/excluded item.
- Run `ready-check` and `request-code-review` on the complete branch when implementation begins.
- Stop before commit/push/PR/merge/deploy/remote migration/production write unless separately authorized.

**Completion criterion:** exact content fingerprint, commands, evidence, open risks, and artifact disposition are recorded; no blocking verified finding remains.

## Verification

### Automated

- Schema validation for source, identity, boundary, formula, analysis, evidence, fit, review, and export artifacts.
- Formula normalization/fingerprint tests and stale-derived-flag rejection.
- One-to-many product identifier contract and global collision-preflight contract tests without writes.
- Direct-property versus derived-fit and profile-fact separation tests.
- Gate/cap/double-counting and formula-evidence firewall tests.
- Boundary tests for rinse-out Conditioner versus mask, leave-in, co-wash, and dual-use products.
- Calibration workbook/schema consistency and blind-key separation checks.
- Full cohort completeness/hash/index tests.
- Deterministic replay/ranking/abstention/export tests.
- Current Conditioner runtime and catalog-spec non-mutation regressions.
- Focused Node tests that import repository server-only surfaces run through `node --import ./tests/server-only-register.cjs --import tsx --test tests/conditioner-research-*.test.ts`, not bare `tsx --test`.
- Repository gate: `npm run ci:verify` according to `ready-check` when application code exists.

### Manual/operator

- Review the category charter and every exclusion class.
- Inspect at least one product from every calibration archetype.
- Review all material blind-classification disagreements and resulting rule changes.
- Walk one clean approval, one targeted property rework, one formula conflict, one identity block, one product-form exclusion, and one proprietary-claim abstention.
- Replay fine/healthy, fine/damaged, normal/processed, coarse/curly, and root-application-risk fixtures.
- Confirm generated reports make current labels visibly comparative rather than authoritative.
- Confirm export identity/formula/analysis/review hashes match the validated source state.

### Live-state and migration

- One read-only live capture creates the frozen cohort; repeatable verification uses the artifact.
- Recheck live counts and schema before any later production-integration plan because catalog and migration state can change.
- Do not apply a migration or write research/catalog data in this program.
- Before any later apply, require migration-head verification, RLS/Data API review, backup/rollback, exact batch fingerprint, identifier collision preflight, and explicit Nick approval.

### Evidence-sensitive review

- Formula-only classification never asserts exact percentages, final pH, sensory performance, cumulative buildup, tolerance, or repair efficacy beyond its confidence ceiling.
- Strong direct behavior or user-fit rules require primary/authoritative support or a product/safety invariant; weak or mixed evidence remains soft or unknown.
- `protein`, `oil`, `silicone-free`, `bond`, `natural`, `volume`, and `repair` labels never bypass the mechanism/evidence chain.
- Routine-level evidence is not attributed to the Conditioner alone.
- Scalp discomfort, persistent symptoms, hair loss, and disease claims stay outside cosmetic matching.
- Reviewer agreement proves repeatability of the written standard, not truth or user outcomes.

## Review and handoff

- **Branch:** `codex/conditioner-inci-research-plan`
- **Worktree:** `.worktrees/conditioner-inci-research-plan`
- **Planning review:** one read-only Claude counterpart review, reconciled below.
- **Planning evidence:** source package, Shampoo worked example, repository/runtime mapping, live read-only catalog snapshot, and initial primary/official source anchors.
- **Evidence review:** confirmed by Nick on 2026-08-23.
- **Artifact-review journey sign-off:** confirmed by Nick on 2026-08-23 with “Okay let's go.”
- **Implementation kickoff:** use `implementation-loop` for Stage A only after plan review and artifact-review journey sign-off. Stop again after Task 5; Stage B requires separate explicit authorization.
- **Current stop point:** the revised Stage A complete-profile pilot is ready for Nick's checkpoint review. Stage B, commit, push, PR, merge, deployment, remote migration, and production writes remain unauthorized.

Artifact disposition:

- **Commit candidates during implementation:** plan; canonical source manifest; category charter; normative Markdown standard; hash-matched DOCX/PDF reading copies; agent context; quick reference; integration contract; product-research prompt; runbook; adapted schema; calibration workbook/key/blind review; rule/disagreement logs; frozen cohort; validated product artifacts; tests; deterministic reports/exports; delta report; verification receipt.
- **Archive only when intentionally retained:** temporary exports, rendered review screenshots, and raw research captures required for audit.
- **Discard:** duplicate Drive copies after hash comparison, ZIP duplicate, temporary source downloads, raw counterpart output, exploratory queries, and any invalid/replaced generated artifacts.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
|---|---|---|---|---|---|
| C1 | Scope/product decision | A bespoke Lab would add routes, access control, persistence semantics, component tests, and substantial implementation before artifact review proves it necessary | Accepted | Chosen direction is artifacts-first; the Lab is deferred to a separate future plan | Stage A artifact-review walkthrough and explicit Stage B checkpoint |
| C2 | Scope/product decision | Tasks 6-9 depend on what calibration and stress tests reveal | Accepted | Added a mandatory stop after Task 5; Stage B needs separate Nick authorization | Checkpoint receipt records accepted standard, cohort estimate, and Stage B decision |
| C3 | Defect | Name-derived product directories can collide for package-size duplicates and near-identical variants | Accepted | Directory ownership is `<normalized-brand-name>--<full-product-uuid>` and Task 1 rejects duplicate keys | Cohort/index uniqueness test before parallel dispatch |
| C4 | Defect | The old rerank generator filters `category = "Conditioner (Drogerie)"`, which currently covers 1/49 active rows | Accepted | Current rerank rows are labelled a non-rerunnable historical comparison snapshot; the old script must not regenerate the baseline | Frozen live-table capture plus generator-query regression note in the delta report |
| C5 | Tradeoff | PR #190 is open on an old non-main base and overlaps category-label/identity context | Accepted with evidence-based sequencing | Task 1 freezes from fresh `main` and current live state, records PR #190 as overlap, and neither adopts nor waits on the stale branch | Recheck PR/live state immediately before cohort capture |
| C6 | Execution risk | Task 2 was too monolithic for bounded parallel research | Accepted | Split Task 2 into four read-only lanes with orchestrator-owned integration | Source/claim/conflict/evidence-ceiling handback contract per lane |
| C7 | Verification precision | The plan did not name the repository CI command or server-only test wrapper | Accepted | Named `npm run ci:verify`; focused tests that import server-only surfaces use the repository shim | Run receipt records exact commands and outcomes |
| C8 | Defect | Shampoo engine code and tests are not on `main`; a Stage B executor cannot safely import the dirty sibling worktree | Accepted | Task 6 requires a merged or clean reviewed/fingerprinted Shampoo source and never copies the dirty tree or imports sibling files at runtime | Stage A checkpoint records exact source commit/fingerprint or Task 6 deferral |
| C9 | Defect | The plan cited Shampoo documents but omitted the strongest code/test prior art | Accepted | Added exact Shampoo modules, scripts, and tests plus a module-by-module seam audit and port-over-rebuild rule | Task 6 mapping and focused parity tests |
| C10 | Defect | A standalone JSON schema would regress the strict Zod v4 contract used by the Shampoo engine | Accepted | Zod v4/TypeScript is executable authority; JSON schema is a generated validated interchange artifact | Contract/schema/workbook/document vocabulary drift tests |
| C11 | Defect | The current DB does not itself guarantee one global owner per normalized identifier | Accepted | Clarified that global ownership is a required application-level preflight across identifier types/spellings | Global collision-preflight contract test before any later attachment proposal |
| C12 | Tradeoff | Conditioner graduation overlaps the existing catalog-authority identity/provenance program | Accepted | Task 8 routes a future graduation proposal through the existing catalog-authority boundary | Stage A checkpoint records sequencing; no independent publication path |

## Designed journey confirmation

This is a backend/operator research program with no end-user surface change. The designed operator and integration journey is recorded above.

Evidence review: **confirmed 2026-08-23**.
Artifact-review operator-journey sign-off: **confirmed 2026-08-23**.

## Revised Stage A calibration decision - 2026-08-24

Nick reopened the Stage A checkpoint because the first calibration proved the 16 direct-property rules but did not yet produce the complete candidate profile defined above. The revised checkpoint keeps the same 12-product pilot, excludes only the leave-in boundary product, and completes all seven current comparison fields for the 11 eligible rinse-out Conditioners.

- Research follows the source hierarchy through conflicts instead of stopping for ordinary source gaps.
- Each product receives one pragmatic complete profile plus a concise uncertainty list; the internal evidence trace remains auditable but is not presented as a per-value approval taxonomy.
- `rinseability` is removed from the lean profile because INCI cannot enrich it reliably. Actual `rinse_behavior` remains trace-only and `unknown` without exact finished-product testing; `weight_potential` remains the ingredient-informed deposition signal.
- The revised profile calibration is measured separately from the historical 176-cell direct-property calibration.
- Bali Curls 75 ml uses the manufacturer formula as authority, confirmed by the exact-EAN HAGEL page. The divergent dm transcription is source history, while the Flaconi formula belongs to another EAN.
- Focus classification follows the Shampoo-style hierarchy: the strongest coherent supported mechanism is primary; up to two distinct supported routes are secondary; there is no fixed label precedence and marketing is corroboration only.
- Reviewer F's retained seven-field projection establishes a 72/77 blind baseline with five focus-hierarchy differences. Nick then approved two explicit NEQI matching-policy overrides: `weight_potential: moderate` instead of the reviewer's `high`, and restoration of fine hair to the broad thickness prior. The current accepted-key comparison is therefore 70/77 overall and 53/55 outside the focus fields; a fresh blind rerun is required before treating the new fallback as independently repeatable.
- `usage_role` and `scalp_application_fit` are excluded from the comparison profile because the pilot showed category defaults or label-wording differences rather than useful product variation. Exact directions remain protocol metadata.
- Nick reviews the complete pilot and its uncertain properties before any full 46-product Stage B cohort is authorized.

## Revised Stage A review surface - Conditioner Research Lab

### Outcome and source context

Nick rejected the spreadsheet as the primary checkpoint surface and explicitly selected the running Shampoo Research Lab at `http://localhost:3224/labs/shampoo-research` as the format reference. The Conditioner pilot must therefore be reviewable at `http://localhost:<worktree-port>/labs/conditioner-research` in the same queue-and-product-audit pattern.

The reference implementation exists only in the older, dirty `.worktrees/shampoo-inci-research-engine` worktree and is not present on current `main`. The Conditioner implementation may inspect that surface and reuse its interaction language, but it must not import sibling-worktree code, copy shampoo ranking logic, or depend on that dirty runtime.

### Chosen direction

Build a separate development-only, artifact-backed Conditioner Lab:

- tab 1, **Research Queue & Produkt-Audit**, shows all 12 pilot packets in the Shampoo Lab's queue/detail layout;
- tab 2, **Kalibrierung & Unsicherheiten**, replaces the Shampoo-specific profile replay matrix with the relevant Conditioner calibration evidence: pre/post agreement, adjudicated differences, field-level agreement, and the concise uncertainty review;
- the selected product detail joins locked formula, directions, accepted profile, blind-review comparison, agreement, and conflict data through one Conditioner-specific server adapter;
- selection is interactive, but the first version is read-only: no fake durable approval buttons, no process-local “catalog approval,” and no write endpoint;
- missing or invalid authority artifacts stop the affected surface with a German development error instead of silently showing partial or invented values.

### Scope and non-goals

In scope:

- one new local-only `/labs/conditioner-research` route;
- a Conditioner queue/detail client with responsive layout;
- a calibration/uncertainty client view;
- a server-side read-only adapter over the existing Stage A JSON artifacts;
- a read-only queue-detail API for client selection;
- focused loader, API, server-render, and responsive browser verification.

Out of scope:

- the 46-product Stage B cohort;
- Conditioner user-profile replay, ranking, recommendation, or legacy comparison;
- durable review decisions, authentication, Supabase, Product Intake, catalog publication, migrations, or production deployment;
- extraction of a cross-category Lab abstraction before both categories have review-stable implementations;
- modification of Shampoo Lab files or the dirty sibling worktree.

### Target map

- `src/lib/labs/conditioner-research-access.ts` — dev-only artifact loader, join/validation, summary/detail view models.
- `src/app/labs/conditioner-research/page.tsx` — guarded server entry and initial payload.
- `src/app/labs/conditioner-research/research-lab-client.tsx` — two-tab shell.
- `src/app/labs/conditioner-research/queue-audit-client.tsx` — responsive queue/product audit.
- `src/app/labs/conditioner-research/calibration-client.tsx` — agreement, differences, and uncertainty review.
- `src/app/api/labs/conditioner-research/queue/route.ts` — read-only selected-detail endpoint.
- `tests/conditioner-research-lab-access.test.ts` — development guard, artifact completeness, exclusion/conflict semantics.
- `tests/conditioner-research-queue-audit.test.tsx` — German UI, seven-field table, empty/error/excluded states.
- `tests/conditioner-research-lab-api.test.ts` — read-only detail endpoint and unknown-product response.

### Designed user journey

1. Nick opens `/labs/conditioner-research` in the task worktree's local development server.
2. The page clearly states that it is development-only, artifact-backed, and cannot write to the catalog or Product Intake.
3. The first tab opens by default with the pilot counters: 11 complete profiles, 7 comparative fields, 0 active formula conflicts, and 1 excluded product.
4. Nick selects any of the 12 queue cards. The selected card remains visible and the detail pane shows exact identity, boundary state, formula status, source, original/normalized INCI, directions as protocol metadata, all seven accepted profile fields, the concise rationale, and only the uncertainties relevant to that product.
5. The excluded Cantu leave-in card explains Gate G0 and shows no invented profile. Bali shows the resolved manufacturer/exact-EAN authority and no active conflict.
6. Nick switches to **Kalibrierung & Unsicherheiten** to see the retained seven-field 72/77 Reviewer F blind baseline, the current 70/77 human-approved comparison, 53/55 non-focus cells, five retained focus differences, and the two explicit NEQI policy overrides.
7. If an artifact is missing, malformed, stale, or refers to an unknown product, the Lab shows a bounded German error with the failing artifact/product and recovery instruction; it never falls back to current catalog labels.
8. On mobile, queue cards scroll horizontally and the selected audit stacks below them; tabs, status chips, and profile values remain readable without horizontal table clipping.
9. Completion is Nick identifying any field corrections in the Lab and returning them for revision. Viewing the Lab does not approve Stage B or mutate any external state.

User-journey sign-off: **confirmed 2026-08-24**. Nick selected “Build this lab” for the walkthrough above without corrections.

### Planning evidence

- Existing Shampoo reference capture: `docs/research/conditioner-inci/v1.0/planning-evidence/shampoo-lab-reference-desktop.png`.
- Proposed Conditioner desktop mockup: `docs/research/conditioner-inci/v1.0/planning-evidence/conditioner-lab-proposed-desktop.png`.
- Proposed Conditioner mobile mockup: `docs/research/conditioner-inci/v1.0/planning-evidence/conditioner-lab-proposed-mobile.png`.
- Reviewable static layout: `docs/research/conditioner-inci/v1.0/planning-evidence/conditioner-lab-proposed.html`.

Question resolved by the mockup: how to preserve the Shampoo Lab's review ergonomics without inventing a Conditioner ranking engine. Selected answer: preserve the queue/detail audit shell and use the second tab for calibration/uncertainty evidence. Evidence review: **confirmed 2026-08-24** for the desktop/mobile mockups; Nick selected “Build this lab.”

### Ordered UI tasks

1. **Create the read-only Conditioner Lab adapter.**
   - Consumes: `calibration-pilot-formulas.json`, `calibration-pilot-directions.json`, `calibration-full-profile-key.json`, `calibration-full-profile-reviewer-f.json`, `calibration-full-profile-agreement.json`, and `stress-tests.json`.
   - Produces: validated queue summary, ordered 12-card queue, selected product detail, and calibration view model.
   - Reject duplicate/missing product IDs, formula-fingerprint mismatch, missing required profile fields, unmatched exclusion, illegal vocabulary, and disagreement counts that do not recompute.
   - Completion criterion: focused loader tests prove 11 complete seven-field profiles, one exclusion, zero active source conflicts, resolved Bali authority, and no database dependency.
2. **Implement the responsive queue-and-audit route.**
   - Consumes: the adapter view model.
   - Produces: the first tab and read-only detail API with the reviewed German hierarchy and mobile behavior.
   - Completion criterion: server-render tests cover first product, all seven fields, source/INCI, uncertainty panel, excluded card, resolved-authority card, and missing/invalid artifact error.
3. **Implement calibration and uncertainty review.**
   - Consumes: recomputed agreement/difference view model.
   - Produces: the second tab with pre/post metrics, field agreement, adjudications, remaining difference, focus calls, and stress-test summary.
   - Completion criterion: tests assert the retained-field 72/77 blind baseline, current 70/77 comparison, 53/55 non-focus cells, five focus differences plus two NEQI policy overrides, Bali's resolved formula authority, and 5/5 stress cases.
4. **Verify the real local journey.**
   - Start the task worktree with `npm run dev:worktree`, inspect desktop and mobile at `/labs/conditioner-research`, select baseline/conflict/excluded products, switch tabs, and inspect console errors.
   - Run focused Node tests followed by `npm run ci:verify` because application code now exists.
   - Completion criterion: browser evidence matches the reviewed mockups and no blocking ready-check or review finding remains.

### Review and handoff

- Reuse branch/worktree `codex/conditioner-inci-research-plan` / `.worktrees/conditioner-inci-research-plan`; all existing dirty files are task-owned.
- Counterpart review is required but currently blocked because the local Claude OAuth session is expired; no review result may be implied.
- Commit candidates: Lab route, adapter, focused tests, revised plan, and durable mockup evidence.
- Archive: rendered browser screenshots and temporary dev logs not needed for review.
- Keep the XLSX as secondary audit/export evidence, not the primary checkpoint surface.
- Stop before commit, push, PR, Stage B, database writes, deployment, or activation.

## Stage A execution receipt - revised 2026-08-24

- Task 0: captured the canonical Drive authority package, reconciled byte-identical duplicates, and recorded source IDs, hashes, and authority precedence without Drive writes.
- Task 1: froze 49 active Conditioner rows from read-only Supabase; 46 are eligible rinse-out candidates and 3 stop at G0. Forty eligible rows still need identifier research.
- Task 2: produced the Conditioner-specific standard with E0-E5 evidence levels, R1-R8 routes, M1-M4 anti-double-counting, 16 historical direct properties, the current seven-field profile projection, finished-product methods, abstentions, and human-review gates.
- Task 3: locked 12 exact product/formula packets with 12 unique formula fingerprints; 11 are eligible and one is a product-form boundary exclusion.
- Task 4: rejected an inherited-context blind attempt, completed a zero-inheritance Reviewer C run, reconciled the answer key, and recomputed 176 cells. Final agreement is 89.2% exact, 100% adjacent across 122 scored ordinal cells, maximum distance one band, and zero material disagreements.
- Revised profile calibration: Reviewer F completed the then-current nine-field artifact for 11/11 eligible products and matched the leave-in exclusion. v1.4 retains seven comparative fields, giving a projected blind baseline of 72/77. After Nick's two explicit NEQI matching-policy overrides, the current accepted-key comparison is 70/77: five focus-hierarchy differences and two non-focus policy differences. Bali's formula authority is resolved; the new weight fallback needs a fresh blind rerun before an independent-repeatability claim.
- Task 5: all five adversarial stress cases, including their complete-profile assertions, pass without a systemic scientific rule change.
- Artifact QA: normative Markdown is represented by the final DOCX/PDF reading copies; DOCX accessibility audit reports zero high/medium/low findings; all eleven rendered PDF pages were visually inspected; the 12-sheet formula-driven workbook was rendered and inspected sheet by sheet.
- Verification authority: `docs/research/conditioner-inci/v1.0/stage-a-checkpoint.md` is the current operator handoff. No catalog/recommendation authority or production write was created.

### Conditioner Research Lab execution - 2026-08-24

- Implemented the development-only, artifact-backed `/labs/conditioner-research` review surface with the approved two-tab journey: **Research Queue & Produkt-Audit** and **Kalibrierung & Unsicherheiten**.
- The read-only adapter validates the 12 formula/direction packet order, fingerprints, category boundary, complete seven-field profile vocabulary and canonical arrays, accepted-versus-blind agreement, one exclusion, calibration invariants, and all five stress assertions.
- The queue shows 11 complete profiles, zero active formula conflicts, and one excluded leave-in. Bali uses the resolved manufacturer/exact-EAN authority; Cantu stops at G0 without a profile.
- Focused loader/API/UI verification passes 12/12 after the NEQI fallback update. Typecheck passes; the earlier full `npm run ci:verify` receipt remains valid for the unchanged build surface.
- Real-browser verification passes at 1440px and 390px, including Bali, Cantu, calibration, mobile property cards, zero document overflow, no browser errors, and a deliberately reordered rapid-selection response test.
- Findings-first review fixed the fast-selection response race. The remaining publication gate is explicit: the Lab consumes ignored Stage A JSON authorities, so a future commit/PR must intentionally include or relocate those exact files. The local checkpoint itself is complete.
- The required read-only Claude code-review lane was attempted at `high` effort but timed out without a report; no counterpart approval is implied.
- Current stop: Nick can review the live local Lab at port 3235, opened on NEQI Volume Victory. Stage B, commit, push, PR, database writes, deployment, and activation remain unauthorized.
