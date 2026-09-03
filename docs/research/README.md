# Research engines

Index of Chaarlie's ingredient/input-based product research engines. Each engine turns an exact product identity plus canonical INCI into explainable direct product properties, kept strictly separate from user fit and from catalog/production activation.

For agent routing (which engine applies to a product, and what to do when none exists), see the repo skill `.agents/skills/product-research-engine/SKILL.md`.

## Category engines

| Category | Engine status | Method docs | Intake bridge | Projection |
| --- | --- | --- | --- | --- |
| Shampoo | v1.4 parked research method; **Production Light v1** active for intake | [shampoo-inci/](./shampoo-inci/README.md) (active: `v1.4/`) | [Shampoo Production Light v1](../product-intake-shampoo-production-light.md) | `src/lib/shampoo/production-light-adapter.ts` — `npm run research:shampoo:production-light` |
| Conditioner | Standard **v1.6 logic-locked**; Production Adapter v1 active for intake | [conditioner-inci/](./conditioner-inci/README.md) (artifact root: `v1.0/`) | [Conditioner Production Adapter v1](../product-intake-conditioner-production-adapter.md) | `src/lib/conditioner-research/production-adapter.ts` — `npm run research:conditioner:production-adapter` |
| Mask, Leave-in, Oil, others | No engine yet | Start from the [category template](./category-classification-engine-template.md) | — | — |

A category without an engine still goes through the standard Product Intake research contract in `docs/product-intake-research-ops.md`; the engines add the deeper formula-first methodology on top, they do not replace intake. Batch additions of scannable, non-recommended products run through the scan-DB-expansion lane (`docs/scan-db-expansion-playbook.md`), which consumes engine research where an engine exists. The lane map lives in `docs/product-intake-research-ops.md` ("Which Workflow Am I In?").

## Shared invariants

Every engine, current and future, holds these rules (the template expands them):

- **Blind formula-first.** Classify from exact identity + canonical INCI before unblinding positioning; claims may only influence explicitly claim-gated properties.
- **Product truth ≠ user fit.** Direct product properties are never tuned to improve profile coverage, assortment balance, or agreement with previous expert labels.
- **Evidence ceiling.** Ingredient presence proves a clue, not concentration, delivery, or user experience. Confidence measures classification robustness, not clinical accuracy.
- **Immutable artifacts.** Frozen runs, cohorts, and receipts are provenance; changes produce overlays or new versions, never silent rewrites.
- **Research stops before activation.** No engine writes to Supabase or production. Activation is a separate, explicitly approved decision through Product Intake's guarded handoff.

## Other documents in this directory

- [category-classification-engine-template.md](./category-classification-engine-template.md) — the 12-section template for bootstrapping a new category engine.
- `goal-concern-levers/` — separate goal/concern research, not a category engine.
- Dated one-off research reports (latency, post-payment) — point-in-time references.
