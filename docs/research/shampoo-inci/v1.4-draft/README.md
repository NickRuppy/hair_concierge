# Shampoo INCI classification overlay — v1.4-draft

This directory is the research-only operational overlay for new Shampoo classification runs after the first holdout exposed repeatability gaps. It inherits the v1.3 scientific standard and changes only the pragmatic operator rules named in [the v1.4-draft amendment](./operational-amendment.md).

Use policy ID `shampoo-classification-v1.4-draft` for holdout-v2 and later internal new-product research unless a newer policy supersedes it.

## Authority order

1. [v1.3 agent-context classification standard](../v1.3/02_Classification_Standard_Agent_Context_v1.3.md) remains the base scientific and evidence standard.
2. [v1.3 Charlie integration contract](../v1.3/charlie-integration-contract.md) remains the direct-property versus derived-fit boundary and keeps the locked dandruff rule.
3. [v1.4-draft operational amendment](./operational-amendment.md) overrides v1.3 only for `focusPrimary`, `focusSecondary`, `usageRole` and provisional v1.4 weight handling.
4. [Final weight-potential method](./weight-potential-final-method.md) supersedes provisional v1.4 weight handling and the `shampoo-weight-v1` route-count calibration for final `weightPotential` conclusions.
5. [v1.3 new-product runbook](../v1.3/new-product-research-runbook.md) remains the reusable workflow, with v1.4-draft routing and trace requirements added for future runs.

For final **weight-potential** passes, apply [`shampoo-weight-final-v1`](./weight-potential-final-method.md). It keeps ingredient recognition and position extraction as evidence, then requires whole-formula judgments for deposition load, persistence and reset capacity before a final band is selected. Keep [`shampoo-weight-v1`](./weight-potential-calibration.md) reproducible as the earlier calibration policy and distribution-warning artifact; do not use its route-count thresholds as final label authority. All other properties, including cleansing strength, remain unchanged unless a directly derived fit/report field must be refreshed from the new weight result.

The v1.3 cohort and holdout-v1 artifacts are history. Do not rewrite their labels, reports or commands to make v1.4-draft look better.

## Scope

This overlay is for repeatable research operations, not clinical truth and not production activation. It creates no catalog row, Supabase write, recommendation change, user-facing advice, Product Intake publication or import path by itself.

The decision trace belongs in research artifacts such as `blind-pass.json.ruleApplication`. It is intentionally not a new production audit/database schema.

## Latest evaluation

[Holdout-v2 result and all ten product audits](../../../../data/research/shampoo-inci/holdout-v2/holdout-adjudication.md): 60/70 exact judgments agree (85.7%), and the preliminary repeatability gate passes. Cleansing strength remains at the minimum 60% agreement; secondary-focus and usage exceptions still need calibration. This does not establish measured accuracy or authorize automatic approval.

The latest full-cohort weight evaluation is [`weight-final-rerun-v2`](../../../../data/research/shampoo-inci/weight-final-rerun-v2/report.md). It preserves all 50 v1 candidate bands after the final reviewed ingredient-role corrections, raises four classifications from low to moderate confidence, and remains a research-only candidate with the directional-shift activation gate intact. `weight-final-rerun-v1` is immutable review history.
