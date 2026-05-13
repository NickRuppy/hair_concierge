# Product Card + Drawer User-Ready Plan

> **For implementation:** use `superpowers:subagent-driven-development` or `superpowers:executing-plans` in a fresh repo-local worktree. This plan is scoped to chat product cards and the chat product detail drawer.

## Goal

Make chat product recommendations feel user-ready by removing internal recommendation/debug metadata from the compact card and drawer while preserving useful product context.

The finalized UX is:

- **Compact card:** quiet product jump with identity + whitelisted product facts only.
- **Drawer:** richer recommendation surface with a concise, intelligent `Warum es passt` explanation that synthesizes user profile, user goal, routine role, and product properties.

Reference mockup:

- `docs/mockups/product-card-drawer-revised-mockup.html`

## Final UX Contract

### Compact Product Card

Show:

- Product icon or image
- Product name
- Brand
- Max 1-3 product fact pills
- Tap affordance, e.g. chevron

Do not show:

- Price
- Generated reason sentence
- `Score`
- `Tags`
- `Profil-Match`
- Raw category/debug metadata
- Generic copy like `Passt in grossen Teilen zu deinem Leave-in-Zielprofil`

Example:

```text
Wella Ultimate Repair Leave-In
Wella
[Lotion] [Hitzeschutz] [Pflege: ausgewogen]  ›
```

### Product Detail Drawer

Use the finalized Drawer D structure:

1. Header
   - Brand
   - Product name
   - Product category pill, e.g. `Leave-in`

2. `Warum es passt`
   - One concise paragraph.
   - It should sound intelligent and personalized.
   - It should synthesize the user’s relevant profile and goal into the conclusion.
   - Do not show separate profile-transfer cards such as `Dein Styling`, `Deine Haardicke`, `Dein Ziel`, `Routine-Rolle`.

3. `Anwendung`
   - Full sentence.
   - Include dosing caveats when relevant, e.g. fine hair should start with little product.

4. `Produktprofil`
   - Labeled rows, not loose pills.
   - For leave-ins:
     - `Textur/Form`
     - `Gefühl`
     - `Wirkung`
     - `Hitzeschutz`
     - `Rolle`

5. Footer
   - Price
   - Shop-aware buy button when possible, e.g. `Bei dm kaufen`
   - Affiliate disclosure when links are monetized

Example `Warum es passt`:

```text
Du stylst regelmäßig mit Hitze und möchtest mehr Glanz, hast aber feines Haar, das schnell beschwert wirken kann. Diese Leave-in-Lotion passt als Booster nach dem Conditioner, weil sie Hitzeschutz mit ausgewogener Pflege verbindet, ohne in eine sehr reichhaltige Richtung zu gehen.
```

Example drawer:

```text
Wella
Wella Ultimate Repair Leave-In
[Leave-in]

Warum es passt
Du stylst regelmäßig mit Hitze und möchtest mehr Glanz, hast aber feines Haar, das schnell beschwert wirken kann. Diese Leave-in-Lotion passt als Booster nach dem Conditioner, weil sie Hitzeschutz mit ausgewogener Pflege verbindet, ohne in eine sehr reichhaltige Richtung zu gehen.

Anwendung
Sehr sparsam ins handtuchtrockene Haar geben und vor dem Föhnen oder Hitzestyling gleichmäßig in Längen und Spitzen verteilen. Bei feinem Haar lieber mit wenig Produkt starten und nur bei Bedarf nachlegen.

Produktprofil
Textur/Form    Lotion
Gefühl         Mittel
Wirkung        Ausgewogene Pflege
Hitzeschutz    Ja
Rolle          Booster nach dem Conditioner

18,51 €        Bei dm kaufen
Anzeige: Der Kauflink kann ein Affiliate-Link sein.
```

## Data Source Rules

Use existing structured product/recommendation fields. Do not add a new LLM hop for card or drawer copy.

Primary source fields for leave-ins:

- `recommendation_meta.product_format`
- `recommendation_meta.product_weight`
- `recommendation_meta.product_balance_direction`
- `recommendation_meta.product_care_benefits`
- `recommendation_meta.provides_heat_protection`
- `recommendation_meta.conditioner_relationship`
- `recommendation_meta.usage_hint`
- profile fields available in the message/product context, such as:
  - heat styling / styling tools
  - hair thickness
  - density if available
  - goals such as shine
  - current routine / conditioner relationship
- `recommendation_meta.top_reasons`, only after filtering generic/internal phrases

Fallback behavior:

- Omit missing compact card facts.
- Use category pill as a last-resort compact fact only if no better product fact exists.
- Omit negative booleans on compact cards.
- In the drawer, boolean facts may be explicit, e.g. `Hitzeschutz: Ja`.
- Never show raw `tags`.
- Never show `score`.
- Never show `matched_profile` or profile-match chips directly.
- Do not surface the profile-transfer inputs as separate UI rows; fold them into the `Warum es passt` paragraph.

## Target Files

Create:

- `src/components/chat/product-display-model.ts`
  - Shared helper for compact facts, drawer rows, price formatting, category labels, application sentence, shop labels, affiliate disclosure, and match summary.

Modify:

- `src/components/chat/product-card.tsx`
  - Remove top reason and price.
  - Render product fact pills.
  - Add clear tap affordance.

- `src/components/chat/product-detail-drawer.tsx`
  - Replace internal recommendation context with finalized Drawer D.

Inspect:

- `src/components/chat/product-popover.tsx`
  - Confirm hover/inline mention UI does not reintroduce old internal language.

Tests:

- `tests/product-display-model.test.ts`
- `tests/product-card-rendering.test.tsx`
- Existing `tests/chat-product-mentions.test.tsx`

## Implementation Tasks

### Task 1: Add Product Display Model

Create `src/components/chat/product-display-model.ts`.

Responsibilities:

- `buildCompactProductFacts(product)`
- `buildDrawerProductProfileRows(product)`
- `buildProductMatchSummary(product, hairProfile?)`
- `buildProductApplicationSentence(product, hairProfile?)`
- `formatProductPrice(price, currency)`
- `getProductCategoryLabel(category)`
- `getShopLabel(affiliateLink)`
- `shouldShowAffiliateDisclosure(product)`

Rules:

- Return only user-facing German labels.
- Use whitelisted structured fields.
- Filter generic/internal `top_reasons`.
- Keep missing data empty instead of inventing filler.
- Build `Warum es passt` with deterministic templates from available profile/product facts, not a new LLM call.

Leave-in compact fact priority:

1. Format: `Lotion`, `Spray`, `Creme`
2. Heat protection: `Hitzeschutz`
3. Care focus: `Pflege: ausgewogen`, `Pflege: Feuchtigkeit`, `Pflege: Protein`
4. Weight only if needed: `Leicht`, `Mittel`, `Reichhaltig`

Leave-in drawer row mapping:

- `product_format` -> `Textur/Form`
- `product_weight` -> `Gefühl`
- `product_balance_direction` or primary care benefit -> `Wirkung`
- `provides_heat_protection` -> `Hitzeschutz`
- `conditioner_relationship` or primary role -> `Rolle`

### Task 2: Test the Display Model

Create `tests/product-display-model.test.ts`.

Must verify:

- Compact facts for the Wella leave-in become:

```ts
[
  { label: "Lotion", source: "format" },
  { label: "Hitzeschutz", source: "heat_protection" },
  { label: "Pflege: ausgewogen", source: "care_focus" },
]
```

- Drawer rows become:

```ts
[
  { label: "Textur/Form", value: "Lotion" },
  { label: "Gefühl", value: "Mittel" },
  { label: "Wirkung", value: "Ausgewogene Pflege" },
  { label: "Hitzeschutz", value: "Ja" },
  { label: "Rolle", value: "Booster nach dem Conditioner" },
]
```

- `buildProductMatchSummary` returns one concise paragraph that integrates:
  - regular heat styling
  - fine hair / weight sensitivity
  - shine goal
  - lotion format
  - heat protection
  - booster role

- The match summary does not include separate labels such as `Dein Styling`, `Deine Haardicke`, `Dein Ziel`, or `Routine-Rolle`.
- Generic/internal match reasons are not reused.
- Price formats as `18,51 €`.
- Usage hint is returned as a full application sentence.
- Shop label is derived from affiliate host where possible.

Run:

```bash
npm run test:node -- tests/product-display-model.test.ts
```

### Task 3: Rework Compact Product Card

Modify `src/components/chat/product-card.tsx`.

Change:

- Remove `topReason`.
- Remove compact-card price.
- Import `buildCompactProductFacts`.
- Render fact pills under brand.
- Add visual tap affordance, e.g. chevron.

Expected compact card:

- Shows `Wella Ultimate Repair Leave-In`
- Shows `Wella`
- Shows `Lotion`, `Hitzeschutz`, `Pflege: ausgewogen`
- Does not show `18,51 €`
- Does not show a reason sentence
- Does not show `Zielprofil`
- Does not show internal tags

Add `tests/product-card-rendering.test.tsx` with `renderToStaticMarkup`.

Run:

```bash
npm run test:node -- tests/product-card-rendering.test.tsx
```

### Task 4: Rework Product Detail Drawer

Modify `src/components/chat/product-detail-drawer.tsx`.

Remove:

- Personalization box
- `Empfehlungskontext`
- `Score`
- `Warum passend` from raw `top_reasons`
- `Trade-offs`
- Internal category fields like `Shampoo-Bucket`
- `Profil-Match`
- `Geeignete Haardicke`
- `Hilft bei`
- Raw `Tags`
- Separate profile-transfer UI cards

Render:

- Header with brand, name, category pill
- `Warum es passt` paragraph from `buildProductMatchSummary`
- `Anwendung` sentence from `buildProductApplicationSentence`
- `Produktprofil` rows from `buildDrawerProductProfileRows`
- Price from `formatProductPrice`
- Shop-aware buy button if `affiliate_link` exists
- Affiliate disclosure if applicable

Order:

1. Header
2. `Warum es passt`
3. `Anwendung`
4. `Produktprofil`
5. Price / buy / disclosure

Note: `BottomSheetContent` mounts via client effects, so drawer rendering should be verified in browser rather than relying only on static markup.

### Task 5: Verify Product Payloads

Inspect:

- `src/app/api/chat/route.ts`
- `src/lib/recommendation-engine/selection.ts`

Confirm chat products sent to the UI preserve:

- `recommendation_meta.product_format`
- `recommendation_meta.product_weight`
- `recommendation_meta.product_balance_direction`
- `recommendation_meta.provides_heat_protection`
- `recommendation_meta.conditioner_relationship`
- `recommendation_meta.usage_hint`
- profile context needed for match-summary templates

If serialization drops these fields, add a focused regression assertion to the closest existing chat pipeline test.

### Task 6: Browser Verification

Use this prompt:

```text
Welches Leave-in passt, wenn ich mein feines Haar regelmäßig mit Hitze style und mehr Glanz möchte?
```

Compact card must:

- show product name and brand
- show fact pills
- not show price
- not show a reason sentence
- not show score, tags, profile match, or generic top reason

Drawer must:

- show one concise `Warum es passt` paragraph
- fold styling, hair thickness, goal, routine role, and product facts into that paragraph
- not show separate `Dein Styling` / `Deine Haardicke` / `Dein Ziel` / `Routine-Rolle` cards
- show `Anwendung` before `Produktprofil`
- show labeled product profile rows
- show price + shop-aware buy button + affiliate disclosure
- not show internal metadata

Check desktop and mobile widths.

### Task 7: Final Checks

Run:

```bash
npm run test:node -- tests/product-display-model.test.ts tests/product-card-rendering.test.tsx tests/chat-product-mentions.test.tsx
npm run typecheck
npm run lint
```

Because this touches chat UI, recommendation presentation, copy, and trust, run `ready-check` before shipping.

## Non-Goals

- No recommendation ranking changes.
- No new DB fields.
- No new LLM card/drawer copy generation step.
- No prompt rewrite.
- No admin product editor redesign.
- No catalog page redesign.

## Open Risks

- Some categories may have weaker structured fields than leave-ins. The helper should omit missing facts rather than inventing labels.
- Some usage strings are ASCII-transliterated in existing code. Keep project consistency unless a separate copy pass is requested.
- Product popovers may still contain older personalization language; inspect and treat as follow-up unless it visibly conflicts with the compact card/drawer end-state.
