# Agent V2 Conversation Closure Polish Design

**Status:** Aligned direction after plan-grill.

**Reader:** Engineers improving GPT-5.4 / Agent V2 production chat answer quality.

**Promised end-state:** Chaarlie closes production chat answers like a warm coach with expert judgment: slightly proactive, specific, feasible, and non-generic. The model writes the close naturally as part of the final German answer. The system nudges the behavior through Agent V2 guidance and blocks only the worst visible closing failures through loose validator checks.

## Alignment Decisions

- Target the GPT-5.4 / Agent V2 worktree and production chat behavior.
- Do not add clickable follow-up chips.
- Do not add a second model call.
- Do not touch legacy RAG.
- Do not rework the full terminal-answer contract for this pass unless the natural approach fails.
- Prefer natural embedded closings, usually as a visible final sentence.
- Be slightly more proactive than a sparse "only when necessary" assistant.
- Balance questions and suggestions, with a slight bias toward concrete suggestions.
- Tone should be warm coach first, with expert consultant underneath.
- Allow concrete "Ich kann ..." offers sparingly; prefer coach-like next-direction phrasing over assistant-service CTAs.
- Validator posture is loose-hybrid: block only truly bad closers, warn on weaker style or missed opportunities.
- The visible close lives in `payload.user_facing_answer_de`. `next_step_offer_de` remains only as nullable legacy metadata for this pass; it must not create a second or different offer.
- Do not open unsupported analysis lanes in the close. Ingredient/INCI-list analysis is not a proactive serviceable next step in the current product system, even if the user could paste text.

## Current System Fit

Agent V2 already has the right places to influence this without extra orchestration:

- `data/agent-v2/guidance/base/tone-and-format.md` owns visible voice, answer shape, and endings.
- `data/agent-v2/guidance/base/general-advice.json` already mentions practical next steps and material questions.
- Category guidance files already say when one follow-up question is useful.
- `src/lib/agent-v2/validation/final-answer-validator.ts` validates terminal answers at the final-answer boundary.
- `src/lib/agent-v2/validation/user-facing-language.ts` already blocks some awkward user-facing language.
- Existing Agent V2 regression fixtures already inspect CTA and final sentence quality.

## Product Behavior

The main answer should come first. The close should be a small conversational move after the answer has done its job.

Preferred close options:

- **Stop cleanly** when the answer is complete, simple, transactional, constrained, or sensitive enough that extra momentum would feel wrong.
- **Ask one material question** when the answer to that question would meaningfully change the next recommendation or safety posture.
- **Offer one concrete next-step suggestion** when the useful next move is already inferable from the answer, profile, routine context, or supported tool facts.

Default posture:

- Use medium proactivity for most non-trivial advice: a clear next direction, not a pushy CTA.
- Use light proactivity or a clean stop when the answer is already complete.
- Use stronger "Ich kann ..." offers only when the next action is genuinely useful and serviceable by current tools/context.
- Prefer behavioral judgment over reusable snippets. Examples in plans/tests should specify qualities, not approved sentences to copy.

Mode-by-mode posture:

- `clarification`: ask exactly one material question.
- `safety_boundary`: avoid upbeat CTA energy; include only one safe next step if appropriate.
- `constraint_blocked`: explain the blocker, then offer one feasible alternative when one exists.
- `general_advice`: usually close with one practical next step or one material question.
- `routine`: usually close with one next routine move unless the answer already provides a complete plan.
- `product_recommendation`: usually close with usage, selection, or comparison help, unless the answer already includes that help.
- `product_detail`: close only if there is a grounded next check or safe alternative; otherwise stop cleanly.

## Anti-Patterns

Block or repair the really bad cases:

- generic bait: "Moechtest du mehr wissen?", "Ich kann dir gern mehr dazu sagen", "Lass es mich wissen"
- infeasible offers: inspect photos, links, INCI lists, exact unsupported claims, color safety, heat-protection temperatures, chelating status, or protocols unless current tools actually surfaced that capability/fact
- unsupported analysis lanes: do not proactively offer ingredient/INCI-list analysis, regardless of whether the user would paste, link, photograph, or name the ingredient list, unless a future dedicated ingredient-analysis or curated ingredient-fact tool exists
- user-initiated product-detail questions remain allowed inside the existing product metadata contract: if the user asks whether a named product has an ingredient-related property, answer only from `select_products`/catalog facts or explain that the current data cannot safely confirm it; do not turn that into a proactive INCI analysis offer
- repeated asks: asking for information already provided in current or recent context
- redundant offers: offering to choose products after products were already recommended
- multiple closing questions
- unsupported next steps that would require product facts, routine facts, or medical certainty the system does not have

Warn, but do not block:

- weak but harmless genericness
- missed close opportunity on a non-trivial answer
- a useful close that is slightly vague
- a close that is phrased more like an assistant than a warm coach

## Voice Standard

Closings should sound like a warm coach who knows the domain:

- practical and specific
- encouraging without cheerleading
- confident but not absolute
- natural German, not translated tool language
- no labels such as "Naechster Schritt:" unless the surrounding answer truly benefits from that structure
- no corporate CTA tone

Behavioral standard:

- A good suggestion-led close names the next useful direction and why it matters for this user's hair, routine, or decision.
- A good question close asks one material question whose answer would change the next recommendation or safety posture.
- A good clean stop feels complete without adding a dangling offer.
- A bad close is generic, unsupported, pushy, corporate, repetitive, or written like translated tool language.

## Technical Shape

Use the existing single-turn Agent V2 model call. Do not add a closure selector.

`next_step_offer_de` treatment:

- Keep the field in the schema for compatibility in this pass.
- Allow it to be null freely, including inside active routine threads.
- Do not require it to preserve routine continuity; routine continuity belongs to `routine_context`.
- If present, it must mirror or summarize the visible final move in `user_facing_answer_de`; it must not introduce a separate CTA or hidden next action.

Implementation should modify:

- existing base guidance sections and paired JSON rubrics for closure policy
- final-answer validation helpers for severe bad-close patterns
- regression fixtures around final sentence behavior
- trace/report wording only if needed for debug visibility

Do not create:

- a closure object in the terminal schema
- a deterministic renderer
- chips
- a separate model pass
- a broad dialogue-state machine

## Evaluation Definition

The work is ready when representative Agent V2 cases show:

- fewer generic closers
- no increase in unnecessary clarification
- materially better final sentences on general advice, routine, and product recommendation turns
- no unsupported photo/link/claim offers
- no redundant close after the answer already gave the next move
- no product/routine grounding regressions

Manual review should judge the final sentence separately from the main answer.
