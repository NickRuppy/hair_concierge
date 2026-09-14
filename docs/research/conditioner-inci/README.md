# Conditioner ingredient research

Status: **logic locked (Standard v1.6) — research engine active for Product Intake, not live matching logic**

This directory is the durable entry point for the Conditioner ingredient-classification work. It separates formula-derived product research from user fit and from catalog or production activation.

## Versioning note

The folder `v1.0/` is the **artifact root version** (the frozen research package). The classification standard inside it carries its own **semantic version**, currently **v1.6** (`conditioner-classification-v1.6`). A semantic bump (classification meaning, thresholds, routes, derivation, eligibility) does not create a new artifact root; a genuinely new research run does.

## Start here

1. Read the [Stage A artifact runbook](./v1.0/runbook.md) — procedure, Lab review order, guidance synchronization, and the new-product Product Intake path.
2. Use the [classification standard](./v1.0/conditioner-classification-standard.md) for the nine-property comparison profile.
3. For a previously unknown eligible Conditioner, follow the runbook's "New-product Product Intake path" and [Conditioner Production Adapter v1](../../product-intake-conditioner-production-adapter.md).
4. Use the [category template](../category-classification-engine-template.md) when adapting the approach to another product category.

## What is authoritative

| Layer | Canonical location | Purpose |
| --- | --- | --- |
| Current Conditioner method | `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md` (Standard v1.6) | Normative nine-property classifications, thresholds, evidence ceiling, confidence rules. |
| Research procedure | `docs/research/conditioner-inci/v1.0/runbook.md` | Stage A procedure, Lab review order, rework handoffs, guidance synchronization. |
| Researcher prompt + guides | `v1.0/product-research-prompt.md`, `v1.0/02_agent-context.md`, `v1.0/03_lean-matching-quick-reference.md`, `v1.0/04_focus-selection-decision-guide.md` | Consuming guides that must stay synchronized with the standard. |
| Category boundary + sources | `v1.0/00_category_charter.md`, `v1.0/01_evidence_source_register.md` | Eligibility, market, medical boundary, source hierarchy. |
| Logic-lock receipt | `data/research/conditioner-inci/v1.0/v1.6-logic-lock-receipt.json` | Machine-readable lock of the v1.6 vocabulary, thresholds, and reasoning contract. |
| Frozen cohort + calibration | `data/research/conditioner-inci/v1.0/` (`source-manifest.json`, `cohort.json`, calibration/agreement artifacts) | Hash-pinned evidence, blind-review lanes, adjudication history. |
| Intake serialization | `conditioner-research-envelope-v1.6` (see adapter doc) | Durable evidence, values, uncertainty, and formula provenance per product. |
| Production projection | `src/lib/conditioner-research/production-adapter.ts` via `npm run research:conditioner:production-adapter` | Deterministic one-way projection into current Conditioner DB fields. |
| Rework handoff | `npm run conditioner:research:rework-queue` (`scripts/conditioner-research/rework-queue.ts`) | Unresolved exact-version Lab rework packets for workers. |
| Product handoff | `docs/product-intake-research-ops.md` | Identity, image, price/link, exact protocol, review, guarded publish. |
| Historical provenance | `v1.0` receipts (`stage-a-checkpoint.md`, `verification-receipt.md`, `conditioner-disagreement-log.md`, `rule-changes.md`, `planning-evidence/`, `conditioner-classification-standard.v1.6-rc1.md`) | Evidence and evolution only; not the active rules. |

## What the lock covers — and does not

The v1.6 logic lock covers the reusable nine-property classification logic: vocabulary, thresholds, evidence ceiling, and reasoning contract. It does **not** approve an individual product or authorize catalog, database, matching-policy, or production use.

This package does **not**:

- alter the production product schema or the live Conditioner matching fields on its own;
- write to Supabase (all publishes stay behind Product Intake's guarded final handoff);
- change user recommendations;
- authorize user-facing claims;
- establish exact ingredient concentrations or finished-product performance.

## Researching a new Conditioner

For a previously unknown German/EU conventional rinse-out Conditioner:

1. follow the complete research method in the [runbook](./v1.0/runbook.md) and standard;
2. serialize all nine fields plus evidence into `conditioner-research-envelope-v1.6`;
3. store the envelope in a Product Intake `property_synthesis` artifact;
4. run the deterministic production adapter to derive today's narrower Conditioner DB fields — the adapter never reads catalog values as evidence, never rewrites the research profile, and never invents an application protocol from INCI;
5. `projection_ready` is property-lane readiness only; catalog intake readiness, global recommendation readiness, and publish approval remain separate gates in `docs/product-intake-research-ops.md`.

## Guidance synchronization

Every reusable classification or review-workflow change must update the normative standard **and** every consuming guide before the next batch (see the runbook's "Guidance synchronization" section), and bump the semantic `standard_version` when meaning changes. Historical runs are immutable; a policy change produces an overlay or a new version, never a silent rewrite.
