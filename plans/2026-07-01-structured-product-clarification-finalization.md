# Structured Product Clarification Finalization

## Goal

Make Agent V2 product-lookup clarification turns use one source of truth: the
structured product lookup result. When lookup returns `needs_variant_selection`,
the agent may write natural German clarification copy, but the backend must
force the matching product clarification card and prevent text/card mismatch.

## Current Problem

In the local Balea Plex Care example, the card showed one candidate:
`Balea Professional Plex Care 2in1`.

The assistant bubble still said "mehrere mögliche Varianten" even though the
card had exactly one candidate. Trace inspection showed the model had produced a
more singular clarification, but the final visible answer was replaced by a
repair/fallback path. The structured card was right; the visible text was not
reconciled against the recovered card.

## Chosen Direction

Use a hybrid contract:

- deterministic lookup owns product identity and candidates
- the agent owns natural wording
- backend validation owns consistency and forces the card

Do not let the model invent candidate names or decide whether a card exists.

Implement this with one reconciliation boundary first: when product lookup turn
outcome recovery has both the assistant answer and the recovered
`product_lookup_clarification`, deterministically regenerate the bubble text
from the card candidate data. Do not attempt fuzzy contradiction detection over
free German text.

## Implementation Steps

1. Add a candidate-aware clarification copy helper near the lookup outcome code
   in `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`.
   - One candidate: natural singular confirmation copy, using the candidate
     display name when available.
   - Multiple candidates: keep multi-variant copy.
   - Category mismatch: preserve the existing category-specific framing.
   - Reuse this helper for the existing deterministic categoryless fallback
     copy around `buildCategorylessKnownBrandClarificationAnswer`, which
     currently hardcodes "mehrere mögliche Varianten" regardless of count.

2. Reconcile final answer text at the outcome boundary in
   `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`.
   - Use `productLookupClarification != null` as the signal that the card is
     forced; do not rely on `answer_mode`.
   - Immediately before the `buildProductLookupTurnOutcome` return, after
     `productLookupClarification` is computed, set
     `answer.payload.user_facing_answer_de` and related clarification question
     fields from the helper.
   - Do this unconditionally for forced clarification cards. This is the
     single-source-of-truth choice; it trades some model-authored phrasing for
     consistency with the card.
   - Do not touch product candidates, search results, `productIntakeOffer`, or
     active product context derivation.

3. Secondary defense-in-depth, only after the boundary fix is green: update the
   model-facing lookup guidance in `src/lib/agent-v2/product-lookup-policy.ts`.
   - The current assistant guidance says "mehrere mögliche Treffer" for
     `needs_variant_selection` regardless of candidate count.
   - This is not the visible bug string; the boundary fix must not depend on
     this prompt wording.
   - If implemented, thread candidate count through
     `enrichAgentV2ProductLookupResultForAssistant`, where `output.candidates`
     is available, instead of editing only the status-only helper.
   - Neutral wording ("passende Variante") is acceptable when count is not
     available.

4. Treat these as verification points, not new architecture:
   - `src/lib/agent-v2/production/chat-pipeline.ts` already attaches
     `product_lookup_clarification` from the outcome.
   - `pending_ui_action: "product_lookup_clarification_card"` already expresses
     that a card is required.
   - `blocks_product_specific_answer: true` plus the existing
     `product_lookup_unresolved` validator already blocks product assessment
     before selection.

5. Defer broader validator plumbing unless tests show the model still produces
   unreconciled text before the outcome boundary. If needed later, thread
   `candidate_count` into `AgentV2ProductLookupValidationResult` and validate
   bubble/card wording there too. This is not the first implementation step
   because fallback-sourced copy can bypass that validator.

6. Add regression tests covering:
   - one-candidate clarification: singular bubble text plus forced card. Extend
     the existing real-pipeline single-candidate clarification test in
     `tests/agent-v2-product-lookup-clarification.spec.ts` around the current
     single-candidate card assertion instead of adding only a duplicate test.
   - multi-candidate clarification: multi-variant bubble text plus card
   - repair/fallback path after failed model answer still uses candidate-aware
     bubble copy
   - no product-fit assessment appears until the candidate is selected
   - sweep stale plural-copy fixtures, including
     `tests/agent-v2-product-selection.spec.ts`, which mocks the pipeline and
     may preserve old copy unless updated deliberately.

## Non-Goals

- Do not change product search/ranking behavior.
- Do not let the agent create product candidates.
- Do not answer suitability before the user selects/confirms a candidate.
- Do not redesign the product clarification card UI.
- Do not add redundant fields such as `card_required` or
  `do_not_assess_until_selected` while existing policy fields already express
  those requirements.

## Verification

Run focused tests first:

```bash
npx tsx --test tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-product-selection.spec.ts
npm run typecheck
```

Before ship/PR handoff, also run the repo finish gate:

```bash
npm run ci:verify
```

Manual local smoke:

1. Ask `Kannst du prüfen ob die Balea Professional Haarmaske plex care 2 in 1 zu mir passt?`
2. Confirm the assistant uses singular copy when only one card candidate appears.
3. Confirm no product-fit answer appears until the candidate is selected.
