# Optional Product Context And Topic Switching Plan

Status: draft  
Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/selected-product-facts-card-polish`  
Branch: `codex/selected-product-facts-card-polish`

## Objective

Make prior product context behave like optional conversation memory, not a routing lock.

When the user naturally continues a product topic, the agent should use the active product context. When the user asks for alternatives, a broad recommendation, or a different product/topic, the agent should move on and use the normal product recommendation or lookup path across all categories.

## Chosen Direction

Use agent guidance plus narrower validator tripwires.

The agent should decide the latest turn's intent from the user message and conversation history. Validators should only block unsafe product-specific claims about an unresolved product, not force the conversation back to an old pending product whenever the category overlaps.

## Explicit Non-Goals

- Do not add a new `subject_resolution`, `currentTurnProductSubject`, or similar structured metadata object.
- Do not add a new tool call just to decide whether old product context applies.
- Do not patch shampoo only. This must work for shampoo, conditioner, leave-in, mask, oil, bondbuilder, dry shampoo, deep-cleansing shampoo, and future categories that use the same Agent V2 contracts.
- Do not redesign the product recommendation engine or category scoring.
- Do not weaken the rule that unresolved exact product assessments must be blocked until identity is resolved.

## Source Context

- `src/lib/agent-v2/runtime/responses-agent.ts`
  - Injects `activeProductContexts` into the model prompt.
  - Converts pending active product contexts into synthetic unresolved lookup results through `activePendingProductContextToLookupResult`.
  - Currently already says active context should only be used for natural follow-ups, but the guidance needs to be sharper for alternatives, topic switches, and different named products.
- `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Owns `product_lookup_unresolved`.
  - The current risk is over-blocking: an old pending same-category product can make a grounded recommendation answer look invalid.
  - Existing helper `isGroundedProductSelectionRecommendation` is the right direction, but the boundary should be audited and covered more generally.
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`
  - Builds pending-review handoff answers.
  - Has category-follow-up fallback logic that must stay exact enough to avoid hijacking new turns.
- `tests/agent-v2-responses-runtime.spec.ts`
  - Has runtime regressions for selected-product follow-ups and unresolved pending product alternatives.
- `tests/agent-v2-final-answer-validator.spec.ts`
  - Has validator coverage for unresolved lookup blocking.
- `tests/agent-v2-product-lookup-clarification.spec.ts`
  - Covers lookup clarification behavior and should stay green.

## Implementation Checklist

1. Strengthen active product context guidance in `responses-agent.ts`.
   - Say active product context is optional memory.
   - Use it only for direct continuations such as pronoun follow-ups, usage questions, "passt das?", "wie oft?", "soll ich es behalten?", and explicit references to the same product.
   - Ignore it when the user asks for alternatives, broader recommendations, another product, another category, or a new named product.
   - For alternatives after a bad fit assessment, call the normal recommendation path with `select_products`.

2. Audit pending active context injection.
   - Keep `activePendingProductContextToLookupResult` only if validators interpret it as a guardrail for the same unresolved product.
   - If the synthetic unresolved result is still too broad, restrict how it is passed into validation or how it is matched.
   - Do not make old pending context globally block same-category recommendations.

3. Narrow unresolved-product validation to exact claim targets.
   - Keep blocking product-specific claims about the unresolved pending product.
   - Allow grounded `select_products` recommendations when payload product IDs match tool-grounded product IDs.
   - Allow alternatives and category recommendations even if there is an older pending product in the same category.
   - Allow a newly named product in the same category to go through normal lookup instead of inheriting the old pending product.
   - Keep repair hints focused on the actual broken contract, not as a router for normal conversation.

4. Add cross-category regression tests.
   - Pending shampoo plus "passt es?" still blocks or hands off to pending review.
   - Pending shampoo plus "Hast du Alternativen?" recommends grounded alternatives.
   - Pending conditioner plus broad conditioner recommendation asks recommend normally.
   - Pending leave-in or mask plus a new named product in the same category performs fresh lookup/selection rather than reusing old context.
   - Resolved selected-product follow-up still calls `load_product_facts` for product assessment.
   - Product-specific unresolved assessment still does not invent a fit answer.

5. Verify UI side effects.
   - A topic-switch turn must not re-render the old product clarification card or old intake card.
   - A same-product pending-review continuation may still show the pending handoff.
   - Any user-facing German copy introduced by the change must stay natural and short.

## Verification

Focused checks:

```bash
./node_modules/.bin/tsx --test --test-name-pattern "pending active product context|unresolved pending product context|selected-product alternative recommendations" tests/agent-v2-responses-runtime.spec.ts
./node_modules/.bin/tsx --test tests/agent-v2-final-answer-validator.spec.ts
./node_modules/.bin/tsx --test tests/agent-v2-product-lookup-clarification.spec.ts
```

Broader checks before handoff:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-responses-runtime.spec.ts
npm run typecheck
```

If this becomes a shipping bundle rather than a narrow local fix, run:

```bash
npm run ci:verify
```

## Risks And Decisions

- Very short messages like "und das?" can be genuinely ambiguous. Default behavior should remain conservative: continue the old product only when that is the natural reading, otherwise ask a short clarification.
- Prompt guidance alone is not enough because repair/validator logic can still override good model behavior. The validator boundary is part of the fix.
- The plan intentionally avoids an extra structured topic-resolution object. That keeps the architecture simpler, but tests need to carry more of the confidence burden.

## Implementation Goal Contract

Implement this plan in the existing selected-product worktree. Preserve unrelated dirty changes. Keep edits scoped to Agent V2 active product context guidance, unresolved lookup validation, pending-review follow-up routing, and focused tests. Run the listed verification before claiming readiness. Stop before staging, committing, pushing, creating PRs, migrations, or cleanup unless Nick explicitly approves.
