# Agentic Tool Loop Parity Matrix

Scope: Compare Lab `Produkt-Evaluation` parity surface for the nine selectable product categories. This matrix defines the expected source of truth per conversation move; it is scope parity, not Classic wording parity.

Legend:
- `select_products`: concrete product facts, eligibility, ordering, and product-specific claims
- `build_or_fix_routine`: routine structure, step order, cadence, and add-on priority
- `load_advisor_guidance`: category education, usage framing, compare framing, caveats, and overlays
- `consultation_brief`: lightweight first-step context for salient categories and profile signals
- `answer_context`: final-render capsules, category caveats, and explanation scaffolding
- `prompt-only global rule`: orchestration rules such as no product names without tool output

| Category | Category Education | Concrete Product Recommendation | Usage / Application | Compare / Decide | Multi-turn Follow-up / Explanation | Routine Insertion / Add-on |
|---|---|---|---|---|---|---|
| shampoo | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| conditioner | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| leave_in | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| mask | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| oil | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| bondbuilder | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| deep_cleansing_shampoo | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| dry_shampoo | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |
| peeling | `load_advisor_guidance`, `consultation_brief`, `answer_context` | `select_products`, `answer_context`, prompt-only global rule | `load_advisor_guidance`, `answer_context` | `load_advisor_guidance`, `answer_context`, `select_products` when products are requested | `answer_context`, `load_advisor_guidance`, prior tool trace | `build_or_fix_routine`, `answer_context` |

## Known Weak Cells Before This Implementation

- dry shampoo guidance/rendering: category guidance and render capsules were missing; should frame it as temporary oil absorption/freshness support, not scalp cleansing.
- peeling guidance/rendering: category guidance and render capsules were missing; should keep scalp exfoliation occasional, tolerance-based, and conservative around irritation.
- deep cleansing alias consistency: `deep_cleansing_shampoo` needed canonical normalization to `deep_cleansing` for advisor guidance.
- bondbuilder explanation follow-ups: product selection exists, but explanation capsules still need stronger final-render coverage.
- oil use-case disambiguation beyond product selection: hair oiling guidance exists, but final rendering needs to preserve finish/tips vs pre-wash vs cautious scalp roles.
- shampoo normal recommendation shape: shampoo guidance exists, but final rendering should answer explicit shampoo product asks instead of only redirecting toward stronger length-care categories.

## Source Anchors For New Guidance

- AAD dry shampoo guidance: dry shampoo can absorb visible oil but is not a replacement for washing with regular shampoo and water; wash after one or two dry-shampoo uses and brush/comb out as directed.
- AAD safe exfoliation guidance: exfoliation method and frequency should match skin tolerance; dry or sensitive skin may need gentler methods, and over-exfoliation can cause redness or irritation.
- Mayo Clinic dandruff guidance: persistent flakes, itch, redness, or symptoms not improving with appropriate shampoo use should be handled conservatively and may need healthcare evaluation.
