# Mask ingredient research

Status: **logic locked (Standard v1.0, frozen 2026-10-06) — research engine with a local production adapter; not wired into the Product Intake worker, not live matching logic**

This directory is the durable entry point for the Mask (rinse-out Haarkur/Maske) ingredient-classification work. It separates formula-derived product research from user fit, and both of those from catalog or production activation.

## Versioning note

The folder `v1.0/` is the **artifact root version** (the frozen research package). The classification standard inside it carries its own **semantic version**, currently **v1.0** (`mask-inci-v1.0`), promoted unchanged from the `v0.6` draft at the 2026-10-06 freeze. Until the freeze the draft lived under the filename `mask-classification-standard.v0.1.md` (retained since v0.1, versioned in its header); from v1.0 the normative path is `mask-classification-standard.md`. A semantic bump (classification meaning, thresholds, routes, derivation, eligibility) does not create a new artifact root; a genuinely new research run does.

## Start here

1. Use the [classification standard](./v1.0/mask-classification-standard.md) (Standard v1.0) for G0, the tail-marker conventions, the nine-field comparison profile and the trace-level `bond_route` / `hinweise` record. Its Version block is the authoritative freeze statement.
2. The [reviewed source snapshot](./v1.0/mask-classification-standard.v1.0-rc1.md) is the exact v0.6 text calibration closed under — identical to the normative file minus its v1.0 header block and Version section.
3. The [evidence lexicon](./v1.0/02_evidence_lexicon.v0.1.md) is the ingredient-family reference the standard consumes (pinned by the adapter).
4. The [calibration round 2 report](./v1.0/calibration-round-2-report.md) is the freeze-gate evidence: §1 cohort gate, §2 unseen set, §3 seams, §5 round 2.5, §6 final status.

## What is authoritative

| Layer | Canonical location | Purpose |
| --- | --- | --- |
| Current Mask method | `docs/research/mask-inci/v1.0/mask-classification-standard.md` (Standard v1.0) | Normative G0, anchors, thresholds, nine-field profile, evidence ceiling, gates, review triggers. |
| Reviewed source snapshot | `v1.0/mask-classification-standard.v1.0-rc1.md` | The v0.6 bytes at freeze; the lock's `review_source_snapshot`. Byte-identical to `v1.0/mask-classification-standard.v0.1.md` (historical draft path). |
| Category boundary + market | `v1.0/00_category_charter.md` | F1–F4, exclusions, medical boundary, coverage target, stop condition. |
| Property set | `v1.0/01_property-set-v0.md` | Ruled nine-field shape and D1–D6, including the projection targets the adapter writes. |
| Evidence lexicon | `v1.0/02_evidence_lexicon.v0.1.md` | Ingredient families and bands (header still reads its pre-freeze v0.2 draft status; frozen unchanged). |
| Rule ledger | `plans/mask-inci/round1-rule-rulings.md` | Nick's binding rulings R1–R9 and E1–E17 plus the round-2 triage notes. |
| Calibration reports | `v1.0/calibration-round-1-report.md`, `v1.0/calibration-round-2-report.md` | Round 1 first set; round 2 freeze gate and round 2.5 targeted validation. |
| Logic-lock receipt | `data/research/mask-inci/v1.0/v1.0-logic-lock-receipt.json` | Machine-readable lock of the v1.0 scope, profile fields, freeze notes and separate gates. |
| Artifact manifest | `data/research/mask-inci/v1.0/artifact-manifest.json` | Hash-pinned inventory of the normative source, snapshot, ruled inputs, reports and the complete frozen corpus. |
| Calibration corpus | `data/research/mask-inci/v1.0/` | `cohort.json`, `capture/`, `blind-packets*/`, `reference-key-v0/`, `reference-key-v1/`, `blind-lane-v0/`, `blind-lane-v1/`, `blind-lane-v2p5/`, `agreement/`, `round2p5-preregistered-expectations.md`. |
| Production adapter | `src/lib/mask-research/production-adapter.ts`, bridge doc `docs/product-intake-mask-production-adapter.md` | `mask-research-envelope-v1.0` → `product_mask_specs` + `suitable_thicknesses`. |
| Historical drafts | `v1.0/mask-classification-standard.v0.1-archive.md` | The v0.1 text. Provenance only. |

## The rulings the standard rests on

Full text: `plans/mask-inci/round1-rule-rulings.md`; every changed passage in the standard is marked `(R<n>)` / `(E<n>)`.

| # | Ruling |
| --- | --- |
| R1 | Directions decide; multi-use products are mode-scoped — no MODE is profiled twice. |
| R2 | Leave-in T16 tail-marker plausibility conditional; implausible markers route to review. |
| R3 | `conditioning_level: high` needs the cationic signal (S1) plus S2 or S3 — evidence fix, not a distribution target. |
| R4 | `weight_potential` gets its own evidence: rich = heavy-lipid core, light = positive leanness test. |
| R5 | The moisture-focus lipid-led guard (focus only). |
| R6 | `balanced` carries two readings (both-substantive or neither-dominant), aligned with leave-in T19. |
| R7 | Focus tie-break only on a genuinely dual-supported verdict. |
| R8 | Leave-in housekeeping block: §1.1 invariant, T18 source-conflict precedence, always-emitted `hinweise`, lexicon patches, G0 placement default. |
| R9 | Fields 7–9 are echo fields (T8 pattern). |
| E1–E6 | Boundary-position species count and cap confidence; E2 third marker-implausibility limb; Pantene `balanced`; `low` weight reachable for creams; `lightness` removed from the focus vocabulary. |
| E7–E12 | Full-list cationic scope; boundary proteins count; `balanced` (b) needs a silicone system; moisture secondary under `general`; #02 reading B; the tail-protein-cluster flag. |
| E13–E17 | Leave-in clause-5 marker wording; three triglyceride bands; carrier glycols are solvents; the `repair` headline evidence gate; formula-level exclusions are mode-independent. |

## Calibration status

| Round | Under | Result |
| --- | --- | --- |
| 1 | v0.1 | G0 12/13; profile 98/99 cells (99.0 %) on 11 both-profiled products; refuse-test passed |
| 2 (freeze gate) | v0.5 | Cohort **97/97 value cells, zero value disagreements**; unseen set of 6 (both traps refused); seams S1–S5 ruled as E13–E17 |
| 2.5 | v0.6 | Six fresh products against pre-registered expectations: **6/6** (E16 both branches, E14, booster limb, E2, a correct G0 stop) |

Agreement measures the repeatability of the rules, never the truth of a value.

**Freeze notes** (also in the lock receipt): E15 / `balanced` reading (b) is validated on one product only (u3); the cohort rerun is confirmation-grade on fields the standard's own E-notes name (independence caveat, round-2 report §1); G0 stops (`insufficient_information`, q3) and charter exclusions (#13, u5, u6) are first-class outcomes, not failures.

## What the lock covers — and does not

The v1.0 lock covers the reusable classification logic and the comparison profile it produces. It does **not** approve an individual product and does **not** authorize catalog, database, matching-policy, Product Intake or production use.

This package does **not**:

- write to Supabase or to any catalog field;
- change user recommendations or the production matcher;
- authorize user-facing claims, or convert any repair/bond/gloss claim into efficacy;
- establish exact ingredient concentrations, dwell efficacy or finished-product performance (formula-only conclusions stay at E2);
- diagnose a user or predict tolerance.

**The production adapter exists as a local, deterministic projection** (`npm run research:mask:production-adapter`). Ruled mapping inputs: property-set fields 2/4/7, D1 (`concentration`), D2 (`functional_benefits`), D6 (`balance_direction`). Open before it is used for intake:

1. **MAD-1 `functional_benefits` baseline** — an implementation default copied from the leave-in AD-3a baseline clause (moderate/high conditioning adds `detangling_slip`), without which nine of the twelve approved records could not project. Needs Nick's ruling.
2. **Product Intake worker wiring** — the leave-in envelope is required by the intake worker; the mask equivalent is not wired, because doing so changes how every mask submission is researched.
3. **A mask runbook** — the standard names it a Phase-4 artifact; it does not exist yet, so the adapter pins the evidence lexicon in the slot where leave-in pins its runbook.

The §18 open questions stay open under v1.0 and are inherited by every record that touches them.

## Guidance synchronization

Every reusable classification or review-workflow change must update the normative standard **and** every consuming guide before the next mask batch, and bump the semantic `standard_version` when meaning changes. Historical runs are immutable; a policy change produces a new version or an overlay, never a silent rewrite. Local Lab approval accepts only the exact research artifact and version — it never implies Product Intake, catalog, Supabase, deployment or production approval.
