# Wash / Length-Care Family Summary

## Categories
- `category.shampoo.v1`
- `category.conditioner.v1`
- `category.leave_in.v1`
- `category.mask.v1`

## What Changed
- Shampoo now owns scalp/root cleansing, rinse-down, wash rhythm, dry-length mismatch, and scalp safety boundaries.
- Conditioner remains the pilot reference and now has matching JSON grounding/ask policy.
- Leave-in now owns leave-on booster logic, heat-protection grounding, simplification boundaries, and fine/low-density dosing.
- Mask now owns periodic extra-care logic, conditioner boundary, protein/moisture fit, cadence caution, and repair overclaim limits.
- General advice keeps the broad leftover logic: concerns, goals, balanced comparisons, usage/application, detangling, CWC/OWC, and troubleshooting before shopping.

## Source Treatment
Legacy topic files, dry-lengths, fine/low-density, texture, tangling, heat, damage, protein/moisture, CWC/OWC, usage, and comparison guidance were folded into the relevant category or base sections. Product facts and exact claims remain tool/catalog-grounded.

## Verification
- `npx tsx --test tests/agent-v2-guidance-compiler.spec.ts` passes after this family.
