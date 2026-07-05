# Agent V2 Product Continuity After Intake Debug Plan

Date: 2026-07-03
Status: Claude-reviewed and reshaped for implementation handoff; reconcile existing in-flight changes before coding
Branch/worktree: `codex/agent-v2-validator-diet-slice-1-product-facts` in `.worktrees/agent-v2-validator-diet-slice-1-product-facts`
Claude review: `plans/2026-07-03-product-continuity-after-intake-debug-plan.claude-review.md`

## Goal

Fix the product conversation continuity after a user adds a product and Chaarlie later says it was checked and linked.

The target behavior:

- If the product was approved/linked and has verified specs, the next fit question should use the product identity plus product facts and answer normally.
- If the product was linked but specs are still missing, the answer should say exactly that, without pretending the product was never checked.
- If the user asks for alternatives after a product was discussed, the assistant should answer the alternatives request and not force a weird "Welche genaue Variante meinst du?" message first unless the variant truly blocks the answer.

## Final Alignment Decisions

These decisions are settled and should guide implementation.

### 0. Use the lean implementation shape

Implement the narrow fixes on the existing seams first. Do not build a new heavyweight `ProductQuestionFrame` module as the starting point.

Use:

- existing active product context;
- existing resolved product context;
- target product hints;
- selected-product projections;
- validation findings;
- trace metadata.

Only introduce a new shared type/module if the narrow implementation creates real duplication or unclear ownership.

### 1. Product approval means database-complete, not identity-only

For this plan, an approved/linked product means:

- the product has been fully added to the product database for its category;
- the category-specific properties/spec row needed for assessment exist;
- the user's routine usage is linked to the product ID;
- Chaarlie may load facts for that product ID in later chat turns;
- the only intentional distinction from normal recommended catalog products is `is_chaarlie_recommended = false`.

The readiness event is the DB-complete approval transaction, not the chat notification.

Once the product row, category spec row, linked `user_product_usage`, review/submission state, and required approval package writes are complete:

- send the chat notification `Wir haben ... geprueft und in deiner Routine verknuepft`;
- transition Agent V2 context from pending to resolved;
- allow later chat turns to load category facts by `product_id`.

If required category specs/properties are missing, the approval flow should block or require rework. It should not send the normal "checked and linked" notification.

After the normal notification has been sent, failing to load facts is a continuity bug or data-read bug, not normal behavior.

### 2. Product context is persistent, but relevance is agent-decided per turn

Do not use a fixed turn limit as the main rule.

Persist recent resolved product context as a compact topical stack. On each turn, present that context to the agent and let it judge whether the latest user message continues the same product topic, uses the product as an alternatives baseline, starts a new product, asks broadly, or is unclear.

Code should only block obvious invalid carryover:

- user names a different product;
- user clearly switches category/topic;
- user asks a broad category recommendation where the prior product should be context at most;
- the model attempts a product-specific assessment without loaded facts.

The chosen relation should be traced for debugging, but it should not become another brittle router.

### 3. Alternatives intent should answer alternatives

When the user asks for alternatives, that intent should win over exact variant ambiguity unless the ambiguity would materially change the answer.

Default behavior:

- if a recent/resolved product ID exists, treat it as the baseline/reference and answer alternatives;
- if category and need are clear enough, answer alternatives with a soft assumption if useful;
- only ask for clarification first when the category or core need is genuinely unclear enough that recommendations would likely be wrong.

Exact variant lookup should not hijack an alternatives turn into a visible clarification card.

### 4. Pending follow-up action is an execution receipt, not the agent's memory

The agent should use conversation history and recent product context to understand short replies like `ja bitte`.

`pending_followup_action` remains only for concrete confirmable offers that need reliable execution on a later short confirmation. It should not be required for soft helpful closings.

If a useful answer has a weak optional closing but no pending state, prefer removing/sanitizing the closing over replacing the whole answer with a generic repair.

### 5. Current-routine product shortcuts may not guess generic `Produkt`

Keep the deterministic current-routine identity shortcut only when the user reference is unambiguous enough to answer without the model.

Allowed shortcut examples:

- `Kennst du mein Shampoo?` when one shampoo is in routine inventory.
- `Kennst du den Conditioner, den ich benutze?` when one conditioner is in routine inventory.

Do not shortcut generic singular product references when multiple routine products exist:

- `Weißt du welches Produkt ich gerade benutze?`
- `Kennst du das Produkt, das ich benutze?`

In those cases, pass the turn to the real Agent V2 model with routine inventory and recent product context. The model may then list all routine products, ask which one the user means, use a clearly recent product topic, or call the right product/recommendation tools.

This is not a new intent router. The deterministic code only decides whether a shortcut is safe. If it is not safe, the agent handles the conversational intent.

## Claude Review Corrections

Claude reviewed this plan and confirmed the diagnosis, but found three implementation traps that must be addressed before handoff:

1. This worktree already has in-flight implementation changes in the same target files. Do not start from a clean-TDD assumption or dispatch subagents blindly. First reconcile the existing diff and decide which edits belong to this plan.
2. `ProductQuestionFrame` should not be built as a new heavyweight module up front. Use the existing active product context, target-product hints, selected-product projections, and trace fields first. Add a dedicated shared frame only if the narrow fixes prove they need it.
3. Tests that assert German copy must use the real source strings with umlauts, not ASCII approximations such as `zuverlaessig` or `verfuegbaren`, otherwise negative assertions can false-green.

The lean load-bearing fix is four parts:

1. DB-complete approval transaction transitions pending product context to resolved and sends notification only after specs are complete;
2. target-detail assessment loads real specs/facts for the owned product;
3. empty-claims projections no longer satisfy product grounding;
4. alternatives-baseline turns do not lead with variant clarification.

Feature-flag regime:

- product intake is controlled by `PRODUCT_INTAKE_ENABLED` / `isProductIntakeEnabled()`;
- it defaults off in production;
- current local failures and verification are in the flag-on regime;
- rollback for this slice is effectively the product-intake feature flag unless the change touches shared, flag-independent validation behavior.

## Observed Failures

### Failure 1: Approved and linked product still cannot be assessed

Screenshot path:
`/var/folders/zq/tmsmyfv96wqf0jmfz3gpdfq80000gn/T/codex-clipboard-a46b387d-7d62-427f-92fe-6b34bf0784be.png`

Flow:

1. User asks whether `L'OREAL PARIS ELVITAL Shampoo Glycolic Gloss` fits.
2. Product is not found, so an intake card is shown.
3. User adds the product.
4. Later assistant notification says:
   `Gute Nachrichten: Wir haben ... geprueft und in deiner Routine verknuepft.`
5. User asks:
   `Okay und passt er zu mir?`
6. Assistant answers:
   `Ich weiss, dass du Shampoo Glycolic Gloss meinst. Ob es wirklich gut zu dir passt, kann ich gerade nicht zuverlaessig aus den verfuegbaren Produktdaten ableiten...`

Why this is bad:

- The assistant does understand the reference.
- The hard product-facts validator is probably doing the right thing: it prevents an invented fit verdict.
- The broken part is upstream: after "checked and linked", the next turn is not reliably getting usable product facts.

### Failure 2: Alternatives request gets variant-confirmation preface

Screenshot path:
`/var/folders/zq/tmsmyfv96wqf0jmfz3gpdfq80000gn/T/codex-clipboard-7c187fb2-974e-4db9-8af9-63fb2ceaec7a.png`

Flow:

1. User asks whether `Schwarzkopf GLISS Conditioner Liquid Silk` fits.
2. Product is intake-submitted and later linked.
3. User asks:
   `Ja passt das zu mir?`
4. Assistant gives a useful fit answer.
5. User asks:
   `okay, was waeren sonst alternativen?`
6. Assistant first says:
   `Ich finde zu ... mehrere moegliche Varianten und moechte nichts Falsches bewerten. Welche genaue Variante meinst du?`
7. A card asks the user to confirm the conditioner.
8. After confirmation, the assistant gives the useful alternatives answer.

Why this is bad:

- The later alternatives answer proves the system can answer.
- The visible clarification message is over-eager and misaligned with the user's intent.
- The card may still be useful as a quiet disambiguation/grounding UI, but the visible answer should not be dominated by variant clarification when the user asked for alternatives and enough context exists.

## Root Cause Evidence

### 1. Product-intake notifications do not update Agent V2 conversation state

File: `src/lib/product-intake/notifications.ts`

`sendProductIntakeReviewNotification` inserts an assistant message with `rag_context.product_intake_review`, but it does not update `conversation_states.agent_v2.active_product_contexts`, `active_resolved_product_context`, or `prior_selected_product_projections`.

That means the next user turn must recover continuity from:

- recent assistant text;
- saved routine inventory from `getUserContext`;
- product lookup/catalog tools;
- existing conversation state, if another path already wrote it.

This is not enough for a durable "we checked it, now ask me about it" promise.

### 2. Current routine matching can identify the product, but not guarantee facts

File: `src/lib/agent-v2/production/chat-pipeline.ts`

`buildMatchedRoutineActiveProductContextsFromRoutineInventory` can create a resolved active product context from matched routine inventory when the latest follow-up is pronoun-like and the recent assistant mentioned the product.

That explains why the first failure says `Ich weiss, dass du ... meinst`.

But this active context is only identity:

- `product_id`
- `display_name`
- `category`
- source `routine_inventory`

It is not a product-facts projection.

### 3. The hard facts validator is correct and should stay hard

File: `tests/agent-v2-final-answer-validator.spec.ts`

Existing test:
`validator blocks product assessment from found-exact identity without product facts`

This is the right guardrail. A resolved product ID alone must not authorize claims like "passt gut, weil es leicht reinigt".

Do not remove this validator.

### 4. The runtime has a fallback that truthfully exposes the missing facts bridge

File: `src/lib/agent-v2/runtime/responses-agent.ts`

`buildActiveResolvedProductFollowupFallback` produces the kind of answer seen in the screenshot:

`Ich weiss, dass du **<product>** meinst. Ob es wirklich gut zu dir passt, kann ich gerade nicht zuverlaessig aus den verfuegbaren Produktdaten ableiten...`

That fallback is truthful, but after an approved product notification it exposes a product-continuity failure.

### 5. Selected-product and intake-notification paths are not the same

File: `src/app/api/chat/product-selection/route.ts`

The clarification-card selection route does persist active product state and calls the normal Agent V2 pipeline with `trustedSelectedProductContext`.

The product-intake review notification route does not. The screenshot uses the notification text from `src/lib/product-intake/notifications.ts`, so the first failure is mainly the intake-review path, not just the product-selection-card path.

### 6. Alternatives are hijacked by product-lookup clarification recovery

Files:

- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`

The deterministic/fallback clarification builders still produce visible German copy like:

`Ich finde zu <displayName> mehrere moegliche Varianten und moechte nichts Falsches bewerten. Welche genaue Variante meinst du?`

This is appropriate for a direct exact-product assessment with unresolved identity. It is not appropriate as the leading message when the user asks for alternatives and the system can provide alternatives after selection anyway.

## Feedback Loop Already Run

Focused command:

```bash
./node_modules/.bin/tsx --test --test-name-pattern "active resolved product|trusted selected product|hides owned lookup products|allows user-owned non-recommended" tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-product-selection.spec.ts
```

Result:

- Passed 6/6.
- The pass is useful evidence because it shows current tests cover pieces of the behavior, but not the desired approved-product happy path.

Read-only DB probe attempted:

```bash
./node_modules/.bin/tsx -e "<query products and spec tables>"
```

Result:

- Failed with `supabaseUrl is required` because this shell did not have app env loaded.
- Do not treat this as evidence that product rows/spec rows are missing.

## Live Trace Findings From Nick's 2026-07-03 Local Runs

### L'Oreal approved-product follow-up

Conversation: `29c30dd4-fdf7-478e-8cd6-b7fbe6088e11`
Assistant message: `f9419216-55c1-46ec-b2dc-6e8b755e83d7`
Trace time: `2026-07-03T14:18:47.233327+00:00`

Observed assistant message:

`Ich weiss, dass du **Shampoo Glycolic Gloss** meinst. Ob es wirklich gut zu dir passt, kann ich gerade nicht zuverlaessig aus den verfuegbaren Produktdaten ableiten...`

Stored product state:

- product ID `88c230c5-1020-4648-a10e-c2a1e8c87e0e`
- name `L'Oréal Paris Elvital Glycolic Gloss Shampoo`
- `category_key: shampoo`
- active, lifecycle active
- `is_chaarlie_recommended: false`
- has `product_shampoo_specs`
  - `thickness: fine`
  - `shampoo_bucket: normal`
  - `scalp_route: balanced`
  - `cleansing_intensity: regular`

Stored routine usage:

- `match_status: matched`
- `product_id: 88c230c5-1020-4648-a10e-c2a1e8c87e0e`
- `product_submission_id: f11b0cff-0d0d-48f3-9592-3c2f6fda4c32`

But stored conversation state still had the same product as a pending active product:

- `source: product_intake_submission`
- `status: pending_review`
- `product_id: null`
- `submission_id: f11b0cff-0d0d-48f3-9592-3c2f6fda4c32`
- `active_resolved_product_context: null`

Agent V2 trace:

- tool calls: `load_advisor_guidance` only
- no `select_products`
- no `lookup_product_candidate`
- repair failed with:
  - `product_assessment_grounding`
  - `product_lookup_unresolved`
- rejected assessed product ID was the real product ID `88c230c5-1020-4648-a10e-c2a1e8c87e0e`

Conclusion:

The product and specs existed. The agent understood the product identity. The failure was that the resolved product follow-up did not force a product-facts load via `select_products`, and the stale pending conversation state was not converted to resolved state after approval.

This is stronger than the initial hypothesis: the first fix must ensure linked-product fit follow-ups always attempt product-facts grounding for the resolved product ID.

### Schwarzkopf alternatives follow-up

Conversation: `4b80dc89-53c7-4388-9f32-2d46382c174a`
Assistant message: `f1938a23-1a70-476c-8998-d7ca1de46717`
Trace time: `2026-07-03T14:16:31.032457+00:00`

Observed assistant message:

`Ich finde zu Schwarzkopf GLISS Conditioner Liquid Silk mehrere moegliche Varianten und moechte nichts Falsches bewerten. Welche genaue Variante meinst du?`

The attached clarification card had one candidate:

- `Schwarzkopf GLISS Liquid Silk Spuelung`
- product ID `7fb31d10-ff21-410b-9dc2-2d1ad34b9130`

Agent V2 trace:

- first called `select_products`
  - `product_request_kind: specific_products`
  - `requested_product_count: 3`
  - `user_request: alternatives to Schwarzkopf GLISS Conditioner Liquid Silk`
  - `output_summary: products:3`
- then called `lookup_product_candidate`
  - `product_name_text: Conditioner Liquid Silk`
  - `output_summary: product_lookup:needs_variant_selection`
- repair failed with:
  - `product_lookup_required`
  - `pending_followup_action_missing`
- request interpretation collapsed to:
  - `Intent: clarification`
  - `product_request_kind: product_detail`
  - router response mode `clarify_only`

Conclusion:

There was not clear evidence that a polished good German final answer was created and then overwritten. But there is clear evidence that the correct tool path existed: the agent already called `select_products` for three alternatives before the lookup/validator path dragged the turn into variant clarification.

The overreach is the `product_lookup_required` rule applying to an alternatives request merely because the alternatives are "to" a named product baseline. For alternatives, exact baseline variant identity should not have kill power when category/profile-grounded alternatives can already be produced.

### 7. Generic current-product shortcut bypasses the real agent and defaults to shampoo

File: `src/lib/agent-v2/runtime/responses-agent.ts`

Function:

- `buildCurrentRoutineProductIdentityAnswer`
- `isCurrentRoutineProductIdentityQuestion`
- `detectCurrentRoutineIdentityCategory`

Current behavior:

- The shortcut runs before the model loop.
- Generic `produkt` matches `isCurrentRoutineProductIdentityQuestion`.
- `detectCurrentRoutineIdentityCategory` defaults to `shampoo` when no explicit category is present.
- Therefore `Weißt du welches Produkt ich gerade benutze?` can answer only the shampoo even when routine inventory contains multiple products.

Real-model probe from this worktree:

- Context contained two routine products:
  - `Balea Aqua Shampoo` as `shampoo`
  - `John Frieda Frizz Ease Wunder-Reparatur Conditioner` as `conditioner`
- Exact prompt `Weißt du welches Produkt ich gerade benutze?`
  - model calls: `0`
  - answer: `Ja, ich sehe **Balea Aqua Shampoo** als dein aktuelles Shampoo in deiner Routine.`
- Nearby prompt `Weißt du, welche Pflegeprodukte ich gerade benutze?`
  - model calls: `3`
  - answer correctly listed both products.
- Nearby prompt `Weißt du, welche Produkte ich gerade benutze?`
  - model calls: `3`
  - answer correctly listed both products.

Conclusion:

The model can handle this when the turn reaches it. The bug is the shortcut's kill power, not lack of model understanding.

## Chosen Architecture: Product Question Frame

Use a small per-turn product-question framing concept before final answer generation and validation.

This is not a new conversation router. It is a context contract that keeps three concepts separate:

1. product identity: do we know which product the user means?
2. product facts: do we have verified facts/specs for that product ID in this turn?
3. visible UI action: do we actually need an intake card or variant-selection card?

Do not start by adding a new module or new persistent schema just to represent this. First reuse the existing seams:

- `active_product_contexts[].status`
- `activeResolvedProductContext`
- target product IDs/hints in the production pipeline
- selected-product projections
- tool-call trace metadata
- validation findings

If these existing seams become awkward or duplicated during implementation, then introduce a focused shared type. If introduced, the target shape should stay compact:

```ts
type ProductQuestionFrame = {
  role: "target" | "baseline" | "background"
  identity: "unresolved" | "pending" | "resolved"
  product_id: string | null
  category: string | null
  source:
    | "active_product_context"
    | "routine_inventory"
    | "product_intake_review"
    | "trusted_product_selection"
    | "latest_user_message"
    | "recent_assistant_message"
  relation?: "same_product" | "baseline_for_alternatives" | "broad_category" | "new_product" | "new_topic" | "unclear"
  requires_facts: boolean
  facts_status: "unknown" | "loaded" | "missing"
  ui_action: "none" | "intake" | "variant_card"
}
```

Plain meaning:

- `role: "target"` means the user is asking about this exact product: `passt der zu mir?`, `wie oft nutzen?`, `ist das farbsicher?`
- `role: "baseline"` means the product is only the reference point: `was waeren Alternativen dazu?`, `statt dem`, `andere Marken als X`
- `role: "background"` means a product is mentioned but should not drive the turn unless the model chooses to use it as context.

The most important rule:

- a resolved `product_id` is not enough for a fit verdict.
- `product_assessment` needs `facts_status: "loaded"` plus concrete product evidence for the assessed ID.
- identity-only projections or fallback projections with empty `supported_claims` must not satisfy `product_assessment_grounding`.

This keeps the validator diet honest: we reduce routing validators, but keep the hard truth invariant.

The framing should be shown to the agent as context and recorded in traces. It should not own final intent or final prose. The agent remains responsible for interpreting the latest message and selecting tools.

## Persistence And Lifetime

Persist only the product pointer, not the product verdict or fact-readiness result.

### Durable sources of truth

These remain outside Agent V2 conversation state:

- catalog `products`
- category spec tables, such as `product_shampoo_specs`
- `user_product_usage`
- product-intake submissions/review state

These can live longer than the chat and should be re-read when needed.

### Conversation-scoped persistent state

Persist in `conversation_states.state.agent_v2.active_product_contexts`:

- `product_id`
- `category`
- display/brand/product name
- `source`
- `submission_id` when available
- `status: "pending_review" | "resolved"`
- last relevant message or turn metadata when already available
- `updated_at`

This state is a topical pointer. It should survive normal follow-ups like:

- `Und passt das zu mir?`
- `Wie oft soll ich es nutzen?`
- `Was waeren Alternativen?`
- `Soll ich es behalten?`

It should not permanently pin the whole conversation. The existing small active-context list should behave like an LRU stack:

- newest resolved product is the primary active product.
- keep only a small number of recent product contexts.
- demote or ignore the active product when the latest user message clearly switches category/topic or names another exact product.
- remove stale pending context by `submission_id` first when approval resolves it.
- do not expire solely by a fixed turn count when the user is clearly still on the same topic.

Do not persist `facts_status: "loaded"` as durable truth. Product data can change, and the answer must be grounded by facts loaded for the current turn.

### Per-turn framing

Build the per-turn product-question framing fresh on every chat turn from:

- latest user message
- recent conversation messages
- persistent Agent V2 active product context
- routine inventory / `user_product_usage`
- trusted selected product context
- product-intake review `rag_context` recovery for old conversations
- tool results during the turn

Before tools run, `facts_status` is usually `unknown`.

The framing may include a model-visible recent product context brief such as:

```txt
Recent resolved product context:
- L'Oréal Paris Elvital Glycolic Gloss Shampoo, product_id: ..., category: shampoo, linked from product intake approval, last discussed 1 turn ago.

Use this for natural follow-ups if the latest user message appears to continue the product topic. Do not force it into broad recommendations, clearly new products, or unrelated topics.
```

After product facts are loaded:

- `loaded` means the assessed product ID has concrete supported evidence.
- `missing` means the product identity is known but category specs/facts are absent or unavailable.

The framing may be stored in traces for observability, but it should not become a separate durable truth source.

### UI action lifetime

`ui_action` is per-turn only.

- `intake` is shown when the product is unknown/not in database and user needs to add it.
- `variant_card` is shown when exact identity is genuinely required for the requested output.
- `none` is used for normal answers, including alternatives where exact baseline variant is not blocking.

This prevents old cards or stale pending context from forcing future replies.

## Behavioral Rules

### Exact product assessment/detail

If the frame is:

```ts
role: "target"
identity: "resolved"
requires_facts: true
```

then the runtime must load product facts by `product_id` before a terminal assessment answer.

Allowed outcomes:

- facts loaded: answer product-specific fit/detail normally.
- facts missing: say the product is known/linked, but verified product facts are missing; do not invent claims and do not show a new intake card.

### Unresolved exact product assessment/detail

If the frame is:

```ts
role: "target"
identity: "unresolved" | "pending"
requires_facts: true
```

then exact product claims are still blocked.

Allowed outcomes:

- variant card when there are multiple plausible catalog products.
- intake card when product is not in the database.
- honest no-answer if neither action is possible.

This is a hard-keep validator area.

### Alternatives or recommendations relative to a product

If the frame is:

```ts
role: "baseline"
```

then the baseline product should guide the answer but should not dominate the turn.

Rules:

- if `product_id` is already known, do not run variant lookup again for the baseline.
- if `select_products` already produced valid alternatives, do not replace the visible answer with `Welche genaue Variante meinst du?`.
- if the baseline is ambiguous, mention uncertainty softly only if useful.
- only force a variant card when the exact variant materially changes the alternatives.

This is the key validator-diet change for the Schwarzkopf failure.

### Optional follow-up offers

Do not treat every closing sentence as a pending action.

Hard pending state is required when the assistant makes a real confirmable offer:

- `Soll ich dir drei leichtere Alternativen raussuchen?`
- `Moechtest du, dass ich es in deine Routine einordne?`

Pending state is not required for soft closings:

- `Wenn du magst, kann ich dir danach noch Alternativen nennen.`
- `Ich kann dir auch helfen, es spaeter einzuordnen.`

If unsure, sanitize/remove the optional closing instead of killing the answer.

Implementation note:

- The transcript still remains available to the agent.
- `pending_followup_action` is only a structured receipt for concrete offers that should execute reliably after a short confirmation.
- It is not the sole source of conversational understanding.

## Missing Regression Tests

### Test 0: identity-only product projection does not satisfy product facts

Add to `tests/agent-v2-final-answer-validator.spec.ts` and/or the select-products projection tests.

Shape:

- terminal answer is `product_assessment`
- `assessed_product_ids` contains a real product ID
- tool projection has `allowed_claim_sources` but empty `supported_claims` and no concrete spec/comparison facts

Assert:

- validator still raises `product_assessment_grounding`
- final answer cannot claim product-specific suitability from identity alone

This catches the adversarial-review P0.

This is not covered by the existing "no projection" grounding test. The regression must include a projection that has a real product ID and source labels, but no concrete supported claims/spec facts.

### Test 1: approved matched routine product with verified specs is assessable next turn

Add to `tests/agent-v2-production-chat-pipeline.spec.ts`.

Shape:

- Seed `routine_inventory` with a matched product:
  - category `shampoo`
  - `product_id`
  - `match_status: "matched"`
  - product name matching the review notification
- Seed recent assistant message:
  - `Gute Nachrichten: Wir haben **...** geprueft und in deiner Routine verknuepft.`
- Latest user message:
  - `Okay und passt er zu mir?`
- Stub `createSelectProductsTool`/engine so the target product returns real supported claims.
- Assert:
  - `runAgentV2ResponsesTurn` receives `activeResolvedProductContext`.
  - `select_products` is called with the target product ID.
  - final answer is `product_assessment`, not fallback.
  - final answer does not contain the actual fallback substring from source, e.g. `nicht zuverlässig aus den verfügbaren Produktdaten`.

This test should fail before implementation if the bridge is still broken.

### Test 2: approved matched routine product without verified specs gets honest pending-facts answer

Add next to Test 1.

Shape:

- Same flow, but product has no verified spec projection.
- Assert:
  - Assistant says product is linked/known.
  - Assistant says specific product facts are missing or not loaded.
  - Assistant does not show intake card again.
  - Assistant does not say product is unknown/not in database.
  - Assistant does not invent fit claims.

This keeps the hard truth validator intact.

### Test 3: alternatives follow-up after resolved product does not lead with variant clarification

Add to `tests/agent-v2-product-lookup-clarification.spec.ts` or `tests/agent-v2-responses-runtime.spec.ts`.

Shape:

- Recent conversation has linked/assessed `Schwarzkopf GLISS Conditioner Liquid Silk`.
- Latest user message:
  - `okay, was waeren sonst alternativen?`
- Product lookup may still recover ambiguous candidates.
- Stub `select_products`/the recommendation engine to return concrete alternatives if the test asserts visible alternatives.
- Assert:
  - final visible answer contains alternatives.
  - final visible answer does not contain `Welche genaue Variante meinst du?`.
  - no forced clarification card is attached unless the answer explicitly needs the user to choose before proceeding.

### Test 4: variant clarification remains hard for exact product assessment

Add as a paired safety test.

Shape:

- User asks:
  - `Passt Schwarzkopf GLISS Conditioner Liquid Silk zu mir?`
- Lookup returns multiple plausible variants and no active resolved product.
- Assert:
  - clarification/card is still allowed.
  - no exact fit verdict is produced.

This prevents over-dieting the validator.

### Test 5: optional next-step offer does not force pending action

Add to `tests/agent-v2-final-answer-validator.spec.ts`.

Shape:

- answer gives a useful alternatives or fit response
- closing says something soft like:
  - `Wenn du magst, kann ich dir danach noch Alternativen nennen.`
- `pending_followup_action` is null

Assert:

- answer is not killed with `pending_followup_action_missing`
- no generic fallback is produced

Add paired hard-keep test:

- answer says:
  - `Soll ich dir drei Alternativen zusammenstellen?`
- `pending_followup_action` is null

Assert:

- validator still flags missing pending state.

### Test 6: DB-complete approval creates resolved product context before notification

Add to product-intake notification/repository tests or pipeline tests, depending on the implementation seam.

Shape:

- approval package writes product row, category spec row, linked `user_product_usage`, and approved submission/review state.
- after those writes, notification is sent to chat.

Assert:

- conversation state transitions matching pending submission to resolved product context.
- resolved context includes product ID, category, display name, source `product_intake_review`, and `submission_id`.
- stale pending context for the same `submission_id` is removed.
- a later follow-up can load category facts by product ID.

Add paired blocker/rework case:

- approval attempts to notify while required category specs are missing.
- assert normal `checked and linked` notification is not sent.
- assert no resolved Agent V2 context is written.

### Test 7: generic current-product question with multiple routine products reaches the agent

Add to `tests/agent-v2-responses-runtime.spec.ts`.

Shape:

- routine inventory contains at least two matched products in different categories, for example shampoo and conditioner.
- latest user message:
  - `Weißt du welches Produkt ich gerade benutze?`

Assert:

- the deterministic current-routine shortcut does not answer by defaulting to shampoo.
- a model request is made.
- the model-visible input includes both routine products.

Use a deterministic fake model for the regression assertion, but do not use that fake model output as product-quality evidence. The test proves routing: ambiguous generic product wording reaches the agent.

Add paired shortcut-keep tests:

- `Weißt du welches Shampoo ich gerade benutze?` with one shampoo may shortcut.
- `Weißt du welchen Conditioner ich gerade benutze?` with one conditioner may shortcut.

Add a real-model/manual verification prompt before handoff:

- With two routine products, ask in local chat:
  - `Weißt du welches Produkt ich gerade benutze?`
- Expected:
  - either list both routine products or ask which product the user means.
  - no silent default to shampoo.

## Implementation Plan

### Step 0: Reconcile current in-flight implementation

Chosen strategy: reconcile in-place in this same worktree/branch because the dirty changes are connected to the validator-diet/product-continuity effort.

The branch already contains substantial uncommitted changes across the exact target files. Before adding new code:

- inspect the current diff and classify which changes belong to this plan;
- do not duplicate existing test/source edits;
- preserve unrelated dirty changes;
- if using subagents, give them disjoint file scopes only after this reconciliation.

This replaces the earlier clean-TDD assumption.

### Step 1: Add or repair the regression tests

Files:

- `tests/agent-v2-production-chat-pipeline.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-product-lookup-clarification.spec.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`

Ensure at least one focused regression would fail on the unreconciled behavior, but account for the fact that some tests may already exist in the current dirty worktree.

### Step 2: Add lightweight product-question framing only where needed

Likely files:

- existing helpers near `src/lib/agent-v2/production/chat-pipeline.ts`
- `src/lib/agent-v2/named-product-context.ts`
- `src/lib/agent-v2/resolved-product-selection-adapter.ts`

Responsibilities:

- expose enough context for the agent to decide whether the latest message is same-product, alternatives-baseline, broad category, new product, or unclear
- provide candidate recent products to the agent for relevance judgment
- record the chosen relation in trace when available
- carry the resolved `product_id` when available
- set `requires_facts` for target suitability/detail/cadence/protocol turns
- keep `ui_action` separate from answer mode

Do not:

- create a large deterministic intent router.
- encode every possible German phrase as a hard branch.
- use the frame to decide final prose.
- use a fixed turn count as the main product-context expiration rule.
- introduce a new shared `ProductQuestionFrame` type unless the narrow implementation needs it.

The product-question framing should be a compact context contract for the model and validators.

### Step 2a: Cut current-routine shortcut power for ambiguous generic product references

File:

- `src/lib/agent-v2/runtime/responses-agent.ts`

Change:

- Keep `buildCurrentRoutineProductIdentityAnswer` for explicit category questions only.
- Do not allow generic singular `produkt` to resolve by falling through to the default `shampoo` category when routine inventory has multiple plausible products.
- If the message names no supported category and routine inventory has multiple current products, return `null` from the shortcut so the normal Agent V2 path runs.
- If the message asks plural/broadly for products or care products, let the normal agent path run; do not add a deterministic list formatter unless real-model verification proves the model path is poor.

Do not:

- add a new deterministic mini-router that chooses between "list all" and "clarify".
- add hard-coded German fallback templates for this case.
- weaken product-facts validation.

Guidance update, if needed:

- Add a compact model-visible instruction near the current routine inventory context:
  - generic `Produkt` with multiple routine products should not assume shampoo;
  - use recent conversation if one product is clearly topical;
  - otherwise list the routine products or ask briefly which one the user means.

Verification:

- run the deterministic routing regression from Test 7.
- run one real-model probe or local chat check with two routine products and the exact generic prompt.

### Step 3: Make DB-complete approval write durable product continuity

Preferred path:

- When the approve-package/review-center workflow completes the product row, category specs, linked usage, review/submission state, and required approval package writes, persist an Agent V2 state transition that adds a resolved `active_product_context`.
- Include:
  - `product_id: approved_product_id`
  - category
  - brand/product name
  - source such as `product_intake_review`
  - submission identity
  - original user-facing handoff text if already available
- Keep this state write idempotent, like notification message IDs.
- Send the normal chat notification only after the DB-complete condition is met and the resolved context transition is safe to write.

Alternative if direct state write is too risky:

- Teach `runAgentV2ProductionPipeline` to read the latest `product_intake_review` rag context from recent assistant messages and synthesize the same active product context for that turn.

Recommendation:

- Use the state write for durability, plus a read-time recovery fallback for already-sent notifications and older conversations.
- Reuse the existing active-product context helpers rather than creating a new transition abstraction:
  - `mergeActiveProductContexts`
  - `buildPrimaryResolvedProductContext`
- Merge by `submission_id` first, then `product_id`, then normalized category/brand/name.
- Use `state_version` optimistic concurrency or an equivalent guarded write for approval-state updates; a bare reload-then-upsert is still vulnerable to overwriting a concurrent chat turn.
- Treat the normal approval notification as a promise that category facts should be loadable. If category specs are missing, block/rework the approval pipeline/data package rather than normalizing missing facts as expected chat behavior.

### Step 4: Ensure `select_products` can load verified owned product facts for target assessment

Files:

- `src/lib/agent-v2/production/chat-pipeline.ts`
- `src/lib/agent/tools/select-products.ts`
- `src/lib/recommendation-engine/selection.ts`
- `src/lib/agent-v2/tools/select-products-projection.ts`

Current risk:

- Target products can fall back to `buildTargetAssessmentFallbackProjection`, which contains identity but no supported facts.
- That keeps the answer truthful but prevents a real fit assessment.
- Worse: if fallback projections carry product-fact source labels without concrete facts, they can accidentally satisfy grounding.

Change:

- For `product_request_kind: "product_detail"` with a target product ID, require the target product to be loaded through the same category spec path used by recommendation products.
- If the target owned product has verified specs, return a projection with supported claims/comparison facts.
- If specs are missing, return an explicit `facts_status: "missing"` projection or trace reason instead of the generic target fallback pretending the projection is enough.
- Ensure identity-only fallback projections do not satisfy `product_assessment_grounding`.
- Keep an eye on latency from the extra category-spec read on assessment turns; this is low risk but should be visible in traces if it becomes slow.

Do not:

- Make user-owned products globally recommendable.
- Show recommendation cards for the assessed product unless the user asked for recommendations.
- Weaken `product_assessment_grounding`.

### Step 5: Make the validator consume fact readiness, not identity

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/contracts.ts` if the terminal answer or trace contract needs a typed field

Change:

- `product_assessment_grounding` should require concrete facts for every `assessed_product_id`.
- Acceptable evidence:
  - non-empty supported claims for that product ID
  - category spec/readiness metadata explicitly attached to that product ID
  - comparison facts/projection facts that are product-ID scoped
- Not acceptable:
  - `allowed_claim_sources` alone
  - a resolved `product_id` alone
  - a target fallback projection with no facts

This is a hard guardrail, not validator overreach.

Step 5 must cover both:

- projection generation, so identity-only projections do not advertise fact grounding;
- final validation, so source labels alone do not pass product assessment grounding.

### Step 6: Demote alternatives-turn variant clarification from visible blocker to trace/card hint

Files:

- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`
- `src/lib/agent-v2/product-lookup-policy.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/named-product-context.ts`

Change:

- Use `ProductQuestionFrame.role === "baseline"` for broad alternatives intent.
- If there is active/resolved product context or a recent linked/assessed product:
  - do not replace the visible answer with variant-clarification copy;
  - allow the agent to answer alternatives;
  - keep any ambiguity as trace warning or optional quiet card only if it does not block the alternatives answer.
- Keep hard clarification when the requested output is an exact product fit/detail assessment and identity is unresolved.
- When category or core need is clear enough, answer alternatives and optionally state the assumption briefly.
- Ask clarification first only when category/core need ambiguity would likely make recommendations wrong.

### Step 7: Reduce `pending_followup_action_missing` kill power for optional closings

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`

Change:

- keep hard pending-state validation for real confirmable offers.
- allow or sanitize soft optional closings.
- prefer removing the optional closing over replacing a useful answer with generic fallback.
- retain transcript-based understanding for short confirmations; pending state is an execution receipt, not the only memory mechanism.

### Step 8: Improve final fallback copy for approved-but-missing-facts cases

If product facts are genuinely missing after approval, use a more honest user-facing answer:

Bad:

`Ob es wirklich gut zu dir passt, kann ich gerade nicht zuverlaessig aus den verfuegbaren Produktdaten ableiten.`

Better:

`Ich weiss, welches Produkt du meinst und es ist in deiner Routine verknuepft. Fuer eine echte Ja/Nein-Einschaetzung fehlen mir dazu gerade noch gepruefte Produktdetails. Ich wuerde es deshalb nicht blind als passend einstufen. Grob fuer dein Profil: ...`

This is a fallback only. The preferred path is to load product facts and answer.

### Step 9: Verification

Run:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-product-selection.spec.ts
npm run typecheck
npm run ci:verify
```

If `npm run ci:verify` is too slow for the inner loop, run it before final handoff at minimum.

Manual local checks on `http://localhost:3541/chat`:

1. Ask about a not-found product.
2. Submit it through the intake card.
3. Approve/link it through the existing product-intake flow.
4. Ask:
   - `Okay und passt er zu mir?`
   - Expected: product-aware answer with facts if specs exist; honest missing-facts answer if specs do not exist; no intake card.
5. Ask:
   - `okay, was waeren sonst alternativen?`
   - Expected: alternatives answer first; no weird variant-confirmation preface.

## Validator Diet Classification

Hard keep:

- `product_assessment_grounding`
- unresolved exact product assessment blockers
- invented product ID blockers
- safety/scalp boundaries
- schema/UI payload integrity
- real confirmable follow-up offers requiring pending state

Soften/demote:

- visible variant-clarification fallback for alternatives intent
- current-routine identity shortcut for generic `Produkt` when multiple routine products exist
- "selected/linked product is not verified" wording when the product is catalog-resolved but facts are missing
- generic target assessment fallback that hides why facts are absent
- optional follow-up closing without actual short-yes dependency

Replace with better data flow:

- DB-complete approval should create or recover durable active product state before sending the normal notification
- target product assessment should load verified owned product specs, not just identity
- per-turn product-question framing should make target-vs-baseline and fact readiness explicit
- recent product context should be model-visible so the agent can choose tools instead of being over-routed by validators
- generic current-product questions should reach the agent when the shortcut cannot prove a unique category/product

## Final Patch Slice: Resolved Routine Product ID Wins

Date added: 2026-07-05
Status: aligned with Nick; implementation-ready

This slice targets the latest local failures:

- `Weißt du welches Shampoo ich gerade benutze?` -> `Und passt das zu mir?` sometimes asks which Syoss variant even though the routine product ID is known.
- `Und passt das zu mir?` -> `Was wären gute Alternativen dazu?` can collapse into generic fallback or variant clarification even after `select_products` produced good alternatives.
- `das shampoo` after a variant clarification can re-trigger fuzzy lookup instead of selecting the already-known routine shampoo.
- `Weißt du welchen Conditioner ich gerade benutze?` -> `Und passt der zu mir?` knows the product name but fails to bridge into product facts.
- Current routine identity answers still sometimes start with `Ja:`.

### Product Decisions

1. `match_status = matched` plus `product_id` in routine inventory is trusted product identity.
   - It should be treated like an exact resolved product identity for chat continuity.
   - It is not enough by itself for factual fit claims; product facts/projections are still required.

2. Product database state has only two valid user-facing cases:
   - pending review: no category specs/facts yet; say it is in review and Chaarlie will notify the user when facts are ready.
   - reviewed/resolved: category facts/specs must exist; no intake card should be shown again.

3. If a reviewed/resolved product is missing category facts, that is a data/read bug.
   - Do not show product intake again.
   - Do not say the product is unknown.
   - Do not invent facts.
   - Prefer an honest internal-facts-missing answer only as a fallback.

4. Do not fuzzy-lookup an already resolved active routine product.
   - If the latest user message naturally refers to the known product (`das`, `der`, `dazu`, `dieses Shampoo`, `passt das zu mir?`), the product ID wins.
   - `lookup_product_candidate` remains valid only when the user names a different product, explicitly asks which variant it is, or no resolved product ID exists.

5. This must be category-general.
   - Do not build a shampoo/conditioner-specific patch.
   - The same resolved-product contract should work for shampoo, conditioner, mask, leave-in, oil, bondbuilder, dry shampoo, deep-cleansing shampoo, and other supported routine product categories.

6. `Ja:` is the same style problem as `Ja -` / `Ja —`.
   - Sanitize it into the useful sentence instead of allowing awkward visible copy or killing the answer.

### Implementation Tasks

1. Add regressions before changing behavior.
   - `current shampoo -> passt das zu mir?` assesses the matched Syoss product and does not ask for variant.
   - `current shampoo -> passt das zu mir? -> Alternativen dazu` returns alternatives and does not generic-fallback.
   - `current product -> das Shampoo -> Welche Alternativen wären gut?` keeps the shampoo reference.
   - `current conditioner -> passt der zu mir?` uses product facts when specs exist, or gives only the honest missing-facts fallback if facts truly cannot be loaded.
   - `Ja:` current routine identity answer is sanitized.

2. Harden the existing matched-routine active context bridge.
   - Do not build a second parallel context mechanism.
   - Patch the existing `buildMatchedRoutineActiveProductContextsFromRoutineInventory` / `deriveRoutineInventoryResolvedContexts` path in `src/lib/agent-v2/production/chat-pipeline.ts`.
   - Replace the current narrow `isAmbiguousProductFitFollowup` plus recent-assistant-text gate with a match-status-driven trigger:
     - if routine inventory contains exactly one matched product in the referenced category, the `product_id` can become active for same-topic follow-ups;
     - if the user names a different product, switches topic, or the category is genuinely ambiguous across multiple routine products, do not force this shortcut.
   - Include `product_id`, category, display name, source `routine_inventory`, and the triggering user message.
   - Widen/preserve `AgentV2ActiveResolvedProductContext.source` in `src/lib/agent-v2/resolved-product-selection-adapter.ts` so routine-inventory provenance is not silently rewritten as `product_lookup_selection`.
   - Do not rely only on fuzzy assistant-text reconstruction after identity answers.

3. Make validators accept resolved routine product identity as identity grounding.
   - A trusted active resolved product ID should satisfy identity resolution for the same product.
   - Keep hard blockers for missing product facts/projections.
   - Do not require `lookup_product_candidate` when the product ID is already trusted and same-topic.
   - Extend the existing `trustedSelectedProductIds` grounding path; do not add a second bypass.

4. Load product facts/projections by trusted product ID for assessment.
   - For fit/detail answers, require category facts or selected-product projection facts tied to the trusted product ID.
   - Empty `supported_claims` must not satisfy grounding; target the existing `productIdsWithProductAssessmentFacts` / `validateProductAssessmentGrounding` path in `src/lib/agent-v2/validation/final-answer-validator.ts`.
   - If facts are missing for a reviewed product, surface that as a data-read failure fallback, not an intake or variant flow.

5. Repair alternatives flow.
   - For `Alternativen dazu`, use the active resolved product as comparison baseline.
   - Run `select_products` for alternatives.
   - Do not fuzzy-lookup the baseline product first.
   - If `select_products` returns valid alternatives, final answer should show them even if reference-product lookup would be ambiguous by name.
   - Check the existing `isGroundedAlternativesBaselineRecommendation` path before adding any new validator exception.

6. Tighten prompt/tool guidance.
   - Replace guidance that says fit/detail follow-ups must always call `lookup_product_candidate`.
   - New guidance: call lookup for unresolved or newly named products; use trusted active resolved product context directly when available.
   - Keep model freedom to decide whether the latest message continues the product topic, but make the trust boundary explicit.

7. Extend bare-`Ja` sanitization.
   - Include `Ja:` at the beginning of otherwise useful current-routine identity answers.
   - Keep the existing hard style guard for unrelated answers.

### Verification Additions

Run focused tests:

```bash
./node_modules/.bin/tsx --test --test-name-pattern "current shampoo|current conditioner|active resolved product|Alternativen|bare Ja" tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts
```

Then run:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts
npm run typecheck
```

Manual local chat checks on the real-product QA account:

1. `Weißt du welches Shampoo ich gerade benutze?`
2. `Und passt das zu mir?`
3. `Was wären gute Alternativen dazu?`
4. `Weißt du welchen Conditioner ich gerade benutze?`
5. `Und passt der zu mir?`
6. `Weißt du welches Produkt ich gerade benutze?`
7. `das Shampoo`
8. `Welche Alternativen wären gut?`

Expected:

- no generic fallback;
- no variant clarification for the already-resolved routine product;
- no product intake card for resolved products;
- product facts used for fit when specs exist;
- honest missing-facts fallback only if product facts genuinely cannot be loaded;
- alternatives answer visible when `select_products` returns alternatives.

## Resolved Decisions And Remaining Risks

Settled:

1. Use the lean architecture: existing seams first, no heavyweight frame module unless implementation proves it necessary.
2. Approved/linked means DB-complete for the product category, not identity-only.
3. DB-complete approval transaction is the readiness event; notification is a consequence, not the source of truth.
4. If required category specs are missing, block/rework approval and do not send the normal checked/linked notification.
5. Product context persists as recent context, but same-topic relevance is agent-decided per turn.
6. Alternatives should proceed on best available context; clarification is hard only when category/core-need ambiguity materially changes the answer.
7. `pending_followup_action` is an execution receipt for concrete offers, not the agent's memory.
8. Reconcile the existing dirty diff in-place before new coding.
9. Current-routine product identity shortcuts are allowed only for unambiguous category references; generic `Produkt` with multiple routine products must reach the normal Agent V2 path.
10. Matched routine inventory with `product_id` is trusted identity for all categories, equivalent to an exact resolved product for continuity.
11. Reviewed/resolved catalog products should have category specs; missing facts after resolution are data/read bugs, not intake-card cases.
12. `lookup_product_candidate` should not be required for the same already-resolved active routine product.
13. The patch must be category-general, not a shampoo/conditioner bandaid.
14. Extend the bare-`Ja` sanitizer to include `Ja:`.

Remaining risks:

1. The product-question framing could grow into a router if implementation adds many phrase-specific branches. Keep it compact and trace-oriented; defer a new shared type unless needed.
2. Read-time recovery for old conversations can be tricky if submission IDs are absent. Prefer `submission_id`, then product ID, then normalized identity.
3. The approval pipeline may reveal old products that were marked approved without complete category specs. Treat these as data/package defects and surface them clearly.
4. Product-context relevance may still misfire in ambiguous chat turns. Add trace fields and eval prompts so failures are debuggable instead of hidden behind fallback copy.
5. `PRODUCT_INTAKE_ENABLED` is the effective rollback/kill-switch for product-intake flows in production, but shared validator changes may still affect flag-independent behavior.

## Stop Line

Implementation may begin after Nick explicitly approves this finalized plan. Stop before staging, committing, pushing, opening PRs, migrations, or production/Supabase apply commands unless separately approved.
