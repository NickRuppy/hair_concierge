# Mask research engine — kickoff handover v1.0

Date: 2026-09-04. Owner: Nick. Prepared by the research-docs-structure session (PRs #513/#515).

## Mission

Build the **Mask ingredient-research engine** to the repo's standardized engine shape, so a previously unknown German/EU rinse-out mask can be classified formula-first with evidence, then projected deterministically into the existing production Mask fields. The engine stops at a research artifact; catalog activation stays a separate Product Intake decision.

The five layers every engine must end with (see the built examples):

1. `docs/research/mask-inci/README.md` — landing page with authority table
2. `docs/research/mask-inci/v1.0/` — charter, classification standard, runbook, consuming guides
3. `data/research/mask-inci/v1.0/` — frozen cohort, calibration artifacts, lock receipt
4. `docs/product-intake-mask-production-adapter.md` — intake bridge (envelope → projection)
5. `src/lib/mask-research/production-adapter.ts` — deterministic projection into current DB fields

Integration on completion: one row in `docs/research/README.md`, one row in `.agents/skills/product-research-engine/SKILL.md` routing table.

## Read order (do this before any research)

1. `.agents/skills/product-research-engine/SKILL.md` — the router; its "Bootstrapping a new category engine" section is this project's contract.
2. `docs/research/README.md` — engine index + the owning list of shared invariants.
3. `docs/research/category-classification-engine-template.md` — the 12-section shell. The deliverable standard is this template, filled for Mask with mask-specific evidence.
4. **The Conditioner engine, in depth — the primary worked reference** (closest category: rinse-off lengths treatment):
   - `docs/research/conditioner-inci/README.md` — authority map
   - `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md` — the nine-property model, thresholds, evidence ceiling, confidence semantics
   - `docs/research/conditioner-inci/v1.0/runbook.md` — Stage A procedure, blind-lane design, Lab review order, guidance-synchronization rules, Damage Fit boundary
   - `docs/research/conditioner-inci/v1.0/04_focus-selection-decision-guide.md` and `conditioner-disagreement-log.md` — how ambiguity was actually adjudicated; the richest source of transferable judgment
   - `docs/research/conditioner-inci/v1.0/rule-changes.md` — why rules moved; avoids re-losing fights already won
   - `docs/product-intake-conditioner-production-adapter.md` — the envelope (`conditioner-research-envelope-v1.6`) and projection pattern the Mask adapter should mirror
5. `docs/product-application-protocol-templates.md` §TPL-MASK — the normative usage rules the engine must respect, especially **P5** (Längen und Spitzen, `replaces_conditioner`, no default wait window — timing comes from packaging).
6. `docs/product-intake-research-ops.md` — category matrix row for `mask`: the exact projection targets.
7. Cross-category material from the leave-in program (branch `codex/leave-in-inci`, **unmerged** — read from `.worktrees/leave-in-inci/plans/leave-in-inci/handover/` if still unmerged): `02_Cross_Category_Ingredient_Research_Playbook_Agent_Context_v1.0.md` and `05_Generic_Product_Research_Schema_v1.0.json`. Its four kickoff rulings (conditioner parity, blind lane, archetype gold set, research-only boundary flags) are precedent for Mask too.

## Projection targets (already fixed — the adapter writes these, nothing else)

- `product_mask_specs`: `weight` (light/medium/rich), `concentration` (low/medium/high), `balance_direction` (protein/moisture/balanced/null), `ingredient_flags`, `repair_support_level` (low/medium/high), `functional_benefits` (smoothing_frizz_control, detangling_slip, shine)
- `suitable_thicknesses` (fine/normal/coarse)
- Role: `intensive_conditioning_mask`; protocol per TPL-MASK — exact wait time always from the authoritative product source, never invented from INCI.

## Conditioner parallels — reuse, but re-derive

Start from the hypothesis that the conditioner nine-property model largely transfers, then earn each property for Mask. Do not copy values or thresholds without mask-specific evidence. Model explicitly what differs:

- **Concentration and contact time**: higher actives payload, minutes-long dwell, sometimes heat-assisted — conditioner thresholds for conditioning level / weight may sit in the wrong places.
- **Cadence**: weekly treatment, not per-wash; overload/buildup and protein-overload risk are first-class counter-signals.
- **`replaces_conditioner` semantics (P5)**: on a mask day the mask takes the conditioner slot — the fit layer must not double-count.
- **Repair claims are strongest here**: the conditioner runbook's Damage Fit boundary (specialist route vs. generic-high) almost certainly needs a Mask equivalent; re-derive it, don't inherit it silently.
- **Existing `concentration` field has no conditioner counterpart** — it needs its own definition, evidence anchors, and confidence rule.

## Non-negotiable gates (owned elsewhere — links, not restatements)

- Shared engine invariants: `docs/research/README.md` (blind formula-first, product truth ≠ user fit, evidence ceiling, immutable artifacts, no production writes).
- Verification bar: rule-ID fixtures + an adversarial lane; the author's own green tests are not evidence — an independent blind reviewer lane validates the calibration set before any lock.
- Decision coverage with Nick before implementation of any standard/adapter; consequential choices (category boundary, property set, confidence semantics, projection mapping) are his rulings, recorded in a ledger like the conditioner disagreement log.
- Orchestration per `AGENTS.md`: research fan-out on cheaper models; `hair-care-expert` (opus) for external evidence; the main session briefs, reviews, integrates.

## Suggested phase plan

1. **Charter** — category boundary (include rinse-out Haarkur/Maske; exclude leave-in masks?, pre-shampoo treatments?, bond-builder overlap → boundary stress cases), market, medical boundary, 80/20 coverage target. → Nick ruling.
2. **Property set** — candidate properties vs. the fixed projection targets; deterministic vs. judgment vs. claim-gated per template §5. → Nick ruling.
3. **Standard v0 + evidence lexicon** — drafted against conditioner's, with mask deltas argued property by property.
4. **Calibration** — 10–12 diverse German-market masks, exact identities + frozen INCI; proposed key + independent blind lane; adjudicate; tighten.
5. **Holdout + stress** — small frozen holdout plus adversarial archetypes (protein bomb, silicone-heavy smoothing mask, "mask" that is really a rich conditioner, bond-builder crossover).
6. **Lock + adapter** — semantic lock receipt; `mask-research-envelope-v1.0`; deterministic adapter + bridge doc; integration rows in index and skill.

Each phase ends with a checkpoint for Nick; no phase consumes an unreviewed prior phase.

## Starting prompt for the fresh session

See `02_mask_engine_starting_prompt.md` in this folder — paste it verbatim as the first message of the new session.
