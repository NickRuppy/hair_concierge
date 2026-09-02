# Shampoo new-product research runbook

Use this runbook to test the locked Shampoo v1.3 method on a **new German-market regular shampoo**. It operationalizes the standard; it does not replace or relax it. See the [classification standard](./02_Classification_Standard_Agent_Context_v1.3.md) for scoring and evidence rules, and the [holdout plan](../../../../plans/2026-08-26-shampoo-new-product-holdout.md) for the ten-product proof.

This is research only. It creates no catalog row, Supabase record, product projection, recommendation change, user-facing copy, release, or production activation.

## Version routing

Use this file as the reusable operator sequence. For any new run after holdout-v1, apply the [v1.4-draft operational amendment](../v1.4-draft/operational-amendment.md) with policy ID `shampoo-classification-v1.4-draft` unless a newer policy supersedes it. The original v1.3 holdout commands and history remain valid for reproducing holdout-v1; do not rewrite v1.3 or holdout-v1 artifacts to match the v1.4-draft rules.

The v1.4-draft overlay keeps the source hierarchy, direct-property boundary, evidence records and locked dandruff rule from v1.3. It only hardens `focusPrimary`, `focusSecondary`, `usageRole` and `weightPotential` and requires a research-only decision trace for those fields.

For final weight-only review, use [`shampoo-weight-final-v1`](../v1.4-draft/weight-potential-final-method.md). Reuse the existing canonical formula; this is a reinterpretation of the formula's weight potential, not a new source-research pass. The final method keeps ingredient recognition and position extraction as evidence, but requires whole-formula judgments for deposition load, persistence and reset capacity plus counterevidence, neighboring-band rationale and confidence before selecting `low`, `moderate` or `high`.

[`shampoo-weight-v1`](../v1.4-draft/weight-potential-calibration.md) remains reproducible as the earlier route-rule calibration. Its route-count thresholds and position windows are superseded for final conclusions and must not decide a future formula band by themselves. Save any final rerun separately from existing v1/v2 audit files. A same-product calibration deliberately reuses the frozen cohort and therefore does not apply the new-product overlap exclusion below; it does require exact membership and formula-fingerprint checks. It must not be reported as a new holdout.

The local weight evaluator/report command is:

```bash
node --import ./tests/server-only-register.cjs --import tsx scripts/shampoo-research/calibrate-weight.ts
```

It reads the frozen ten-product packet plus two independently saved weight-label sets and prints the comparison without changing product data. Only `--write` may write its JSON/Markdown reports, and only inside `data/research/shampoo-inci/weight-calibration-v1/`. These reports are provisional historical research output, not replacement analyses, approvals, import payloads or final-method conclusions. Review route-extraction completeness and position sensitivity even when labels agree. Rule-application confidence and INCI-only product confidence are separate; agreement does not raise the latter.

## 1. Pre-register and resolve identity

Record the candidate's exact German name, brand, market (`DE`), pack size, known GTIN/EAN aliases, selection archetype, selection source and capture date. Use the protocol-specific research ID, for example `holdout-v1:<candidate_id>` for holdout-v1 or `holdout-v2:<candidate_id>` for the v1.4-draft test, and keep `catalogProductId: null`; never invent a UUID.

Before researching, reject any candidate that overlaps the frozen v1.3 cohort by either:

- normalized `brand + exact product name`; or
- any GTIN/EAN alias.

For holdout-v2, apply the same overlap checks to holdout-v1 as well. Both predecessor manifests must be readable; missing history is a blocker, not evidence that the product is new.

Exclude an exact deep-cleansing product from this regular-shampoo batch. Record the evidence for that exclusion from its category or usage language, rather than guessing from a name alone.

For a current German formula, resolve sources in this order:

1. A photo/transcription of the exact German pack, if available for the exact GTIN.
2. The current German manufacturer/brand page for the exact variant and size.
3. A preferred German retailer page for the exact variant/GTIN, only when the manufacturer formula is unavailable or as corroboration.

Keep every conflicting material formula visible in provenance. A current, exact German manufacturer formula is canonical over retailer evidence. If exact pack evidence conflicts, exact-pack evidence wins for that GTIN. Do not combine lists across GTINs, sizes, markets, or reformulations. If identity or the material formula conflict cannot be resolved, mark the candidate blocked, retain its evidence, and replace it from the pre-registered reserve list; never force a classification.

## 2. Formula-first analysis, then claims

Create a formula packet containing only normalized raw INCI, formula fingerprint, source IDs, formula architecture, exposure facts and the standard. Remove product name, brand, claims, marketing copy and source URLs.

1. A fresh labeler completes `blind-pass.json` from that packet: observations, score ranges, provisional values for all eight properties and concise reasons. Persist its payload hash before unblinding.
2. Then reveal the exact identity and read manufacturer claims. Add the claim audit and final analysis. Claims can describe intended use or evidence scope, but cannot override a contradictory formula conclusion. Under v1.4-draft, claims select the primary intended direction only after the formula gates that direction as compatible.
3. If a value changes, retain the blind value and write a `finalDelta` with the final value and reason. Ordering is transcript-backed process evidence, not cryptographic proof of time.

The eight direct formula-derived properties are:

| Property | Allowed values |
| --- | --- |
| `cleansingStrength` | low, moderate, strong |
| `conditioningLevel` | low, moderate, high |
| `weightPotential` | low, moderate, high |
| `focusPrimary` | volume, shine, repair, clarifying, scalp_active, gentle, general |
| `focusSecondary` | zero to two distinct values from the primary-focus vocabulary |
| `usageRole` | frequent, regular, alternating, occasional_reset, treatment |
| `scalpComfortTarget` | targeted, not_targeted, unknown |
| `dandruffSupport` | supported, not_supported, unknown |

Each property must be a direct product-property conclusion, cite eligible formula evidence and include a concise German rationale with support and counter-signals. Derived user fit is a later result, never a substitute for a missing direct property.

`dandruffSupport` is the locked formula rule, not a marketing inference: the normalized INCI yields `supported` only when it contains **Piroctone Olamine** or **Climbazole**; a complete list without either yields `not_supported`; an empty or opaque formula yields `unknown`. Dry flakes and scalp comfort remain separate questions.

For v1.4-draft:

- `focusSecondary` defaults to empty and should be filled only for a distinct secondary claim plus independent formula route; two values require the explicit multi-benefit exception.
- `usageRole` defaults to `regular`; non-default roles require the trigger table in the amendment.
- `weightPotential` follows [`shampoo-weight-final-v1`](../v1.4-draft/weight-potential-final-method.md): deposition load, persistence and reset capacity are assessed from the whole formula; ingredient recognition is a trigger for assessment, not a label rule.
- the final post-unblind record must include `blind-pass.json.ruleApplication.policyVersion = "shampoo-classification-v1.4-draft"` and the four-property trace defined in the amendment.

## 3. Validate before reviewing fit

Keep `analysis.json` as `provisional`. Passing validation creates only a `validator_passed_preview`; it is not a human approval and must not be presented as `approved` or imported.

Run from the task worktree:

```bash
npm run research:shampoo:validate-holdout-v2
npm run research:shampoo:report-holdout-v2
```

The commands without `-v2` reproduce holdout-v1 only. Do not use them to evaluate a v1.4-draft run.

The commands use the holdout root and must not generate or overwrite `src/lib/shampoo-research/generated-artifact-index.ts`. They check identity namespace and overlap, source/provenance and formula fingerprint, all eight properties and exposure flags, formula-derived dandruff support, blind-pass hash/delta, complete sources, and agreement/report completeness.

Replay the validator-passed preview against the hash-pinned 18 de-identified profile fixtures. Label the result `new_product_no_legacy_baseline` until Product Intake has reconciled an exact catalog product. The preview harness deliberately supplies the in-memory approval state needed by the existing fit engine after validation, so approval-state abstention is not an empirical holdout check. Preference and occasional-reset abstentions are legitimate output; `identity_unresolved` and `material_formula_conflict` are failures to resolve before the batch report.

## 4. Independent repeatability check

Give an independent, fresh labeler the post-unblinding evidence packet and standard, but never the first labeler's values. Brief it to challenge weak calls. Store its values and rationales in the root `agreement.json`; compare all seven judgment-based properties across all ten products (70 decisions), using normalized set comparison for `focusSecondary`. Report formula-derived `dandruffSupport` separately.

Adjudicate every disagreement as one of:

| Rule-gap outcome | What to do |
| --- | --- |
| product correction | Correct this artifact and preserve the reason. |
| source or identity failure | Resolve/re-source it, or block and replace the candidate. |
| researcher-process ambiguity | Tighten the packet, instructions or review sequence. |
| systematic rule gap | Amend the normative standard, then rerun the complete cohort; never patch only the convenient product. |

The holdout passes only at **at least 75% exact agreement overall**, **at least 60% for every judged property**, and **zero unresolved identity or audit failures**. Passing demonstrates rule repeatability—not clinical validity or user-outcome accuracy—and does not replace Nick's product-by-product approval.

## 5. Review, reserve and catalog hand-off

The reviewer approves or sends back the final provisional analysis only after the source chain, blind/final delta, eight evidence records, independent comparison and profile preview are legible. Approval in this research flow is not catalog publication.

If a slot blocks, record the failed selection and reason, then use the first identity-resolved reserve from that run's pre-registered manifest that preserves the missing archetype where possible. Never reuse the first holdout's reserve list automatically or substitute after seeing agreement scores.

When a product should enter the catalog later, Product Intake—not this runbook—reconciles the exact identity to a real catalog UUID, captures any required commercial data, and produces a new catalog-linked artifact. The historical holdout record stays immutable; do not retrofit its namespaced ID or use it as an import payload.

## Stop boundary

Stop after local holdout artifacts, validation, profile preview, agreement report and human review. Ask for separate authorization before catalog creation/reconciliation, any database import, projection into `product_shampoo_specs`, recommendation changes, user-facing integration, commit, push, deployment or activation.
