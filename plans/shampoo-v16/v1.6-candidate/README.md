# Shampoo classification v1.6 (candidate)

Status: **final candidate with the pre-lock rulings R15/R16 applied (2026-10-10); locked as v1.6 (R14).** The locked, normative text is `docs/research/shampoo-inci/v1.6/classification-standard.md`, pinned by `data/research/shampoo-inci/v1.6/v1.6-logic-lock-receipt.json`. This directory is the working record of how the candidate got there. Earlier revisions: 2026-10-07 implemented Nick's rulings R2–R6; 2026-10-09 prepared and closed round 2. Nothing here changes the catalog, Supabase, Production Light or recommendations.

What this is: one self-contained standard. It merges the frozen v1.4 method (`../v1.4/`, unchanged) with the Focus v1.5 overlay Nick approved on 2026-09-03, which adds `moisture`, retires `gentle` as a focus and adds the formula-first care-direction rule. It also adds Section 13, *Production projection assessment*. Section 13 writes down the rules for thickness fit (three tiers: green, amber, not shown), the projected live `weight`, scalp targets, cleansing intensity and deep-cleanser dual listing; these used to be unwritten researcher judgment. It also adds the no-gap apply gate and the exception register. Every uncertain rule fails toward the cautious value or to Nick's review, never toward recommending a product.

Round-2 revision (2026-10-09):

- **Full weight method merged (Section 6).** The v1.4 README lists three consolidated sources. The weight one, `../../../docs/research/shampoo-inci/v1.4-draft/weight-potential-final-method.md` (`shampoo-weight-final-v1`), had been wrongly treated as provenance only. Round 1 showed both lanes rating weight lighter than the method's own reruns. Section 6 now carries that method in full; Nick ruled to add it. The route-count rule and "a polymer means moderate" stay out.
- **Operational amendment detail merged.** The focus, secondary and usage operating rules and the decision trace from the v1.4-draft operational amendment are now in Sections 7–9. Its superseded route-count weight section is not carried.
- **Round-1 ambiguities closed.** About 50 lane-reported ambiguities now have general rules: the neighbor criterion, surfactant conventions, the claim-source grading, the scalp-claim lexicon and claim units, S-FAIL/S-FOCUS/S-ORDINARY, direction-aware I3, the D1 lexicon, and catalog ids resolved after the lanes. No rule was tuned to a calibration product or to the live catalog. Each change is a row (43–86) in the changelog.
- **Three new questions for Nick** (3–5 in `open-questions.md`). The cautious answer applies until he rules, so round 2 can run without them.

Post-round-2 revision (2026-10-09, lock path R13):

- **R11 applied.** The humectant part of the high-conditioning rule (C2) needs a deliberate humectant such as glycerin or panthenol; trace glycols and aloe juice never count.
- **R12 applied (option A).** Soothing, itch or tension words next to a dandruff claim never add an irritated- or dry-scalp target; live rows stay dandruff-only. When the formula also passes the sensitive-scalp formula check, the research record carries `researchCombinationTargets: ["sensitive"]` for a later profile feature (rule E2b). A separate sensitive-scalp claim keeps the old behaviour; whether it should is question 6.
- **Round-2 clarifications closed** with general rules: emulsifier-grade fatty sulfates (C3a), sparing and ingredient-reputation wording (SC1/E2a), "credible supportive architecture" (CSA), "limited reset" for rich formulas (W-RICH), W1 without amodimethicone, acrylate thickeners (6.4), neighbors for `focusSecondary`, split water entries (ID-2), foreign-language maker pages (E1), several S-ORDINARY ways (13.8), non-scalp "Sensitiv" in a name (F7). Changelog rows 87–101.

Pre-lock revision (2026-10-10, rulings R14–R16):

- **R14 (lock).** Lock approved after round 1 (97.4%), round 2 (97.1%) and the unseen check v2 (95.8%); Kokosmilch & Macadamia weight adjudicated `moderate`, Aussie Bouncy Curls stays `needs_research`.
- **R15 + R16.1 (anti-dandruff is the path).** A dandruff-primary product never projects a secondary sensitive- or dry-scalp target, whether the claim is next to the dandruff claim or separate. A separate sensitive or dry claim whose formula passes the matching check is kept as research-only `researchCombinationTargets` (`"sensitive"`, `"dry"`).
- **R16.2 (oily scalp green).** Only explicit deep cleansers (D1) with a strong formula record `clarifying`; a strong oily-scalp shampoo records `regular`.
- **R16.3 (deep-cleanser entry needs a strong formula).** A "Tiefenreinigung" name on an ordinary formula keeps only its regular entry; the review flag becomes a note.
- **R16.4 (closed lists).** E4, C2 humectant and CSA lists unchanged; additions decided in one batch after the Track A/B research.
- Changelog rows 102–108. Open questions 3–6 are ruled; 1–2 stay open for the later app PR.

Post-lock amendment (2026-10-10, ruling R17), applied in place to the locked text before publication and mirrored here:

- **R17.1 (dandruff claim + active = dandruff path, always).** A passing dandruff target is the primary target even when the product name names another target such as "Sensitive".
- **R17.2 (oily is a sub-feature too).** A dandruff-primary product projects no secondary target at all; oily-scalp suitability joins sensitive and dry as research-only `researchCombinationTargets` (`"oily"`, gate = the S-OILY formula clause).
- **R17.3 (active without a dandruff claim = regular shampoo).** Its sensitive, dry and oily paths stay open; only the note `active_without_dandruff_positioning` remains.
- Changelog rows 109–114. Not exercised by calibration lanes.

| File | Purpose |
| --- | --- |
| `classification-standard.md` | The full normative candidate, with rule IDs that calibration lanes cite. |
| `changelog-vs-v1.4.md` | Every change from v1.4, with its source (ruling, weight method, or the round-1 ambiguity it closes) and whether it could change a live value. |
| `open-questions.md` | What R2–R6, R11, R12, R15 and R16 settled, and the two live-display questions (1–2) that stay open for the later app PR, each with an example and a recommendation. |

Relationship to earlier versions:

- **v1.4** stays the frozen research method, and the shipped Production Light adapter stays pinned to it. The v1.4 README names three consolidated sources: the v1.4 standard, the v1.4-draft operational amendment and the v1.4-draft final weight method. All three are now merged here; only the amendment's superseded route-count weight section is left out.
- **v1.5** was a focus-only overlay. This candidate absorbs it, so a separate v1.5 overlay is not needed for v1.6 work.
- **v1.3, the v1.4-draft route-count weight calibration (`shampoo-weight-v1`), holdout-v1 and holdout-v2** are provenance only. Holdout-v3 adjudications are used only where they settled a rule question; its operator clarifications stay non-normative explanation (F2 was adopted earlier as a rule).

Next: the unseen check held (95.8%) and the standard is locked as `shampoo-classification-v1.6` (R14). The Production Light adapter is re-pinned in a separate reviewed change. Questions 1–2 must be settled before the R2 `weight` PR. See `plans/shampoo-v16/plan.md` (decisions D1–D9) and `docs/research/shampoo-inci/v1.6/README.md`.
