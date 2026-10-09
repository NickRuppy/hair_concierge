# Shampoo classification v1.6 (candidate)

Status: **revised for round 2 (2026-10-09). Draft candidate, not locked, not production-active.** Earlier revision 2026-10-07 implemented Nick's rulings R2–R6. Nothing here changes the catalog, Supabase, Production Light or recommendations.

What this is: one self-contained standard. It merges the frozen v1.4 method (`../v1.4/`, unchanged) with the Focus v1.5 overlay Nick approved on 2026-09-03, which adds `moisture`, retires `gentle` as a focus and adds the formula-first care-direction rule. It also adds Section 13, *Production projection assessment*. Section 13 writes down the rules for thickness fit (three tiers: green, amber, not shown), the projected live `weight`, scalp targets, cleansing intensity and deep-cleanser dual listing; these used to be unwritten researcher judgment. It also adds the no-gap apply gate and the exception register. Every uncertain rule fails toward the cautious value or to Nick's review, never toward recommending a product.

Round-2 revision (2026-10-09):

- **Full weight method merged (Section 6).** The v1.4 README lists three consolidated sources. The weight one, `../../../docs/research/shampoo-inci/v1.4-draft/weight-potential-final-method.md` (`shampoo-weight-final-v1`), had been wrongly treated as provenance only. Round 1 showed both lanes rating weight lighter than the method's own reruns. Section 6 now carries that method in full; Nick ruled to add it. The route-count rule and "a polymer means moderate" stay out.
- **Operational amendment detail merged.** The focus, secondary and usage operating rules and the decision trace from the v1.4-draft operational amendment are now in Sections 7–9. Its superseded route-count weight section is not carried.
- **Round-1 ambiguities closed.** About 50 lane-reported ambiguities now have general rules: the neighbor criterion, surfactant conventions, the claim-source grading, the scalp-claim lexicon and claim units, S-FAIL/S-FOCUS/S-ORDINARY, direction-aware I3, the D1 lexicon, and catalog ids resolved after the lanes. No rule was tuned to a calibration product or to the live catalog. Each change is a row (43–86) in the changelog.
- **Three new questions for Nick** (3–5 in `open-questions.md`). The cautious answer applies until he rules, so round 2 can run without them.

| File | Purpose |
| --- | --- |
| `classification-standard.md` | The full normative candidate, with rule IDs that calibration lanes cite. |
| `changelog-vs-v1.4.md` | Every change from v1.4, with its source (ruling, weight method, or the round-1 ambiguity it closes) and whether it could change a live value. |
| `open-questions.md` | What R2–R6 settled, the two remaining live-display questions, and three new product questions from round 1, each with an example and a recommendation. |

Relationship to earlier versions:

- **v1.4** stays the frozen research method, and the shipped Production Light adapter stays pinned to it. The v1.4 README names three consolidated sources: the v1.4 standard, the v1.4-draft operational amendment and the v1.4-draft final weight method. All three are now merged here; only the amendment's superseded route-count weight section is left out.
- **v1.5** was a focus-only overlay. This candidate absorbs it, so a separate v1.5 overlay is not needed for v1.6 work.
- **v1.3, the v1.4-draft route-count weight calibration (`shampoo-weight-v1`), holdout-v1 and holdout-v2** are provenance only. Holdout-v3 adjudications are used only where they settled a rule question; its operator clarifications stay non-normative explanation (F2 was adopted earlier as a rule).

Next: round 2. Two sealed lanes run on the gold set. The unseen check uses fresh products, because round 1 already exposed the earlier unseen set to rule fixes. Nick adjudicates. Then the standard is locked as `shampoo-classification-v1.6` with a hash-pinned receipt, and the adapter is re-pinned in a separate reviewed change. Questions 1–2 must be settled before the R2 `weight` PR; questions 3–5 before any catalog apply. See `plans/shampoo-v16/plan.md` (decisions D1–D9).
