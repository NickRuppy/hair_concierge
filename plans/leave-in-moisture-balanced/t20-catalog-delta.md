# T20 + AD-3a revision — production delta for the leave-in calibration set

Status: **for Nick's review before any apply. Nothing has been written to the database.** The apply batch and executor migration are a separate, later step.
Date: 2026-09-29 · Worktree: `codex/leave-in-moisture-balanced`

## What is compared

- **Before:** `data/research/leave-in-inci/v1.0/calibration-expected-projections.json`. These are the golden projections of calibration batch `leave-in-research-calibration-v1` (Standard v1.0, AD-3a as of 2026-09-14). The file is frozen and not edited.
- **After:** `data/research/leave-in-inci/v1.1/calibration-expected-projections.json`. Same adapter (`leave-in-production-adapter-v1`), Standard v1.1 (T20), AD-3a revised. Built by `scripts/leave-in-research/build-v1.1-calibration.ts`.
- **Pinned by a test.** `tests/leave-in-production-adapter-calibration.test.ts` ("the v1.0 -> v1.1 production delta is exactly the ruled one") fails if any field outside this list moves.

**Baseline caveat.** "Before" is batch v1's payload, not a live read. This worktree had no database access, so I have not confirmed that batch v1 is what production holds today. The follow-up apply generator reads the live rows and fingerprints them. Its per-product diff is the authoritative live delta, and it should match this document wherever batch v1 was applied as built.

## Summary

| # | Product (live) | `care_direction` | `care_benefits` | `functional_benefits` | Fit specs | Eligibility rows | Other |
|---|---|---|---|---|---|---|---|
| 1 | alverde Sprühkur Express 7in1 | moisture (=) | = | = | = | = (4) | — |
| 2 | ISANA Hyaluron & Panthenol | moisture (=) | = | = | = | = (2) | — |
| 3 | Cantu Repair Creme | moisture (=) | = | = | = | = (2) | — |
| 5 | EVO Head Mistress | balanced (=) | = | **− moisture_softness** | = | = (4) | — |
| 6 | Curlsmith Hydrate & Plump | moisture (=) | = | = | = | = (2) | — |
| 8 | **Gliss Express-Repair** | **moisture → balanced** | **− moisture** | **− moisture_softness** | = | = (6) | new review warning: `care_direction` uncertain |
| 9 | Redken Extreme Anti-Snap | protein (=) | = | **− moisture_softness** | = | = (10) | — |
| 10 | **Olaplex No.6** | **moisture → balanced** | **− moisture** | **− moisture_softness** | = | = (3) | — |
| 13 | **Neqi Diamond Glass** | **moisture → balanced** | **− moisture** | **− moisture_softness** | = | = (6) | (care_direction was already flagged uncertain) |

Not live, for completeness: slot 4 (alverde 2-Phasen) and slot 11 (Balea) do not change. Unseen u1 (Elvital) flips to `balanced` in the research record only; it has no envelope and no catalog row.

**Five of nine live products change, and three of those change direction.** No product falls to `needs_research`. No eligibility row is added or removed. For each product the following are also unchanged: `suitable_thicknesses`, `weight`, `format`, `roles`, heat binary, `plan_roles`, `repair_support_level`, `ingredient_flags`, `application_stage`, the whole of `product_leave_in_fit_specs`, and `requiredProtocolRoles`.

**The brief's expected deltas, checked.** The care_direction flips for Gliss, Olaplex and Neqi are confirmed. `moisture_softness` is dropped for Gliss, Olaplex, Neqi and EVO, as expected. **Redken also loses `moisture_softness`, which the brief did not list.** It is `protein` with conditioning `moderate`, so the old conditioning clause was its only route to that benefit. It keeps `smooth_anti_frizz`, `heat_protect` and `repair_support`.

**Eligibility rows do not drop.** `need_bucket = moisture_anti_frizz` is emitted when `care_benefits` contains `moisture`, `anti_frizz` or `detangling`. All three flipped products keep `anti_frizz` (smoothing focus and/or a continuous silicone-film smoothing route), so they keep every `moisture_anti_frizz` row. The matcher does not read `functional_benefits` for eligibility.

## Per product (changed fields only)

### 8 — Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair

| Field | Before | After |
|---|---|---|
| `product_leave_in_specs.care_direction` | `moisture` | `balanced` |
| `product_leave_in_specs.care_benefits` | `moisture, anti_frizz` | `anti_frizz` |
| `product_leave_in_specs.functional_benefits` | `moisture_softness, smooth_anti_frizz, heat_protect` | `smooth_anti_frizz, heat_protect` |
| projection warnings | AD-5 only | + "care_direction is uncertain … review the projection before approval." |
| eligibility (6 rows, unchanged) | normal+coarse × {heat_protect/heat_style, moisture_anti_frizz/air_dry, moisture_anti_frizz/non_heat_style} | same |

Why: T20 §9-O3. Dimethicone r3 outranks the only directional species, apricot kernel oil r4, so the film leads. The margin is one rank, so confidence is `low` and the record routes to review (`moisture_leg_subordinate`). AD-3a revision: no `moisture_softness` without `care_direction = moisture`.

### 10 — Olaplex N°.6 Bond Smoother

| Field | Before | After |
|---|---|---|
| `product_leave_in_specs.care_direction` | `moisture` | `balanced` |
| `product_leave_in_specs.care_benefits` | `moisture, anti_frizz` | `anti_frizz` |
| `product_leave_in_specs.functional_benefits` | `moisture_softness, smooth_anti_frizz, heat_protect` | `smooth_anti_frizz, heat_protect` |
| eligibility (3 rows, unchanged) | coarse × {heat_protect/heat_style, moisture_anti_frizz/air_dry, moisture_anti_frizz/non_heat_style} | same |

Why: T20 §9-O4. No settled humectant and no medium/rich lipid sits above the r14 marker. The v1.0 "legs" were dry-feel esters, volatiles and propanediol, all behind Dimethicone r3. Confidence `moderate`, no review. Conditioning stays `high`, so it stays `replacement_capable` and keeps `detangle_smooth`.

### 13 — Neqi Diamond Glass Ultimate Styling Spray

| Field | Before | After |
|---|---|---|
| `product_leave_in_specs.care_direction` | `moisture` | `balanced` |
| `product_leave_in_specs.care_benefits` | `moisture, anti_frizz` | `anti_frizz` |
| `product_leave_in_specs.functional_benefits` | `moisture_softness, smooth_anti_frizz, heat_protect` | `smooth_anti_frizz, heat_protect` |
| eligibility (6 rows, unchanged) | normal+coarse × {heat_protect/heat_style, moisture_anti_frizz/air_dry, moisture_anti_frizz/non_heat_style} | same |

Why: T20 §9-O2/O4. The glycols (Dipropylene r2, Pentylene r6) no longer create a leg, and Polysilicone-29 r7 is the only film above the tail. Confidence `low` with review (`glycol_only_leg`), because the read rests on demoting glycols that outrank the film. This supersedes T19's "Neqi stays moisture".

### 5 — EVO Head Mistress Cuticle Sealer

| Field | Before | After |
|---|---|---|
| `product_leave_in_specs.functional_benefits` | `moisture_softness, smooth_anti_frizz` | `smooth_anti_frizz` |

Why: AD-3a revision only (already `balanced`). The EVO catalog-row EAN mismatch blocker from batch v1 (`REVIEW_BLOCKERS["slot-05"]`) still applies.

### 9 — Redken Extreme Anti-Snap Leave-In Treatment

| Field | Before | After |
|---|---|---|
| `product_leave_in_specs.functional_benefits` | `moisture_softness, smooth_anti_frizz, heat_protect, repair_support` | `smooth_anti_frizz, heat_protect, repair_support` |

Why: AD-3a revision only (`protein`).

### 1, 2, 3, 6 — alverde 7in1, ISANA Hyaluron, Cantu, Curlsmith

No catalog field changes. The projection's provenance still moves: `research_model_version` goes `leave-in-inci-v1.0 → v1.1`, and the `care_direction` / `care_benefits` / `functional_benefits` rationale strings now cite T20 and the revised AD-3a. That changes `projection_sha256` and `research_input_sha256` for every product, so the next apply batch has new content fingerprints for all nine, including the five-with-no-field-change.

## What users see (plan authority)

For the three flipped products, `careDirectionAxisFitResult`:

| User target | Before (`moisture`) | After (`balanced`) |
|---|---|---|
| moisture | pass | **caution** (intended: no longer presented as a dryness treatment) |
| balanced | caution | **pass** |
| protein | fail | **caution** |

Function axis. A dry or rough profile's `moisture_softness` function need ("Feuchtigkeit & Geschmeidigkeit") is no longer covered by EVO, Redken, Gliss, Olaplex or Neqi. It is still covered by alverde 7in1, ISANA Hyaluron, Cantu and Curlsmith. The `smooth_anti_frizz`, `heat_protect` and `repair_support` coverage of those five products is unchanged.

## Apply lane (prepared 2026-09-29, not applied)

Batch `leave-in-research-calibration-v2-t20` carries exactly the five products above: one spec upsert each, and no eligibility, fit or product operation. Its executor migration is `20260929214731`, and each step is gated separately in `plans/leave-in-moisture-balanced/apply-runbook-v2-t20.md`. The read-only prod preflight of 2026-09-29 is green on all five, with pinned fingerprints equal to live (`preflight-output-v2-t20.json`). That also confirms the baseline caveat above: live equals batch v1's payload.
