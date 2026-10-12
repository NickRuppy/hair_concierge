# Shampoo ingredient research

Status: **v1.6 is the active, locked research method (2026-10-10). v1.4 is the parked, frozen predecessor. Neither is active in production.**

This directory is the durable entry point for the Shampoo ingredient-classification work. It separates formula-derived product research from user fit and from catalog or production activation. This README is the living entry point; it is not part of either version's frozen files.

## Start here

1. Read the [v1.6 overview](./v1.6/README.md).
2. Use the [v1.6 classification standard](./v1.6/classification-standard.md) for the eight direct product properties and the production projection block.
3. Follow the [v1.6 research runbook](./v1.6/runbook.md) for a new German shampoo.
4. Use the [category template](../category-classification-engine-template.md) when adapting the approach to another product category.

## Active method: v1.6

| Layer | Canonical location | Purpose |
| --- | --- | --- |
| Locked standard | `docs/research/shampoo-inci/v1.6/classification-standard.md` | `shampoo-classification-v1.6` / `shampoo-inci-v1.6`: eight direct properties plus the production projection (Section 13). |
| Rule changes | `docs/research/shampoo-inci/v1.6/rule-changes.md` | Every change from v1.4, with its source. |
| Runbook | `docs/research/shampoo-inci/v1.6/runbook.md` | Formula freeze, sealed two-lane validation, adjudication, stop boundary. |
| Lock receipt and manifest | `data/research/shampoo-inci/v1.6/` | Hash pins for the locked files, the rulings ledger snapshot and the calibration corpus; checked by `tests/shampoo-research-v1-6-lock.test.ts`. |
| Calibration evidence | `data/research/shampoo-inci/v1.6/calibration/` | Round 1 (97.4%), round 2 (97.1%) and unseen check v2 (95.8%). |

The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is still pinned to v1.4; re-pinning it to v1.6 is a separate, reviewed change. Locking v1.6 authorizes no catalog, database or recommendation change.

## Parked predecessor: v1.4

Everything below describes the parked v1.4 package. It stays frozen as provenance and as the adapter's current pin; do not use it for new research.

## What is authoritative

| Layer | Canonical location | Purpose |
| --- | --- | --- |
| v1.4 method (parked) | `docs/research/shampoo-inci/v1.4/` | Normative v1.4 classifications, confidence rules and research procedure. |
| Parked package manifest | `data/research/shampoo-inci/v1.4-candidate/parked-research-package.json` | Hash-pinned map of the final method and evidence. |
| Existing-product candidate | `data/research/shampoo-inci/v1.4-candidate/` | Research-only 50-product snapshot with eight properties each. |
| Final weight correction | `data/research/shampoo-inci/weight-final-rerun-v3/` | Four-case closure and whole-formula weight evidence. |
| New-product scalability test | `data/research/shampoo-inci/holdout-v3/` | Ten new products, two independent lanes, adjudication and 18-profile replay. |
| Reusable procedure | `docs/research/shampoo-inci/v1.4/` | The classification standard and new-product runbook to apply in a future research task. |
| Integrity check | `scripts/shampoo-research/validate-parked-package.ts` | Verifies the frozen v1.4 package byte-for-byte and prevents its research-only boundary from drifting. Its archive scope excludes the v1.6 package and this living README. |
| Historical provenance | `v1.3/`, `v1.4-draft/`, `holdout-v1/`, `holdout-v2/`, and earlier weight runs | Evidence and evolution only; not the active method. |

v1.4 was the active method until v1.6 was locked. Earlier rules must not be silently combined with it. In particular, historical route-count logic and “polymer means moderate” are not valid v1.4 weight rules.

## What is parked here

- A stable, explainable method for classifying a current German regular shampoo from an exact identity and canonical INCI.
- Eight direct product properties, each with value, confidence, rationale, supporting evidence, counter-signals and source references.
- A finalizable research candidate for 50 existing shampoos: 400 property records, no low-confidence properties and no missing rationale references.
- A ten-product independent holdout with 85.7% raw agreement, every property above the defined pass floor, 100% dandruff agreement and no unresolved identity/audit failure.
- A separate deterministic fit replay. Product truth is not tuned to produce a preferred profile distribution.

## What is explicitly not live

This package does **not**:

- alter the production product schema or catalog;
- replace the existing Shampoo matching fields;
- write to Supabase;
- change user recommendations;
- authorize user-facing claims;
- establish exact ingredient concentrations or finished-product performance.

`finalizable` means internally complete as a research artifact. It does not mean catalog-approved or production-ready.

## How the v1.4 runbook was used

The v1.4 runbook ran in this order (new research follows the v1.6 runbook):

1. resolve the exact German product, size, GTIN aliases and current canonical formula;
2. preserve conflicts and freeze the normalized INCI fingerprint;
3. perform the blind formula-first classification;
4. unblind positioning only for focus, usage and corroboration;
5. obtain an independent second judgment for a validation batch;
6. validate every property, confidence, rationale and source reference;
7. replay fit separately;
8. stop at a research artifact until Product Intake and an explicit activation decision approve the next stage.

The published archive deliberately contains no catalog importer, database writer,
Lab route, or production matching code. Verify that the frozen method and result
files are intact with:

```bash
npm run research:shampoo:validate-parked-v14
```

Historical receipts and replay scripts inside the evidence folders record how
earlier research runs were produced. They are provenance, not standalone tools:
the experimental engine code they referenced is intentionally not part of this
research-only archive. The v1.6 standard and runbook—not those historical scripts—
are the supported basis for a future research task.

For a genuinely new research run, start a new versioned artifact root and follow
the v1.6 runbook. Do not overwrite or regenerate the frozen historical results in
this package.

## Future activation gate

Before any production use, create a separate implementation plan that explicitly decides:

- how the eight research properties map into the production schema;
- which existing Shampoo fields remain, are shadowed or are replaced;
- how catalog identity and reformulations are versioned;
- who approves formula research and subsequent changes;
- how ingredient-derived explanations are phrased to users;
- how shadow recommendations compare with the current expert-led matching;
- rollout, monitoring and rollback boundaries.

Activation must consume a reviewed, hash-pinned candidate through Product Intake. Application code must not read these research files as an implicit production database.
