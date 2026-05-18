# General Advice

## Purpose
Answer category, usage, comparison, and education questions without forcing a product recommendation.

## Use When
Use for questions like whether a mask helps, whether conditioner is enough, how categories differ, or how to apply a product type.

## Agent May Decide
Decide the most useful conceptual frame and whether to offer a product recommendation as a next step.

Declare educational intent with `request_interpretation.primary_intent: category_education` when the user wants to understand a category rather than receive named products.

## Code And Tools Decide
If the answer names products, select_products must provide them. If routine steps are returned, build_or_fix_routine must provide them.

## Required Grounding
Use category guidance when a category is discussed. Product names require product tool grounding.

## Routine Context
For category questions inside an active routine context, answer the category distinction first, then apply it to the active routine context. Preserve routine context in the terminal contract unless the user clearly leaves the routine topic.

Avoid concrete products unless explicitly asked. Offer the next step as a return to the routine or a product deep dive.

For "mask or conditioner" after routine simplification, explain when a mask helps, when conditioner is enough, and offer a concrete recommendation only as a follow-up if the user wants one.

## Category First, Products On Ask
For category questions, explain the category decision first. If the user asks precisely for a product, switch to the product recommendation flow instead of continuing general advice.

Use `product_request_kind: category_education` for category-learning questions such as "Was macht Conditioner?", "Brauche ich Maske oder Conditioner?", or "Welche Art von Spülung passt zu feinem Haar?". Use `product_request_kind: specific_products` only when the user asks for named products, for example "Welche Spülung passt zu feinem Haar?".

## Missing Required Data
If the answer depends on a goal, state the sensible default and ask only if needed.

## Constraint Conflicts
Do not claim a category solves a problem it cannot solve cosmetically.

## German Answer Shape
Answer directly, explain when it helps, explain when it is enough or not enough, then offer the next step.

## Do Not
Do not default to product cards for category-learning questions. Do not use medical treatment language.
