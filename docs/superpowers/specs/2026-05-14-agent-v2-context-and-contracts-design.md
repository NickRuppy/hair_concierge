# AgentV2 Context And Contracts Design

## Reader

This spec is for the engineer building the first AgentV2 prototype for Hair Concierge inside Compare Lab.

## User Situation

The current recommendation chat was tactically optimized around GPT-4o and a Chat Completions-era architecture. That work produced useful deterministic recommendation intelligence, but the product now needs a GPT-5.4-mini-native agent shape: one bounded Responses loop, cleaner context, typed tools, stricter terminal contracts, and validators.

The goal is not to make the system less deterministic. The goal is to let GPT-5.4-mini own semantic judgment and tool sequencing while making product, routine, safety, grounding, memory, and UI boundaries more explicit than before.

## Promised End-State

Compare Lab can run a separate AgentV2 engine that uses GPT-5.4-mini through the Responses API. AgentV2 has its own runtime, contracts, context packages, tool projections, traces, validators, repair loop, and eval gates. It reuses existing deterministic product and routine intelligence through narrow adapters, but does not reuse the GPT-4o-era route classifier, Chat Completions loop, final composer, or old prompt shape.

The production V1 chat path is not modified in place. Minimal additive Compare Lab type and runner changes are allowed so V1 and AgentV2 can be compared side by side. Production feature flags and shared production abstractions come only after AgentV2 contracts prove stable in Compare Lab and shadow evals.

## Source Notes

Official OpenAI docs current on 2026-05-14 support this direction:

- Responses is recommended for new projects and is described as a unified interface for agent-like applications. It uses typed Items such as `message`, `function_call`, and `function_call_output`, which fit a tool-loop architecture better than Chat Completions messages.
- Function calling works best with a small tool surface and strict schemas. Large or rare tool surfaces can be deferred, but AgentV2 V0 intentionally keeps the toolset to the existing advisor tools.
- Prompt caching benefits from stable shared prompt/context at the beginning and variable user-specific context later.
- Structured Outputs should be used where application code needs a reliable JSON Schema boundary.
- The GPT-5.4 mini model page lists `gpt-5.4-mini-2026-03-17` as an available snapshot. It also lists GPT-5.4-family reasoning effort values as `none`, `low`, `medium`, `high`, and `xhigh`. Do not replace these with the older GPT-5 `minimal` scale unless the target model changes.

Links:

- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization

## Strategic Decision

Build AgentV2 as a separate Compare Lab path first.

```text
deterministic gates and loaded profile state
  -> GPT-5.4-mini Responses agent
  -> selected existing advisor tools
  -> AgentV2 projections over old deterministic logic
  -> terminal submit_final_answer contract
  -> validators
  -> one repair turn
  -> Compare Lab judgment and traces
```

Do not wire AgentV2 into production in this pass.

Do not build a provider-neutral production abstraction layer in this pass.

Do not start with new ingredient, product-detail, inventory, or contraindication tools. Those can be added after Compare Lab proves a concrete gap.

## Architecture Verdict

The target should be model-native in the middle and deterministic at the edges.

GPT-5.4-mini may decide:

- how to interpret the user request
- which existing safe advisor tools are needed
- whether the answer is product, routine, routine product deep dive, general advice, clarification, constraint-blocked, or safety boundary
- how to synthesize a warm German answer
- what short-lived session memory is worth proposing

Application code decides:

- whether the request may enter the normal path or needs a safety-restricted path
- which tools exist
- which tool outputs are authoritative
- what product IDs, claims, routines, profile facts, and memory writes are valid
- when the task is complete
- whether the terminal answer can be rendered
- whether a repair turn is allowed

## AgentV2 V0 Boundaries

In scope:

- Compare Lab-only AgentV2 path.
- GPT-5.4-mini Responses runtime.
- Four model-visible tools:
  - `load_advisor_guidance`
  - `select_products`
  - `build_or_fix_routine`
  - `submit_final_answer`
- Rewritten AgentV2 guidance packages for base guidance and every active product category.
- AgentV2 projections for existing tool outputs.
- Terminal contract with typed payloads.
- Deterministic validators and one repair turn.
- Session memory writes inside the terminal contract.
- Compare Lab eval gates and manual iteration workflow.

Out of scope:

- Production feature flag rollout.
- Production V1 chat-path changes.
- Provider-neutral production abstractions.
- Agents SDK adoption.
- New ingredient lookup tool.
- New product-detail lookup tool.
- New inventory/price lookup tool if current `select_products` already exposes sufficient price and availability facts.
- New durable memory/profile write system.
- Rewriting recommendation ranking logic.
- Replacing the existing routine planner.
- GPT-5.5 migration.

## Reuse Map

Reuse directly as backend authority:

- recommendation engine category selectors
- routine planner logic
- product catalog data access and product IDs
- profile loading and routine inventory loading
- Compare Lab scenario/user fixtures
- current safety and business constants where they are already cleanly separated from V1 routing

Reuse through AgentV2 projections:

- `select_products`
- `build_or_fix_routine`
- `load_advisor_guidance`
- final answer and state transition metadata
- trace output

Do not reuse directly:

- V1 route classifier
- V1 Chat Completions message loop
- V1 final composer
- V1 system prompt as AgentV2 prompt
- old markdown guidance as runtime context
- route-packet semantics as the AgentV2 semantic authority

## Direct Reuse Risks

Recommendation engine:

- Good: deterministic product/routine authority already exists.
- Risk: raw runtime objects contain internal assessments, reason codes, and intermediate state that are too broad for an LLM tool result.
- Mitigation: expose only an AgentV2 product projection with decision, valid product IDs, supported claims, missing required inputs, blockers, and trace metadata.

`select_products`:

- Good: already returns product IDs, price, caveats, fit reasons, supported claims, unsupported requested signals, missing info, and no-match decisions.
- Risk: existing output is optimized for V1 composition, not for GPT-5.4-mini terminal validation.
- Mitigation: wrap it in an AgentV2 projection that separates user-visible facts from internal facts and marks allowed claim sources.

`build_or_fix_routine`:

- Good: the existing planner already supports `basics`, `goals`, `problems`, and `deep_dive`.
- Risk: current projection is usable but does not explicitly tell AgentV2 the layer purpose, product naming policy, next-layer options, or return path.
- Mitigation: wrap it in an AgentV2 routine projection.

`load_advisor_guidance`:

- Good: existing playbooks, topics, overlays, and routines contain valuable advice.
- Risk: current markdown-oriented output is not validator-friendly and can carry V1 routing language.
- Mitigation: replace the runtime shape with a light guidance compiler: structured package plus markdown brief.

Compare Lab fixtures:

- Good: existing scenarios capture real historical failure modes.
- Risk: they can overfit V1 problems and miss AgentV2-specific risks.
- Mitigation: add cases for routine journey, category-first advice, product deep dives inside routine, safety-restricted paths, and constraint conflicts.

## Deterministic Pre-Model Gates

Before the GPT-5.4-mini call, code should perform only true edge checks and context loading:

- account/session checks
- consent/state checks
- message eligibility and abuse checks
- obvious severe safety detection
- hard product/business constraints that are independent of semantic recommendation judgment
- load user profile, allergies, preferences, owned products, routine inventory, recent conversation, and session memory

Pre-model gates must not become a second recommendation engine.

## Safety Paths

AgentV2 has two safety modes:

Hard short circuit:

- wounds, bleeding, burns, severe pain, infection-like language, allergic reaction, sudden hair loss in clumps, prescription-treatment questions, or other clearly severe medical wording
- the normal AgentV2 Responses tool loop does not run
- normal product/routine/guidance tools are not exposed
- code returns a deterministic `safety_boundary` terminal payload
- the trace records that a hard short circuit occurred and why

Restricted path:

- itchy scalp, flakes, irritation, postpartum shedding, ingredient safety, mild shedding, or ambiguous medically adjacent wording
- the agent may answer carefully, but product-first behavior is constrained
- validators enforce no diagnosis, no treatment claims, and no unsupported medical assertions

## Context Strategy

AgentV2 uses modular source material compiled into a few coherent task-specific context packs.

Use modular source packages because they are easier to maintain and test:

```text
data/agent-v2/guidance/base/
data/agent-v2/guidance/playbooks/
data/agent-v2/guidance/categories/
data/agent-v2/guidance/routines/
data/agent-v2/guidance/overlays/
```

Use compact runtime packs because GPT-5.4-mini should see relevant context, not an encyclopedia:

```text
stable prefix:
  base.advisor_rules.v1
  output contract summary
  tool rules
  safety boundaries
  tone and format rules

turn-specific guidance:
  product recommendation package
  routine building package
  general advice package
  one or more category packages
  relevant overlay packages
```

Do not pass every guidance file to every turn.

Do not rely on the large context window as permission to dump old docs.

Prompt caching target:

- keep the stable instruction prefix and tool definitions as stable as possible
- do not move per-turn guidance package content into instructions just to chase caching
- treat tool results, selected guidance packages, latest user message, recent messages, and session memory as dynamic turn context
- user profile summaries may be stable enough to cache later, but V0 should optimize correctness and trace clarity first

## Guidance Compiler V0

`load_advisor_guidance` becomes a light guidance compiler.

It does not dynamically normalize, dedupe, resolve conflicts, or select overlays from many source documents. It loads manually curated packages containing structured metadata plus a model-readable markdown brief.

The structured object is canonical for validators, traces, repair prompts, and downstream logic. The markdown brief is a faithful model-readable rendering of the same guidance.

No hard rule may exist only in markdown.

Every hard rule has:

```ts
{
  rule_id: string
  severity: "block" | "repair" | "warn"
  source: string
  validator_id: string | null
  message: string
}
```

Every package has:

```ts
{
  package_id: string
  version: 1
  scope: {
    answer_modes: string[]
    categories: Array<
      | "shampoo"
      | "conditioner"
      | "leave_in"
      | "mask"
      | "oil"
      | "bondbuilder"
      | "deep_cleansing_shampoo"
      | "dry_shampoo"
      | "peeling"
    >
    routine_layers: string[]
    safety_modes: string[]
  }
  hard_rules: GuidanceRule[]
  soft_rubrics: GuidanceRubric[]
  required_grounding: GroundingRequirement[]
  ask_when: GuidanceAskPolicy[]
  markdown_brief: string
}
```

## Guidance Package Scope

AgentV2 V0 includes base packages:

- `base.advisor_rules.v1`
- product recommendations
- routine building
- general advice
- safety boundaries
- tone and format
- answer contract

AgentV2 V0 includes category packages for all active product categories:

- `shampoo`
- `conditioner`
- `leave_in`
- `mask`
- `oil`
- `bondbuilder`
- `deep_cleansing_shampoo`
- `dry_shampoo`
- `peeling`

Category packages are advisory and explanatory. They may define category role, usage, tradeoffs, weak levers, caveats, common confusions, and uncertainty wording. They may not define final product ranking, exact product eligibility, availability, price, or product-specific claims unless those facts come from tools.

Category package IDs use product category slugs. The compiler owns remapping to existing source directories where names differ:

| Category slug | Existing source directory |
| --- | --- |
| `bondbuilder` | `data/agent-guidance/topics/bond-builder/` |
| `deep_cleansing_shampoo` | `data/agent-guidance/topics/deep-cleansing/` |
| `dry_shampoo` | `data/agent-guidance/topics/dry-shampoo/` |
| `oil` | `data/agent-guidance/topics/hair-oiling/` |

All other category slugs map directly to their matching source directory.

## Tool Projection Contracts

### `select_products`

AgentV2 projection must expose:

- selected category
- decision: `recommended`, `needs_more_info`, `not_recommended`, `no_catalog_match`
- product response policy
- valid product IDs in display order
- products with user-visible fields
- supported claims per product
- unsupported requested signals
- missing required data
- constraint blockers
- allowed claim sources
- trace-only engine metadata

The model may synthesize why a supported claim matters for the user. It may not invent a product claim.

### `build_or_fix_routine`

AgentV2 projection must expose:

- routine layer
- layer purpose
- visible steps
- step IDs
- step categories
- step necessity
- step action
- short reasons
- caveats
- whether the step can be filled with a concrete product
- product naming policy
- next layer options
- return path after deep dive
- missing required data

The model may explain the routine. It may not invent steps outside the visible projection.

### `load_advisor_guidance`

AgentV2 projection must expose:

- loaded package IDs
- hard rules
- soft rubrics
- required grounding rules
- ask policies
- markdown brief
- source file references for trace review

The guidance tool accepts only validated package/category enums. Invalid category input is rejected or ignored with an explicit trace entry; it must not silently load an arbitrary file or package.

The model uses the markdown brief for comprehension. Validators use hard rules.

### `submit_final_answer`

This is the terminal tool. It must be the only terminal completion path.

It uses one fixed outer contract plus typed payloads selected by `answer_mode`.

## Terminal Answer Contract

Required root fields:

```ts
{
  answer_mode:
    | "product_recommendation"
    | "routine"
    | "routine_product_deep_dive"
    | "general_advice"
    | "clarification"
    | "constraint_blocked"
    | "safety_boundary"
  interpreted_intent: string
  confidence: number
  extracted_constraints: Record<string, unknown>
  missing_information: Array<{
    key: string
    label_de: string
    blocking: boolean
    question_de: string
  }>
  safety_flags: string[]
  tool_grounding: {
    used_guidance_package_ids: string[]
    used_product_tool: boolean
    used_routine_tool: boolean
    product_ids: string[]
    routine_step_ids: string[]
    hard_rule_ids: string[]
  }
  routine_context: {
    active: boolean
    routine_layer: "basics" | "goals" | "problems" | "deep_dive" | null
    step_id: string | null
    category: string | null
    return_path: Array<"goals" | "problems" | "deep_dive">
  }
  session_memory_writes: Array<{
    type: "preference" | "constraint" | "current_goal" | "routine_context" | "safety_observation"
    text: string
    evidence_quote: string
    confidence: number
    ttl: "session"
    affects_recommendations: boolean
  }>
  payload: Record<string, unknown>
}
```

`answer_mode` determines the required payload shape.

`tool_grounding.hard_rule_ids` may contain only rule IDs from loaded guidance packages. The validator must reject unknown hard rule IDs and hard rule IDs from packages that were not loaded in the turn.

User-visible rendering is allowlisted from payload fields only. The UI must not render `session_memory_writes`, `tool_grounding`, validator notes, hard rule IDs, internal notes, or trace metadata.

## Payload Modes

`product_recommendation` payload:

- `user_facing_answer_de`
- `recommendations` with product IDs and German reasons
- `comparison_notes_de`
- `usage_notes_de`

`routine` payload:

- `user_facing_answer_de`
- `routine_layer`
- `visible_steps`
- `next_prompt_de`
- no concrete product recommendations unless `select_products` was explicitly used for a user-requested product ask

`routine_product_deep_dive` payload:

- `user_facing_answer_de`
- `routine_step`
- `recommendations`
- `return_to_routine_prompt_de`

`general_advice` payload:

- `user_facing_answer_de`
- `category_or_topic`
- `next_step_offer_de`
- no product cards

`clarification` payload:

- `user_facing_answer_de`
- `question_de`
- `missing_keys`

`constraint_blocked` payload:

- `user_facing_answer_de`
- `blocking_constraints`
- `generic_alternatives_de`
- `relaxation_question_de`

`safety_boundary` payload:

- `user_facing_answer_de`
- `safety_reason`
- `safe_next_step_de`
- no product cards

## Routine Journey Rules

Broad routine asks always start with `basics`.

The basics layer shows:

- shampoo
- conditioner
- the single biggest additional lever

The basics layer does not name concrete products by default.

After basics, AgentV2 offers the next choice:

- goal-driven products
- problem-solving products

`goals` and `problems` can be used in either order based on the user choice.

If a user asks for a specific product or category while inside the routine journey, AgentV2 stays on the routine route and performs a product deep dive for that routine step:

```text
routine context
  -> select_products for requested category
  -> answer where the product fits in the routine
  -> guide user back to goals/problems/deep_dive path
```

The terminal answer uses `answer_mode = "routine_product_deep_dive"` for this case.

## Product Recommendation Rules

Concrete product asks use `select_products`.

No product card or product name is rendered unless it came from `select_products`.

If required product/category inputs are missing, ask for the missing datapoint. Missing required profile fields are an exception path because profile data should usually be complete.

If deterministic constraints block a recommendation:

- do not recommend invalid products
- explain the blocker in German
- offer generic attributes or a safe routine/category alternative
- ask whether the user wants to relax one specific constraint
- trace the blocker in `tool_grounding`

## General Advice Rules

Non-product category questions use `load_advisor_guidance` when the advice is category-specific, comparative, usage-related, or non-trivial.

For example, "Brauche ich wirklich eine Maske?" should:

- explain when a mask helps
- explain when conditioner is enough
- avoid concrete products
- offer a product recommendation as a next step

It should not call `select_products` unless the user explicitly asks for a concrete product, product comparison, or product decision.

## Session Memory V0

AgentV2 V0 uses session memory only.

There is no second memory model call.

There is no automatic durable profile write.

`submit_final_answer` includes optional `session_memory_writes`, usually an empty array.

Within Compare Lab, accepted session memory writes are stored in the in-memory multi-turn run state. On the next turn in the same Compare Lab run, those accepted writes are injected into `userContext.sessionMemory` with evidence quotes and source turn IDs. They are not written to Supabase and are cleared when the Compare Lab run ends.

Valid session memory examples:

- user prefers lightweight conditioners in this conversation
- user wants to avoid oils in this routine
- user reacted badly to a product mentioned in this session
- user is comparing two product categories right now

Session memory must not silently become:

- hair texture
- thickness
- allergy
- permanent avoid list
- medical condition
- permanent profile update

Precedence:

1. Latest user message.
2. Hard profile fields.
3. Required product/routine tool contracts.
4. Session memory.
5. Older conversation summary.

## Validation And Repair

Validator context must include enough state to enforce the contract, not only product IDs:

```ts
{
  selectedProductProjections: AgentV2SelectProductsProjection[]
  routineProjections: AgentV2RoutineProjection[]
  latestUserMessage: string
  explicitProductAsk: boolean
  toolCallHistory: AgentV2ToolCallTrace[]
  safetyMode: "normal" | "restricted" | "hard_short_circuit"
  requiredGuidancePackageIds: string[]
  currentRoutineLayer: "basics" | "goals" | "problems" | "deep_dive" | null
}
```

Validate after `submit_final_answer`:

- schema is valid
- answer mode and payload match
- product IDs exist and came from `select_products`
- product claims are supported by allowed claim sources
- routine steps came from `build_or_fix_routine`
- broad routine ask did not skip basics
- category-first advice did not include unasked product cards
- severe safety cases did not recommend products
- German user-facing prose exists
- user-facing prose does not leak internal fields
- memory writes are session-scoped and evidence-backed
- missing required fields produce a clarification, not an invented assumption
- all payload modes are validated explicitly:
  - `product_recommendation`
  - `routine`
  - `routine_product_deep_dive`
  - `general_advice`
  - `clarification`
  - `constraint_blocked`
  - `safety_boundary`

Repair:

- one repair turn maximum
- give the model exact validator errors and original tool facts
- if repair fails, return a safe clarification or safety/constraint fallback

## Trace Contract

AgentV2 traces are typed from the first implementation pass. The trace schema must cover the fields the Compare Lab UI renders:

- `engine: "agent_v2"`
- `model`
- `endpoint: "responses"`
- `reasoning_effort`
- `safety_mode`
- `answer_mode`
- `response_ids`
- `model_steps`
- `tool_calls`
- `blocked_tool_calls`
- `loaded_guidance_package_ids`
- `validation_errors`
- `repair_attempts`
- `final_product_ids`
- `routine_layer`
- `session_memory_writes`
- `injected_session_memory`
- `langfuse`
- `failure_stage`

## Langfuse V0 Decision

AgentV2 V0 does not depend on Langfuse for positive reference mining. Runtime tracing is stored in the Compare Lab response as typed `agent_v2_trace`.

If the existing observed OpenAI client captures Responses metadata without extra work, AgentV2 may use it. If not, V0 should not block on Langfuse instrumentation; it should expose typed local traces first and add Langfuse/OTel export after the runtime contract stabilizes.

## Compare Lab Evaluation Gates

AgentV2 is ready for production shadow planning only when manual Compare Lab review confirms:

- no hallucinated products, product IDs, prices, ingredient lists, or unsupported product claims
- no safety-boundary failures
- AgentV2 is better than V1 in at least 70% of judged cases
- traces explain tool choice, guidance packages, validators, repair, and final contract shape
- AgentV2 traces are typed from the first implementation pass, not stored as `unknown`

The 70% gate is computed over a manually judged Compare Lab batch of at least 30 cases before production-shadow planning. Use the existing Compare Lab judgment log shape where possible so each judgment records prompt, systems, winner, note, failure bucket, critical product claim flag, and trace snapshot. Positive references are orientation cases, not automatic wins.

The user will steer the manual iteration and final judgment.

V1 is a baseline, not a golden answer. AgentV2 may differ from V1 when the rubric shows improvement.

Mine positive reference responses manually from prior Compare Lab text feedback and local judgment logs where available. Do not rely on Langfuse ratings because too few traces are rated there.

Positive references preserve qualities, not wording:

- tone
- product fit
- routine structure
- category explanation
- caveat/safety handling
- intent understanding

## Readiness Standard

AgentV2 V0 is ready when:

- it runs in Compare Lab as a separate engine path
- it uses GPT-5.4-mini through Responses
- it uses only the V0 toolset
- all tool outputs are AgentV2-shaped projections
- guidance packages are structured object plus markdown brief
- terminal answer contract is validated
- one repair turn works
- routine journey cases pass
- general advice cases answer educationally before product recommendations
- safety-restricted cases do not drift into product-first answers
- Compare Lab traces are inspectable enough for manual iteration
