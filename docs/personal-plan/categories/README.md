# Personal Plan category knowledge

This directory preserves the category-by-category evidence and product decisions behind the Personal Plan without turning prose into a second runtime recommendation engine.

## Authority model

| Layer | Owns | Does not own |
|---|---|---|
| `evidence.md` | External sources, evidence strength, limitations, conflicts, and rejected overclaims | Runtime thresholds, product ranking, or exact unverified protocols |
| `decision.md` | Nick-confirmed product policy, deterministic mappings, fallbacks, reason codes, and fixture intent | Executable behavior after implementation |
| `src/lib/personal-plan/**` plus tests | Executable category decisions, product allocation, day compilation, and stable reason output | External evidence narrative |
| Catalog/spec tables and `product_application_protocols` | Concrete product properties, eligibility, exact verified cadence, timing, and application overrides | General category policy |
| `data/agent-v2/guidance/**` | Curated agent interpretation and explanation guidance when an LLM consumer is active | Personal Plan computation or unverified product facts |

During planning, an approved `decision.md` is the implementation specification. After implementation, runtime code, tests, and verified catalog/protocol data are authoritative; the Markdown remains the durable rationale and traceability record.

External evidence and internal decisions must remain in separate files. Agent guidance may later distill the operational value, but must not ingest raw research as if it were executable or universally certain.

## Required category files

Each category directory contains:

- `evidence.md`: external evidence only;
- `decision.md`: confirmed and still-open Personal Plan product decisions.

Cross-category research such as detangling or scalp safety may live in a shared topic note and be referenced from several decisions. Duplicate only the operational category rule, not the full research narrative.

## Required metadata

Each file starts with:

```yaml
---
category: conditioner
document_type: evidence # or decision
status: in_progress # researched, confirmed, implemented, superseded
evidence_version: 1 # evidence files
decision_version: 1 # decision files
last_reviewed_at: 2026-08-03
---
```

A confirmed decision file also names its evidence file, intended runtime module, and test surface.

## Frequency invariant

Category computation owns the total required cadence. Product assignment distributes that total but never changes it.

For a total shampoo cadence of three wash events in the plan cycle, valid assignments include:

- one shampoo used three times;
- a primary shampoo twice and a secondary shampoo once;
- three shampoos once each.

The sum of active product assignments for a role/category must cover the computed total exactly unless a documented recipe intentionally uses more than one product in the same event. Specialized wash types normally substitute within the shampoo wash budget; they do not create extra washes.

Current product frequency and recommended plan frequency are separate facts. A later change to the total need cadence or its product allocation creates a proposed successor plan and requires confirmation before replacing the active plan.

## Decision rule shape

Use stable rule IDs and keep every row testable:

| Rule ID | Inputs/condition | Output | Evidence | Runtime/test mapping |
|---|---|---|---|---|
| `conditioner.cadence.cover_total` | Conditioner is included and the plan has eligible wash events | Assigned Conditioner uses equal the eligible-wash total | `conditioner/evidence.md` | Added during implementation |

Weak or conflicting evidence must not become a hard rule. Record it as optional guidance, a conservative fallback, or an open decision.

## Category workflow

1. Research and update `evidence.md`.
2. Grill product decisions and update `decision.md`.
3. Mark the decision `confirmed` and create one category checkpoint commit.
4. Implement the category module test-first.
5. Link stable rule IDs to runtime reason codes and fixtures.
6. Set the decision status to `implemented` only after the mapped tests pass.
7. Curate relevant agent guidance separately if an LLM consumer needs it.

Do not introduce a category DSL, vector database, or automatic code generation for V1. The current Markdown, TypeScript, tests, catalog metadata, and existing agent-guidance packages are sufficient.
