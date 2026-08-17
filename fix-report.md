# Bondbuilder tie default + per-role Stage-1 cards

Branch `codex/bondbuilder-default-oil-cards`, cut from `main` at `de07607b`.
Two user-decided product changes, implemented test-first for the deterministic
parts.

---

## CHANGE 1 — Bondbuilder K18 tie default (authority rule)

### What changed

`src/lib/personal-plan/products/authority/categories/bondbuilder.ts`

- New exported constant `BONDBUILDER_TIE_DEFAULT_PRODUCT_ID =
  "38dace91-0fba-49ee-a93f-ac36e488fe4b"` (K18 Leave-In Molecular Repair Hair
  Mask), with a comment recording it as Nick's explicit product decision
  (2026-08-17) among equally-ideal candidates, and why (permanent 3-way
  production tie: Olaplex No.3, Epres, K18).
- New private `tieDefaultRecommendationForBondbuilder(product)`: the same
  recommendation shape as `recommendationForBondbuilder`, relabelled with
  - `authorityRuleId: "bondbuilder.stage3.tie_default"` (distinct, honest id)
  - `reason: "Unsere Standardwahl, wenn mehrere Produkte gleich gut passen."`
    (conservative German — a house default, not a superiority claim)
- Multi-ideal gap branch: if the ideal shortlist contains that exact product id,
  it becomes the recommendation; `allowedActions` gains `plan_recommendation`;
  `recommendationFactFingerprint` is K18's `factFingerprint`. The
  `bondbuilder.equal_shortlist` **caution criterion stays**, so "mehrere gleich
  passende Produkte" remains visible on the evaluation.
- Tie **without** K18 on the shortlist: unchanged — `recommendation: null`,
  `allowedActions: ["leave_uncovered"]`, fingerprint `null`.
- Single-ideal and zero-ideal branches: unchanged (single ideal keeps
  `bondbuilder.stage3.validated_standalone`, no `equal_shortlist` criterion).

### RED → GREEN evidence

New tests in `tests/personal-plan/products/stage3-authority.test.ts`:

| test | RED (before impl) | GREEN |
| --- | --- | --- |
| `a Bondbuilder tie defaults to K18 without claiming it is the better product` | ✖ fail | ✔ |
| `a Bondbuilder tie without the default product still leaves the need uncovered` | ✔ (pins old behaviour, must not regress) | ✔ |
| `a single ideal Bondbuilder candidate keeps the standalone rule, not the tie default` | ✔ (pins old behaviour) | ✔ |

RED run output (before the source change):

```
✖ a Bondbuilder tie defaults to K18 without claiming it is the better product
✔ a Bondbuilder tie without the default product still leaves the need uncovered
✔ a single ideal Bondbuilder candidate keeps the standalone rule, not the tie default
```

GREEN after the change: `stage3-authority.test.ts` → 67 pass / 0 fail.

### Updated existing coverage (not deleted)

`tests/personal-plan/product-previews.test.ts` — the Task-2-era test
`"falls back to post_refinement for a tied Bondbuilder recommendation instead of
the removed K18 hardcode"` was renamed to
`"a tied Bondbuilder shortlist previews the authority's tie default, not an
illustration"` and rewritten honestly:

- the historical note about the removed **presentation** hardcode
  (`STAGE1_BONDBUILDER_EXAMPLE_PRODUCT_ID`) is kept — that hardcode stays gone;
- the 3-way tie now asserts a real recommendation for K18 with K18's own image,
  name and fact fingerprint, verdict `ideal`;
- a **new** sub-assertion was added covering the tie *without* K18 on the
  shortlist → still the explicit `post_refinement` fallback;
- the existing "only one ideal candidate remains" assertion is unchanged.

Net: coverage grew (tie-with-default, tie-without-default, single-ideal) rather
than shrank.

### Joint invariant / accept chain

`tests/personal-plan-direct-accept-seen-state-join.test.ts` stays green. It is
structurally unaffected: it computes the preview payload with an **empty catalog
loader**, so the preview role-key set is decided by the snapshot alone, and the
bondbuilder change only decides whether an existing role key resolves to a
recommendation or a fallback — never which role keys exist. No cohort
divergence, so no BLOCKED condition. `personal-plan-direct-acceptance.test.ts`
and `personal-plan-stage1-2-3-integration.test.ts` also green.

### Ripple (intended)

Stage-1 previews now emit a bondbuilder recommendation for the production tie:
the fallback card disappears and direct acceptance is no longer blocked by the
bondbuilder role.

---

## CHANGE 2 — Multi-role products render as their own Stage-1 cards

### What changed

**`src/components/personal-plan-start/need-card.tsx`**

- `NeedCardViewModel` gains `category: Stage1Category`. `id` is now the unique
  *card* identity (`"oil"` for the category's leading card,
  `"oil:dry_finish"` for a further role); `category` drives the accent styling
  (`CATEGORY_CARD_STYLES[card.category]`), which used to key off `id`.
- Everything else about the card is untouched — same approved pattern (category
  overline + dot, product name title, type/price subline, purpose, pills,
  frequency, chevron → detail sheet).

**`src/components/personal-plan-start/snapshot-adapter.ts`**

- `applyStage1ProductExamplePreviews` now `flatMap`s: the lead-role preview
  still produces the category card (unchanged behaviour: recommendation /
  fallback / untouched), and **every further `kind: "recommendation"` preview of
  that category produces its own card directly after it**, in payload order
  (which is the plan's own `decision.roles` order).
- Extracted `withRecommendation(card, preview)` so the lead card and the
  secondary card build their product/image/detail blocks from one place.
- `secondaryRoleCard(card, preview)` overrides exactly what makes the role
  legible:
  - `id`: `` `${category}:${role}` ``
  - `targetType` (the type half of the type · price subline):
    `routinePurposeLabel(role)` — e.g. `dry_finish` → "Finish",
    `shampoo_dandruff` → "Schuppenpflege"
  - `purpose`: `routineRolePurposeDescription(role)` — e.g. `dry_finish` →
    "Schließt die Routine als Finish für die Längen ab."
  - `pills`: just this role's pill from the existing `ROLE_PILLS` map
  - `frequency`: `preview.reasoning.frequency`
- A secondary role whose preview is a **fallback** produces **no** extra card —
  there is no product to show, and the category card already carries the
  post-refinement state.
- The detail sheet needs no change: `ProductDetailSheet` already renders from
  the card it is given, so the secondary card's sheet opens with that role's
  product, price, image and reasoning blocks.

**`src/lib/personal-plan/routine/labels.ts`**

- The per-role purpose sentences (`purposeDescriptions`) moved here from
  `src/components/routine/personal-plan/routine-item-card.tsx` and are exposed as
  `routineRolePurposeDescription(role): string | null`. `labels.ts` is the
  repo's existing shared, non-client German label module for exactly this
  vocabulary; moving the map avoids duplicating 18 approved German strings into
  the Stage-1 adapter.

**`src/components/routine/personal-plan/routine-item-card.tsx`**

- Imports `routineRolePurposeDescription` instead of holding the local map. Its
  own `routinePurposeDescription(item)` wrapper (with the category fallback
  sentence) is unchanged, so Routine rendering is byte-identical.

**`src/components/personal-plan-journey/plan-fork-screen.tsx`**

- Removed `PLAN_FORK_ADDITIONAL_TITLE` ("Außerdem in deinem Plan"), the
  `additionalItems` field on `PlanForkPreviewState`, its derivation in
  `derivePlanForkPreviewState`, and the rendered `<section>`. With per-role
  cards nothing reaches direct acceptance undisclosed.
- `seenRoles` is untouched and **stays per-role and complete** — it is derived
  from `response.previews`, independent of the removed block. A comment now
  records that the accept contract compares this set to the server's Stage-3
  evaluations and rejects any difference.
- `stage1LeadRolePreviewByCategory` is no longer imported by the fork screen
  (only the adapter uses it now); the remaining import became type-only.

### Frequency line choice (asked for explicitly)

**Chosen: `preview.reasoning.frequency` from the payload.**

The brief assumed the payload's `reasoning` carries role-specific texts. It does
not: `product-previews.ts` builds `reasoning` from
`presentationFor(decision)` + `frequencyLabel(decision.frequency, …)`, both of
which are **category-level** — every role of a category gets the identical three
strings. So for the frequency line the payload value *is* the category
frequency; there is no role-specific cadence copy anywhere today
(`frequencyLabel` even collapses the role-keyed `role_keyed_product_protocol`
kind to a single "nach Herstellerangabe" for all roles). Using
`preview.reasoning.frequency` keeps the card and its detail sheet's "Empfohlener
Rhythmus" block reading from one value, and it is the right seam if a
role-specific frequency is ever added to the payload.

For the same reason the **role legibility** could not come from `reasoning`
either — it comes from the shared Routine role vocabulary (`labels.ts`), which
is the only existing per-role German copy in the repo. That is stated here
rather than silently substituted.

### RED → GREEN evidence

RED run (tests written before the implementation), 4 failures:

```
✖ the fork no longer re-lists secondary-role products as a bare delta block
✖ the primary role leads the category card and the other role follows as its own card
✖ a secondary role becomes its own card right after its category's primary card
✖ the secondary-role card renders the role in its subline and keeps the category styling
ℹ pass 60  ℹ fail 4
```

GREEN after the implementation: `personal-plan-start-ui.test.tsx` +
`personal-plan-fork-screen.test.tsx` → 64 pass / 0 fail.

Tests added / updated:

- `tests/personal-plan-start-ui.test.tsx`
  - **new** `a secondary role becomes its own card right after its category's
    primary card` — order `["oil", "oil:dry_finish"]`, role-specific
    `targetType` / `purpose` / pill / frequency, per-role product, image, alt
    and detail blocks, inherited category identity + tone.
  - **new** `a secondary role without a product adds no card at all`.
  - **new** `the lead card is never duplicated as a secondary card` (the lead
    may itself be a secondary role when the primary role fell back).
  - **new** `the secondary-role card renders the role in its subline and keeps
    the category styling` — renders `Finish · 24,90 €`, the Oil dot colour, and
    `data-plan-start-card="oil:dry_finish"`.
  - **updated** `the primary role wins when several roles deliver a
    recommendation` → `the primary role leads the category card and the other
    role follows as its own card` (kept the original assertion, added the
    secondary card and the full card order).
  - fixtures updated for the new required `category` field, including the
    "malformed legacy category IDs" neutral-styling test, which now exercises
    the fallback through `category`.
- `tests/personal-plan-fork-screen.test.tsx`
  - **removed** `only roles the Stage-1 cards never showed become the disclosure
    list` (asserted the removed derivation).
  - **updated** `a single-role plan discloses nothing extra` → `a single-role
    plan has nothing left to disclose` (now asserts both blocking notices are
    null).
  - **updated** `secondary-role products the cards never showed are disclosed
    before accepting` → `the fork no longer re-lists secondary-role products as
    a bare delta block` (asserts the block and both product names are absent).
  - **unchanged and green**: `the accept payload echoes every recommendation
    role with its exact pinned fields` — the wire-payload test that proves the
    `seenRoles` echo stayed per-role and complete across the removal.

---

## Verification

| check | result |
| --- | --- |
| `tests/personal-plan/products/stage3-authority.test.ts` | 67 pass / 0 fail |
| `tests/personal-plan/product-previews.test.ts` | 17 pass / 0 fail |
| `tests/personal-plan-start-ui.test.tsx` + `tests/personal-plan-fork-screen.test.tsx` | 64 pass / 0 fail |
| `npm run test:personal-plan` (flat glob) | **1808 pass / 0 fail** |
| `node scripts/ci/run-personal-plan-nested.mjs` | **538 pass / 0 fail** |
| `npm run test:node` | 4121 pass / 1 fail — pre-existing, unrelated (see below) |
| `npm run ci:verify` (typecheck + lint + build) | pass |

Logs: `personal-plan-flat.log`, `personal-plan-nested.log`, `test-node.log`,
`build2.log`, `ci-verify.log` in the session scratchpad (kept out of the repo).

### Two environment notes (neither caused by this branch)

1. `tests/billing-plan-change-route.test.ts` →
   `billing plan-change route behavior under React Server conditions` fails
   locally. It spawns a child `node --test` run and asserts the reporter line
   `# tests 6`; this Node version prints `ℹ tests 6`. **Verified pre-existing**:
   the same test fails identically in the clean root checkout on `main`.
   Untouched by this branch.
2. The first `ci:verify` run died in `next build` with a Turbopack panic
   (`x Unexpected character '\0'`, NUL bytes inside a generated chunk). It was a
   corrupt incremental `.next` cache: after moving `.next` aside, `npm run build`
   and the full `ci:verify` pass. The corrupt cache was preserved at
   `scratchpad/next-cache-corrupt` rather than deleted, in case it is worth a
   Turbopack bug report.

---

## Concerns / follow-ups

1. **`countLabel` under-counts now.** A screen's count line still says
   "N Kategorien" / "N Vorschläge" from the snapshot's category count, computed
   before the per-role expansion. For Basis ("Kategorien") that stays literally
   true; for the Optional screen ("N Vorschläge") a category with two roles now
   renders two cards under a label that counts one. Left alone deliberately
   (out of the two decided changes) — worth a copy decision from Nick.
2. **Secondary-card copy comes from the Routine vocabulary.** It is approved,
   in-product German, but it was written for the Routine list, not the Stage-1
   card. Two lines read slightly generic in this context —
   `shampoo_dandruff` → "Hilft, deine Kopfhautpflege gezielter einzuplanen." and
   `scalp_flake_oil_adjunct` → "Ergänzt die Kopfhautpflege punktuell." If Nick
   wants Stage-1-specific role copy, `routineRolePurposeDescription` is the one
   place to fork.
3. **Primary vs. secondary card voice.** The leading card still shows the
   category-level `targetType`/`purpose`; only further roles show role-level
   copy. That was the smaller, lower-risk diff and matches the brief, but it
   means an Oil pair reads "Reichhaltige Vorwäsche" (category) then "Finish"
   (role). Making the lead card role-aware too would need a role-level
   presentation layer in `decision-presentation.ts`.
4. **Tie default is a catalog-coupled id.** `BONDBUILDER_TIE_DEFAULT_PRODUCT_ID`
   points at a specific production row. If K18 is delisted or its id changes,
   the tie silently reverts to the honest no-recommendation path (no crash, no
   wrong product) — but nobody is alerted. A catalog audit assertion could pin
   it if that matters.
