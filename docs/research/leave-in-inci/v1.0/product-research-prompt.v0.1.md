# Ready-to-run Leave-In product research prompt v0.1 (skeleton)

> **SUPERSEDED (2026-09-14).** This v0.1 guide predates the trim/freeze to the
> 13-dimension, `leave-in-research-envelope-v1.0` standard and **must not be
> followed** for current research. The operative research contract is the
> worker's `leave_in_research` prompt contract
> (`src/lib/product-intake/leave-in-research-prompt-contract.ts`) under the
> frozen Leave-In Standard v1.0 (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`).
> This file is kept for history only.

Status: **pre-calibration skeleton.** The standard it executes (`leave-in-classification-standard.v0.1.md`, engine `leave-in-inci-v0.1`) is not locked and no anchor has been blind-tested. Every record this prompt produces is a **draft research artifact**: it writes nothing to the catalog, changes no recommendation, and creates no user-facing copy.

Research **one** exact Germany/EU leave-in product using the Leave-In Research and Classification Standard v0.1. Read the standard before starting; the section references below are load-bearing and this prompt does not restate their content.

---

## Required order

1. **Run G0, the product-form gate, first.** Classify by function + authoritative directions + formula architecture, never by name (§2.3). Stop with `excluded_anhydrous` (no leading Aqua → oil/serum), `excluded_styling_first` (a fixative-class route with thin conditioning behind it → styling), or `excluded_other_form` (rinse-out, mask, co-wash, scalp/medicated, color-depositing, salon chemistry). A genuinely ambiguous product becomes `provisional_boundary`: complete the record, mark every affected field uncertain, and route to human review. "Serum" in the product name is not an architecture — verify the formula.

2. **Run G1, the identity gate** (§2.4). Resolve product UUID, exact brand/name, market, pack size, a reliable identifier or a documented gap, dated exact-market formula source, product-form status and source conflicts. Preserve conflicts; do not resolve them by preference.

3. **Resolve authoritative application directions** using the source hierarchy: user package → German/EU manufacturer → exact-GTIN German retailer → other German/EU retailer → secondary discovery only. Directions are **E1 evidence in this category**, not metadata, because `usage_role` is read from them.

4. **Preserve raw INCI and the normalized formula fingerprint.** Record literal formula observations only — exact INCI names with captured list positions, or a precise absence pattern.

5. **Determine FORM** against the five-architecture table (§7.1). Record the marketing form word separately as `presentation_form` metadata; it carries no decision weight.

6. **Evaluate routes L1–L9** (§5) with counter-signals, and assign `shared_mechanism_ids` from M1–M7 (§6) before comparing any endpoints.

7. **Produce the 13 scored dimensions** (§7), each with value, E-level, confidence, evidence scope, rationale, `formula_observations[]`, `product_inferences[]`, `counter_signals[]`, `threshold_reasoning[]`, `limitations[]`, sources and review state. `threshold_reasoning[]` must explain why the evidence clears the selected value **and** why the nearest lower or higher alternative does not. Generic "formula-derived" or value-restating reasoning is invalid.

8. **Produce the demoted flags and derived values** (§8): SHN as a qualifier on SFR only; CURL derived from HOLD + COND + WT; R3 as a flag; LAYER as at most one caution string; the buildup caution bound to the PERS evidence.

9. **Classify `care_direction`** (§9): `protein` needs a materially present substantive protein/peptide/silane film route beyond ordinary conditioning; `moisture` needs a coherent conditioning/humectant/emollient architecture with no dominant protein-film route; `balanced` needs a substantive **mixed** architecture and is neither a fallback nor an uncertainty bucket; `unknown` when neither direction is materially readable. Panthenol alone never sets `protein`; a humectant name alone never sets `moisture`. Never describe this as a diagnosed user deficiency, and never let it drive weight, persistence, hold or heat matching.

10. **Project the lean matching profile** (§10) from reviewed direct properties only, using the exact vocabulary and the §10.1 projection rules. Every field carries its own evidence object, `evidence_basis`, `derivation` and `derived_from[]`. Derived fit fields cite their upstream weight/conditioning/slip/hold inputs and remain **broad priors**, never universal exclusions.

11. **Write `rationale`, `threshold_reasoning[]`, `derivation` and `limitations[]` in English.** Emit user-facing cautions in **German**, following the §18 patterns. `threshold_reasoning[]` is the compact review headline and must stand alone without opening the detailed evidence block.

12. **Return the record in the `leave-in-research-envelope-v0.1` envelope** (five-part conditioner shape: `version, researchMethod, identity, formula, profile`), fail-closed on validation.

---

## Standing rules the researcher may not relax

**Evidence caps**

- Formula-only evidence never exceeds **E2**; a claim alone is **E0** (G4).
- An E3 record missing dose (g/g), damp-vs-dry, drying method or ambient RH is **downgraded to E2** (§3.2).
- Rinse-out, shampoo, pre-wash-oil and in-salon evidence enters **only at E2, as mechanism** (G8). It is never an upgrade path. Legality of an EU claim means a dossier exists, never that a test exists.
- No exact percentages, ratios, pH, molecular weight, droplet size, viscosity grade, deposition amount, manufacturing process or active dose from an INCI list.

**Weight and form**

- **FORM never sets WT** (G9). "Spray ⇒ light", "cream ⇒ heavy", "clear ⇒ light" and "no emulsifier ⇒ no lipid load" are hard failures.
- WT may reach `moderately high` confidence only when FORM resolves **and** the non-volatile architecture is readable above the 1 % tail.
- Any fine-hair residue threshold applied is a **product judgment call** and must be labelled as one in `limitations[]`.

**Persistence**

- PERS is an **ordinal mechanism class**, never a duration, wash count, applications-to-buildup figure or clarification schedule (G11).
- The buildup caution comes from the **same** evidence as PERS and may not contradict it (G3 rule 4).
- The circulating removal percentages ("0.3–0.7 % after five applications", "89 % removed in one wash", "no silicone after 8 shampoos") are untraceable and **banned from any record**.

**Heat (§13, G10)**

- Research trace: `not_claimed` / `claim_only` / `formula_plausible` / `product_tested`.
- `formula_plausible` requires a member of the **closed L9 list**: VP/Acrylates/Lauryl Methacrylate Copolymer · Polyquaternium-55 · PVM/MA Copolymer with Polyquaternium-28 · PVP/DMAPA Acrylates Copolymer · Quaternium-70 · hydrolyzed wheat protein. Generic silicone, generic protein, panthenol and oils stop at `claim_only`.
- Production output is the **binary** `provides_heat_protection`, claim-led: a claim normally yields `true`. Run the formula sanity-check anyway — **a claim with no L9 member yields `true` plus a mandatory human-review route** with a "claim looks formula-unsupported" note. A formula with no claim never manufactures one.
- **Never grade efficacy. Never emit or consume `heat_protection_max_c`.** A "bis 230 °C" figure is a use-condition statement, not a protection level.

**Humidity**

- HUM is a 4-state evidence flag, never a score. `formula_plausible` needs a hydrophobic continuous film route with a plausible water-uptake-reduction mechanism **and** no dominant humectant architecture.
- **Humectant presence is a counter-signal**, never support. **Never encode a dew-point threshold.**

**Repair and bond**

- R2 `candidate` needs an identifiable substantive route (cationised protein, silane derivative, silicone quat, high-charge cationic polymer) in a plausible film context. Generic gums, starches, rheology polymers and tail-position plain hydrolyzed proteins do not qualify.
- Panthenol is a **fibre-mechanics** signal only — not R2, not heat.
- A named bond chemistry opens the R3 review flag and **never sets a repair level**. "K18"/"Plex"/"Bond" naming is E0.

**Hold and the styling boundary**

- HOLD is the 3-state `none` / `incidental_film` / `meaningful_hold_route`. **Never grade hold level.**
- A gum, starch, Carbomer, Xanthan Gum, Hydroxyethylcellulose or Acrylates/C10-30 Alkyl Acrylate Crosspolymer plausibly serving bottle viscosity is **not** a hold route.
- `meaningful_hold_route` routes the record back to the G0 styling-boundary decision and to human review.

**Anti-double-counting (G3)**

- Group evidence by shared mechanism before comparing endpoints. One mechanism does not independently score conditioning, slip, smoothing, shine, weight and persistence.
- SHN may not carry an independent value that restates the M3 consequence of the M1/M2 film.
- DOSE is derived from WT + FORM + spreading class; it does **not** additionally modify `hair_thickness_fit`. It emits a German dosing caution instead.
- A "10-in-1" label is not ten mechanisms.

**Exposure and medical (G6)**

- EXPO flags are **exposure statements**: `fragrance_declared` / `aromatic_or_allergen_exposure` / `no_listed_fragrance_signal` / `unknown`, plus a note for materially present alcohol.
- "No listed fragrance signal" is not fragrance-free, not allergy-safe and not hypoallergenic. **Sensitive-scalp tolerance is not derivable from an INCI list.**
- No diagnosis, treatment, hair-loss lifecycle, inflammation, infection or structural-regeneration suitability. Keep cosmetic guidance separate from medically adjacent scalp or hair-loss guidance.

**Regulatory durability (G12)**

- Key every rule on **function** — "a volatile carrier is present" — with the INCI family enumerated. Never write a rule that depends on Cyclopentasiloxane being present; that signal decays under Regulation (EU) 2024/1328 from **6 June 2027**.
- Stamp `regulatory_re_review_trigger: 2027-06-06` on any record whose anchors mention a cyclosiloxane.

**Catalog boundary**

- **Do not use current catalog labels as input.** Existing leave-in spec values are legacy heuristics, not research-engine output; they are comparison-only and never break a tie.
- Do not hand-author production schema fields. A deterministic adapter derives current-schema values from the reviewed profile at a separate, later gate.
- Preserve exact application area, frequency wording, amount, damp-vs-dry instruction and reapplication guidance as **protocol metadata**, independent of the profile.

---

## Mandatory human-review routes (§14)

Emit `review_status: specialist_review_required` and stop short of an approved record for:

- any `provisional_boundary` G0 result, or `HOLD = meaningful_hold_route`;
- a heat-protection claim with **no L9 member**;
- a proprietary bond/repair claim (R3 `chemistry_candidate`);
- a formula-source or identity conflict, or an absent exact-market formula/identifier;
- root or scalp application, or any medically adjacent framing;
- a fragrance-free or hypoallergenic implication;
- routine-level efficacy evidence offered for a single leave-in;
- a two-phase product (least dose-predictable form);
- `PERS = permanent_cationic` combined with a `refresh` usage role;
- any proposed hard user-fit rule, or any attempt to replace a production field.

## Output contract

Return two blocks:

1. **`research_trace`** — G0/G1 states, identity, raw INCI plus fingerprint, directions with their source, routes L1–L9 with mechanism IDs, all 13 dimensions, the demoted flags and derived values, `care_direction`, per-field evidence objects, per-field unsalted SHA-256 fingerprints (G7), and the open-limitation list inherited from §17.
2. **`matching_profile`** — the §10 lean profile inside `leave-in-research-envelope-v0.1`, with `cautions[]` in German, `uncertain_fields[]`, `assumption_notes[]`, `category_standard_version: "leave-in-inci-v0.1"` and the versioned whole-profile fingerprint.

**Explicit unknowns beat confident guesses.** When evidence is mixed, keep the output conservative, name the uncertainty, and let the review route carry it.

## Re-research triggers (§16)

Formula fingerprint change → reopen the fields whose per-field fingerprints no longer match. GTIN/identifier change → new identity, re-run G1 and re-verify the formula. Directions change → reopen ROLE, `scalp_application_fit` and placement/frequency cautions. Category-boundary change → re-run G0 across the cohort. Standard-version bump → reopen only the fields whose rules changed. L9 list change → re-review every record carrying a heat claim. **2027-06-06** → §15.
