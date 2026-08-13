# Stage 3 product-fit UX findings

Date: 2026-08-13
Source: authenticated review of the merged PR #385 experience at mobile and desktop widths, using the five supplied screenshots and a source/test trace on merge commit `d0a4ca8c`.

## Executive finding

The current page does not present a coherent user decision. It visually says “inspect these product records and technical dots,” while the actual task is “decide what happens to this product in my routine.” The server-side decision and recovery model is intact, but the presentation obscures the verdict, comparison meaning, category context, and action hierarchy. Valid zero-alternative states can look like an unfinished or empty page.

## What the user should be able to do

For each category or role, the first viewport must let the user answer four questions:

1. What am I reviewing now?
2. Does my current product fit my needs?
3. If not, what verified alternative is being offered and why is it better?
4. What exact decision will the primary action save?

The current page answers none of these reliably without interpretation or scrolling.

## Screenshot findings

### F1 — The page lacks a clear purpose and verdict

Observed in screenshots 1–5.

- `Wie gut passt dein Produkt?` asks a question but the screen does not give a prominent answer.
- `Ein Produkt nach dem anderen` describes process, not value.
- `Produkte prüfen` repeats navigation context without identifying the category or position.
- Product cards and technical dimensions appear before a plain-language conclusion.

User message received: “You must inspect technical evidence yourself before deciding.”
Required message: “Here is the conclusion for your Conditioner, here is why, and here is the decision you can make.”

### F2 — Mobile is not a comparison

Observed in screenshots 3 and 4.

- Product cards use a one-column grid below `md` (`768px`), so at `375–400px` the current product and alternative are vertically separated.
- The user cannot visually scan the products side by side.
- Existing browser coverage asserts only general containment, not mobile comparison geometry.

Confirmed source seam: `src/components/personal-plan-products/product-fit-comparison.tsx`, product-card grid.

### F3 — The rails are visually ambiguous

Observed in screenshots 2 and 3.

- `Ziel`, `Deins`, and `Alternative` exist only as ARIA labels; there is no visible legend.
- All three markers share one vertical position.
- When values coincide, later markers paint over earlier markers, making one or two meanings disappear.
- Color alone is insufficient and the colors do not map visibly back to the product cards.

Confirmed source seam: `ComparisonDimensions` and `RailMarker` in `product-fit-comparison.tsx`.

### F4 — Actions overflow and lose hierarchy

Observed in screenshots 1, 3, and 4.

- The global button primitive forces `white-space: nowrap`.
- The sticky CTA interpolates complete product names into the label.
- Realistic German names overflow the viewport instead of wrapping or shortening.
- Secondary actions render as large ghost buttons with almost no container treatment, so they look like unrelated text floating in whitespace.
- The sticky CTA can cover content because the page reserves a fixed amount of bottom padding independent of actual wrapped action height.

Confirmed source seams: `src/components/ui/button.tsx` and the action section in `product-fit-comparison.tsx`.

### F5 — The category context is computed but hidden

Observed in screenshots 1–5.

- The flow passes `Conditioner`, `Shampoo`, `Leave-in`, or the Oil role into `Stage3Shell`.
- `Stage3Shell` only serializes it into `data-stage3-context`; it never renders it.
- Changing review subject does not trigger the existing scroll-to-top/focus effect because that effect depends on category capture index and phase, not the current review subject.

Confirmed source seams: `stage3-products-flow.tsx` and `src/components/personal-plan-products/index.tsx`.

### F6 — The “empty page” is a real render-path defect

Observed in screenshots 1 and 5.

This is not evidence of a missing API bundle. A missing or mismatched comparison bundle takes the explicit `Passung wird aktualisiert` system-error branch. The screenshots show `ProductFitComparison`, meaning the server delivered a valid bundle.

The defect occurs when a valid decision exists but there is no verified alternative or no comparison dimension:

- `hasTruthfulAction` is true because `keep_owned`, `keep_pending`, or `leave_uncovered` is allowed.
- The component therefore bypasses its explicit no-action fallback.
- Without an alternative, the alternative card, navigation, rails, and compact facts disappear.
- The remaining output is a current/placeholder card, a large blank area, and a sticky CTA.

Affected truthful states:

| State | Current rendering | Required rendering |
| --- | --- | --- |
| Owned product fits, no verified alternative | Product card + keep CTA | Positive verdict, reason, current product, keep CTA |
| Pending submitted product, no alternative | Product identity + wait CTA | Pending state, what happens next, wait CTA |
| No owned product, no verified alternative, uncovered allowed | `Noch kein Produkt` + CTA | Honest no-recommendation explanation, consequences, deliberate continue/add action |
| Known/pending, no action at all | Explicit no-alternative fallback | Keep explicit fallback, but align with category/progress shell |
| Unsupported analysis | Retry state | Keep distinct retry state |

Confirmed source seams: `ProductFitComparison`, `primaryActionFor`, and `buildStage3FitComparison`.

### F7 — Exact explanatory prose is not yet universally computable from the transport contract

All ten product categories have deterministic authority adapters, and both the owned product and every verified alternative are evaluated independently. That is enough to determine a verdict for a known product with complete facts. It is not yet enough to produce the newly reviewed target-relative sentences uniformly in the client:

- rich comparison dimensions currently exist for Shampoo (except the dandruff role), Conditioner, Leave-in, Mask, and Oil;
- Heat protectant, Scalp care, Dry shampoo, Bondbuilder, Deep-cleansing shampoo, and dandruff shampoo intentionally use compact criterion summaries rather than three-axis rails;
- some honest core dimensions have product positions but no authoritative target corridor, including Shampoo cleansing intensity and set-valued suitability rows;
- `Stage3CriterionResult` carries a result and explanation, but not a normalized observed value, target value, or target relation for both products;
- several current `Stage3FitComparisonDimension.reason` strings describe provenance rather than the actual owned-versus-alternative result.

Therefore the UI must not assemble universal claims by inspecting labels or marker percentages. The sustainable boundary is a deterministic server-built evidence projection: structured observed positions, target relation where one exists, and explicit `no_target`/`unknown` states. Specialist categories use their existing verified criteria as compact reasoning. Unknown, pending, or unsupported inputs receive no fit claim.

Confidence boundary: we can cover every category and role after this projection is implemented and exhaustively fixture-tested, but only for known products and server-verified alternatives with sufficient authority facts. We cannot truthfully score arbitrary or pending catalog entries.

### F8 — The partial-fit action policy is inconsistent with the offered alternative

The comparison bundle is already the server-validated replacement allowlist, so `select_replacement` is a truthful action whenever a selected alternative is present. The production component can submit that action even though category adapters deliberately omit it from `allowedActions`.

However, the reviewed partial-fit state did not show all three user decisions, and current category adapters do not consistently authorize `leave_uncovered` for supportive owned products. The correct partial-fit action set is:

1. `keep_owned` — keep the current product;
2. `select_replacement` — choose the currently viewed exact alternative and fingerprint;
3. `leave_uncovered` — continue without a product for this role.

This requires a narrow authority-policy normalization for supportive verdicts; it is not merely a copy change. Candidate validation, fingerprint binding, and persistence semantics remain unchanged.

## Why the existing tests passed

- Component tests assert strings, ARIA labels, and action payloads; they do not assert visible legend structure, collision handling, mobile geometry, or CTA containment.
- The pending-state test currently locks in the sparse identity-plus-action surface.
- The Playwright journey proves that decisions reach Routine, but does not test the first-viewport comprehension contract.
- The desktop containment check only proves that the main shell is at most `720px` and the document has no horizontal overflow in that single state.

## Repair principles

1. Verdict first: answer keep, replace, wait, or continue without a product before presenting proof.
2. Persistent context: show category/role and `n von m` at the top of every review and return to the top on subject change.
3. Mobile comparison: current product and selected alternative remain adjacent at `375–400px` with compact, bounded cards.
4. Stable visual semantics: visible legend; labeled shapes; target as a band; current and alternative markers use separate lanes so collisions remain readable.
5. One action boundary: only one sticky primary CTA; it uses a short verb phrase. The exact product identity remains visible immediately above it, not inside an unbounded label.
6. Contained alternatives: secondary/override actions live in a clearly labeled action card or disclosure, never loose in whitespace.
7. Designed sparse states: no-alternative, pending, unsupported, and no-product states each explain what is known, what is not, and what the next action does.
8. Preserve authority: presentation changes must not alter the server candidate allowlist, candidate fingerprint validation, durable retry logic, or direct Routine handoff.
9. Server-owned reasoning: comparative sentences are deterministic projections of authority facts, never client inference or generated prose.
10. Complete partial-fit choice: when a supportive product and verified alternative are shown, keep, replace, and continue-without are all available and persist distinct existing actions.

## Evidence-review annotations incorporated

Nick's interactive review added two clarity requirements:

1. The headline verdict must name the concrete aspects that fit and the concrete limitation. A generic grade such as `passt grundsätzlich – mit Einschränkung` is not independently useful.
2. Each dimension explanation must reinforce the visual by stating where the current product and alternative sit relative to the target. The sentence must come from the same authoritative criterion result as the rail; it must not invent a second score. If no alternative exists, it describes the current product and the honest absence of a clearly better verified option.

## Required regression evidence

- Component states for owned-fit/no-alternative, pending/no-alternative, no-product/leave-uncovered, zero-action, and unsupported analysis.
- Visible legend and separately represented colliding markers.
- Headline verdict names the decisive matching and limiting aspects.
- Every comparison dimension textually identifies the current product's and alternative's relationship to the target; no-alternative states never fabricate an alternative value.
- Category/role fixtures prove a non-empty, truthful reason for every known ideal, supportive, and mismatch evaluation across all ten categories, with compact specialist fallbacks and explicit no-target/unknown handling.
- A supportive state with a verified alternative exposes exactly `keep_owned`, `select_replacement`, and `leave_uncovered`; selecting the alternative still sends its exact ID and fingerprint.
- At `375px` and `400px`, product cards satisfy the selected side-by-side composition and every CTA remains within its container.
- Long product names never create horizontal overflow and never obscure required content.
- Category/role and review position are visible and update for each subject.
- Subject change scrolls/focuses the new review heading.
- Candidate switching remains presentation-only; only the primary action persists the exact selected candidate and fingerprint.
- The final decision still leads directly to Routine.
