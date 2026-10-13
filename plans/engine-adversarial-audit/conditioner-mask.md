# Adversarial audit — Conditioner v1.6 + Mask v1.0 engines

Date: 2026-10-09 · Worktree: `.worktrees/engine-adversarial-audit` (`codex/engine-adversarial-audit`) · Audit only, nothing fixed.

Test file: `tests/audit-conditioner-mask-rules.test.ts`. The tests in `describe("contradictions")` are expected to fail; the tests in `describe("verified")` are expected to pass.

```
cd /Users/nick/AI_work/hair_conscierge/.worktrees/engine-adversarial-audit && node --import ./tests/server-only-register.cjs --import tsx --test tests/audit-conditioner-mask-rules.test.ts
# tests 33 · pass 13 · fail 20
```

## Scope and production-path notes

- **Conditioner.** `projectConditionerForProduction` (`src/lib/conditioner-research/production-adapter.ts`) is live in Product Intake: `CATEGORY_RESEARCH_REGISTRY.conditioner.state = "active"` and `applyConditionerResearchAdapter` writes `suitable_thicknesses`, `product_conditioner_specs` and `product_conditioner_rerank_specs`. Stage-3 then reads those rows (`personal-plan/products/authority/catalog-facts.ts` `selectConditionerSpec`, `categories/conditioner.ts`).
- **Mask.** `projectMaskForProduction` is the frozen engine's documented production adapter. It is **not wired** into intake: the router has `mask: unavailable(...)` (`category-research-router.ts:174`), so the model still hand-writes `product_mask_specs` with no validation. Every mask adapter finding below is therefore **latent**: it ships the moment the adapter is wired in. Stage-3 already reads `product_mask_specs.repair_support_level` and `products.suitable_thicknesses` (`categories/mask.ts`).
- **No deterministic classifier exists in `src/`.** The S1/S2/S3 signals, tail marker, R5 tests, focus hierarchy and similar rules are applied by the LLM researcher. Code only validates and projects the envelope. That makes the adapters the only code-level guard on standard conformance (see NR-2).
- **Calibration data.** All 11 accepted conditioner key profiles and all 11 projectable mask calibration envelopes already satisfy the weight→thickness, conditioning→damage and bond→repair rules. The rules are real and the researchers follow them. The defect is that the adapters do not enforce them.
- **Fixtures.** The repo's own adapter fixtures violate the echo rule. `tests/conditioner-production-adapter.test.ts` and `tests/mask-production-adapter.test.ts` both pair `weightPotential: moderate` with a thickness fit that has no `fine`, and they assert that projection as correct.

## (a) Rule inventory

Status values: holds / contradicted / untestable / needs-ruling. Citations are doc path plus heading.

| ruleId | Rule | Citation | Status |
|---|---|---|---|
| conditioner.adapter.formula_sequence.1 | normalizedIngredients must keep the complete ordered sequence; a divergent list is refused | `docs/product-intake-conditioner-production-adapter.md` › Required research envelope | contradicted |
| conditioner.adapter.flags_normalized.1 | ingredient_flags come from the *normalized* complete INCI | same doc › Deterministic projection | contradicted |
| conditioner.adapter.flags_proteins.1 | R5 hydrolyzed proteins count as protein presence | `conditioner-classification-standard.md` §5 R5; adapter doc › Deterministic projection | contradicted |
| conditioner.fit.thickness_prior.1 | thickness fit follows weight: low→fine,medium · moderate→all · high→medium,coarse | standard §10.4 (and §10.1 fallback) | contradicted |
| conditioner.care_direction.protein_route.1 | `protein`/`balanced` need a material R5 route in the formula | standard §10.2 | contradicted |
| conditioner.repair.bond_route.1 | repair `high` needs a named bond route visible in the formula | standard §10.2, §5 R7 | contradicted |
| conditioner.repair.film_route.1 | repair `medium` needs a protein/peptide/keratin film route | standard §10.2 | contradicted |
| conditioner.damage_fit.shape.1 | damage_fit is exactly the §10.4 two-value set (never all three) | standard §10.4 | contradicted |
| conditioner.profile.ordered_subset.1 | fit arrays are *ordered* subsets | standard §9 | contradicted |
| conditioner.adapter.baseline.1 | weight/thickness/balance mapping table, protocol role only | adapter doc › Deterministic projection, Protocol boundary | holds |
| conditioner.adapter.confidence_internal.1 | research confidence never reaches projection or rationale | memory rule; adapter doc | holds |
| conditioner.adapter.gates.1 | G0 exclusion → routed out; low identity / unresolved formula / hash mismatch → blocked | standard §2, §11; adapter doc | holds |
| conditioner.adapter.uncertainty_review.1 | uncertainty in a mapped field surfaces as a review warning | `plans/2026-09-03-conditioner-new-product-production-adapter.md` › Operator journey 5 | holds |
| conditioner.focus.secondary.1 | secondary ≤2, excludes `general`, never repeats primary | standard §9 | holds |
| conditioner.catalog_firewall.1 | catalog values never enter the research envelope | `charlie-integration-contract.md` › Prohibited dependencies | holds (strict schema has no catalog input) |
| conditioner.intake.research_id_binding.1 | identity.researchId must equal submission_id | adapter doc › Required research envelope | holds (`tests/conditioner-product-intake-adapter.test.ts:152`) |
| conditioner.weight.conflict_fallback.1 | conflict-tagged formula-only `high` → `moderate` | standard §10.1 | untestable (needs finish/claim evidence) |
| conditioner.focus.hierarchy.1 | §10.3 focus hierarchy | standard §10.3 | untestable (research judgment; research-only field) |
| conditioner.texture_fit.1 | architecture-based texture prior | standard §10.4 | untestable (has a second architectural input; research-only) |
| conditioner.g7.review_freshness.1 | unsalted per-field fingerprints, versioned profile fingerprint | standard §11 G7 | untestable here (Lab path; covered by `tests/conditioner-research-review-state.test.ts`) |
| conditioner.fit.not_universal_exclusion.1 | thickness prior is "not a universal exclusion" | standard §10.4 | needs-ruling (NR-1) |
| conditioner.matching.balanced_target.1 | product `balanced` ≠ uncertainty bucket; mapping to user balance is a production policy | standard §10.2, §10.4 last ¶; integration contract | needs-ruling (NR-5) |
| mask.repair.bond_gate.1 | repair `high` ⇔ `bond_route ≠ none`; "Nothing else reaches high" | `mask-classification-standard.md` §9.4; lexicon §6 | contradicted |
| mask.echo.thickness.1 | thickness fit is the deterministic echo of weight | standard §9.5E, §9.6 | contradicted |
| mask.echo.damage.1 | damage_fit is the deterministic echo of conditioning + repair/bond; never all three | standard §9.5E, §9.7 | contradicted |
| mask.echo.texture.1 | texture_fit is the deterministic echo of weight | standard §9.5E, §9.8 | contradicted |
| mask.adapter.flags_normalized.1 | flags from the normalized INCI (`*`/`†` stripped) | adapter doc › Formula integrity, Deterministic projection; standard §9 trace | contradicted |
| mask.flags.lexicon.humectants.1 | flags are deterministic lexicon lookups (family 7) | standard §10; lexicon §7 | contradicted |
| mask.flags.lexicon.proteins.1 | family 5a → proteins | standard §10; lexicon §5a | contradicted |
| mask.flags.lexicon.polymers.1 | family 9 → polymers; family 10 thickeners earn nothing | standard §10; lexicon §9, §10 | contradicted |
| mask.flags.lexicon.silicones.1 | family 4 → silicones | standard §10; lexicon §4 | contradicted |
| mask.flags.lexicon.oils.1 | family-3 heavy band → oils; family-10 solubilisers earn nothing | standard §10; lexicon §3, §10 | contradicted |
| mask.flags.glycols.1 | same-class glycols are flagged alike | lexicon §7 + E15 | contradicted |
| mask.adapter.baseline.1 | D1 twin, D6 1:1, MAD-1 benefits, protocol role | adapter doc › Deterministic projection | holds |
| mask.adapter.formula_sequence.1 | token-exact sequence check | adapter doc › Formula integrity | holds |
| mask.adapter.g0.1 | 3 G0 outcomes; provisional identity blocks; multi-use names uncovered modes | standard §2.1, §2.2; adapter doc outcome table | holds |
| mask.adapter.unknown.1 | no `unknown` committed (AD-2, §1.1) | adapter doc outcome table; standard §1.1 | holds |
| mask.adapter.benefits_nonempty.1 | functional_benefits never empty (fallback) | adapter doc (MAD-1 rows) | holds |
| mask.adapter.bond_positive.1 | recorded bond route projects `high` | standard §9.4 | holds |
| mask.adapter.catalog_firewall.1 | legacy values warn only, never change projection | standard §9.9 | holds |
| mask.adapter.confidence_internal.1 | confidence never changes projection | memory rule; adapter code comment | holds |
| mask.thresholds.signals.1 | §9.1–§9.3 S1/S2/S3, leanness test, R5 test, E1/E8/E14/E15/E16 | standard §9.1–§9.5 | untestable (no deterministic implementation in `src/`) |
| mask.g0.formula_exclusion.1 | E17: pigment/bond-protocol formulas excluded in every mode | standard §2.2 E17 | untestable (adapter trusts `categoryBoundaryStatus`; no INCI check) |
| mask.intake.wiring.1 | mask envelope required in Product Intake | adapter doc › Product Intake handoff | untestable / gap (not wired; legacy hand-written specs unvalidated) |
| mask.fit.not_universal_exclusion.1 | thickness prior is "not a universal exclusion"; weight is a "soft preference" | standard §9.2 Wording rule, §9.6 | needs-ruling (NR-1) |
| mask.functional_benefits.moisture.1 | moisture reaches production "only via balance_direction" vs MAD-1 `moisture_softness` | standard §9.5 provenance, §9.9; README; adapter doc | needs-ruling (NR-4) |
| mask.tokenizer.water_eau.1 | "(Water, Eau)" is one alias parenthetical vs comma-split rule | lexicon §0.4; adapter doc › Formula integrity | needs-ruling (NR-6) |
| mask.repair_proxy.d1 | chat path matches repair on `concentration`; Stage-3 on `repair_support_level` | standard §9.1 production note (D1) | needs-ruling (NR-7) |
| cross.flags.rule_source.1 | which authority defines presence flags | mask standard §10 vs mask adapter doc "rules shared with the leave-in adapter" | needs-ruling (NR-3) |

**Counts:** 50 rules. 16 hold, 20 contradicted, 7 untestable, 7 needs-ruling.

## (b) Contradictions

Severity rubric: P0 is a wrong product or a wrong property for a real-looking input; P1 is a wrong rationale, ordering or gate; P2 is cosmetic or research-only. "P0-data" means the stored property is wrong but no ranking consumes it today (no conditioner/mask matcher reads `ingredient_flags`).

### Conditioner (live in Product Intake)

1. **conditioner.fit.thickness_prior.1** · P0 · confidence medium (rule high; adapter ownership is NR-2)
   - Example: a rich conditioner (weight high) whose envelope also lists `fine` gets a `fine` eligibility row, so fine-haired users see it as an exact thickness fit. The reverse also happens: a moderate conditioner listed as medium/coarse drops fine-haired users.
   - Expected: `suitable_thicknesses` equals the §10.4 prior (high→normal,coarse; moderate→all three), or the envelope is refused.
   - Observed: `["fine","normal","coarse"]` and `["normal","coarse"]` respectively.
   - Source: `src/lib/conditioner-research/production-adapter.ts:422` (fit array copied verbatim; weight is never consulted).
2. **conditioner.repair.bond_route.1** · P0 · confidence medium
   - Example: a "Repair" silicone conditioner (Amodimethicone, Panthenol, no bond chemistry) researched as `repair_support_level: high` is written as `repair_level: high`. Stage-3 then gives a high-repair user an exact pass.
   - Expected: refusal, or a value below `high`.
   - Observed: `high`.
   - Source: `production-adapter.ts:432`.
3. **conditioner.repair.film_route.1** · P0 · confidence medium
   - Example: the same formula as `medium`, with no protein species.
   - Expected: `low` or refusal.
   - Observed: `medium` while the adapter's own flags are `["silicones","humectants"]`.
   - Source: `production-adapter.ts:432`.
4. **conditioner.care_direction.protein_route.1** · P0 · confidence medium
   - Example: a plain cetearyl/behentrimonium/glycerin conditioner researched as `protein` (or `balanced`) is written as `stretches_stays` (or `stretches_bounces`) compatibility rows, although its own flags show no protein.
   - Expected: no protein/balanced projection without an R5 species.
   - Observed: projected.
   - Source: `production-adapter.ts:425-433`.
5. **conditioner.adapter.flags_normalized.1** · P0-data · confidence high
   - Example: an organic-certified conditioner labelled `Glycerin*` loses the `humectants` flag.
   - Cause: the integrity check strips punctuation, so the envelope is accepted, but flags are matched on the raw token (`"glycerin*" !== "glycerin"`). The repo's own fixture builds `normalizedIngredients` with `rawInci.split(",").map(trim)`, which keeps the `*`.
   - Source: `production-adapter.ts:434` (raw tokens) together with `:311` (exact string equality).
6. **conditioner.adapter.formula_sequence.1** · P1 · confidence high
   - Example: `["Aqua Glycerin", …]` (5 items for a 6-ingredient formula) passes, and the humectants flag disappears. The doc says divergent lists are refused.
   - Cause: the comparison is punctuation-blind, so merged or split tokens are indistinguishable.
   - Source: `production-adapter.ts:402-411`. The mask adapter's token-exact check does not have this defect (verified).
7. **conditioner.adapter.flags_proteins.1** · P0-data · confidence medium
   - Example: a "Liquid Silk" conditioner with `Hydrolyzed Silk`, `Sericin` (the pair in calibrated mask #04) gets no `proteins` flag. The mask adapter flags the same tokens.
   - Source: `production-adapter.ts:289-292`.
8. **conditioner.damage_fit.shape.1** · P2 (research-only field, but the adapter is its only validator) · confidence medium
   - Example: an envelope with all three damage values, or low conditioning paired with healthy+moderately_damaged, is accepted as `projection_ready`.
   - Source: `production-adapter.ts:117`.
9. **conditioner.profile.ordered_subset.1** · P2 · confidence high
   - Example: `hairThicknessFit: ["coarse","medium"]` is accepted and emitted as `["coarse","normal"]`, not in canonical order.
   - Source: `production-adapter.ts:116`, `:422`.

### Mask (adapter not wired yet, so these are latent)

10. **mask.repair.bond_gate.1** · P0 · confidence high
    - Example: a "Bond Repair" front-of-pack mask with `bondRoute: none` and `repairSupportLevel: high` projects `repair_support_level: high`. §9.4 says nothing but a bond route reaches `high`, and both values are in the same envelope.
    - Source: `src/lib/mask-research/production-adapter.ts:700` (copied verbatim; `bondRoute` from `:204` is never read).
11. **mask.echo.thickness.1** · P0 · confidence high
    - Examples:
      - A rich mask (weight high) listing `fine` makes fine hair eligible.
      - A moderate mask listing normal/coarse (the repo fixture shape) excludes fine hair.
      - A lean mask listing coarse makes coarse hair eligible for a light mask.
    - Expected: the §9.6 table, which §9.5E calls deterministic with "no rule that can change its output".
    - Source: `production-adapter.ts:737-738`.
12. **mask.adapter.flags_normalized.1** · P0-data · confidence high
    - Example: an Alverde/Lavera-style Haarkur with `GLYCERIN*` is accepted (the integrity check strips `*` at `:654-656`), but its flags are `["oils"]` with no humectants (flags are derived from the unstripped tokens at `:734`).
13. **mask.flags.lexicon.humectants.1** · P0-data · confidence high
    - Example: lexicon family-7 members get no flag: Sodium PCA, Hydrolyzed Hyaluronic Acid, Sodium Acetylated Hyaluronate, Aloe Barbadensis Leaf Juice Powder/Extract, Trehalose, Inositol, Saccharide Isomerate, Glycereth-26.
    - Juice Powder appears in calibrated #08 Sante and #09 Balea Aqua Hyaluron. Glycerin happens to mask the gap there.
    - Source: `production-adapter.ts:452-465`.
14. **mask.flags.lexicon.polymers.1** · P0-data · confidence high (misses), medium (false positive)
    - Misses: Cassia and Starch Hydroxypropyltrimonium Chloride (lexicon §9).
    - False positive: the family-10 thickener `Acrylates/C10-30 Alkyl Acrylate Crosspolymer` is flagged `polymers`, because `/acrylates.*polymer/` matches "Crosspolymer". Carbomer, in the same family, is not flagged.
    - Source: `production-adapter.ts:436-444` (`:440`).
15. **mask.flags.lexicon.oils.1** · P0-data · confidence medium (the oils↔family-3 mapping is implied, not stated)
    - Misses: heavy-band Lanolin, Petrolatum, Paraffinum Liquidum and Cera Alba are not flagged, while `Lanolin Oil` is.
    - False positive: the family-10 solubiliser `PEG-40 Hydrogenated Castor Oil` is flagged.
    - Source: `production-adapter.ts:445`.
16. **mask.flags.lexicon.silicones.1** · P0-data · confidence high (Bis-PEG-18), medium (Methicone)
    - Misses: `Bis-PEG-18 Methyl Ether Dimethyl Silane` (lexicon §4) and plain `Methicone` (declared by calibrated #07 Pantene) are not flagged.
    - Source: `production-adapter.ts:430-435`.
17. **mask.flags.lexicon.proteins.1** · P0-data · confidence high
    - Example: `Hydrolyzed Casein` (lexicon §5a) gets no flag.
    - Source: `production-adapter.ts:446-451`.
18. **mask.flags.glycols.1** · P0-data · confidence high
    - Example: Pentylene Glycol is flagged as a humectant and Dipropylene Glycol is not, yet the lexicon puts both in one subgroup and E15 classes both as solvents. They disagree under either reading. Calibrated #12 Guhl has Dipropylene Glycol at rank 4.
    - Source: `production-adapter.ts:452-465` (`"pentylene glycol"` at `:462`; no dipropylene entry).
19. **mask.echo.damage.1** · P2 · confidence high
    - Example: all three values, an empty set, or low conditioning with healthy+moderately_damaged are all accepted.
    - Source: `production-adapter.ts:206` (`min 0`, no echo check).
20. **mask.echo.texture.1** · P2 · confidence high
    - Example: an empty set, or weight low with wavy/curly/coily, is accepted.
    - Source: `production-adapter.ts:207`.

## (c) Needs ruling

- **NR-1. Is the thickness prior a hard exclusion?**
  - Reading A (the standards): it is a "desired-finish/dosage prior, not a universal exclusion" (conditioner §10.4, mask §9.6). The mask §9.2 wording rule calls weight "a soft preference with a stated reason". `plans/mask-recommendation-spec.md` §2 item 4 says "strong downranking (not hard exclusion by default)".
  - Reading B (shipped policy): Mask v4 (`plans/2026-08-15-personal-plan-mask-v4-independent-release.md`, Nick-approved) makes "exact hair-thickness eligibility" "hard and fail-closed". Stage-3 implements a fail for both categories (`authority/categories/mask.ts:129`, `conditioner.ts:45-60`). The chat path ignores mask `suitable_thicknesses` entirely (`recommendation-engine/categories/mask.ts`, `MaskFitSpec` has no thickness).
  - Example: a fine-haired user and calibrated #06 Monday Smooth Anti-Frizz (weight high → normal/coarse). Stage-3 returns `mismatch` and never recommends it. The chat path also reaches `mismatch`, but through its weight axis rather than thickness (`evaluateMaskWeightFit`: fine + rich), and can still show the mask as a labelled fallback.
- **NR-2. Who enforces cross-field and derived rules: the adapter, or only the Lab review?** This decides whether findings 1–4, 8, 10, 11, 19 and 20 belong to the adapter.
  - Reading A: the adapter projects whatever the reviewed envelope says.
  - Reading B: the adapter must re-derive or refuse. Support for B: the adapter plan's done-when says it "validates the complete research envelope", and mask §9.5E calls echoes deterministic with no second input.
  - Example: the repo's own fixtures (moderate weight without `fine`) pass today under Reading A.
- **NR-3. What defines the presence flags?**
  - Mask standard §10: "deterministic lexicon lookups".
  - Mask adapter doc and code comment: "rules shared with / identical to the leave-in v1.0 adapter".
  - The code is neither. Mask adds silk/sericin and drops dipropylene glycol. Leave-in and conditioner flag Dipropylene Glycol but not Hydrolyzed Silk. Conditioner has no flag lexicon at all.
  - Example: `Dipropylene Glycol` is a humectant for leave-in and conditioner but not for mask. `Hydrolyzed Silk` is a protein for mask only.
- **NR-4. MAD-1 status and the moisture projection.**
  - The mask README lists MAD-1 as "Needs Nick's ruling".
  - The adapter doc says "ruled 2026-10-07" and adds `moisture_softness`.
  - Standard §9.5 provenance and §9.9 say moisture "reaches production only via `balance_direction`… no adapter change is needed".
  - No `plans/` record of the 2026-10-07 ruling was found.
  - Example: #09 Balea Aqua Hyaluron (focus moisture) projects `moisture_softness`.
- **NR-5. User-side `balanced` target vs product-side `balanced`.**
  - User side: Stage-3 defaults the user's conditioner care direction to `balanced` when there are no clear signals (`personal-plan/categories/conditioner.ts:184`).
  - Product side: v1.6 reserves `balanced` for a substantive protein-plus-moisture formula, "not an uncertainty bucket". 1 of the 11 calibrated conditioners is `balanced`.
  - Mechanism: the adapter writes one balance row per product, and Stage-3 requires an exact thickness+direction row (`catalog-facts.ts` `selectConditionerSpec`). A `balanced`-target user therefore gets `known_mismatch` on every adapter-researched moisture conditioner. Meanwhile `careDirectionAxisFitResult` and the chat path call balanced-vs-moisture "caution/close".
  - Example: a user with a healthy pull test and no concerns, offered a v1.6 moisture conditioner. Stage-3 says "Keine Produktvariante deckt deine Haardicke und Pflegerichtung gemeinsam ab."
- **NR-6. "(Water, Eau)" tokenization.**
  - Lexicon §0.4 treats "(Water, Eau)" as one alias parenthetical.
  - The adapter rule splits on every comma that is not between two digits. Real #02 Gliss 7 Sekunden is stored as `AQUA (WATER` + `EAU)`, which inflates rank positions by one.
  - This does not affect projection today, but it would affect any future rank-based check.
- **NR-7. Mask repair axis differs between paths.**
  - The chat path matches repair on `concentration` (= conditioning level under D1; `recommendation-engine/categories/mask.ts:322`).
  - Stage-3 matches on `repair_support_level`. The standard flags this as "a production-policy question outside this project".
  - Example: calibrated #03 Bali Curls SOS (conditioning high, repair low). For a high-repair user the chat path calls it an exact concentration fit, while Stage-3 gives a two-step repair caution.

## (d) Untestable gaps

- **No deterministic classifier.** §9.1–§9.5 (mask) and §10.1–§10.3 (conditioner) are applied by an LLM. Only frozen calibration artifacts test them; any new-product drift is caught by human Lab review alone.
- **Mask intake is not wired** (`category-research-router.ts:174`). Production mask specs are still hand-written by the model with no echo, bond or lexicon validation. That is strictly weaker than the latent adapter findings above.
- **E17 formula-level exclusion.** The adapter trusts `categoryBoundaryStatus` and never scans the INCI for pigments (e.g. `CI 60730`) or bond-protocol chemistry.
- **Conditioner §10.1 conflict fallback and the §10.3 focus hierarchy** need claim or finished-product evidence that the envelope does not carry.
- **Lab review-state G7 fingerprints** are a local Lab path, covered by existing tests. They were not exercised here.
- **Supabase-backed retrieval** (`product-matching/matcher.ts` strict thickness+PMB pairs, Stage-3 catalog loading against live rows) was not run. That would need a DB, and the audit stayed offline.
