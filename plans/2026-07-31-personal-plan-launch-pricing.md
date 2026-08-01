# Membership launch pricing across all purchase surfaces

**Status:** Approved for implementation on 2026-08-01
**Worktree:** `.worktrees/launch-price-test`
**Branch:** `codex/launch-price-test`
**Original implementation base:** `origin/main` at `2adfc05e`
**Refresh required before implementation:** current branch is seven commits behind `origin/main`

## Outcome and source context

Temporarily offer one consistent recurring membership catalog everywhere a
customer can start a membership:

| Interval  | Standard price | Launch price | Effective monthly price |
| --------- | -------------: | -----------: | ----------------------: |
| Monthly   |         €14.99 |        €9.99 |                   €9.99 |
| Quarterly |         €34.99 |       €19.99 |                  ~€6.66 |
| Yearly    |         €99.99 |       €69.99 |                  ~€5.83 |

The original approved scope applied the launch catalog only to the membership
arm after the new `personal_plan` quiz. Nick corrected that scope on 2026-08-01:
while the launch catalog is active, a customer must not be able to reach the
standard catalog by entering through the older quiz, a guided-story offer, or a
different membership purchase page.

The provider resources already exist under the current subscription Products,
and their six IDs are configured in Vercel Production. The public activation
flag remains absent/off. No existing subscription has been moved, and no public
launch-price checkout has been activated.

## Chosen direction

Use one server-owned launch catalog for every **new recurring subscription
creation**, regardless of which UI route initiated it:

- Personal Plan result membership arm;
- legacy quiz result, including default, guided-story, and app-value-stack
  offer variants;
- authenticated membership reactivation while the launch flag is active;
- any future direct membership-purchase surface that uses the shared checkout
  contract.

Keep these separate rules:

1. The €29.99 Personal Plan one-time offer never selects a membership catalog.
2. An active subscriber is never migrated. Plan changes remain inside the
   provider Price/Plan family of the subscriber's current resource.
3. A standard subscriber sees standard same-family plan-change prices; a launch
   subscriber sees launch same-family plan-change prices.
4. A canceled or expired customer who starts a new subscription through
   reactivation receives the currently active acquisition catalog, so the
   reactivation page cannot contradict the public offers. This deliberately
   means a customer whose prior paid period has fully ended can return at the
   launch price while acquisition is still open; they cannot do so while an
   active paid period remains.
5. The browser may display the server-resolved catalog but may not choose or
   authorize it. Every recurring subscription-creation surface uses the same
   one-input server rule: strict flag on means launch; otherwise standard. The
   separate one-time route never invokes this subscription resolver.
6. A prepared Stripe checkout may complete on its stored, validated catalog
   after the flag is disabled; newly prepared checkouts fall back to standard.
   The same rule applies to an already-reserved reactivation checkout: resume
   uses its stored provider Session/intent rather than silently changing the
   displayed amount.

This is a temporary uniform price rollout measured pre/post, not a concurrent
price-control experiment. A percentage holdout would recreate the exact
cross-page price inconsistency Nick wants to remove. The independent Personal
Plan one-time-versus-membership experiment remains running; its two arms must be
analyzed separately because the launch changes only the membership comparator.
Launch acquisition is time-boxed by the server flag, but a subscriber acquired
at launch keeps that provider Price/Plan until cancellation.

On legacy/guided-story offers, the launch comparison anchors are deliberately
the actual standard catalog (€14.99/€34.99/€99.99), replacing the older
€19.99/€44.49/€149.99 reference framing. This narrows the direct yearly
comparison discount but is more truthful to the requested “drop the current
prices” proposition and the recent price history. Cadence savings remain 33%
quarterly and 42% yearly relative to the €9.99 monthly launch plan.

Continue using the already-created provider catalog and technical identity
`personal_plan_launch_v1` for this release. That identifier is an immutable
version label for the validated provider resources, not an eligibility rule.
Eligibility becomes membership-purchase based rather than quiz-kind based. This
avoids replacing the live Stripe Prices/PayPal Plans solely because the launch
scope widened before activation.

## Scope and non-goals

### In scope

- launch-price display and real recurring charges on every membership purchase
  selector while the strict launch flag is enabled;
- Personal Plan membership, legacy result, guided-story, app-value-stack, and
  reactivation paths;
- the same `Launch-Rabatt sichern` treatment, crossed-out standard amounts,
  retention sentence, monthly equivalents, cadence savings, CTA amount, and
  checkout amount on all of those surfaces;
- Stripe and PayPal server routes resolving the same catalog without trusting
  lead quiz kind or browser-supplied catalog values as eligibility authority;
- same-family plan-change display and execution for standard and launch
  subscribers;
- amount-neutral AGB copy that does not advertise stale prices or falsely say a
  persistent launch price changes only the first billing amount;
- actual-amount analytics with `pricing_catalog=personal_plan_launch_v1` and
  offer/funnel dimensions retained separately;
- dark rollout, kill switch, provider validation, and existing-subscriber
  compatibility.

### Unchanged

- every current Stripe and PayPal subscription, amount, renewal, and provider
  resource assignment;
- the €29.99 one-time Personal Plan offer and its commerce semantics;
- entitlement, refund, cancellation, tax, webhook, and guarantee semantics;
- plan order and quarterly default selection;
- landing and quiz pages that do not display a membership price;
- standard provider IDs, which remain configured and usable after launch
  deactivation.

### Non-goals

- no percent-based coupon or redeemable promotion-code system;
- no new Stripe Product or PayPal Product;
- no replacement provider resources solely to rename the catalog;
- no migration of existing subscribers between provider Price/Plan families;
- no countdown, individualized expiry, browser-owned eligibility, or database
  migration unless implementation proves current provider-ID recognition is
  insufficient.

## Target map

### Catalog eligibility and provider authority

- `src/lib/billing/pricing-catalog.ts`
  - reduce acquisition resolution to the strict launch-flag boolean;
  - remove `quizKind`, `offerVariant`, and reactivation exclusions from this
    recurring-subscription resolver;
  - keep one-time purchases outside it entirely via their separate route and
    component contract.
- `src/lib/funnel/flags.ts`
  - retain exact-`true`, default-off parsing for
    `PERSONAL_PLAN_LAUNCH_PRICING_ENABLED` in this release.
- `src/app/api/stripe/create-checkout-session/route.ts`
  - use trusted request kind, checkout context, stored one-time authorization,
    and server flag to resolve new-subscription catalog;
  - do not require `quiz_kind="personal_plan"` for launch membership pricing;
  - preserve trusted prepared-session Price/catalog validation after flag-off.
- `src/app/api/paypal/create-subscription-intent/route.ts`
  - apply the same new-subscription resolver for legacy leads, Personal Plan
    leads, and reactivation;
  - keep the browser unable to supply a catalog.
  - on intent resume, return and validate
    `existingIntent.metadata.paypal_plan_id` rather than re-resolving a Plan from
    today's flag; fail closed if the stored Plan is unconfigured or its catalog/
    interval disagrees.

### Public and authenticated UI surfaces

- `src/app/result/[leadId]/page.tsx` and
  `src/app/result/[leadId]/result-client.tsx`
  - resolve the launch catalog for both `legacy` and `personal_plan` membership
    results;
  - pass it into the legacy/default/guided-story pricing slot as well as the
    Personal Plan membership offer;
  - add `pricingCatalog` explicitly to `LegacyResultPageClient` and pass catalog
    plus the matching reference-price treatment together into its shared
    `ResultOfferPricing` slot;
  - keep the Personal Plan one-time arm unchanged.
- `src/components/quiz/result-offer-pricing.tsx`
  - use the resolved catalog consistently for rendered plans, CTA, prewarm,
    Stripe, PayPal, and analytics across all membership offer variants.
- `src/components/checkout/subscription-plan-selector.tsx` and
  `src/components/checkout/plan-reference-prices.ts`, plus
  `src/lib/stripe/pricing-plans.ts`
  - reuse one launch presentation on every purchase selector: standard prices
    crossed out, launch prices charged, truthful equivalents/savings, and
    retention copy;
  - do not reintroduce the older inflated comparison prices while launch pricing
    is active.
  - derive launch comparison prices from the standard catalog instead of
    repeating the same three numeric literals;
  - decouple launch banner/retention treatment from the mere presence of
    `referencePrices` so each surface has an explicit flag-on and flag-off
    presentation.
  - delete the duplicated launch reference-price literals and derive anchors
    from the standard catalog;
  - remove silent `"standard"` defaults from catalog-aware purchase helpers and
    selector boundaries; every production caller must pass `standard` or
    `personal_plan_launch_v1` explicitly.
- `src/app/reactivate/page.tsx`,
  `src/components/reactivation/membership-reactivation-page.tsx`,
  `src/components/reactivation/membership-reactivation-checkout.tsx`, and
  `src/components/labs/profile-reactivation-lab.tsx`
  - resolve the active acquisition catalog on the force-dynamic server page and
    thread it through the real page and lab fixture;
  - flag on: launch banner, crossed-out standard prices, launch amounts, and
    retention sentence;
  - flag off: standard prices with no launch banner, no crossed-out inflated
    references, and no launch retention sentence.
- `src/app/api/billing/membership/route.ts`,
  `src/lib/billing/plan-change.ts`, `src/lib/billing/types.ts`,
  `src/lib/billing/subscriptions.ts`, the Stripe/PayPal activation and webhook
  writers, and
  `src/components/profile/profile-plan-switcher.tsx`
  - persist `pricing_catalog` into the existing
    `billing_subscriptions.metadata` JSON at activation/webhook reconciliation,
    with no migration;
  - before activation, run an approval-gated one-time backfill that marks every
    pre-launch row with missing catalog metadata as `standard`; launch resources
    have never been active, so this does not infer a launch subscriber;
  - derive and self-heal the catalog on every Stripe/PayPal subscription-created
    or subscription-updated write from the live provider Price/Plan ID;
  - if catalog metadata is still missing/unknown after the backfill, return a
    reconciliation state rather than silently rendering standard prices;
  - expose the resolved family only on the `manageable` state that renders plan
    alternatives, and render the subscriber's current provider family;
  - render interval alternatives from that same family and submit only the
    interval, leaving the provider service to enforce same-family changes.
- `src/app/agb/page.tsx`
  - remove hard-coded recurring amounts and the false first-billing-only launch
    statement;
  - state that the recurring amount, cadence, tax-inclusive total, and any
    persistent launch condition shown before purchase are authoritative;
  - require legal/compliance review before activation.

### Preview, analytics, and operations

- `src/app/labs/offer-page/page.tsx`
  - let Personal Plan and legacy/guided-story preview variants render the same
    selected catalog for mockup and browser verification;
  - remain unavailable in Vercel Production.
- `src/components/quiz/quiz-result-offer-page.tsx`
  - make its lab/default `ResultOfferPricing` and `StaticPricingPreview`
    catalog-explicit rather than importing the standard plan array implicitly.
- analytics event types, PostHog destination, and offer dashboards
  - report actual amount plus catalog, while preserving `quiz_kind`,
    `offer_variant`, and funnel package so entry paths remain comparable.
  - keep interval-to-analytics-plan identity direct because standard and launch
    catalogs intentionally share analytics plan IDs; catalog remains a separate
    dimension.
- Stripe/PayPal plan mapping, validation, webhook, and plan-change modules
  - continue recognizing both families and validating exact amount/cadence;
  - keep same-family plan changes and current subscriber resources intact.
- `docs/personal-plan-launch-pricing-provider-setup.md`
  - revise the activation matrix to cover all new subscription entry points and
    reactivation;
  - record that no additional provider resources are required.

## Designed user journey

1. A customer enters through `/lp/haarplan`, the legacy `/quiz`, a saved result,
   a result email, or an authenticated reactivation link.
2. Pages without a membership selector show no price and remain unchanged.
3. When the customer reaches any membership purchase selector while the launch
   flag is enabled, they see the same three choices:
   - monthly: `€14,99` crossed out, `€9,99` charged;
   - quarterly: `€34,99` crossed out, `€19,99` charged and selected by default;
   - yearly: `€99,99` crossed out, `€69,99` charged;
   - `Launch-Rabatt sichern` and
     `Dein Launch-Preis bleibt bis zur Kündigung erhalten.`
4. If the Personal Plan experiment assigned the €29.99 one-time arm, the user
   sees only that one-time offer; no launch membership copy appears.
5. Selecting an interval updates the CTA and payment overlay to the exact same
   amount on every offer family.
6. Stripe and PayPal independently resolve the active catalog on the server and
   return the matching configured Price/Plan. A forged browser catalog or an
   unknown/mismatched provider resource fails closed.
7. If preparation fails, existing retry/fallback behavior remains and no
   entitlement or silently substituted amount is granted.
8. After successful payment, renewals remain on that Price/Plan until
   cancellation. A later interval change shows and uses the subscriber's same
   standard or launch family.
9. While the flag is enabled, a canceled/expired customer who reactivates starts
   a new launch-price subscription; after flag disablement, newly opened result
   and reactivation checkouts return to standard pricing.
10. Existing active subscribers never enter acquisition pricing resolution and
    receive no amount or provider-resource change.

## Mockup evidence

- Original Personal Plan launch-price mockup:
  `plans/mockups/2026-07-31-personal-plan-launch-pricing.html`.
- Revised artifact shows the same selector in the Personal Plan result,
  legacy/guided-story result, and reactivation contexts, plus the AGB copy
  correction.
- Current-surface evidence is source-backed from the shared
  `ResultOfferPricing`/`SubscriptionPlanSelector` hierarchy. A fresh in-app
  browser capture was attempted on 2026-08-01 but blocked by the browser's
  local-URL policy; no alternate browser workaround was used.
- Revised mockup review status: **confirmed by Nick on 2026-08-01**.
- Revised designed-journey sign-off: **confirmed by Nick on 2026-08-01**.

## Ordered tasks

### 0. Checkpoint the approved current task and refresh before more edits

- After Nick confirms the revised mockup/journey and authorizes the local task
  checkpoint, commit only the current launch-pricing worktree changes.
- Fetch current `origin/main`, integrate it into this task branch, and resolve
  the known overlaps in offer pricing, flags, labs, Personal Plan offer, and
  tests before adding the expanded-scope edits.
- Run `npm run test:contracts` plus the focused launch-pricing tests after
  reconciliation so upstream checkout/prewarm changes are covered.

Completion criterion: the worktree is based on current `origin/main`, the
current implementation is preserved in Git history, and focused tests pass
before Task 1 begins.

### 1. Lock the global subscription-creation catalog contract with tests

- Change the existing scope tests so flag-enabled legacy and Personal Plan
  membership results both resolve launch pricing.
- Add reactivation launch/flag-off standard cases.
- Prove one-time, active same-family plan management, flag-off, malformed lead,
  and browser-supplied catalog cases cannot select an unauthorized resource.
- Add route tests for both providers across legacy, Personal Plan membership,
  one-time, reactivation, and no-lead/direct contexts.
- Update the currently contradictory expectations in
  `tests/subscription-plan-selector.test.tsx` and
  `tests/funnel-variants.test.ts` for launch-enabled reactivation and the
  catalog-aware shared legacy pricing slot.
- Add a source/contract guard that production purchase components cannot import
  `STRIPE_PRICING_PLANS` directly or omit an explicit catalog at a catalog-aware
  boundary.

Completion criterion: failing tests describe every catalog boundary before
runtime changes.

### 2. Make every membership purchase selector visually consistent

- Pass one resolved catalog through the Personal Plan offer, the single legacy
  `pricingSlot` shared by default/guided-story/app-value-stack variants, and the
  reactivation chain. The individual offer-variant files do not need edits.
- Thread both catalog and its matching reference-price treatment through
  `LegacyResultPageClient`; make inconsistent combinations unrepresentable at
  the shared selector boundary.
- Keep shared plan ordering, quarterly default, banner, retention copy, CTA,
  guarantee, and payment overlay amounts identical.
- Add lab fixtures for each customer-visible context.

Completion criterion: render tests and reviewed fixtures show €9.99/€19.99/
€69.99 everywhere the flag-enabled customer can start a membership, with no
standard-price purchase selector left reachable.

### 3. Route Stripe and PayPal through one trusted acquisition catalog

- Remove quiz-kind gating from recurring subscription creation while preserving
  Personal Plan one-time authorization.
- Resolve catalog before provider Price/Plan selection for result and
  reactivation checkouts.
- Persist catalog/provider identity in Stripe Session and PayPal intent
  metadata; validate prepared claims from trusted stored Price identity.
- Resume Stripe and PayPal offer/reactivation checkouts from their stored,
  configured Price/Plan identity after flag-off; add explicit rejection tests
  for stored interval/catalog/provider mismatches.

Completion criterion: provider-contract tests prove both providers charge the
rendered catalog and reject mismatches or browser-forged catalog requests.

### 4. Preserve truthful same-family subscriber management

- Infer standard versus launch family from the current provider resource for
  every provider subscription create/update event; self-heal that family in the
  existing subscription metadata for later UI reads.
- Backfill all pre-activation missing catalog metadata to `standard` behind an
  explicit production-write checkpoint, then make missing/unknown metadata a
  reconciliation state rather than a display default.
- Render the profile interval alternatives from that family.
- Keep provider plan-change services authoritative and reject unknown or
  cross-family resources.
- Do not mutate any existing subscription during deploy or activation.

Completion criterion: tests cover standard subscriber, launch subscriber,
unknown provider ID, all cross-interval changes, and display/execution agreement
for Stripe and PayPal.

### 5. Correct public legal copy and analytics

- Replace hard-coded AGB amounts with amount-neutral, checkout-authoritative
  language that accurately covers a launch price retained until cancellation.
- Preserve interval, renewal, cancellation, tax, and one-time distinctions.
- Record actual values and catalog across both result families and reactivation,
  without losing funnel/offer segmentation.
- Rename `tests/stripe-purchase-analytics.spec.ts` to the repository's
  `*.test.ts` convention or add it explicitly to a CI-run script so the modified
  analytics coverage cannot remain a false green.

Completion criterion: copy review finds no stale amount or first-cycle-only
claim, and analytics tests distinguish catalog from entry route and offer arm.

### 6. Validate resources and dark rollout

- Reuse the existing three Stripe Prices and three PayPal Plans under the
  current Products; do not create replacements.
- Run read-only validators for active state, EUR, cadence, exact amount, Product
  ownership, Stripe inclusive tax, infinite PayPal cycles, zero setup fee, and
  no PayPal plan tax.
- Follow the existing provider setup runbook for the six Vercel Production
  variables, validators, and dark deployment; update only its activation/
  rollback surface matrix for the expanded scope.
- Add a dry-run/read-only inventory mode for the subscription-metadata backfill;
  its production apply step requires explicit approval and runs before public
  flag activation.

Completion criterion: provider validators pass and the inventory proves both
catalogs remain configured before activation.

### 7. Verify and review the whole refreshed branch

- Run focused catalog/route/render/plan-change tests, full node tests,
  formatting, browser QA, and the canonical `npm run ci:verify` command.
- Run the Codex `ready-check` workflow skill and `request-code-review` workflow
  skill; these are review procedures, not package scripts.
- Keep commit, push, PR, merge, deployment, and public flag activation behind
  their explicit workflow gates.

Completion criterion: the reviewed branch head has no unresolved P0/P1 finding,
all public/authenticated purchase surfaces agree, and the release runbook is
executable against validated live provider resources.

## Verification

### Automated

- catalog resolver tests for legacy, Personal Plan membership, one-time,
  reactivation, flag-off, active plan management, and invalid contexts;
- Personal Plan, legacy/default, guided-story, app-value-stack, reactivation,
  and profile selector render tests;
- exact catalog amount, label, equivalent, savings, CTA, and comparison-price
  tests;
- Stripe create/prepare/claim and PayPal intent tests for every entry context;
- Stripe/PayPal same-family plan-change and webhook recognition tests;
- analytics destination/dashboard tests for actual value, catalog, offer, and
  funnel identity;
- AGB source test preventing hard-coded standard or launch recurring amounts;
- AGB source test also preventing stale per-month equivalents such as €11.66 or
  €8.33 and the first-billing-only promotion statement;
- explicit cadence-savings assertions for 33% quarterly and 42% yearly;
- `npm run test:node`, `npm run typecheck`, targeted ESLint/Prettier,
  `git diff --check`, and `npm run build`/repository CI verification.

### Manual/browser

- Personal Plan membership result, legacy default result, every guided-story
  offer variant, app-value-stack, and reactivation at desktop and 390 px;
- select all three plans on each distinct selector and verify card, CTA, overlay,
  Stripe, and PayPal amounts;
- verify Personal Plan one-time remains €29.99 without launch membership copy;
- verify standard and launch active subscribers see their own same-family
  profile plan-change amounts;
- disable the launch flag in a controlled environment and confirm every new
  selector falls back to standard while a valid in-flight checkout completes.

### Provider/live-state

- read-only validators pass for all six launch resources;
- current standard Stripe Prices and PayPal Plans retain their shapes;
- existing subscription IDs, provider resource IDs, and family mapping remain
  unchanged through dark deploy and activation;
- no public launch-price checkout before code is dark-deployed and provider
  inventory is valid;
- any deliberate live purchase requires action-time confirmation of provider,
  amount, payment method, and refund/reconciliation plan.

### Evidence-sensitive review

- Official source check: § 3 PAngV requires the total price when a business
  offers or advertises goods or services to consumers with a price, and Art.
  246a § 1 EGBGB specifically requires the total cost per billing period for an
  open-ended or subscription contract. The implementation must therefore keep
  exact tax-inclusive amount and cadence visible before purchase even though
  the AGB themselves become amount-neutral:
  - `https://www.gesetze-im-internet.de/pangv_2022/__3.html`;
  - `https://www.gesetze-im-internet.de/bgbeg/art_246a__1.html`.
- § 11 PAngV's express 30-day comparison-price rule is written for goods; this
  plan does not assume that wording resolves the service-membership comparison
  price question: `https://www.gesetze-im-internet.de/pangv_2022/__11.html`.
- obtain legal/compliance confirmation for crossed-out standard prices,
  `Launch-Rabatt`, persistent renewal wording, AGB wording, and any communicated
  end date before activation;
- confirm recent promotional price history before representing €14.99/€34.99/
  €99.99 as comparison prices.

## Review and handoff

- Original counterpart review: completed with revisions using Claude Opus 4.8.
- Revised-scope counterpart review: **completed with two revision passes** using
  Claude Opus 4.8; material findings C9-C23 were reconciled below.
- Revised findings ledger:

  | ID  | Type                   | Evidence                                                                                                                     | Decision                                                     | Plan change                                                                                          | Revalidation                             |
  | --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
  | R1  | scope/product decision | Legacy/default/guided-story membership results currently default to the standard catalog                                     | accepted from Nick's corrected intent                        | make all subscription creation entry paths catalog-consistent                                        | route and render matrix                  |
  | R2  | defect                 | `/agb` hard-codes standard amounts and says a promotion may reduce only the first billing amount                             | accepted                                                     | use amount-neutral persistent-price wording                                                          | legal/source review                      |
  | R3  | tradeoff               | Reactivation would remain a visible standard-price escape hatch if excluded                                                  | accepted by Nick on 2026-08-01                               | make reactivation use active acquisition catalog                                                     | reactivation UI/provider tests           |
  | R4  | defect                 | Profile plan management renders only standard amounts even though backend plan changes preserve a launch subscriber's family | accepted                                                     | infer and render current family                                                                      | profile/provider tests                   |
  | R5  | tradeoff               | `personal_plan_launch_v1` is narrower in name than the corrected eligibility scope                                           | accepted for this validated resource version                 | treat it as technical version identity, not eligibility authority                                    | analytics dimension checks               |
  | C9  | defect                 | Profile display has no current provider family in its management-state data                                                  | accepted                                                     | persist catalog in existing subscription metadata and expose it through membership state             | activation/webhook/profile tests         |
  | C10 | defect                 | Reactivation passes neither launch comparison prices nor an explicit banner treatment                                        | accepted                                                     | define flag-on and flag-off reactivation UI and decouple banner from references                      | reactivation render tests                |
  | C11 | defect                 | Refreshing after six more tasks would compound overlaps on an uncommitted branch                                             | accepted                                                     | add approved checkpoint and current-main integration as Task 0                                       | focused tests after merge                |
  | C12 | tradeoff               | Uniform launch pricing has no concurrent control                                                                             | accepted from consistency requirement                        | define as a time-boxed pre/post price rollout, not an A/B price test                                 | catalog-segmented pre/post reporting     |
  | C13 | tradeoff               | Launch membership changes the comparator in the one-time experiment                                                          | accepted from earlier approved experiment scope              | keep experiment running and analyze arms separately, not as a clean price comparison                 | offer-variant plus catalog reporting     |
  | C14 | tradeoff               | Reactivation inclusion permits fully canceled customers to return at launch price while active                               | accepted by Nick on 2026-08-01                               | state the leakage explicitly; current paid access remains a duplicate-checkout blocker               | reactivation and access-guard tests      |
  | C15 | tradeoff               | Persistent launch wording creates a lifetime obligation for acquired subscriptions                                           | accepted from approved subscriber-safety intent              | time-box acquisition via flag, retain Price/Plan until cancellation                                  | runbook retention and provider inventory |
  | C16 | reviewer mismatch      | Reviewer reported `ready-check` missing because it is not an npm/Claude skill                                                | rejected                                                     | clarify it is the available Codex workflow skill; use `npm run ci:verify` for executable checks      | implementation-loop receipt              |
  | C17 | reviewer mismatch      | Reviewer proposed retrying the blocked browser URL through `localhost`                                                       | rejected by browser policy                                   | do not circumvent the explicit local-URL policy; provide the served review artifact to Nick directly | Nick mockup review                       |
  | C18 | defect                 | Resumed PayPal reactivation returns a Plan re-resolved from today's flag instead of the intent's stored Plan                 | accepted                                                     | validate and return stored `paypal_plan_id` on resume                                                | flag-flip PayPal resume tests            |
  | C19 | defect                 | Existing green selector and funnel-variant tests contradict the expanded UI scope                                            | accepted                                                     | name and update both tests in Task 1                                                                 | focused render/contract run              |
  | C20 | defect                 | Catalog defaults silently mask a missed legacy/reactivation caller                                                           | accepted                                                     | remove defaults at purchase boundaries and add source guards                                         | typecheck plus source contract           |
  | C21 | tradeoff               | Legacy standard comparison anchors reduce the direct yearly discount framing versus the old inflated references              | accepted from requested current-price drop and evidence gate | use actual standard catalog anchors                                                                  | copy/legal review                        |
  | C22 | defect                 | One-time activation metadata write can leave profile display wrong after a missed write                                      | accepted                                                     | derive/self-heal on every provider create/update and block unknown display state                     | webhook and membership-state tests       |
  | C23 | defect                 | Modified Stripe analytics spec is outside current CI globs                                                                   | accepted                                                     | rename or explicitly include it in CI                                                                | CI command proves execution              |
  | C24 | reviewer mismatch      | Reviewer again proposed a Claude-specific rescue invocation                                                                  | rejected                                                     | repository AGENTS routes Codex through `request-code-review` and one Claude counterpart lane         | implementation-loop receipt              |

- Revised mockup review: **confirmed by Nick on 2026-08-01**.
- Revised designed-journey sign-off: **confirmed by Nick on 2026-08-01**.
- Implementation-loop handoff: **authorized by Nick on 2026-08-01**, including
  a local checkpoint of the approved task state before refreshing from main.
- Artifact disposition:
  - this plan: **commit**;
  - revised HTML mockup: **commit**;
  - browser screenshots: **none created; local URL inspection was blocked**;
  - counterpart report: **temporary outside the repository unless a finding
    requires retention**.
