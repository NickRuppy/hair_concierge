---
category: shampoo
document_type: decision
status: confirmed
decision_version: 1
last_reviewed_at: 2026-08-03
evidence_file: docs/personal-plan/categories/shampoo/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/shampoo.ts
test_surface: tests/personal-plan/categories/shampoo.test.ts
---

# Personal Plan Shampoo decision

## Authority

This is the confirmed product specification until implementation. After implementation, the Personal Plan Shampoo module, its deterministic tests, and verified catalog/application-protocol data become runtime authority. The linked evidence file remains the source record for external claims and their limitations.

The complete input/output contracts and regression fixtures remain in `plans/2026-08-02-personal-plan-computation-spec.md`.

## Scope

- Shampoo is `basis` for every user.
- Stage 1 explains the required Shampoo job, type, and total wash cadence.
- Stage 2 evaluates every owned or pending Shampoo and recommends an exact verified product only when the role remains unresolved.
- Stage 3 allocates confirmed in-hand products across the computed wash events.
- Deep cleansing remains a separate category and normally substitutes for a normal wash.

## Confirmed rules

| Rule ID | Condition | Decision |
|---|---|---|
| `shampoo.inclusion.basis` | Every Personal Plan | Include Shampoo as `basis`. |
| `shampoo.concern.specific_wins` | Generic concern and specific scalp answer coexist | Use the specific scalp answer for Shampoo computation. |
| `shampoo.role.everyday` | Every user | Create an everyday cleansing role matched to scalp context, hair context, and exclusions. |
| `shampoo.role.dandruff` | Specific targeted dandruff concern | Add a treatment-capable dandruff role. Dry flakes or irritation alone do not create it. |
| `shampoo.role.product_reuse` | One verified product safely satisfies several roles | Let that product fulfil the roles without forcing a second purchase. |
| `shampoo.cadence.total_budget` | Shampoo cadence has been resolved | Treat it as the total wet-wash event budget. |
| `shampoo.cadence.cover_total` | One or more Shampoos are active | Allocate the products so their planned uses cover the total wash budget exactly. |
| `shampoo.cadence.substitution` | A clarifying or intensive-care wash is due | Substitute it inside the total wash budget unless a separately confirmed rule says otherwise. |
| `shampoo.product.primary` | Several Shampoos are active | Derive primary from greatest planned use after aggregation across roles; apply the confirmed tie-breaker when equal. |
| `shampoo.protocol.product_specific` | Exact cadence, contact time, acute phase, or maintenance phase is stated | Require verified product protocol data; do not infer it from category or product name. |
| `shampoo.dandruff.review` | Cosmetic dandruff product becomes active | Schedule the confirmed 21-day response check without claiming every course ends at that time. |
| `shampoo.safety.escalation` | Symptoms worsen, red flags appear, or appropriate use yields no clear improvement | Suppress automatic intensification and use the confirmed professional/pharmacy escalation path. |

## Total cadence and product allocation

The resolved Shampoo cadence is invariant for the confirmed plan version. Products partition it:

| Total wash events | Valid allocation examples |
|---:|---|
| 3 | Shampoo A `3` |
| 3 | Shampoo A `2` + Shampoo B `1` |
| 3 | Shampoo A `1` + Shampoo B `1` + Shampoo C `1` |

No product rotation may create a fourth wash event. The same product may cover everyday and dandruff roles; aggregate its planned uses before deriving primary/secondary placement. A change to total cadence or allocation creates a proposed successor and requires user confirmation.

## Product-state behavior

- Matched owned products are evaluated individually against every relevant Shampoo role.
- A pending product remains visible but cannot satisfy a role until reviewed.
- Opening a shopping link changes nothing.
- A recommended product remains on the shopping list until explicitly removed or acquired.
- Acquisition previews the changed assignment/day types and updates the active plan only after confirmation.
- `mismatch` and `unknown` are never presented as confident exact recommendations.

## Traceability

- External evidence: `docs/personal-plan/categories/shampoo/evidence.md`
- Cross-category contracts and sixteen fixtures: `plans/2026-08-02-personal-plan-computation-spec.md`
- Living implementation plan: `plans/2026-08-02-personal-plan-app-implementation-v2.md`
- Intended runtime module: `src/lib/personal-plan/categories/shampoo.ts`
