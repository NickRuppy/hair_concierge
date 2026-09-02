# Category classification research engine template

Use this document to define an ingredient/input-based research engine for one new product category. It is a planning and research template, not a generic runtime or production schema.

Shampoo v1.4 is the worked example. A new category must supply its own property meanings, evidence and validation; do not copy Shampoo values merely because the workflow is reusable.

## 1. Category boundary

Define:

- included product form and ordinary use;
- excluded adjacent categories;
- healthy/cosmetic population;
- medical or regulated boundary;
- exact market/locale;
- what counts as the same formula-bearing identity;
- initial 80/20 coverage target.

Decision:

```text
Category:
Included:
Excluded:
Market:
Population:
Medical boundary:
```

## 2. Input authority

Name the most trustworthy inputs and their hierarchy.

Typical hierarchy:

1. exact pack/label for the exact product identifier;
2. current exact local-market manufacturer source;
3. preferred exact-product retailer source;
4. reputable fallback/corroboration.

For each tier define:

- required identity fields;
- completeness test;
- conflict handling;
- reformulation handling;
- confidence ceiling;
- when to block rather than infer.

Never merge lists across product identifiers, sizes, markets or versions unless the category establishes evidence that they share a formula.

## 3. Direct product properties

Start from the actual product/profile matching decision. Select the smallest property set that materially improves fit.

For each property complete:

| Field | Definition |
| --- | --- |
| Property name | Stable machine field. |
| Allowed values | Closed values and optional unknown/null. |
| Consumer meaning | What difference the value makes. |
| Input evidence | Ingredients/materials/formula/claims needed. |
| Deterministic rule | Only when evidence supports a hard conclusion. |
| Structured judgment | Required subjudgments and anchors. |
| Counter-signals | Facts that move or cap the conclusion. |
| Claim boundary | Whether/how positioning may influence it. |
| Confidence rule | High/moderate/low requirements. |
| Fit consumers | Profile fields that later use this property. |

Keep formula facts separate from formulation-dependent outcomes. Ingredient presence proves a clue, not exact amount, delivery or user experience.

## 4. Evidence lexicon

Create one versioned lexicon of recognized inputs:

```text
normalized name / aliases
functional family
directly supported functions
category-specific evidence role
exclusions / common false positives
source and review date
```

The lexicon extracts evidence. It must not silently become a label algorithm unless the property has a justified deterministic rule.

Version it when a change would invalidate historical records. Historical validation must continue using the evidence-method version stored in each artifact.

## 5. Deterministic versus judgment decisions

Classify each property as:

- **deterministic:** a complete input contains or lacks a defined fact and the result follows directly;
- **bounded structured judgment:** several signals must be reconciled against explicit anchors;
- **claim-gated:** positioning selects intent only when compatible input evidence exists;
- **not inferable:** available inputs do not support a dependable property and the category should not claim it.

For structured judgment require:

- named subjudgments;
- value anchors;
- supporting and counterevidence;
- neighboring-value rationale;
- confidence and limiting factor.

Avoid single-ingredient floors, unvalidated route-count thresholds and target-distribution tuning.

## 6. Formula/input-first sequence

Define a blind packet that hides brand, claims, prior labels and fit outcomes. Freeze its hash before unblinding.

After unblinding, define exactly which properties claims may influence. Record every blind-to-final change.

The same evidence packet and policy must be usable by an independent second researcher.

## 7. Confidence

Use a category-wide meaning:

- `high`: exact complete input, no material gap, converging evidence, reasonable unknowns would not move the value;
- `moderate`: one value is best supported but realistic unknowns could move it to a neighbor;
- `low`: identity/input conflict, incomplete evidence or balanced interpretations prevent a dependable call.

Confidence measures classification robustness, not clinical accuracy. Never invent percentages.

Decide the finalization behavior for low confidence:

```text
visible in artifact: yes
excluded from product set: normally no
blocks finalization: yes/no and why
can be unknown/null: which properties
```

## 8. Product truth versus user fit

Document two layers:

```text
authoritative input -> direct product properties -> separate profile fit
```

For every direct property name the profile fields and fit rule that consume it. Keep personalized cadence, ranking and recommendations out of the input classification.

Do not change product truth to balance profile coverage or match historical recommendations.

## 9. Calibration and holdout

Use existing products to draft anchors. Then freeze a genuinely new holdout before finalizing the method.

Pre-register:

- balanced stress archetypes;
- exact identities and product identifiers;
- reserves and deterministic substitution rule;
- predecessor overlap exclusions;
- success metrics.

Use independent lanes. Report:

- raw exact agreement overall/by property;
- label prevalence;
- conditional agreement for default-heavy properties;
- chance-corrected diagnostic where suitable;
- confidence distribution;
- every disagreement and adjudication;
- deterministic-property agreement separately.

Passing shows research-process repeatability, not real-world outcome accuracy.

## 10. Validation and artifacts

Specify immutable artifacts:

- policy and evidence-method hashes;
- cohort/reserve manifest;
- identity/source records;
- normalized input packets;
- blind/final records and receipts;
- independent labels;
- agreement/adjudication;
- profile replay;
- verification receipt.

Historical runs are immutable. A policy/evidence change produces an overlay or new version, never a silent rewrite.

## 11. Activation gate

Research completion and production activation are separate decisions.

Define who owns:

- exact catalog reconciliation;
- database schema/import;
- product/profile matcher changes;
- user-facing explanations/disclaimers;
- rollout and monitoring;
- rollback.

The default research stop is local versioned artifacts and review. No catalog or production write is implied.

## 12. Category acceptance checklist

- Category boundary and medical exclusions are explicit.
- Source hierarchy can resolve exact identities at useful coverage.
- Every direct property has allowed values and evidence anchors.
- Deterministic versus judgment decisions are explicit.
- Claims cannot override incompatible input evidence.
- Evidence lexicon is versioned and historical runs remain reproducible.
- Low-confidence handling is honest.
- Product truth and user fit are separate.
- New-product holdout is frozen before labels.
- Agreement and confidence gates are defined.
- Activation remains a separate approval.
