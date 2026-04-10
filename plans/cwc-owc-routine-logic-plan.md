# Variant-Aware CWC/OWC Routine Logic

## Summary

- Replace the current generic `CWC/OWC` routine topic with **variant-aware logic** that chooses **CWC** or **OWC** deterministically.
- Require a **real need signal** before surfacing either method. Hair pattern decides the default branch; damage/dryness/frequency/stress signals decide whether it appears at all.
- Keep this as a **routine-planner + synthesis change only** for v1: no new onboarding fields, no DB/schema work.
- Surface the chosen method inside the **wash-day/base routine**, with a **compact ordered technique outline** and clear guardrails.

## Implementation Changes

### Planner and Topic Selection

- Replace umbrella routine topic usage with distinct planner behavior for `cwc` and `owc`.
- Add a selector helper that:
  - first checks for at least one **need signal**
  - then chooses the variant by pattern + intensity + guardrails
- Count as need signals:
  - dryness, frizz, split ends, hair damage
  - rough/slightly rough cuticle
  - colored/bleached hair
  - frequent washing (`daily`, `every_2_3_days`)
  - mechanical stress / wash-day friction proxies already in profile
- Variant rules:
  - **CWC**: default for `straight` and most `wavy` hair with need signals
  - **OWC**: allowed for `wavy`, `curly`, and `coily`, but only when the profile is clearly **dry/stressed/dyed** and oil-weight risk is acceptable
  - `wavy` stays **CWC by default**; it upgrades to **OWC** only on the stronger textured/dry/stressed branch
- Guardrails:
  - do not proactively surface either method with no need signal
  - demote/suppress proactive **OWC** for oily scalp, buildup-prone routines, or strong oil-weight risk
  - treat color as a strengthening modifier, not a sole selector

### Routine Slot Behavior

- Remove the current generic occasional `CWC / OWC als Technik-Option` slot.
- Add a variant-specific **base-wash instruction slot**:
  - `CWC als Wash-Day-Schutz`
  - `OWC als Wash-Day-Schutz`
- Keep the rest of the routine modular:
  - **CWC** reuses normal shampoo + conditioner slots
  - **OWC** reuses shampoo + conditioner and should also reuse/inject the existing oil slot path so current oil matching can support it
- Slot copy should include compact steps:
  - **CWC**: conditioner on dry lengths/spitzen -> shampoo only at scalp -> foam through lengths -> final conditioner
  - **OWC**: oil on dry lengths with praying hands/scrunch -> shampoo at scalp on dry hair -> add water and spread foam -> final conditioner
- Add concise caveats:
  - optional technique, not a universal default
  - clarify/reset may matter if residue/build-up increases
  - OWC should stay conservative for oil-sensitive profiles

### Synthesis and Retrieval

- Update routine synthesis so CWC/OWC is the one allowed exception to "high level only":
  - include a **short ordered technique outline** for the selected method
  - do not explain both methods unless the user explicitly asks for a comparison
- Retrieval hints/subqueries should use the chosen variant label (`CWC` or `OWC`) instead of the current generic topic.
- If the user explicitly asks about CWC/OWC but the profile is too incomplete to choose safely, ask one targeted follow-up instead of guessing.

## Important Interface Changes

- `RoutineTopicId` should support variant-specific handling for `cwc` and `owc` instead of relying on one generic `cwc_owc` path.
- `RoutineContext` should expose enough derived signal state for wash-protection selection, either via new derived flags or a dedicated variant-selection helper.
- `RoutineSlotAdvice` for this feature becomes variant-specific in `id`, `label`, `topic_ids`, cadence, rationale, and caveats.
- No public API, onboarding schema, or Supabase table changes in this phase.

## Test Plan

- Activation:
  - straight/fine/dyed + frequent washing -> `CWC`
  - wavy + mild need -> `CWC`
  - wavy + strong dryness/stress/dye + acceptable oil profile -> `OWC`
  - curly/coily + dry/stressed/dyed -> `OWC`
  - oily scalp / buildup-prone / no need signals -> neither method
- Slot construction:
  - chosen technique appears in `base_wash`, not `occasional`
  - CWC slot contains the compact 4-step sequence
  - OWC slot contains oil-first + shampoo-on-dry-scalp + final conditioner sequence
  - OWC reuses or activates the oil product path correctly
- Synthesis:
  - routine prompt includes compact steps only for the active variant
  - no generic "CWC/OWC" wording remains in the final answer path
  - explicit comparison requests can explain both briefly without breaking the routine structure
- Non-regression:
  - existing shampoo, conditioner, leave-in, mask, hair-oiling, and lockenrefresh behavior stays unchanged when CWC/OWC is not selected

## Assumptions

- The chosen threshold is **"need signal required"**.
- **OWC** is allowed for **broad textured hair**, including `wavy`, but only on the stronger dry/stressed/dyed branch.
- Compact technique steps should appear directly in the routine answer when the method is active.
- v1 should avoid new profile questions and instead use existing profile signals plus current routine heuristics.
- Technique-specific product support should reuse existing category logic, not add a new product category.
