# Shampoo v1.4 final methodology and scalability holdout

## Outcome and source context

Finalize one reproducible, research-only Shampoo classification methodology, close the four remaining low-confidence weight assessments in the approved 50-product cohort, and test the frozen method on ten genuinely new German-market regular shampoos.

This plan consolidates rather than replaces the accumulated work:

- v1.3 remains the immutable source, identity, property-schema and approved-product history;
- the v1.4-draft focus, secondary-focus and usage-role amendment becomes stable;
- the whole-formula weight method becomes the only active weight-potential method;
- `weight-final-rerun-v1` and `v2` remain immutable research history;
- the new run creates a v3 overlay plus a research-only v1.4 release candidate. It does not mutate Lab approvals, catalog data, Supabase or production recommendation behavior.

The four remaining low-confidence records are `wahre-schatze-sanfte-hafermilch`, `guhl-hyaluron-plus`, `ogx-rosemary`, and `hair-biology-revitalize-soothe`. Their current v2 candidate band is `moderate`; the immediate unresolved field is confidence, not a request to force another band. The comparison must still show that Hair Biology's v2 candidate is a real `high -> moderate` transition from its approved v1.3 value, while the other three current candidate bands are unchanged from their v2 state.

## Chosen direction

Use one stable policy ID, `shampoo-classification-v1.4`, with a **two-layer contract**:

1. **Product truth:** exact German identity and canonical formula, eight direct product properties, confidence and traceable reasoning.
2. **User fit:** deterministic profile replay derived from those product properties. Fit is not stored as ingredient truth and cannot change the direct classification to improve assortment balance.

The eight direct properties remain:

- `cleansingStrength`: `low | moderate | strong`;
- `conditioningLevel`: `low | moderate | high`;
- `weightPotential`: `low | moderate | high`;
- `focusPrimary`: `volume | shine | repair | clarifying | scalp_active | gentle | general`;
- `focusSecondary`: zero to two distinct focus values, normally zero or one;
- `usageRole`: `frequent | regular | alternating | occasional_reset | treatment`;
- `scalpComfortTarget`: `targeted | not_targeted | unknown`;
- `dandruffSupport`: `supported | not_supported | unknown`.

The stable method keeps the formula-first/claims-second boundary:

- formula architecture determines cleansing, conditioning, weight and the ingredient support required for scalp conclusions;
- claims may identify intended primary/secondary focus and usage context only after the blind formula assessment, and only when compatible with the formula;
- `regular` and an empty secondary focus are valid defaults, not missing research;
- a complete formula with neither Piroctone Olamine nor Climbazole is `dandruffSupport = not_supported`; `unknown` is reserved for an incomplete or identity-conflicted formula;
- product classification confidence measures conclusion robustness, not user-facing fit confidence or measured clinical accuracy.

Weight remains a bounded whole-formula judgment over deposition load, persistence and reset capacity. Ingredient recognition supplies evidence; no polymer, silicone, oil, route count, position window or claim assigns a final band on its own.

For protocol v3, weight validation is **structural rather than label-deterministic**: it requires the complete `shampoo-weight-assessment-v2` record, traceable evidence positions, all three subjudgments, counterevidence, neighboring-band rationale, confidence and the independent-lane result. The route-count-to-band check currently used by holdout v2 remains only inside the v2 protocol branch for historical reproduction. It must not run for v3.

## Four-case closure decisions

The new v3 weight overlay must resolve the actual limiting facts rather than simply editing confidence labels:

| Product | Open fact | Method resolution | Expected result to verify |
| --- | --- | --- | --- |
| Wahre Schätze Sanfte Hafermilch | `Glycine Soja Oil / Soybean Oil` and `PEG-60 Hydrogenated Castor Oil` are unresolved | Alias-normalize soybean oil as a nonvolatile payload lipid. Treat PEG-60 Hydrogenated Castor Oil as a solubilizer/emulsifier and exclude it from persistent payload evidence, consistent with the existing PEG-40 exclusion. Reassess the complete architecture. | `moderate`, confidence raised to `moderate` if both independent judgments agree that the early soybean oil does not create a high architecture against the SLES/betaine reset. |
| Guhl Hyaluron+ | `Hydrogenated Vegetable Oil` is unresolved | Recognize it as an emollient/waxy payload lipid, preserve position 6, and reassess it together with glyceryl oleate, cationic guar and the three-surfactant reset. | `moderate`, confidence `moderate` if the full evidence clearly remains below a rich/high architecture. |
| OGX Rosemary Mint | Formula roles are resolved but German formula identity is low confidence | Canonicalize the current exact German retailer formula for GTIN `3574661805931` using Rossmann as the preferred-retailer source, with a second German retailer as corroboration. Preserve the materially different US manufacturer formula as visible market-specific provenance, not as the German canonical formula. | `moderate`, confidence `moderate`; band changes are permitted only if the canonical German INCI differs from the frozen formula. |
| Hair Biology Revitalize & Soothe | Complete formula exists but identity is low confidence | Canonicalize the current dm German formula for GTIN `8006540153963`; retain P&G Germany positioning as corroboration rather than formula authority. | `moderate`, confidence `moderate`; band changes are permitted only if the canonical INCI differs from the frozen formula. |

If research contradicts any expected result, preserve the contradiction and adjudicate it against the frozen anchors. The completion gate is a justified moderate-or-better confidence result, not four predetermined labels.

## Pre-registered holdout-v3 cohort

The final ten are selected before any labels are produced. They must not overlap the approved 50, holdout-v1 or holdout-v2 by normalized exact name or any GTIN alias.

| Slot | Exact German product | Pack / known GTIN | Stress-test archetype | Starting source chain |
| --- | --- | --- | --- | --- |
| H3-01 | Eucerin DermoCapillaire pH5 Shampoo | 250 ml / `4005800036736` | gentle, sensitive, frequent-use candidate | German manufacturer plus dm-med GTIN/formula corroboration |
| H3-02 | L'Oréal Paris Elvital Hydra Hyaluronic Feuchtigkeit-Auffüllendes Shampoo | 300 ml / `3600524137465` | mass-market moisture and lightness claim | German manufacturer formula plus German retailer identity |
| H3-03 | Wella Professionals Invigo Nutri-Enrich Deep Nourishing Shampoo | 300 ml / `4064666585765` | rich professional nourishment and deposition/reset boundary | German manufacturer formula plus exact-EAN retailer corroboration; activated from the reserve list before labels because Maui's material formula/EAN conflict was unresolved |
| H3-04 | Redken Volume Injection Shampoo | 300 ml / `3474636920266` | professional volume versus polymer/conditioning evidence | German manufacturer formula and GTIN |
| H3-05 | Vichy Dercos Anti-Schuppen Sensitiv Shampoo | 200 ml / `3337871323394` | true dandruff plus sensitive positioning | German manufacturer formula plus dm-med identity |
| H3-06 | Urtekram Fragrance Free Sensitive Scalp Shampoo | 250 ml / `5701058011608` | fragrance-free natural-sensitive architecture | German manufacturer formula and EAN |
| H3-07 | Kérastase Nutritive Bain Satin Riche | 250 ml / `3474637154943` | premium rich nourishment and high-weight boundary | German manufacturer formula plus exact-EAN retailer corroboration |
| H3-08 | Jean&Len Green Apple Lemongrass Shampoo | 300 ml / `4262401738944` | ordinary-use, normal-to-oily positioning | German brand formula plus dm exact-EAN corroboration; activated from the reserve list before labels because the pre-registered Schauma 400 ml identity was not current |
| H3-09 | Syoss Intense Repair Shampoo | 440 ml / `4015100860382` | repair with silicone, protein, oil and strong reset | dm exact GTIN/formula; German manufacturer corroboration if available |
| H3-10 | Pantene Pro-V 3in1 Repair & Care | 250 ml / `8700216558136` | genuine shampoo/conditioner/treatment hybrid | dm exact GTIN/formula; P&G Germany corroboration if available |

The original pre-registration froze four reserves: Wella Professionals Invigo Nutri-Enrich Deep Nourishing Shampoo 300 ml (`4064666585765`), MONDAY Moisture Shampoo 354 ml (`4897097266329`), Jean&Len Green Apple Lemongrass Shampoo 300 ml (`4262401738944`), and Pantene Pro-V Glatt & Seidig Shampoo 300 ml (`8700216558259`). Before labels, source audit blocked Maui and the exact Schauma 400 ml slot and activated Wella plus Jean&Len as shown above. MONDAY remains the only ready unused reserve. Pantene Glatt & Seidig is retained as a blocked reserve because current German sources expose a material same-GTIN formula conflict.

## Scope and non-goals

### In scope

- close the four weight evidence/identity gaps and produce immutable `weight-final-rerun-v3` artifacts;
- freeze stable v1.4 Shampoo methodology and route all future Shampoo research to it;
- produce a research-only consolidated v1.4 candidate for the 50 approved products with all eight effective properties and rationales;
- extend the existing holdout harness with an explicit v3 protocol, without changing v1/v2 reproduction;
- research, classify, independently check and profile-replay the ten new products;
- document a category-neutral methodology shell that future category projects can instantiate with their own property taxonomy and evidence rules.

### Non-goals

- no production database migration, catalog write, import, Lab approval mutation or recommendation activation;
- no end-user UI or copy change;
- no price, availability, image or product-intake completeness research beyond exact identity and formula provenance;
- no deep-cleansing SKU, diagnosed scalp condition, hair-loss treatment or medical efficacy claim;
- no retroactive tuning of labels toward the existing distribution or influencer assessments;
- no claim that inter-rater agreement equals real-world prediction accuracy;
- no implementation of another product category in this pass.

## Target map

- `docs/research/shampoo-inci/v1.4/README.md`: stable version routing and supersession map.
- `docs/research/shampoo-inci/v1.4/classification-standard.md`: one normative eight-property method, evidence boundary, confidence semantics and all active exceptions.
- `docs/research/shampoo-inci/v1.4/new-product-research-runbook.md`: exact repeatable operator protocol.
- `docs/research/category-classification-engine-template.md`: reusable category shell separating identity, formula/input evidence, direct properties, profile fit, confidence, holdout and activation gates.
- `src/lib/shampoo-research/weight-evidence.ts`: preserve historical v2 evidence behavior and add versioned v3 soybean/HVO/PEG-60 recognition.
- `src/lib/shampoo-research/weight-assessment-v2.ts` plus a versioned v3 assessment contract: keep historical v2 validation reproducible and validate v3 evidence explicitly.
- `scripts/shampoo-research/run-weight-correction-overlay.ts`: dedicated four-record v3 overlay that pins v2 hashes and never pretends the other 46 products were freshly assessed.
- `data/research/shampoo-inci/weight-final-rerun-v3/`: corrected evidence packets, two independent assessments for the four affected records, freeze, adjudication if needed, report and verification receipt.
- `data/research/shampoo-inci/v1.4-candidate/`: effective 50-product research release referencing approved base analyses plus the final v3 weight overlay; no copied production row or import payload.
- `src/lib/shampoo-research/holdout.ts`, `scripts/shampoo-research/validate-holdout.ts`, `scripts/shampoo-research/report-holdout.ts`: explicit v3 namespace, predecessor overlap and stable-method validation.
- `data/research/shampoo-inci/holdout-v3/`: pre-registration, sources, formula packets, two lanes, adjudication, profile replay and report.
- `tests/shampoo-research-weight-*.test.ts`, `tests/shampoo-research-holdout.test.ts`, `package.json`: anti-regression and explicit v3 commands.

## Designed operator journey

There is no end-user product change in this phase.

1. **Freeze policy and candidates.** The operator freezes the stable v1.4 policy hash, the four-case correction manifest and a 10+4 holdout manifest. No labels exist in the holdout artifacts yet.
2. **Resolve exact identity first.** For each holdout slot, resolve exact German name, pack, GTIN aliases and canonical INCI using package > exact German manufacturer > preferred German retailer. Conflicting market formulas remain visible. A material unresolved conflict blocks and replaces the slot before classification.
3. **Run the blind formula pass.** Lane A sees normalized INCI, formula provenance/completeness and the standard, but no product name, claims, existing catalog labels or fit outcome. It records all eight provisional properties; formula-derived dandruff is validated mechanically.
4. **Unblind positioning.** Only after the blind hash is frozen, reveal exact identity and claims. Focus and usage may change under the documented rules; every change records the specific claim, compatible formula route and reason. Empty secondary and regular usage remain complete decisions.
5. **Run an independent challenge.** Lane B receives the same final source packet and stable policy, but not lane A's values. It classifies the same seven judgment properties; dandruff is recomputed from the formula.
6. **Adjudicate rule gaps, not convenient products.** Exact agreement is measured before adjudication. Disagreements are classified as product correction, identity/source failure, researcher-process ambiguity or systematic rule gap. A systematic gap amends the normative policy and reruns all ten; it is not patched for one product.
7. **Validate and replay.** The harness validates all eight properties, rationales, confidence, fingerprints and source chain, then replays the ten products against the existing 18 de-identified profiles. Direct product truth and fit outcomes are displayed separately.
8. **Review the result.** The final report leads with: ten classifiable products or explicit replacements, property-by-property agreement, confidence distribution, every adjudication, profile-fit distribution, and any remaining methodology limitation. Completion produces research-only artifacts; catalog/production activation remains a later gate.

Recovery states:

- no exact German formula: intensify to preferred retailer sources, then use a reserve if still unresolved;
- exact formulas conflict by GTIN/market: do not merge them; select the canonical German identity or block;
- a material ingredient function is unresolved: research and update the shared evidence lexicon before freezing judgments;
- any final property remains low-confidence: do not relabel it as moderate; document the missing evidence, decide whether the policy can resolve it, and rerun or keep the holdout failed;
- a broad directional shift appears: inspect the common reasoning and test anchors, never tune toward a desired distribution.

## Planning evidence

This is a backend/research workflow with no product surface, so no visual mockup is required. The evidence motivating this pass is concrete:

- the approved 50-product release is complete on all eight fields, but four weight records remain low-confidence for two recurring causes: unresolved ingredient function and low formula-identity confidence;
- the current whole-formula rerun already has agreement on all four bands, so the necessary work is targeted evidence closure rather than another broad relabeling;
- holdout-v1 exposed insufficient repeatability and holdout-v2 proved that tighter focus/usage rules improve it; the new holdout must test the final combined policy on untouched products;
- current German product pages provide source-rich candidates across the intended stress archetypes, while the Maui slot intentionally tests whether the identity gate rejects unresolved reformulation/GTIN ambiguity.

## Ordered tasks

### 1. Close the four low-confidence facts and freeze weight v3

First freeze the stable v1.4 classification and weight-policy documents and use their exact path/hash as the v3 `policyPath`. Add red-first evidence tests for soybean aliases, HVO and PEG-60 HCO in a versioned v3 extractor while preserving the v2 extractor/validator. Update OGX and Hair Biology source provenance through v3 overlays only after exact German source/fingerprint validation. Generate a dedicated four-record v3 correction overlay that pins the frozen v2 manifest/mapping/protocol/report hashes and assesses those four formulas independently in both lanes. The effective resolver uses v3 for the four corrections and v2 for the other 46. Do not edit v1.3 or v2 artifacts.

**Produces:** four final structured assessments, v3 report and receipt.
**Complete when:** all four are moderate-or-better confidence with explicit evidence and counterevidence; all unaffected v2 bands and artifacts are byte-identical. If a record honestly remains low-confidence, keep it flagged in the generated v1.4 candidate and mark that candidate `not_finalizable`; do not exclude the product or promote confidence. The run may complete as evidence, but final-method/product-cohort completion fails until the source or rule gap is resolved.

### 2. Promote the methodology and consolidate the approved cohort

Create stable v1.4 docs by reconciling v1.3 plus the approved v1.4-draft amendments and final weight method. Mark superseded route-count rules as historical. Build a reference-based v1.4 candidate manifest containing the effective eight-property record and reasoning source for every approved product, using v3 weight where applicable and v2 elsewhere.

**Produces:** one canonical Shampoo policy and one non-production 50-product research candidate.
**Complete when:** every approved product resolves to exactly eight properties and rationales, no active runbook points new research to a draft/superseded method, and the manifest proves its source hashes. A low-confidence effective property remains visible and makes the candidate `not_finalizable`; it never disappears through filtering.

### 3. Generalize the holdout harness narrowly for v3

Add an explicit v3 protocol rather than silently changing v2. Reuse the existing formula/blind/unblind/agreement/profile-replay artifacts, but point rule validation to the stable policy and whole-formula weight assessment. In `holdout.ts`, retain the route-count label check only for protocol v2 and validate v3 weight through the structured whole-formula record plus lane agreement; v3 must never derive an expected weight band from route counts. Add overlap adapters for both previous holdouts, exact 10+4 membership checks and deterministic reports. Add explicit package commands `research:shampoo:validate-holdout-v3`, `research:shampoo:report-holdout-v3`, and a separately named v3 weight prepare/freeze/report command. Preserve golden v1/v2 outputs.

**Produces:** runnable v3 validate/report commands and tests.
**Complete when:** synthetic fixtures reject overlap, incomplete identity, missing rationales, forced secondary focus, invalid usage triggers and automatic ingredient-to-weight shortcuts, while v1/v2 still reproduce.

### 4. Resolve and freeze the ten new identities

Research the pre-registered 10+4 list in selection order. Resolve current German formula, exact GTIN aliases and source hierarchy without looking at prospective labels. Replace a blocked slot only under the reserve rule and freeze source/formula hashes before analysis.

**Produces:** immutable holdout-v3 manifest and source/formula packets.
**Complete when:** ten non-overlapping, complete, classifiable German formulas are frozen with no unresolved material conflict.

### 5. Run the final scalability test

Produce lane A blind/final records, freeze them, then produce lane B independently. Validate, compare and adjudicate. Profile-replay only the final provisional records, keeping fit separate from direct properties.

**Produces:** ten complete provisional analyses, agreement ledger, adjudication, replay and final report.
**Complete when:** all ten have eight properties and moderate-or-better confidence; raw exact agreement is at least 75% over the 70 judgment decisions and raw exact agreement is at least 60% for each of the seven judgment properties; formula-derived dandruff is 100%; and there are zero identity/audit failures. The report also computes per-property label prevalence, conditional non-default agreement and Cohen's kappa as diagnostics, with no kappa pass threshold on this ten-product sample. A miss remains an honest failed holdout with the named rule gap.

### 6. Document the reusable category shell

Extract only the category-neutral workflow: input identity, authoritative source hierarchy, category-specific property schema, evidence lexicon, deterministic versus structured-judgment decisions, claim boundary, confidence, independent holdout, fit separation and activation gate. Shampoo supplies the worked example; future categories must define their own properties and evidence rather than reuse Shampoo rules.

**Produces:** category-method template, not a generic production framework.
**Complete when:** a future category project can fill the template without copying Shampoo-specific values or bypassing source/holdout gates.

## Verification

Automated:

- focused red/green tests for soybean alias, HVO and PEG-60 HCO handling;
- exact four-record v3 membership and immutability checks for v1/v2 plus the other 46 weight records;
- effective v1.4 candidate validation: 50 approved, one blocked historical duplicate, eight properties and rationale source per approved record; any low-confidence effective property makes the candidate `not_finalizable` and fails the intended completion gate;
- v1, v2 and v3 holdout validators and deterministic report regeneration;
- holdout-v3 exact 10 products, unique identities/GTIN aliases, eight properties, confidence, source/fingerprint and predecessor-overlap checks;
- 18-profile replay with direct-property versus fit separation;
- relevant Shampoo research test suite, `npm run typecheck`, `npm run lint`, `git diff --check`; use full `npm run ci:verify` only if changes escape the isolated research modules.

Evidence review:

- inspect the four corrected evidence records and source chains manually;
- inspect every holdout disagreement and every blind-to-final change;
- sample formula positions for each property/archetype and verify claims appear only post-unblind;
- report agreement as repeatability, not accuracy, and report confidence limits without generic caution language.

Isolation:

- SHA-256 receipt proves no mutation of v1.3 approvals, v1/v2 holdouts, weight v1/v2, generated artifact index, catalog records, migrations or Lab review state;
- because the long-running v1/v2 research baseline is currently uncommitted, the start receipt is explicitly a working-tree content-hash baseline, not Git-level immutability. The receipt inventories every protected path before v3 writes and verification compares against those captured bytes. Commit/push remains separately unauthorized; durable Git provenance is a later publication gate, and this limitation must be stated in the final research receipt;
- no database or authenticated browser verification is required because there is no UI or live-data write.

## Review and handoff

- Worktree: continue `codex/shampoo-inci-research-engine`; preserve unrelated dirty state and do not rebase.
- Counterpart review: required for this plan before implementation and for the complete branch after verification; reviewer is read-only.
- Human review: Nick reviews the four closures and the holdout-v3 report. Product-by-product Lab approval is not required for the scalability measurement unless the report exposes a substantive methodological disagreement.
- Stop before commit, push, PR, database import, catalog mutation, deployment or production activation.
- Commit-intended later: stable methodology docs, category template, isolated harness/tests, immutable v3/holdout-v3 research artifacts and this plan.
- Historical v1.3/v1.4-draft and v1/v2 run artifacts remain available as provenance.

## Counterpart findings ledger

| ID | Finding | Decision | Plan change / verification |
| --- | --- | --- | --- |
| C1 | The v2 holdout validator still deterministically maps route counts to weight bands, contradicting the final whole-formula method if reused for v3. | Accepted | Explicit protocol split: preserve v2 historical behavior; v3 validates the structured whole-formula assessment and independent result without deriving a band. Add tests proving the split. |
| C2 | An honest low-confidence result conflicted with the proposed all-resolved candidate gate. | Accepted | Keep the record visible and flag the candidate `not_finalizable`; completion fails rather than excluding the product or promoting confidence. |
| C3 | Existing v1/v2 artifacts are uncommitted, so SHA receipts are not equivalent to Git immutability. | Accepted as disclosed constraint | Capture an exhaustive working-tree start receipt, preserve bytes and label the limitation. Do not commit without separate authorization. |
| C4 | Hair Biology's candidate moderate band is a high-to-moderate change versus its approved v1.3 record. | Accepted | State the transition explicitly in the four-case review and consolidated comparison. |
| C5 | The per-property gate could be confused with conditional non-default agreement. | Accepted clarification | Keep the existing raw exact 75%/60% gates; report conditional non-default agreement and prevalence separately. Add kappa as a diagnostic, not a gate. |
| C6 | The stable method was created after the v3 run in task order. | Accepted | Freeze the stable policy files before v3 and hash their exact path in the run protocol. |
| C7 | The category template might be premature. | Rejected for this scope | Nick explicitly requested an engine pattern that can later extend beyond Shampoo. Keep a documentation-only template; do not build a generic runtime or second category. |
