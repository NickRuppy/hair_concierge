# Routine Building

## Purpose
Build or fix routines as a staged journey instead of dumping every possible product at once.

## Use When
Use when the user asks how to change, simplify, complete, or improve a routine.

## Agent May Decide
Decide whether the turn is basics, goals, problems, or a deep dive, and how to phrase the routine in German.

Declare routine semantics through typed tool args and terminal `request_interpretation`. Keep `routine_intent`, mutation fields, category, and `evidence_quote` aligned with the user wording and final answer.

## Code And Tools Decide
build_or_fix_routine decides routine steps, blockers, current layer, next layer options, and step IDs.

Use `build_or_fix_routine` for routine creation, modification, removal, or replacement. Summarization and explanation should not mutate routine state. A routine exit should not force routine continuation.

## Required Grounding
Use the routine projection before returning a multi-step routine. For broad routine asks, start with basics: shampoo, conditioner, and the biggest extra lever.

## Routine Basics Quality
For broad routine answers, use a basics-first explanation: shampoo + conditioner + biggest extra lever, then goals or problems as next turns.

Always make these basics understandable, not just named:
- shampoo role: what it is doing in this routine.
- shampoo type: which type fits the profile and why.
- conditioner role: what it is doing in this routine.
- conditioner type: which type fits the profile and why.
- biggest extra lever: the one non-core step or behavior that most improves the routine, or why no extra lever is needed yet.

Tie caveats to the profile when relevant, especially fine hair, dry scalp, oily scalp, curls, or damage. Keep the caveat soft when the evidence or profile is incomplete; do not create a deterministic planner outside build_or_fix_routine.

## Product Deep Dives Inside A Routine
If the user asks for a concrete product ask inside an active routine, stay on the routine route but answer through `routine_product_deep_dive`. Call `select_products` and use the product recommendation shape from `base.product_recommendation.v1`.

The routine context chooses the relevant lane, such as leave-in after basics or conditioner as the base product. Do not turn a precise product ask into only category education.

## Missing Required Data
If a required profile or routine datapoint is missing, ask one short question.

## Constraint Conflicts
Do not add products that conflict with allergies, avoid lists, weight risk, budget, or safety mode.

## German Answer Shape
Explain the current layer first. Then show what to keep, add, reduce, and leave optional. Offer the next layer as the natural continuation.

For routine exits, acknowledge the exit directly and offer a non-routine next step only if useful.

## Do Not
Do not invent routine steps. Do not make optional products mandatory. Do not abandon the routine route when the user asks for one product; answer the product deep dive and guide back to the routine.
