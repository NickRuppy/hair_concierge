# Conditioner: Core Fit

## Runtime Variables

- `profile.thickness`
- `profile.hair_texture`
- `profile.concerns`
- `profile.protein_moisture_balance`
- `current_routine_products`

## Category Role

Conditioner is the routine's default rinse-out baseline and length-care anchor after washing. It supports slip, surface feel, softness, reduced friction, and care balance in lengths and ends.

## Best Fit

- routine basics after shampoo
- dry-feeling, rough, tangled, or friction-prone lengths and ends
- frizz or surface-feel concerns where everyday length care is missing or too weak
- users comparing conditioner against a mask and needing the baseline step first

## Weak Fit

- scalp cleansing, scalp treatment, or root oil management
- structural repair or permanent split-end repair promises
- situations where a user already has an effective conditioner and needs a specific booster, styling prep, or reset instead

## Decision Axes

- `weight_tolerance`: thickness and texture decide how light or rich the conditioner should feel
- `care_balance`: protein_moisture_balance steers moisture versus protein-sensitive wording
- `placement`: lengths and ends are the default placement; scalp is usually avoided
- `baseline_gap`: current_routine_products decide whether conditioner is missing, underpowered, or already covered

## Profile Interplay

Fine hair often needs lighter weight and careful placement. Wavy, curly, coarse, chemically treated, or rough-feeling hair may need more slip and conditioning intensity, while protein-sensitive or overloaded-feeling hair needs conservative wording around protein direction.

## Compare Against Other Categories

- Compare against shampoo when the user is asking for length softness, slip, frizz, or dryness after washing.
- Compare against leave-in by keeping conditioner as the default rinse-out baseline and leave-in as a booster/simplification candidate.
- Compare against mask when the user needs occasional extra care beyond the baseline.
- Compare against oil when the user mainly asks about tips feel, shine, or finishing rather than wash-out conditioning.

## Answer Guidance

- Position conditioner as the normal after-wash length-care step.
- Keep placement to lengths and ends, not scalp.
- Explain that conditioner is usually more central than a mask for routine basics.
- If replacement comes up, say leave-in can sometimes replace conditioner only when product data/context supports replacement; otherwise conditioner remains the baseline.
- Do not name products unless the active tool path has selected products.

## Guardrails

- Do not treat conditioner as a scalp product.
- Do not promise permanent split-end repair; it can make split ends feel smoother temporarily.
- Do not overstate protein or moisture rules when the profile signal is weak.
