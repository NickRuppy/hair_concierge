# Shampoo classification v1.6 (candidate)

Status: **draft candidate — not locked, not production-active.** Nothing here changes the catalog, Supabase, Production Light or recommendations.

What this is: one self-contained standard that merges the frozen v1.4 method (`../v1.4/`, unchanged) with the Focus v1.5 overlay Nick approved on 2026-09-03 (adds `moisture`, retires `gentle` as a focus, formula-first care-direction rule). It also adds Section 13, *Production projection assessment*. Section 13 writes down the rules for thickness fit, scalp targets and cleansing intensity, which used to be unwritten researcher judgment. Every uncertain rule fails toward the cautious value or to Nick's review, never toward recommending a product.

| File | Purpose |
| --- | --- |
| `classification-standard.md` | The full normative candidate, with rule IDs that calibration lanes cite. |
| `changelog-vs-v1.4.md` | Every change from v1.4, with its source and whether it could change a live value. |
| `open-questions.md` | Five decisions for Nick, each with a product example, counts and a recommendation. |

Relationship to earlier versions:

- **v1.4** stays the frozen research method, and the shipped Production Light adapter stays pinned to it.
- **v1.5** was a focus-only overlay. This candidate absorbs it, so a separate v1.5 overlay is not needed for v1.6 work.
- **v1.3, v1.4-draft, holdout-v1 and holdout-v2** are provenance only. Holdout-v3 adjudications are used only where they settled a rule question.

Next: Nick reviews the open questions and the changelog (phase-1 gate). Then two sealed calibration lanes run on the gold set, Nick adjudicates, and the standard is re-run on unseen products. After that it is locked as `shampoo-classification-v1.6` with a hash-pinned receipt, and the adapter is re-pinned in a separate reviewed change. See `plans/shampoo-v16/plan.md` (decisions D1–D9).
