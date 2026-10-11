# Budget and tier journey — planning prototype

Date: 2026-10-03. Updated: 2026-10-07. Planning revision: 47. Status: updated local mockup; changed confirmation/recovery screens pending Nick's review. No app implementation or launch approval.

Next-agent context and review checklist: [complete handover](../handover-2026-10-07.md), including specific direct-route portfolio fixture limits. Review mockup interaction separately from policy/allocator correctness.

## Current preview — revision 49 (October 8, adversarial design review)

One read-only Opus design review (30 findings) ran on revision 48. Disposition:

- **Applied (defects/copy within settled rules):** neutral plum notices instead of amber warnings for over-budget recommendations; no „Ausnahme“/„bewusst“ wording; one exception reason everywhere („Passt beim Pflegegewicht deutlich besser als die Option im Budget.“); card labels by price relation („Im Budget“ / „Empfohlen“ for the flexible primary / „Alternative“), never a fit claim on affordable-first order; strict-zero and no-candidate states put „Ohne neues Shampoo weiter“ in the dock instead of a disabled CTA; edit mode changes only the edited role, shows „Dein Produkt“ and offers „Mein Shampoo behalten“; first-time journey now steps Shampoo → Conditioner → Maske and shows when the single flexible exception is already used; unfinished selection continues with „Weiter zur Maske“; conflict names the other saved value with „Meine Auswahl speichern“ / „… behalten“; stale proposal is info-tone with dimmed cards and „Vorschläge neu laden“; Back from a reused saved budget returns to the capture step; no budget notices on capture screens; direct accept says „Weiter“ until a budget exists and states how many products changed; cockpit shows the alternative's check marks, euro amount over budget and exception count, and edits the budget inline in staff voice; scanner uses a caption („Bis 15 € zuerst“) and verdict pills; suggestion chip „Wie deine bisherigen Produkte“ stays on the suggested answer; flexibility descriptions rewritten; legacy products accepted before a budget get no amber badge; larger link hit areas and fuller card aria-labels.
- **Not applied — Nick-approved copy:** „insbesondere“ sentence in the tier helper (explicitly required by Nick).
- **Nick 2026-10-08 („Sharpen“):** helper „Preis pro Packung – gilt für jedes Produkt deiner Routine.“; follow-up „Bis 15 € für jedes Produkt?“ / „Ja, für jedes.“ / „Einzelne dürfen mehr kosten.“; main question unchanged. Budget line „Bis 5 € für jedes Produkt“.
- **Out of feature scope:** live-app coral CTA contrast (3.67:1); applies to every screen, separate design-system decision.

Captures: `screenshots/rev49-*.jpg|png`.

## Current preview — revision 48 (October 7, Claude review)

Redesign pass after the takeover review. Same settled rules (points 1–35); presentation now follows the live app instead of a bespoke mockup style. Pending Nick's walkthrough.

- Visual system from the live app: coral pill CTA, refinement-question option cards with eyebrow, product-fit comparison cards (status label, size · price line, tier + „Über deinem Budget“ badges), scan result + „Passende Alternativen“. Tokens copied from `src/app/globals.css`.
- Personal Plan entry is now the real last capture step („Deine Maske“, per-category capture as in `/labs/personal-plan/stage-3`), not an invented product shelf. The budget step sits between the last capture screen and „Produkte prüfen“. Owned-product prices are no longer shown anywhere (Nick, 2026-10-07).
- Suggestion = chip „Passt zu deinen Produkten“ on the preselected option only; disappears when another answer is chosen.
- **New copy for approval:** flexibility option descriptions — „Teurere höchstens als Alternative, nie vorausgewählt.“ / „Wenn ein Produkt deutlich besser passt.“; missing-budget edit context „Danach geht es direkt mit deiner Änderung weiter.“; existing routine after a lower budget: „3 Produkte liegen über deinem Budget. Sie bleiben, bis du neue Vorschläge übernimmst.“ + „Neue Vorschläge ansehen“.
- Example portfolios now follow the allocation rules (N = 3): capped flexible = exactly one exception with reason; no ceiling = two of three above €15; strict = all within budget; unknown budget = fit examples without budget labels. Accepting a flexible exception Shampoo keeps the rest of the routine in budget.
- Scanner shows the scanned product and verdict first; with a saved flexible budget the affordable alternative leads, without a budget the existing fit order applies and no budget labels appear.
- Cockpit is desktop-first (budget panel beside the product table) and no longer overflows at 390 px.
- Working-log text removed from customer screens; per-route review hints live in the „Entwurf · Demo“ toolbar.

Captures: `screenshots/rev48-*.jpg`. Previous October-7 source preserved in `oct7-archive/` (not served). Checks: `node --check`, no console errors, no horizontal overflow at 390 px across all toolbar scenarios, desktop 1280 px product and cockpit screens.

## Previous preview — October 7 (superseded by revision 48 presentation)

Question: is it clear when budget is suggested, confirmed and reused, without silently replacing products? Shape: the existing local interactive mockup, with short German screens and in-memory recovery fixtures. Retain source and captures as planning evidence; rewrite production behavior through the normal workflow.

- [Personal Plan](http://127.0.0.1:4391/): `Deine Produkte` → editable budget suggestion when evidence is clear → explicit capped-only flexibility → product decisions. Proposed real placement: the existing capture-to-decisions boundary, after any need-revision review. The initial quiz is unchanged. Mixed/no-product fixtures leave the question unanswered; saved complete answers are reused.
- [Consulting preparation](http://127.0.0.1:4391/beratung): equivalent confirmation after `Deine Produkte`, before `Deine Routine` and `Hitze & Styling`. [Call cockpit](http://127.0.0.1:4391/cockpit) retains the bounded saved-budget section.
- [Direct acceptance](http://127.0.0.1:4391/direkt): illustrative proposal → budget if missing → updated proposal shown → explicit routine acceptance. No forced product entry; complete saved answers skip collection. Cancel/failure does not accept the routine.
- [Scanner](http://127.0.0.1:4391/scanner): suitable affordable option first under a saved flexible budget, evidenced higher-priced alternative clearly labelled. Unknown-budget examples make no affordability claim. No per-scan routine quota or automatic routine change.

Use the closed `Entwurf · Demo` toolbar for clear/mixed/cheap/no-product inputs, saved-answer reuse, existing-routine missing-budget edits, strict 2+/1/0 options, conflicts and stale refresh. It is review-only UI, not a proposed customer control. Editing an existing routine with a missing budget collects it first and resumes the intended edit only after the successful save stub; merely viewing the routine remains uninterrupted.

All displayed catalog facts and suitability claims are fictional. Product search/scanning, durable saves, cross-route reuse, concurrency, actual portfolio allocation, package-evidence binding, payments/provisioning and full application integration are not implemented or proven. Reload resets fixture state. These loopback URLs are mockup routes, not new production pages.

## Verification — October 7

Chrome browser checks at 390×844: clear €8/€10/€14 → €15 suggestion; edited answer survives Back to products and returning; mixed €4/€4/€25 and no products → unanswered/disabled Weiter; €3/€4/€5 → €5 suggestion with an unanswered flexibility follow-up. Existing routine viewing is uninterrupted; cancelling frequency collection keeps the original products and 2× frequency; failed save retains the answer; explicit retry resumes 2→3× without changing products. Product-edit collection resumes a proposal, and declining preserves the original routine. Complete saved answers bypass collection in the product-entry and shortcut fixtures.

Shortcut checks: initial three-role illustrative proposal → unanswered budget → capped follow-up → visibly different ≤€5 products → explicit acceptance. Back returns to the original proposal without accepting it. Consulting uses the same confirmation; uncapped skips the flexibility question and proceeds through routine to existing heat/styling context. Scanner shows affordable-first under saved flexibility and no affordability/budget-fit claim when unknown. Rechecked strict-zero unselected/disabled acceptance, deliberate €70 selection with unchanged €5 preference, conflict readback plus explicit retry preserving draft answers, optional refresh without replacing prior choices, and stale proposal acceptance blocked until reload. These are local UI checks, not real persistence or concurrency tests.

No horizontal overflow in the inspected mobile confirmation, shortcut proposal, scanner and long-name comparison states; desktop confirmation checked at 1280×900. Temporary viewport override reset after review. The old IAB automation backend was unavailable; verification used an isolated Chrome review tab. The same localhost preview remains available in Codex.

Current captures under `screenshots/`: `budget-suggestion-mobile-oct7.jpg`, `budget-unanswered-mobile-oct7.jpg`, `budget-suggestion-desktop-oct7.jpg`, `consult-suggestion-mobile-oct7.jpg`, `direct-updated-proposal-mobile-oct7.jpg`, `budget-edit-save-failure-mobile-oct7.jpg`, `scanner-flexible-mobile-oct7.jpg`. Syntax checks for the prototype/server and formatting checks pass. No application tests, production operations, publication or deployment ran. User review and the full hardened technical-plan review remain pending.

## Historical evidence — superseded placement

The October 3–5 records below preserve earlier approvals and captures. Their before-exact-product-entry placement and blanket unselected first-time default are superseded by points 30–35 and the current preview above. Do not treat them as approval of the changed screens.

## Recovery extension — revision 38

Question: when saving or refreshing fails, is it clear that existing product choices stay intact? Shape: the same interactive fixture, with stub conflict and revision states. No new normal screens or production persistence. Retain this source and captures with the plan; implement real persistence through the normal workflow.

At 390×844, checked unfinished routine budget edit, failed save and explicit retry, chosen Shampoo preserved with Mask still open, optional refresh offer, failed refresh and decline; conflict retains local answers even when the answer changes, blocks save until readback, displays the actual saved budget and requires explicit retry; stale proposal blocks acceptance even after another product is selected, reload restores normal review, and declining retains the original selection. At 1280×900, conflict layout fits without horizontal overflow; approved strict-zero and flexible-primary behavior remains unchanged.

Captures: `mid-budget-refresh-mobile-oct5.png`, `mid-refresh-failure-mobile-oct5.png`, `budget-save-conflict-mobile-oct5.png`, `budget-save-conflict-desktop-oct5.png`, `budget-stale-proposal-mobile-oct5.png`. These are visual/interaction evidence only. The shortened refresh fixture replaces an illustrative whole portfolio only after acceptance; it does not implement the remaining-category flow or prove real concurrency, atomic acceptance, package freshness, missing-legacy behavior or consultation persistence. The cockpit remains the approved bounded normal-section mockup; it does not demonstrate staff conflict recovery. See [technical contract and remaining decisions](../technical-handoff.md).

Nick's “works yes” approves the displayed placement and wording. The requested [Claude Opus design review](./design-review-opus.md) preserves that direction and records proposed minor polish and unreviewed states. This does not approve production implementation or unshown recovery behavior.

## Polish applied — 2026-10-05

Nick's “good apply that” approves 10px badges with stronger over-budget emphasis, shorter exception copy preserving the affordable compromise, and clearer cockpit ownership without duplicate numbering/labels. Approved questions, placement and selection rules are unchanged. At 390×844, checked strict 0/1 affordable states, explicit over-budget choice with unchanged preference, flexible primary and long-name cards without horizontal overflow. Cockpit checked at 390×844 and 1280×900. Captures: `strict-zero-polished-mobile-oct5.png`, `strict-one-polished-mobile-oct5.png`, `flexible-polished-mobile-oct5.png`, `cockpit-polished-mobile-oct5.png`, `cockpit-polished-desktop-oct5.png`, `flexible-polished-desktop-oct5.png`. Syntax/formatting checks pass. These are mockup checks, not real persistence/ranking or complete recovery verification.

## Current review — 2026-10-05

Question: can the same short budget questions fit the Personal Plan and consulting preparation, while the call cockpit shows the saved preference beside recommendations? The existing interaction fixture is extended only to review conditional questions, back/edit behavior and responsive layout. Disposition: retain source and screenshots with the plan; rewrite production behavior through the normal workflow.

- [Personal Plan](http://127.0.0.1:4391/): proposed `/plan-start` Stage 2, immediately after current product categories; the existing questions continue after budget and capped-only flexibility. Cards remain in Stage 3. This shortened fixture still omits those intervening questions.
- [Consulting preparation](http://127.0.0.1:4391/beratung): proposed `/beratung/produkte`, `Deine Produkte` → budget → capped-only flexibility → `Deine Routine` → existing `Hitze & Styling`. The same German budget copy is reused. Coral primary buttons and product shelf context follow current `discovery/intake/ui-classes.ts` and `discovery-products-screen.tsx`. The shelf is static demo context, not a working search/scanner.
- [Call cockpit](http://127.0.0.1:4391/cockpit): compact proposed budget summary/edit entry at the beginning of Phase 3 `Produkte` on `/admin/beratung/[enrollmentId]`. One fictional recommendation illustrates package price/quantity/tier and an exception reason next to a product/target table, grounded in `discovery-call-cockpit.tsx` and `comparison-table.tsx`. This is a bounded section mockup, not a recreation or replacement of the entire cockpit. Call decisions/finalization are not implemented.

Required question: “Was darf ein Pflegeprodukt ungefähr kosten?” with “Pro Packung, für deine gesamte Routine.” Answers: “Bis 5 €”, “Bis 15 €”, “Keine feste Preisgrenze”. Only capped answers get “Bis … € für alle Produkte?” with “Ja, für alle.” / “Einzelne dürfen mehr kosten.” The saved value is shown compactly on the routine and recommendation surfaces. Tier explanation retains “insbesondere” in the second sentence, separately from the all-category budget.

Observed in browser on 2026-10-05: no preselected first-time answer and disabled Weiter; consulting €15 → flexibility → routine with the same summary; saved-answer edit restoration; no-ceiling bypasses flexibility; strict zero-affordable shows higher-priced cards without selection and disables acceptance; flexible exception shows the primary and affordable swap; consulting budget at 390×844 and desktop cards/cockpit inspected. Screenshots: `budget-review-oct5.png`, `flexibility-review-oct5.png`, `consult-budget-review-oct5.png`, `consult-budget-mobile-oct5.png`, `cards-review-oct5.png`, `cockpit-review-oct5.png`. Historical captures below remain separate evidence.

Limits: answers reset on page navigation/reload; cross-route profile reuse, missing legacy answers, real save/revision/concurrency recovery, mid-selection refresh, exact full-flow placement and all live suitability/ranking remain unverified. All products, fit claims and prices are fictional. Current eligibility/priority policy is documented in plan points 26–27, not computed by this fixture. The shown consultation/cockpit direction is approved; unshown complete-flow/recovery and production integration are not. No production code, services or data changed.

Question: does one mandatory package-budget step, with a conditional flexibility follow-up, lead naturally into the existing product comparison without making visible above-budget options look automatically selected?

Shape: an interactive, local-only HTML UI prototype in the existing task worktree. All answers, save failures and routine changes are in-memory stubs. No credentials, analytics, production services, catalog writes or real customer data.

Decision criterion: Nick can walk the €5/€15/no-ceiling paths, compare mobile and desktop, see the strict 2+/1/0 affordable-candidate cases, and deliberately choose an above-budget option without any hidden budget change. He can judge the proposed placement, copy, price/quantity/tier badges and recovery states in context.

Disposition: retain this source and its verification notes as durable planning evidence in the future PR. Production implementation must be rewritten through the normal workflow; no mockup code is promoted to the app. Browser captures used for review are planning evidence, not evidence of deployed behavior.

## Current product context

- Stage-2 product questions currently start with “Welche Produkte nutzt du?”, then wash frequency and conditional product questions. Proposed placement: budget immediately after product categories, before exact product matching. The shown placement is approved in point 28; full surrounding-flow evidence remains open.
- Reuse the Stage-2 question shell, option cards, journey header and mobile fixed / desktop inline Weiter action from `src/components/personal-plan-refinement/refinement-question.tsx`, `refinement-options.tsx` and `src/components/personal-plan-journey/journey-header.tsx`.
- Reuse the current one/two-product comparison and bounded alternative navigation from `src/components/personal-plan-products/product-fit-comparison.tsx`. A web bundle has at most three candidates; this is not a three-card grid.
- Use existing plum/cream tokens and bundled Plus Jakarta Sans / Playfair Display fonts. Product illustrations, names, prices, quantities and fit reasons in this prototype are explicit demo data, not researched or approved catalog facts.
- Preserve the settled business rules in `../plan.md`. Exact visual copy/layout and the complete journey still require approval.

## Run

From the task worktree: `node plans/profi-tier-baseline/evidence/server.mjs`.

The server exposes only the prototype files and two bundled fonts on loopback. It does not serve the repository or environment files. The review toolbar is prototype-only and offers scenario, reset and simulated-failure controls; it is not proposed customer-facing UI.

Open `http://127.0.0.1:4391`. The toolbar selects scenarios, not the customer's budget. Use the browser's responsive viewport for device checks; there is no customer-facing device picker.

## Concrete journey proposed for review

Approved shown placement (full surrounding-flow evidence still open): inside the existing `/plan-start` flow, Stage 2 becomes `current_product_categories` → budget → capped-only flexibility → `wet_wash_frequency` → the remaining existing product questions. The product cards remain the existing Stage-3 selection after the relevant Stage-2 product segment; preserve current modular handoffs rather than requiring every habits module first. No new recommendation page or URL is added. The routine and refresh screens are shortened behavior fixtures, not additional onboarding steps. A later budget change is proposed through the product/routine budget summary's “Ändern”; the durable settings/chat entry and persistence remain D2 work.

Historical revision-25 scope note: consulting is also in feature scope. Proposed placement: within `/beratung/produkte`, after `Deine Produkte` and before `Deine Routine`; reuse already saved answers. `/admin/beratung/[enrollmentId]` shows the same preference and allows authorized completion/correction during the call. Both recommendation entry points must consume the shared policy. The October-5 extension above now shows bounded consulting/cockpit context; full contextual journey approval remains pending.

Plan revision 28 confirms the unfinished-selection budget-change behavior: keep chosen products, use the successfully saved new budget for remaining suggestions, and offer an optional whole-routine refresh. Generating the refresh does not replace choices; explicit acceptance is required. Revision 38 adds the bounded unfinished-selection and conflict/stale UI evidence above. Actual remaining-category flow and real revision/save recovery remain implementation work, not proven by this fixture.

Nick's 2026-10-03 feedback requests fewer headings, labels and words. The revised proposal has one main heading per screen, one package/routine helper line, single-line budget answers and no repeated eyebrow/section labels. Product comparison retains price, quantity, tier and “Über deinem Budget”, with one short contextual note. General fit/tier explanation moves into one closed “Details zur Auswahl” disclosure; making current fit detail collapsible is a UX proposal, not an approved production change. The prototype-only test controls are also collapsed by default. Budget/exception rules are unchanged. This feedback does not approve placement or the complete journey.

Actor: a Personal Plan user who has just chosen their current product categories. Insert the budget question immediately after that existing screen, before the remaining product questions and exact-product matching. The prototype starts at the budget question: the existing surrounding Stage-2 screens are not recreated, and Back at this shortened entry point is disabled. The real journey would retain its current category-selection return path.

1. Choose €5, €15, or no ceiling. No answer is preselected; Weiter requires a choice.
2. A capped answer gets the all-products / individual-exceptions question. No ceiling bypasses it. Back from the follow-up retains the budget answer.
3. The shortened demo jumps to one Shampoo comparison; production would first resume its existing product-question segment and handoff. Comparison has one/two visible cards and at most three fixture candidates, not three reserved card slots.
4. In strict mode, 2+ affordable candidates means only affordable choices. One/zero means directly visible, separately labelled above-budget choices. With zero affordable candidates nothing is preselected. Explicit above-budget selection does not change the saved preference. No suitable candidates leaves a truthful open step.
5. Flexible fixtures show a justified primary exception, an affordable swap where available, and the necessary-gap overflow example. No-ceiling illustrates the provisional mix, not a launch-ready ranking implementation.
6. Accept or leave the Shampoo step open to see an illustrative three-item routine. This is not a complete multi-category selection flow.
7. Changing the budget retains the accepted routine and offers a refresh. Preview, retain, accept and simulated refresh failure are in-memory paths. Failed budget save retains answers for retry.

## Verification and limits — 2026-10-03

Current surface context was visually inspected through read-only fixture labs on the same task checkout: Stage-2 product categories and Stage-3 Conditioner comparison. No authenticated customer flow, catalog mutation or fresh production query was performed in this prototype pass. The temporary Next.js lab server was stopped after inspection.

Browser checks passed at desktop 1280×900 and mobile 390×844: explicit required choice, capped follow-up, no-ceiling bypass, save failure/retry retaining the answer, strict 2+/1/0 affordable states, alternative paging, keyboard arrow selection, optional €70 manual selection with unchanged €5 preference, truthful no-candidate state, direct flexible exception, N=3/G=2 gap fixture, accepted routine retained after a saved €15 change, and refresh failure/decline retaining that routine. No horizontal overflow was observed on the inspected mobile budget/comparison states. Long-name cards and price/quantity/tier/budget badges remain readable; badges can wrap instead of forcing the name line wider.

Syntax checks for both scripts and Prettier checks passed. These are prototype checks, not app tests or proof of recommendation, storage, concurrency, stale-price handling, real suitability or research readiness. Browser reload resets all state; durable resume, missing legacy data, revision conflicts and exact multi-category acceptance remain D1/D2 hardening work. D3 placement/copy/journey approval is still pending. The full hardened feature plan still needs counterpart review.

The original `screenshots/budget-desktop.jpg`, `budget-mobile.jpg`, `strict-one-desktop.jpg`, `strict-one-mobile.jpg`, `strict-zero-desktop.jpg` are historical first-proposal evidence. New `*-lean-*.jpg` captures show the concise revision. Use only revision-matched evidence for decisions.

Concise-revision recheck: desktop 1280×900 and mobile 390×844 inspected; required unselected budget/flexibility controls, €15 strict affordable comparison, one/zero affordable states, optional detail disclosure and its tier wording verified. Zero-affordable cards remain unselected with a disabled accept action. Mobile price/size/budget labels fit without horizontal overflow. This pass does not rerun every original fixture or prove real persistence/ranking. Captures: `budget-lean-desktop.jpg`, `budget-lean-mobile.jpg`, `strict-one-lean-desktop.jpg`, `strict-zero-lean-mobile.jpg` under `screenshots/`.
