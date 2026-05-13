# Leave-in: Core Fit

## Runtime Variables

- `profile.thickness`
- `profile.hair_texture`
- `profile.heat_styling`
- `profile.concerns`
- `uses_heat_protection`
- `current_routine_products`

## Category Role

Leave-in is a post-wash booster for lengths and ends and usually a booster/simplification candidate rather than the routine baseline. It can support smoother feel, frizz control, light conditioning, styling prep, and sometimes routine simplification when product data supports the combined role.

## Best Fit

- post-wash frizz, rough feel, dryness, or styling-prep needs
- heat-styling routines where heat protection is missing or unclear
- users who need a leave-on booster beyond rinse-out conditioner
- routines that may be simplified by one selected product only when the product supports the combined role, including cases where it can sometimes replace conditioner because product data/context supports replacement

## Weak Fit

- scalp cleansing or scalp treatment
- replacing conditioner by default
- exact heat-protection claims without selected product data
- users who already have a suitable leave-in and need a reset or stronger periodic care instead

## Decision Axes

- `weight_tolerance`: thickness and texture decide whether the leave-in should be very light or richer
- `styling_role`: frizz control, smoothing, definition support, or prep before tools
- `heat_protection_gap`: heat_styling and uses_heat_protection decide whether protection should be raised
- `routine_complexity`: current_routine_products decide whether a leave-in adds value or can consolidate care and protection

## Profile Interplay

Fine or flat-prone hair needs light dosing and sparing placement. Wavy, curly, coarse, dry, or rough-feeling hair may benefit from more leave-on support. Heat-styling profiles need protection discussed, but exact supported claims require selected product information.

## Compare Against Other Categories

- Compare against conditioner by treating conditioner as the default rinse-out baseline and leave-in as the leave-on booster/simplification candidate.
- Compare against mask when the user wants occasional deeper conditioning for lengths.
- Compare against oil when the user mainly wants shine or tips finishing.
- Compare against shampoo or deep cleansing when the issue is residue, buildup, or root feel.

## Answer Guidance

- Present leave-in as a booster or styling-prep step after washing.
- Apply to lengths and ends, not scalp.
- For fine hair, recommend light and sparing use.
- Mention routine simplification or replacement only when selected product data and the user's context support it.

## Guardrails

- Do not claim heat protection for an unspecified product.
- Do not make leave-in an automatic conditioner replacement.
- Do not name products unless the active tool path has selected products.
