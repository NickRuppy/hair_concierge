---
name: product-research-engine
description: Use when researching product properties with an ingredient/INCI-based research engine — classifying a new Shampoo or Conditioner from its formula, running or replaying a production projection (Shampoo Production Light, Conditioner Production Adapter), working on classification standards/runbooks under docs/research/, or bootstrapping a research engine for a new category.
---

# Product Research Engine

## Purpose

Route formula-first product research to the correct category engine and hold every run to the shared engine invariants. This skill is the router; the normative rules live in the versioned category docs and must not be restated or paraphrased here.

## Category routing

Determine the product's category first, then load the category's contract of record:

| Category | Engine | Contract of record (read before acting) | Production projection |
| --- | --- | --- | --- |
| Shampoo (regular, German market) | Shampoo v1.4 + Production Light v1 | `docs/research/shampoo-inci/README.md` → `v1.4/classification-standard.md` + `v1.4/new-product-research-runbook.md`, then `docs/product-intake-shampoo-production-light.md` | `npm run research:shampoo:production-light` |
| Conditioner (conventional rinse-out, DE/EU) | Conditioner Standard v1.6 + Production Adapter v1 | `docs/research/conditioner-inci/README.md` → `v1.0/conditioner-classification-standard.md` + `v1.0/runbook.md`, then `docs/product-intake-conditioner-production-adapter.md` | `npm run research:conditioner:production-adapter` |
| Any other category (mask, leave-in, oil, …) | **No engine yet** | `docs/research/category-classification-engine-template.md` | — |

Routing rules:

- The category README is the authority index; the semantic standard version inside it wins over folder names (Conditioner: artifact root `v1.0/`, standard v1.6).
- Never mix engine versions or resurrect superseded rules (e.g. Shampoo route-count weight logic, "polymer means moderate").
- A category boundary exclusion (e.g. deep-cleansing shampoo in the Shampoo engine, non-rinse-out conditioner forms) blocks the engine lane; record the boundary evidence instead of fabricating a profile.
- Products in categories without an engine follow the ordinary Product Intake research contract (`docs/product-intake-research-ops.md`); do not improvise a pseudo-engine for them.

## Shared engine invariants

These hold for every engine, current and future. The category standard defines the specifics; this list is the checklist that a run has not drifted:

- **Blind formula-first.** Exact identity + canonical INCI is resolved and frozen before positioning/claims are unblinded; claims influence only explicitly claim-gated properties.
- **Product truth ≠ user fit.** Never tune direct product properties to improve profile coverage, assortment balance, or agreement with prior expert labels. Fit is a separate deterministic layer.
- **Evidence ceiling.** Ingredient presence proves a clue, not concentration, delivery, or user experience. Confidence measures classification robustness; never invent percentages.
- **Immutable artifacts.** Frozen runs, cohorts, receipts, and holdouts are provenance. A rule change produces an overlay or new semantic version plus synchronized guide updates — never a silent rewrite.
- **Guidance synchronization.** A reusable rule change updates the normative standard and every consuming guide (prompt, agent context, quick reference, runbook) before the next batch.
- **Research stops before activation.** No engine command writes to Supabase or production. Projection readiness (`property_lane_ready` / `projection_ready`) is not catalog intake readiness, global recommendation readiness, or publish approval. Guarded publish belongs to the `product-intake` skill and Nick's explicit final handoff.

## Relationship to other skills

- `product-intake` owns identity/brand review, images, price/link sourcing, protocols, review-center operations, and the guarded publish. This skill owns only the formula-research lane that feeds it.
- `hair-care-expert` owns external evidence research. Keep external evidence independent from internal engine methodology unless Nick explicitly asks for reconciliation.

## Bootstrapping a new category engine

Building an engine for a new category is a project, not a side effect of one product:

1. Confirm Nick explicitly wants an engine for the category (cost: charter, standard, calibration, holdout).
2. Work through `docs/research/category-classification-engine-template.md` section by section; do not copy Shampoo/Conditioner property values merely because the workflow is reusable.
3. Create a new versioned artifact root (`docs/research/<category>-inci/v1.0/` + `data/research/<category>-inci/v1.0/`) with a landing README following the existing category READMEs.
4. The engine is usable for intake only after its calibration/holdout gates pass and a deterministic production adapter with its own intake bridge doc exists.
5. Register the new category in `docs/research/README.md` and in this skill's routing table.

## Operating rules

- Read the routed contract of record before researching, changing rules, or running projections; if it is missing, stop and tell Nick rather than improvising.
- Keep new research runs in new versioned artifacts; never overwrite or regenerate frozen historical results.
- Report projection warnings as visible review issues, not hidden defaults.
- Application protocols come from authoritative product directions, never derived from INCI.
