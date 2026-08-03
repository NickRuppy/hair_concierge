---
category: conditioner
document_type: decision
status: in_progress
decision_version: 0
last_reviewed_at: 2026-08-03
evidence_file: docs/personal-plan/categories/conditioner/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/conditioner.ts
test_surface: src/lib/personal-plan/categories/conditioner.test.ts
---

# Personal Plan Conditioner decision

## Authority

This document records confirmed Conditioner decisions and remaining open items. It becomes the implementation specification when marked `confirmed`. After implementation, the Personal Plan Conditioner module, tests, and verified catalog/protocol data become runtime authority.

## Intended user decision

The Personal Plan should tell the user:

- whether rinse-out Conditioner belongs in their Bedarfsplan;
- what formula weight, care direction, and repair support they need;
- how often the Conditioner need occurs;
- whether each owned Conditioner fits;
- which product or confirmed rotation covers the need;
- how to apply the selected product safely and precisely.

## Confirmed inclusion

| Rule ID | Condition | Need tier |
|---|---|---|
| `conditioner.inclusion.length_basis` | Hair length is `short`, `medium`, `long`, or `very_long` | `basis` |
| `conditioner.inclusion.very_short_optional` | Hair is `very_short` and a material length-care signal exists | `optional` |
| `conditioner.inclusion.very_short_not_needed` | Hair is `very_short` without a material length-care signal | `not_needed` |

Very short hair is not an automatic basis case. Exact material-signal precedence must be locked before this decision becomes `confirmed`.

## Target product profile

Conditioner target fit has three independent axes:

1. `weight`: `light | medium | rich`;
2. `balance`: `moisture | balanced | protein`;
3. `repairLevel`: `low | medium | high`.

A light Conditioner may still have high repair support. Repair need must not automatically make the recommended formula heavier.

### Weight

| Rule ID | Inputs | Decision |
|---|---|---|
| `conditioner.weight.thickness` | fine / normal / coarse hair diameter | Start at light / medium / rich respectively. |
| `conditioner.weight.volume_up` | More-volume direction, especially outside coarse/curly contexts | Shift one level lighter where supported. |
| `conditioner.weight.control` | Less-volume/control direction | Shift one level richer where supported. |
| `conditioner.weight.amount_not_formula` | Length or density changes | Adjust amount/distribution rather than formula weight by itself. |
| `conditioner.weight.no_shampoo_compensation` | Shampoo is too harsh | Correct the Shampoo or recipe; do not permanently compensate by making Conditioner richer. |

### Balance

Retain the home elasticity answer as a contextual heuristic, not a diagnosis:

- `stretches_stays`: protein-oriented signal;
- `snaps`: moisture-oriented signal;
- `stretches_bounces`: balanced signal.

Contextualize it with chemical treatment, surface condition, dryness, roughness, tangling, breakage, and damage. Conflicting or weak inputs should produce a balanced/conservative direction rather than a false deficiency claim.

### Repair

Reuse the relevant DamageAssessment inputs: surface condition, elasticity context, chemical treatment, breakage/damage/split-end signals, and heat/mechanical stress. Conditioner remains the baseline; Mask or Bondbuilder may be additional categories and do not remove Conditioner from the Bedarfsplan.

## Frequency and product allocation

| Rule ID | Condition | Decision |
|---|---|---|
| `conditioner.cadence.after_wash` | An eligible Shampoo wash event is planned | Create one Conditioner need after the final Shampoo rinse. |
| `conditioner.cadence.double_shampoo_once` | The event contains two Shampoo passes | Use one Conditioner step after the final rinse, not after each pass. |
| `conditioner.cadence.cover_total` | One or more Conditioners are active | Assigned Conditioner product uses must equal the total eligible Conditioner events. |
| `conditioner.cadence.rotation_explicit` | Several suitable Conditioners are intentionally used | Persist an explicit primary/secondary allocation; ownership alone does not schedule rotation. |
| `conditioner.cadence.successor` | Total cadence or product allocation changes | Create a proposed successor plan and require confirmation. |

Example: three eligible wash events can be covered by Conditioner A `3`, by A `2` + B `1`, or by A `1` + B `1` + C `1`. The products distribute the already-computed total; they do not add Conditioner events.

Current product frequency belongs to the user's inventory state. Recommended product frequency belongs to the confirmed plan assignment.

## Multiple products

- The user product library may contain several Conditioners.
- Evaluate every matched Conditioner against the same confirmed target profile.
- The default plan chooses the cleanest valid assignment.
- One product may cover all Conditioner events.
- Several suitable products may rotate only when the user explicitly confirms that allocation.
- The most-used active product is category primary; other active products are secondary.
- Equal-frequency placement uses the confirmed plan-level tie-breaker.
- Unassigned, shopping, rejected, or pending products remain visible but never enter executable day recipes.

## Product fit verdict

| Result | User-facing verdict |
|---|---|
| Weight, balance, and repair are exact or safely satisfied | `passt` |
| One-step weight/repair difference or balanced bridge | `passt mit Einschränkung` |
| Two-step weight/repair difference or direct protein-versus-moisture opposition | `wechseln` |
| Required product fields are unavailable or product is pending | `noch in Prüfung` |

Do not add a separate thickness mismatch on top of the formula-weight verdict when thickness has already determined target weight.

## Application rules

| Rule ID | Inputs/condition | Guidance |
|---|---|---|
| `conditioner.application.ends` | fine or straight hair | Focus on the ends; keep amount/lightness conservative. |
| `conditioner.application.full_length` | dry, curly, or coily hair | Cover the full hair length while avoiding deliberate scalp treatment. |
| `conditioner.application.mid_ends` | no stronger placement signal | Apply through mid-lengths and ends. |
| `conditioner.application.section_if_needed` | long, dense, thick, curly/coily, or tangled hair where coverage is difficult | Divide into manageable sections; no fixed section count. |
| `conditioner.application.detangle` | Detangling is needed | Finger-detangle first; if needed, use a wide-tooth comb gently from ends upward. |
| `conditioner.application.label_protocol` | Verified product directions exist | Product amount, dwell, and rinse directions override category fallback. |
| `conditioner.application.no_false_precision` | Exact product directions are unavailable | Use enough for even coverage, add incrementally, rinse thoroughly, and do not invent pumps/minutes. |
| `conditioner.application.no_cold_seal_claim` | Water temperature is explained | Avoid very hot water; do not claim a cold rinse seals the cuticle. |

Sectioning, gently removing excess runoff water, and distributing product between the hands can be optional technique guidance. They are not universal performance requirements.

## Detangling and Leave-in boundary

Conditioner supplies baseline in-shower slip. When the user's main unresolved job is persistent post-wash detangling, Leave-in is the primary additional category to assess. A possible Leave-in replacement of rinse-out Conditioner is an explicit exception to define in the Leave-in category, not a default Conditioner rule.

## Safety and overclaim boundaries

- Conditioner is not scalp cleansing, scalp treatment, or root-oil control.
- Do not promise permanent split-end repair or structural damage reversal.
- Burning, itching, rash, swelling, or persistent scalp symptoms suppress optimization and trigger stop-product/professional guidance.
- Do not infer product weight, protein/moisture role, repair level, fragrance status, or exact protocol from the name.

## Initial fixture matrix

1. `conditioner-very-short-no-care-signal`: `not_needed`.
2. `conditioner-very-short-chemical-dryness`: `optional` with a light targeted profile.
3. `conditioner-fine-dry-lengths`: light weight, moisture/balanced direction, one use after each eligible wash.
4. `conditioner-coarse-curly-damaged`: rich or context-adjusted weight, high repair support, full-length/sectioned guidance.
5. `conditioner-volume-up`: one-level-lighter adjustment without deleting Conditioner.
6. `conditioner-two-products-three-washes`: primary `2` + secondary `1`; total remains `3`.
7. `conditioner-one-product-three-washes`: one primary `3`; total remains `3`.
8. `conditioner-pending-product`: visible as pending, excluded from day recipes.
9. `conditioner-owned-mismatch-kept`: `owned_override` remains executable with non-blocking advice.
10. `conditioner-double-shampoo`: one Conditioner step after the final rinse.
11. `conditioner-label-protocol`: exact verified product directions override category fallback.
12. `conditioner-sensitive-scalp-reaction`: no product escalation; safety guidance.

## Remaining decisions before `confirmed`

- Lock the exact material care signals and precedence for `very_short` hair.
- Lock the final deterministic target-weight precedence when thickness and volume direction conflict.
- Confirm whether any product/protocol-specific recipe may replace the normal Conditioner step in V1 beyond already verified exceptions.
- Reconcile the final fit verdict thresholds with the structured Conditioner catalog fields and candidate availability.
