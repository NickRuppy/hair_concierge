# Personal Plan UX investigation and decision brief

Status: approved independent slices implemented locally and verified. Nick approved the Bedarf direction, labelled example imagery, expandable details, one visible quick sentence, frequent-to-rare one-column wash frequency, Stage 3 search and the eight-stop product-frequency slider. His 2026-08-11 v4 review removed repeated product-kind context from search, required materially less copy, and redefined Routine as the Bedarfsplan resolved with exact products. His v5 annotations clarified that Stage 2 must show the full supported product-category inventory and that wet-wash ordering needs an explicit visual scale. Those corrections are incorporated in v5 and await final evidence review.

## What the production walkthrough established

### Bedarfsplan

- Missing images are not a broken image component. Stage 1 deliberately emits an empty `productPreviews` list so the immutable need plan remains independent from catalog availability and exact-product selection stays in Stage 3.
- The observed Conditioner classification is the exact current rule for the walkthrough profile: `very_short` hair makes Conditioner optional when care signals exist. Every other hair length gets Conditioner as Basis. This was not a random edge-case failure.
- The current compact card makes image, target type, reason, properties, and cadence compete for too little space.

Superseded comparison evidence: [five responsive Bedarfsplan card alternatives](./mockups/2026-08-10-personal-plan-debug-card-alternatives.html). Nick chose A1 as the starting architecture but rejected its execution as insufficiently polished.

The alternatives use clearly labelled `Beispielbild` target-type proxies. This adds product texture without falsely implying that an exact product has already been selected. Using live brand/catalog images in Stage 1 would be a larger authority change and is not the recommended default.

### Refinement

- Every answer currently replaces the entire question with a saving screen and waits for the remote PATCH. There is no hidden timer.
- On the observed production requests, total Stage 2 answer time was 2.76-4.13 seconds. The journey-access phase took 1.48-3.02 seconds; the actual save/completion operation took 0.58-0.96 seconds.
- The new quiz feels immediate because it updates local state first and transitions after about 260 ms while persistence is decoupled. Refinement does not currently share that contract.
- `Nichts davon` is implemented as a separate rounded button rather than the normal option-card component, which explains the inconsistent height and padding.
- `Kopfhautpflege` and `Hitzeschutz` have no context on the inventory question.
- Wash frequency is deliberately ordered "common first" rather than from most frequent to least frequent.

Proposed direction for the later implementation plan:

- advance locally with the new quiz's two-layer motion pattern;
- serialize durable saves and chain returned revisions in the background;
- replace full-screen saving shells with a subtle header state;
- prevent final completion until the queue is drained;
- on save failure, preserve answers, stop dependent forward progress, and offer inline retry/reload;
- replace the per-answer full journey snapshot load with the narrowest authorization query that preserves user, entitlement, plan-owner, source-version, and stage-readiness checks;
- add descriptions to ambiguous categories, restyle `Nichts davon` as a subdued option card, and display wash-frequency choices from most to least frequent without changing stored enum values.

### Exact products

- Stage 3 is created only for categories the user declared as owned, yet it still offers `Ich habe dafür kein Produkt`. That is a real semantic contradiction. The current button also serves as the only correction mechanism for a mistaken Stage 2 answer.
- A repeated per-category `Zur Verfeinerung` route is also rejected because it scales poorly across many categories. The replacement uses one global `Deine Produktarten` inventory editor, then keeps exact-product screens focused on products only.
- Product frequency currently uses eight buttons. The repository already has a discrete, keyboard-accessible eight-stop Routine slider that maps to the canonical enum. The proposed Stage 3 control adapts that interaction and the attached visual concept rather than inventing new frequency values.
- The repeated `Speichern fehlgeschlagen` loop and legacy-onboarding handoff are covered by the separate critical-recovery plan.

Superseded evidence: [refinement and products proposal](./mockups/2026-08-10-personal-plan-refinement-products-proposal.html). Nick rejected its visual execution and repeated correction model.

Replacement evidence: [cohesive premium Personal Plan UX v2](./mockups/2026-08-11-personal-plan-world-class-ux-v2.html). It carries the A1 product-proxy idea forward with explicit `Beispiel` labelling, uses one-column refinement choices and inline saving, centralizes product ownership correction, presents complete product identities, adapts the canonical eight-stop slider, includes conflict recovery, and shows the Routine handoff on mobile and desktop.

Final revised review artifact: [Personal Plan UX v5](./mockups/2026-08-11-personal-plan-world-class-ux-v5.html). It keeps product-kind clarification in the single Stage 2 inventory question, shows all ten currently supported Stage 2 product categories, removes that inventory from the Stage 3 search surface, cuts explanatory copy and redundant headings, and turns Routine into a Bedarfsplan-style overview with exact products, cadence, purpose and expandable application details. The final two annotated corrections were rendered at 390 px and 1440 px without horizontal overflow; Nick's review of that corrected render remains the visual evidence gate before those two details enter production code.

Nick's incorporated review:

- Bedarf keeps a real example packshot, always-visible one-sentence purpose, and the existing expand-for-more-information affordance. `Beispiel` must stay explicit for every category so no exact product recommendation is implied in Stage 1.
- Stage 2 product inventory is not limited to already recommended Basis/Optional items. It lists every currently supported exact-product reconciliation category from `STAGE2_PRODUCT_CATEGORIES`: Shampoo, Conditioner, Leave-in, Hitzeschutz, Öl, Maske, Kopfhautpflege, Trockenshampoo, Bondbuilder, Tiefenreinigungsshampoo. Basis/Optional/Weitere badges are visual guidance only; the user's selected categories decide which exact-product searches appear in Stage 3. The broader application category `styling` is not in the current Stage 2 picker and is therefore not shown in this mockup.
- Wet-wash rhythm is a display-order correction only: exactly one column, most frequent to least frequent, with a numbered vertical frequency rail and `Ich wasche meine Haare nicht nass` separated last. Stored enum values and branching remain unchanged.
- The global product-kind editor, exact-product search, and eight-stop frequency slider are approved as one Stage 3 sequence.
- Routine is not a set of separate routine concepts. It is the Bedarfsplan resolved with exact products: Basis and Optional product cards, cadence and a short purpose, each opening to its application details.
- The v2 Stage 2 heat-protection/context sequence is not approved. Product ownership must not be asked again there, and exact heat-protection product frequency belongs to Stage 3. Replacement evidence must make the remaining Stage 2 context questions feel like the same polished quiz, not a detached mini-flow.

## OGX database provenance

The search results come directly from live Supabase table `public.products`, queried by `/api/personal-plan/stage-3/search` for `category_key = 'shampoo'`. The UI renders `products.name` verbatim and the brand separately.

Five active OGX shampoo rows currently match:

| sort | Product ID                             | Stored name                                                               | Source                               |
| ---: | -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
|    0 | `f41badc9-16e3-41c1-ab6c-23541fffade0` | `OGX Renewing Argan Oil of Morocco Renewing Argan Oil of Morocco Shampoo` | approved user submission, 2026-07-02 |
|  175 | `3f3c7d89-9e7b-4e91-85f7-d3c58d304918` | `OGX Biotin & Collagen`                                                   | curated                              |
|  196 | `2ecd3c9d-90f6-45a3-a72c-daefed50be10` | `OGX Renewing`                                                            | curated                              |
|  202 | `7b5ec424-d21f-4eb8-999e-7aed98e94b86` | `OGX Rosemary`                                                            | curated                              |
|  214 | `bef4f219-2c1f-4e02-8e3a-93056b95465a` | `OGX Keratin Oil`                                                         | curated                              |

The long name was produced by concatenating brand + `product_line` + `clean_name`, while both incoming fields already contained “Renewing Argan Oil of Morocco”. The first and third rows are a high-confidence duplicate identity across old/new packaging generations, but they have different barcodes and conflicting authority specs. The user-submitted row is already referenced by two `user_products` rows and two Stage 3 drafts, so deactivation or deletion without transactional reconciliation would break history.

Safe correction is a separate catalog/data slice: choose a canonical identity, reconcile specs and identifiers, transactionally repoint references, then retire (not delete) the duplicate and harden intake normalization/duplicate detection. No catalog data was changed during this investigation.

## Designed user journey

1. Bedarf shows example product cards with one short reason; each card opens for more detail.
2. Refinement asks once which product categories the user currently owns. The inventory shows all currently supported exact-product categories, not just the categories already recommended as Basis/Optional. Then it asks the remaining concise routine questions such as wet-wash frequency.
3. Stage 3 opens directly on the current category: `Welches Shampoo nutzt du?`, search field, results. There is no product-category summary or correction panel above the search.
4. After selecting the exact product, the user sets its frequency on the eight-stop slider. A save or authority conflict retains the selection and offers one explicit reload/retry action.
5. Routine is one overview, not several routine concepts. It mirrors Bedarf's Basis/Optional card hierarchy, now using exact products, cadence and a short purpose. Opening a card reveals its application details.
6. The user confirms that one Routine and continues to Anwendung only after the existing activation boundary is satisfied.

Evidence review: v5 is rendered at 390px and 1440px without horizontal overflow after the final two annotation fixes. Nick's final review and explicit journey sign-off are pending.

Counterpart review: the required read-only Claude Opus/high lane was attempted after v5, but Claude Code returned its session-limit boundary and produced no report. Rerun remains required before publication.

## Remaining evidence gate

Nick's review of v5 is the only remaining visual evidence gate. Product ownership is asked once in Stage 2 across all ten supported categories; Stage 3 search opens directly on the current category with no inventory summary or correction panel above it. The Routine overview mirrors Bedarfsplan cards but replaces target types and example images with exact products and application details.

Resolved: current very-short Conditioner exception remains; Stage 1 uses clearly labelled example product proxies; wash frequency is one column and frequent-to-rare; Stage 3 uses search followed by the canonical eight-stop rare-to-daily slider; Routine is one product overview rather than multiple routine concepts.

## Proposed release slices after decisions

1. Critical recovery: Stage 3 conflict handling plus field-test Routine handoff.
2. Refinement continuity/performance: narrow authorization and immediate question continuity are implemented; each CAS save remains single-flight and disables dependent actions until it resolves. The rejected heat-protection frame is not included.
3. Approved Bedarfsplan/product-capture UI: truthful example imagery, expandable cards with one visible sentence, one-column wash ordering, global ownership correction, exact-product search, and Stage 3 frequency slider.
4. OGX catalog repair and intake hardening: Nick authorized the exact duplicate merge and normal-only/gentle authority repair on 2026-08-11. Apply only after a fresh exact-state preflight, transactional rollback ledger, and postcondition proof; provenance must remain preserved and must not create a second searchable identity.

Each slice must pass its own plan review, implementation loop, ready check, code review, and explicit publication gate. No slice implies production data writes, deployment, or activation.
