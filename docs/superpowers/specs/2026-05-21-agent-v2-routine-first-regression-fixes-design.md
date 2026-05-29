# AgentV2 Routine-First Regression Fixes Design

## Reader Line

For AgentV2 guidance/runtime work on the GPT-5.4 responses migration: this spec defines when routine tooling is required, when placement advice stays general, and how known-intent failures should degrade for the user.

## User Situation

The latest guidance regression ledger shows several failures around routine prompts:

- broad change prompts such as "Was soll ich aendern?" can hand-roll multi-step advice without `build_or_fix_routine`
- "keine schwere Routine" can be answered as loose general advice, so follow-up routine context is lost
- direct mutations such as "Fuege einen Reset-Schritt ein" can call the routine tool correctly but be rejected by the first-layer validator
- placement questions such as "Kommt Oel vor oder nach Leave-in?" should not mutate routine state
- validation/repair failures currently expose internal fallback copy to users even when the user intent is known

The product direction is that the user's routine is the base object for bigger care changes. Chaarlie should start and end larger change requests from the routine, while still answering broad educational questions naturally.

## Promised End-State

- Bigger action/change requests route through `build_or_fix_routine`.
- Broad education and placement/order questions stay `general_advice` unless the user asks to add, remove, replace, simplify, or otherwise change routine state.
- "Keine schwere Routine" produces a lightweight routine spine and keeps routine context active.
- Direct category mutations are allowed when an existing routine inventory or active routine context exists, but the visible answer must keep the baseline routine spine visible.
- For dry/frizzy lengths in a lightweight-routine follow-up, "Maske oder Oel?" resolves to Maske as the main add-on, with oil only as a tiny finish.
- Known-intent repair failures degrade into useful user-facing advice instead of "Ich konnte die Antwort gerade nicht sauber zusammensetzen" or "Formulier es bitte".
- Regression coverage pins the six open/stale cases from `docs/agent-v2-guidance-migration/open-regression-failures.md`.

## Decisions

1. **Routine-first for action/change.** Prompts like "was soll ich aendern", "Routine einfacher machen", "keine schwere Routine", "was soll ich ergaenzen/weglassen", and "fuege X ein" require routine grounding.
2. **Advice-first for education.** Prompts like "Was hilft gegen Frizz?", "Warum sind meine Laengen trocken?", or "Was ist Maske vs Oel?" can stay general advice when not framed as changing a routine.
3. **Placement is not mutation.** "Wo kommt X hin?" and "Kommt X vor oder nach Y?" use `general_advice`, `primary_intent: routine_explanation`, and `routine_intent: none` unless the user asks to change saved/current routine state.
4. **Existing routine inventory counts as baseline.** A current inventory with Shampoo + Conditioner is enough baseline context to allow a direct category mutation, even if no routine thread layer is active yet.
5. **Baseline spine must stay visible.** First category-specific mutations can target `goals` or `problems`, but the answer must say the baseline stays intact.
6. **No internal failure copy for known intent.** Trace/debug can preserve `repair_failed`, but the user should receive a useful degraded answer if the runtime already knows the intent from tools or validation context.

## Non-Goals

- Do not redesign all AgentV2 routing.
- Do not add a new router for `routine-then-mask-oil-choice`; it remains an eval case over the existing flow.
- Do not change product catalog availability or product-ranking policy.
- Do not revisit scalp safety rules in this patch; those were investigated separately.
- Do not make placement/order questions mutate saved routine state.

## Source Of Truth

- Product intent: this spec.
- Runtime enforcement: `src/lib/agent-v2/runtime/responses-agent.ts`.
- Terminal contract enforcement: `src/lib/agent-v2/validation/final-answer-validator.ts`.
- Model steering: `data/agent-v2/guidance/base/routine-building.md/.json`, category guidance, and `src/lib/agent-v2/tools/tool-definitions.ts`.
- Regression fixture: `data/agent-v2/evals/guidance-migration-regression.json`.
- Open failure ledger: `docs/agent-v2-guidance-migration/open-regression-failures.md`.

## Acceptance Criteria

- The six cases in the open failure ledger no longer fail in a fresh full guidance regression run.
- `deep-cleansing-routine-mutation` returns a useful routine answer, not fallback copy.
- `frizz-color-damage-routine` and `routine-basics-build` call `build_or_fix_routine`.
- `routine-then-mask-oil-choice` keeps routine context from the first turn and picks Maske as the main add-on.
- `dry-shampoo-routine-placement` and `oil-routine-placement` stay guidance-only, without routine payloads or routine step IDs.
- Unit tests cover the validator/runtime contract, not only the LLM eval fixture.
- `ready-check` is required before shipping because this affects recommendation, routine, and trust-facing behavior.
