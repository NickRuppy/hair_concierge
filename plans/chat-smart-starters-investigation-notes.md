# Chat Smart Starters Investigation Notes

> Date: 2026-04-16
> Scope: Underperforming conditioner starter prompts

## Question

Why did the conditioner-oriented starter prompts perform much worse than the routine, scalp, leave-in, and lengths-comparison prompts in the initial evaluation?

## Important Context

The first prompt matrix was run against the root checkout, which was on local `main` and behind `origin/main` by 2 commits.

Between local `main` and `origin/main`, the chat path changed materially:

- router moved to tri-state `response_mode`
- prompt / synthesis behavior changed substantially
- classifier handling changed slightly

This means the original “bad conditioner result” needed to be rechecked on a clean `origin/main`-based worktree before treating it as a product truth.

## Recheck On `origin/main`

Tested prompts:

- `Welcher Conditioner passt gerade am besten zu meinem Haar?`
- `Welcher Conditioner passt bei Feuchtigkeitsmangel?`

Test profile:

- `hair_texture = wavy`
- `thickness = fine`
- `density = medium`
- `protein_moisture_balance = snaps`
- `cuticle_condition = rough`
- `chemical_treatment = bleached`
- `heat_styling = several_weekly`
- concerns include dryness, damage, frizz

## Finding 1: Conditioner matching itself is not broken

On the clean `origin/main` base, both conditioner prompts classified as:

- `intent = product_recommendation`
- `product_category = conditioner`

And both ended up with concrete conditioner products from the matcher.

So the issue is not:

- “conditioner category is broken”
- “conditioner prompts are misclassified into another category”
- “conditioner product retrieval is empty”

## Finding 2: The generic conditioner chip is still more fragile because of router slot logic

For:

- `Welcher Conditioner passt gerade am besten zu meinem Haar?`

The classifier produced:

- `product_category = conditioner`
- all normalized free-text slots = `null`

Router result:

- `response_mode = recommend_and_refine`
- `policy_overrides = ["category_product_mode", "missing_slots"]`
- `slot_completeness = 0.1`

Why this happens:

- the conditioner profile is actually complete enough for recommendation
- but slot completeness still depends mostly on free-text filters like `problem`, `routine`, `products_tried`
- the router gives conditioner only a small bonus for `protein_moisture_balance`
- that still leaves the generic conditioner question below the product slot threshold

So the router interprets this as “under-specified” even though the deterministic conditioner profile is already sufficient.

On the later synced-root-main rerun, this prompt still recovered to a usable score and returned strong answers. The fragility remains real, but it is not a reason to exclude conditioner entirely anymore.

## Finding 3: The explicit conditioner chip is no longer weak on current base

For:

- `Welcher Conditioner passt bei Feuchtigkeitsmangel?`

The classifier produced:

- `product_category = conditioner`
- `normalized_filters.problem = "Feuchtigkeitsmangel"`

Router result:

- `response_mode = answer_direct`
- `policy_overrides = ["category_product_mode"]`

The assistant returned a direct conditioner recommendation with concrete products.

Implication:

- this prompt was weak in the original matrix because that matrix ran on the stale local root checkout
- on current `origin/main`, this variant is not the same problem anymore

## Root Cause Summary

There are 2 different issues that were initially collapsed into one:

1. **Stale evaluation branch**
   - The original bad conditioner results were produced on a local checkout behind `origin/main`.
   - Router/synthesis behavior has changed since then.

2. **Generic conditioner prompt fragility**
   - The broad wording `Welcher Conditioner passt gerade am besten zu meinem Haar?` contributes no explicit problem slot.
   - Router fallback logic still treats it as partially under-specified.
   - This makes it more fragile than sharper prompts like:
     - `Welches Shampoo passt zu meinem schnell fettenden Ansatz?`
     - `Welcher Leave-in passt zu meinem Styling-Alltag?`
     - `Was hilft bei trockenen Schuppen?`

## Synced Root `main` Rerun

After the root checkout was fast-forwarded to match `origin/main`, the full starter matrix was rerun.

Key ranking changes:

- `Welcher Conditioner passt gerade am besten zu meinem Haar?` moved back into the strong group.
- `Welcher Conditioner passt bei Feuchtigkeitsmangel?` also stayed usable.
- `Wie bekomme ich mehr Volumen, ohne zu beschweren?` became the weakest prompt in the matrix.

This changes the product conclusion:

- conditioner is back in play for v1
- volume is the prompt to treat more cautiously

## Recommendation

For v1 starter chips:

- allow conditioner prompts when the profile already supports them
- prefer the explicit `Feuchtigkeitsmangel` variant when the balance signal is present
- keep volume conditional on an explicit volume goal rather than using it as a broad default

For follow-up evaluation:

- watch whether broad conditioner wording still underperforms when `protein_moisture_balance` is missing
- investigate whether the volume chip can be reframed into a stronger first-turn question

## Candidate Fixes

If we want the broad conditioner starter to become more robust later, likely fixes are:

1. Treat eligible conditioner requests as sufficiently specified even when free-text slots are sparse.
2. Give conditioner slot completeness credit for:
   - `thickness`
   - `protein_moisture_balance`
   - possibly `density`
   - category eligibility itself
3. Narrow conditioner starter copy to explicit need-led variants instead of generic “best conditioner” wording.

## Current Practical Decision

The best v1 call after the synced-main rerun is:

- routine
- scalp/shampoo
- care-category prompt chosen between conditioner, leave-in, and mask-vs-leave-in
- outcome

Conditioner no longer needs to stay out of the default starter set. The more important guardrail now is to avoid surfacing the volume chip unless the profile explicitly points there.
