# Shampoo INCI classification v1.4

Policy ID: `shampoo-classification-v1.4`

Analysis model version: `shampoo-inci-v1.4`

Status: parked, stable internal research method — not production-active

## Purpose

This is the active method for researching a current German regular shampoo from its exact identity and ingredient list. It produces eight explainable direct product properties that can later feed a separate user-fit calculation.

It is intentionally research-only. A completed analysis does not approve a catalog record, write to Supabase, alter the live recommendation engine, or authorize user-facing claims.

## Active documents

- [Shampoo research landing page](../README.md): package map, reuse entry point and future activation gate.
- [Classification standard](./classification-standard.md): normative property meanings, source hierarchy, evidence rules and confidence.
- [New-product research runbook](./new-product-research-runbook.md): repeatable identity, blind analysis, independent review and holdout procedure.
- [Holdout-v3 operator clarifications](./holdout-v3-operator-clarifications.md): non-normative examples recorded after disagreement adjudication; they explain the existing focus rules without changing the frozen policy used by the holdout.
- [Category classification template](../../category-classification-engine-template.md): documentation shell for applying the approach to another category without copying Shampoo-specific rules.
- [Parked package manifest](../../../../data/research/shampoo-inci/v1.4-candidate/parked-research-package.json): hash-pinned method and result inventory.

## Version history and authority

The v1.4 standard consolidates these earlier sources:

1. [v1.3 scientific classification standard](../v1.3/02_Classification_Standard_Agent_Context_v1.3.md): scientific background, INCI interpretation, formula architecture and original Shampoo property model.
2. [v1.4-draft operational amendment](../v1.4-draft/operational-amendment.md): primary focus, optional secondary focus, pragmatic usage role and repeatability rules.
3. [Final weight-potential method](../v1.4-draft/weight-potential-final-method.md): structured whole-formula judgment over deposition, persistence and reset.

Use this directory for all new Shampoo conclusions. The earlier documents and frozen runs remain immutable provenance and reproduction material.

## Superseded rules

- The `shampoo-weight-v1` route-count calibration is historical evidence only. It must not assign a future `weightPotential` label.
- The v1.4-draft policy ID is historical. New artifacts use `shampoo-classification-v1.4`.
- Holdout-v1 and holdout-v2 retain their original validation behavior. Do not rewrite them to look like v1.4 results.

## Two-layer contract

```text
exact German identity + canonical INCI
                  |
                  v
       eight direct product properties
                  |
                  v
       separate deterministic user fit
```

Product truth is not adjusted to improve profile coverage, assortment balance or agreement with a previous expert label. Fit can change when direct properties change; fit never changes the underlying product classification.

## Activation boundary

The permitted output of this method is a versioned research artifact with sources, reasoning, confidence, independent agreement and profile replay. Product Intake and an explicit release/import decision own any later catalog reconciliation or production activation.

The parked package must remain repository-owned and versioned. Google Drive/source attachments remain research provenance, not the runtime authority. Future work should begin from this README and its package manifest rather than reconstructing decisions from a chat or Lab session.
