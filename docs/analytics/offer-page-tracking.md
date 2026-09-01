# Offer page tracking

## Purpose

This specification measures the product-led quiz offer from arrival through purchase. The authoritative business outcome is a completed paid purchase. Section views, clicks, selections, and checkout failures are diagnostic signals used to explain where conversion changes.

The offer uses explicit typed events. PostHog autocapture and session replay are not part of this measurement design.

## Event flow

| Stage                | Event                           | Meaning                                                                                        | Destination                                                                                     |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Offer arrival        | `offer_viewed`                  | One mounted offer view                                                                         | PostHog and first-party funnel; persisted-result views reuse the server-recorded event          |
| Chapter available    | `offer_chapter_revealed`        | A guided-story chapter newly mounted                                                           | PostHog only                                                                                    |
| Content reach        | `offer_section_viewed`          | A section was at least 25% visible continuously for 750 ms in a visible tab                    | PostHog                                                                                         |
| Detail exploration   | `offer_detail_opened`           | A deliberate guided-story analysis, product, or locked-card interaction                        | PostHog only                                                                                    |
| CTA action           | `offer_cta_clicked`             | A tracked offer CTA was clicked; `destination` distinguishes navigation from checkout intent   | PostHog                                                                                         |
| Pricing reach        | `pricing_viewed`                | Pricing reached the existing visibility threshold                                              | Existing PostHog, Customer.io, and Meta routes                                                  |
| Plan choice          | `offer_plan_selected`           | A pricing plan was explicitly clicked                                                          | PostHog                                                                                         |
| Checkout UI intent   | `offer_checkout_opened`         | The payment UI was opened, before a provider session exists                                    | PostHog; Meta `InitiateCheckout` for the overlay only                                           |
| Checkout lifecycle   | `offer_checkout_lifecycle`      | Privacy-safe diagnostic transition for one app-owned checkout attempt                          | PostHog only                                                                                    |
| Payment option reach | `offer_payment_option_viewed`   | One ready payment option was at least 50% visible for 750 ms in the open overlay               | PostHog only                                                                                    |
| Payment choice       | `offer_payment_method_selected` | A provider was explicitly selected; Stripe records `apple_pay` or `payment_element` when known | PostHog                                                                                         |
| Checkout failure     | `checkout_start_failed`         | Provider initialization failed or duplicate access blocked checkout                            | PostHog                                                                                         |
| Checkout initialized | `checkout_started`              | Stripe created a session or PayPal created an intent                                           | Existing PostHog, Customer.io, Meta for inline/external checkout, and first-party funnel routes |
| Purchase             | `purchase_completed`            | Authoritative server-side paid conversion                                                      | Existing billing analytics/outbox routes                                                        |

`checkout_started` is deliberately later than `offer_checkout_opened`: opening the UI expresses intent, while checkout start requires a successful provider session or intent. Both events carry `checkoutPresentation` (`inline` or `overlay`). `checkout_started` also carries `checkoutStartTrigger`: `automatic_mount` for the default-mounted Stripe session and `explicit_provider_action` for an explicit provider action such as PayPal.

### Checkout lifecycle diagnostic contract

`offer_checkout_lifecycle` is a PostHog-only diagnostic event, never a first-party funnel milestone or a Meta or Customer.io event. Its fixed transitions are `preparation_started`, `prepared_response_received`, `client_mounted`, `claimed`, `opened`, `provider_ready`, `payment_surface_selected`, `payment_engaged`, `confirm_started`, `dismissed`, `resumed`, `recovery_presented`, and `attempt_ended`.

Every event contains only the app-owned `checkoutAttemptId`, `openIndex`, `commerceKind` (`one_time` or `subscription`), `checkoutPresentation`, `transition`, `elapsedMs`, and `lastState`; it may add a bounded `provider`, `option`, and one fixed dismissal, recovery, or end reason. It excludes provider session and preparation IDs, email, tokens, and free text. A transition is claimed once per attempt, transition, provider/option/reason, and `openIndex`, while a new provider or reopen index can record a meaningful later transition. A pristine `dismissed` only hides an attempt; a later `resumed` keeps its attempt ID and increments `openIndex`. After engagement, a confirmed abort records its dismissal and then a terminal `attempt_ended`, so provider-owned form input is discarded as promised by the confirmation copy.

Lifecycle telemetry diagnoses the client boundary only. The one-time and membership `checkout_started` milestones have different preparation boundaries and must not be compared between arms as equivalent funnel stages. Provider and Supabase/billing truth remain authoritative for prepared sessions, payments, purchases, and entitlements.

Client teardown is deliberately recorded as `page_teardown`, never `completed`: provider return, purchase and entitlement truth decide whether a payment succeeded. The other terminal reasons emitted by this slice are `customer_aborted` and `plan_changed`.

### Cold checkout timing contract

The CTA tap remains immediate intent: `offer_cta_clicked` is emitted when the customer taps a tracked CTA, and the drawer opens synchronously. The current offer checkout performs no Stripe or PayPal provider work from page mount, pricing visibility, or a hidden drawer.

`offer_checkout_opened` is emitted when the drawer opens; Meta `InitiateCheckout` remains tied to that action. Membership then creates a fresh Stripe Session for a private Session-attempt ID while retaining the immutable drawer checkout-attempt ID for analytics. The one-time offer reserves the Apple Pay/card positions without making them actionable and starts its unbound Stripe preparation only after the customer accepts the existing consent. PayPal remains independently selectable. `checkout_started` is later still: after Stripe creates a usable Session or PayPal creates an intent.

An explicit Stripe retry does not reopen the drawer and therefore does not emit another `offer_checkout_opened` or Meta `InitiateCheckout`. It keeps the analytics `checkoutAttemptId` stable. A known provider/response failure rotates the private `checkoutSessionAttemptId` so a cached failed Session cannot trap the retry; an uncertain network transport failure reuses that private ID so a Session whose response was lost can be recovered. All provider outcomes remain joined to the original drawer open.

`checkout_prepared` and `checkout_preparation_outcome` remain historical typed events for already-recorded analytics, but the current offer client does not emit them.

Apple Pay availability, Express Checkout mounting, and Payment Element initialization do not count as a payment choice. In the flagged offer-overlay Elements path, `offer_payment_method_selected` retains `provider=stripe` and adds `paymentMethodType=apple_pay` for a real Apple Pay interaction or `payment_element` for the fallback submit path.

`offer_payment_option_viewed` is the exposure signal between initialization and interaction. It
emits at most once per `checkoutAttemptId` and option (`apple_pay`, `paypal`, or
`card_and_more`) after that provider reports readiness and the option remains at least 50% visible
for 750 ms in a visible tab. Closed checkout, unavailable wallets, failed provider loads, rerenders,
and options outside the open overlay do not emit. The event carries the common offer and commerce
context plus `checkoutAttemptId`, `provider`, and `option`.

## Meta conversion contract

Meta uses a smaller conversion funnel than the internal analytics model:

| Milestone                            | Meta event                                               | Delivery                                | Event ID                                                        |
| ------------------------------------ | -------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| Page load                            | `PageView`                                               | Pixel only                              | none                                                            |
| Quiz start                           | `QuizStarted`                                            | Pixel only                              | existing funnel event ID                                        |
| Persisted quiz and email             | `Lead`                                                   | Pixel plus default-off first-party CAPI | browser-supplied `funnelEventId`                                |
| First rendered quiz-completion offer | `ViewContent` with `content_name=quiz_result_offer_view` | Pixel plus default-off first-party CAPI | deterministic Meta-only UUID derived from the persisted lead ID |
| Overlay checkout entry               | `InitiateCheckout`                                       | Pixel only from `offer_checkout_opened` | checkout attempt ID                                             |
| Paid activation                      | `Purchase` and `Subscribe`                               | existing billing delivery               | provider-stable billing ID                                      |

`quiz_completed` remains an internal PostHog, Customer.io, and first-party funnel milestone. It does not emit Meta `CompleteRegistration` or custom `QuizCompleted` events. Ordinary `offer_viewed` also remains internal; the dedicated Meta offer conversion is emitted only for `entryContext=quiz_completion`.

Create the Meta custom conversion **Offer Page Viewed** from source event `ViewContent` with the exact rule `content_name equals quiz_result_offer_view`. Both parts are required: the overlay checkout-entry action uses `InitiateCheckout(content_name=quiz_result_offer)`, and pricing visibility uses `ViewContent(content_name=quiz_result_offer_pricing)`.

For the overlay, one explicit `Jetzt starten` action emits `offer_checkout_opened` and owns Meta `InitiateCheckout`, using its stable `checkoutAttemptId` as the Meta event ID. Provider-session `checkout_started` events remain available to PostHog and Customer.io but are suppressed from Meta only when `checkoutPresentation=overlay`. Inline fallback and checkout surfaces outside this offer retain their existing Meta delivery.

For membership, the overlay is strictly default-off and renders only when
`NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED=true`; otherwise the existing inline checkout and its
current Meta routing remain unchanged. The one-time offer always uses its payment dialog. For that
offer, disabling the overlay flag is a Stripe Elements containment switch: Apple Pay and card are
removed while the PayPal-only dialog remains available.

The Elements/Apple Pay path is a second default-off gate: it is active only when both
`NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED=true` and
`NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED=true`. With Express disabled, membership uses the
existing non-Express Embedded Checkout presentation. The one-time offer does not mount Stripe,
reports only PayPal as available, and becomes PayPal-only because it has no non-Express Stripe
fallback. Disabling the overlay flag keeps the existing non-overlay membership behavior.
The one-time offer remains PayPal-only whenever either Elements gate is disabled.

### Offer-view deduplication

The browser claim is stored once per stable lead/funnel/offer identity in `localStorage` and fails closed when storage is unavailable. Pixel and the same-domain `/api/analytics/meta-offer-view` request use the same privacy-safe deterministic UUID derived from the persisted lead ID. The server recomputes that ID and rejects arbitrary UUIDs before rate limiting or delivery. Reloads, later tabs, and repeated funnel contexts for the same lead therefore converge on one Meta event ID.

The endpoint accepts no email or name from the browser. It validates the IDs and entry context, applies IP and lead rate limits, requires recent persisted quiz evidence, loads matching data server-side, and uses the aggregate source URL `https://chaarlie.de/result` rather than a lead-bearing result path.

### CAPI flags and cutover

- `META_CAPI_LEAD_ENABLED=true` enables the first-party Lead server copy.
- `META_CAPI_OFFER_VIEW_ENABLED=true` enables the first-party offer-view server copy.
- Both flags are strictly default-off. Pixel remains the fallback and these non-billing sends have no retry loop.
- The existing billing Meta adapter and outbox are unchanged.
- This implementation does not add or reinterpret consent policy. In particular, the quiz's email-marketing consent is not advertising consent. Because enabling first-party CAPI adds hashed identity plus request metadata to Meta delivery, privacy/legal approval of the advertising-consent policy remains a separate prerequisite before either flag is enabled.

The 2026-07-17 Meta preflight found three connected integrations: Meta Pixel, direct Conversions API, and an active **Conversions API Gateway for Pixel 988892550357504** named `Chaarlie`. The Gateway is the existing top-funnel server mirror. Its settings were disabled in the available Meta UI, so do not enable either new first-party flag until the Gateway can be disabled or configured to exclude these events. No custom conversions or active **Used by** dependencies were shown for the retired `CompleteRegistration` and `QuizCompleted` events.

For Test Events verification, submit one fresh quiz and confirm matching browser/server name and ID for `Lead` and `ViewContent`. Reload, navigate back, and open a saved result to confirm no second primary offer conversion. PageView must remain browser-only.

Rollback is split by behavior:

- set both server flags to false to stop the new first-party CAPI copies;
- revert the browser semantic change to restore `CompleteRegistration`/`QuizCompleted` or remove `quiz_result_offer_view`—the server flags do not control Pixel events;
- do not change an active campaign optimization event as part of either cutover or rollback.

## Guided-story three-way offer experiment

The `guided_story_offer_v2` experiment compares three sticky server-assigned offer variants:

- `guided-story-locked`
- `guided-story-founder-letter`
- `guided-story-potential`

`GUIDED_STORY_OFFER_EXPERIMENT_ENABLED=true` allows new, unviewed `guided-story` funnel sessions to
enter the experiment. The flag is default-off. With the flag disabled, the result renders the
unchanged `guided-story` rollback without rewriting stored assignments.

Assignment is deterministic from the experiment ID, revision, and funnel session ID. A lead ID is
used only when no funnel session exists. The assignment is independent of campaign, ad, package,
device, and quiz properties. For eligible sessions, the server conditionally persists the arm in
`funnel_sessions.offer_variant` before recording `offer_viewed`; a concurrent winner is read back
and rendered. This session column is the only first-party arm authority.

If assignment persistence fails, the server captures the original exception through the redacted
offer-experiment Sentry boundary, renders and tracks `guided-story`, and leaves the journey outside
the three experiment arms. The Sentry payload contains fixed experiment, stage, arm, fallback, and
package tags only—never names, email addresses, quiz answers, or raw lead/session IDs.

The experiment arms use offer revision `guided_story_experiment_v1`. PostHog receives the actual
`offer_variant` through the existing common offer context. The Potential arm does not send its
three percentages in the first release. Potential-arm journeys with incomplete or unsupported
legacy quiz data remain assigned to that arm but render without percentages; count those journeys
as treatment-delivery context when interpreting the arm rather than silently reclassifying them.

Meta behavior is intentionally identical across arms. Do not add an arm parameter, arm-specific
event name, or arm-specific `content_name`. Keep the standard path
`ViewContent(content_name=quiz_result_offer_view)` → `InitiateCheckout` → authoritative `Purchase`
and `Subscribe`, with the active campaign optimization event unchanged.

The primary experiment KPI is unique funnel sessions with a later `purchase_completed` divided by
unique funnel sessions with `offer_viewed`, grouped by the durable session `offer_variant`.
Lead-fallback journeys without a funnel session are excluded from that denominator and counted
separately. Report raw counts, rates, and uncertainty; do not automatically declare a winner.

## Organic offer-media experiment

`organic_offer_media_v1` compares exactly two arms inside the canonical
`default_organic` package: video control `organic-plan-v1` and before/after treatment
`organic-plan-before-after-v1`. The public result URL, Meta event names, content names, campaign
semantics, checkout, and purchase delivery are identical across arms. The durable
`funnel_sessions.offer_variant` snapshot is the sole arm authority; browser event properties and
purchase analytics resolve that same snapshot.

The readout's eligible exposure is the first valid `offer_viewed` in the reporting range with a
non-empty `funnel_session_id`, `funnel_package_key=default_organic`, one of those two arm IDs, and
no marked internal traffic. Each session must contain exactly one arm among its scoped offer-view
events. Sessions marked `is_internal_test=true` (including string/`1` representations) or
`test_kind=field_test` and `test_kind=partner` are excluded. Field-test, partner, and moderator journeys stay on the video control
and are not comparable paid-experiment traffic.

The overview reports, per arm, unique eligible session counts for raw offer views, pricing reach
(`pricing_viewed`), checkout opens (`offer_checkout_opened`), purchases, and purchase rate.
`purchase_completed` joins through the same `funnel_session_id` and package after the first valid
offer view; it does not need to repeat `offer_variant`. Checkout opens and starts are diagnostic
stages, never purchase substitutes.

The data-quality insight reports mixed-arm sessions and the absolute difference between valid
control and treatment session counts as `sample_ratio_difference_percent`. Do not interpret the
conversion insight while mixed-arm sessions are non-zero, attribution is incomplete, or the
allocation check is unexpectedly far from 50/50. Report raw numerator and denominator alongside
each rate. Until each arm has a pre-agreed, decision-useful purchase denominator, treat rate
differences as directional only and show an interval or other uncertainty estimate; the dashboard
does not choose a winner automatically. The default rolling range includes only purchases that
occur inside that same range, so its newest exposures are right-censored. Any winner decision must
use a predeclared, matured exposure cohort and conversion window rather than the rolling seven-day
rate alone.

The declaration is stored in
`scripts/analytics/organic-offer-media-experiment-dashboard.ts`. The installer defaults to a
no-network declaration dry run:

```bash
npm run posthog:organic-offer-media-experiment-dashboard
```

To validate a selected existing organic dashboard without writes, pass its ID and a read-capable
personal key through the normal environment. Production installation is a separate authorization
and additionally requires `--apply`, `--confirm-project=126788`, and the exact
`--dashboard-id=<existing-organic-dashboard-id>`. The installer refuses duplicate exact-title
insights and spec drift. When attaching an existing exact-title insight, it preserves that insight's
other dashboard memberships. It creates or attaches only the two declared insights; it does not
alter Meta, campaigns, offer routing, assignment, or payment state.

Rollback means first disabling `ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED` for new unviewed sessions;
already exposed sessions retain their stored arm. Dashboard removal or PostHog writes require a
separate authorized, reversible operator action. Do not activate the experiment until the
dashboard has been installed, its two insights have been visually verified, and the quality check
is understood.

## Stable dimensions

Offer diagnostics include one `offerViewId` per mounted view, one `checkoutAttemptId` per checkout UI open, a unique event ID per interaction, the offer variant and semantic revision, entry context, routine-return state, deterministic need lane and suggested category, selected shampoo and conditioner module IDs, and the existing funnel session/package attribution when available.

## Identity and join contract

- `lead_id` joins all offer views for the same lead; it is an event property, not a PostHog person identity. Do not call `posthog.identify(leadId)` or attach name/email traits.
- `offer_view_id` joins one mounted offer experience and its within-page diagnostics. Reloads intentionally create a new view.
- `funnel_session_id` is the durable acquisition-to-purchase and cross-page join. Join `purchase_completed` by this property, never by a PostHog person.
- `checkout_attempt_id` joins one checkout open to payment selection, provider start, and classified failure. A later open receives a new ID.
- `funnelEventId` / PostHog `$insert_id` is an application trace and collision diagnostic only. It is not relied on as PostHog ingestion deduplication.

Use non-null `lead_id` browser events for product cohorts; preview/lab views with a null lead are expected excluded noise. Server purchase queries start from the eligible cohort's `funnel_session_id` values rather than inheriting browser-only filters.

Commerce events use structured plan metadata:

| Interval | Plan ID           | Value | Currency |
| -------- | ----------------- | ----: | -------- |
| Month    | `premium_month`   | 14.99 | EUR      |
| Quarter  | `premium_quarter` | 34.99 | EUR      |
| Year     | `premium_year`    | 99.99 | EUR      |

Do not derive analytics values by parsing visible price copy.

## Stable section IDs

In visual order:

1. `personalized_analysis`
2. `mini_routine`
3. `locked_routine`
4. `unlock_explanation`
5. `product_story_chat`
6. `product_story_routine`
7. `product_story_products`
8. `subscription_explanation`
9. `pricing`
10. `guarantee`
11. `faq`
12. `final_cta`

The hero is represented by `offer_viewed` and is not duplicated as a section event.

Stable CTA IDs are `sticky_header`, `locked_plan`, `pricing_primary`, `change_plan`, and `final`. FAQ IDs are semantic identifiers rather than question copy, so copy edits do not fragment reporting.

CTA reporting must use `destination`, not the generic event name, as the intent contract:

- `destination=pricing` is navigation. For the personal-plan offer, `sticky_header` is a pricing
  jump and must be reported separately from checkout intent.
- `destination=checkout` is checkout intent. The current personal-plan placements are
  `pricing_primary` and `final`.

### Personal-plan pricing experiment

The personal-plan pricing experiment has exactly two reportable arms:
`personal-plan-membership-v1` and `personal-plan-one-time-v1`, both with
`offer_revision=personal_plan_v3`. The legacy `personal-plan-v1` cohort remains a historical
base metric and is never part of an experiment denominator. Every experiment query must exclude
internal QA using a boolean/string-safe predicate for `is_internal_test` (for example,
`lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')`).

The primary rate is unique eligible `funnel_session_id` values with a later
`purchase_completed`, divided by unique eligible `offer_viewed` sessions, grouped by arm. Report
raw counts alongside the rate. Keep `destination=pricing` navigation, `destination=checkout`
intent, `offer_checkout_opened`, and `checkout_started` as separate journey stages; provider
initialization is not payment-option exposure.

One-time commerce carries `commerce_kind=one_time` and `purchase_kind=personal_plan_once` with
the server-owned plan ID, currency and value. It never carries a subscription interval and never
uses a provider subscription identifier for an order, capture or payment ID.

### Guided-story additions

`offer_chapter_revealed` is PostHog-only and carries the common offer context plus `chapter_id` (`analysis`, `routine`, `support`, or `pricing`), `chapter_index` (1–4), and `reveal_generation`. Generation `0` is the initial result render; each successful later high-water-mark increase uses the existing increasing generation. If one transition mounts several chapters, emit one event per chapter in `chapter_index` order with the same generation. Provider-owned claims suppress gated-remount duplicates; a no-op reveal emits nothing.

Do not add a chapter-view event. Derive qualified chapter exposure from `offer_section_viewed`: analysis = `personalized_analysis`; routine = either `mini_routine` or `locked_routine`; support = any of `product_story_chat`, `product_story_routine`, or `testimonials`; pricing = `pricing`. FAQ exposure is not chapter-4 exposure.

`offer_detail_opened` is PostHog-only and carries the common context plus `detail_type`, `detail_id`, `detail_index`, `source_section`, and monotonic `detail_interaction_index`. Types and sources are fixed: `analysis_marker` / `personalized_analysis`, `routine_product` / `mini_routine`, and `locked_routine_card` / `locked_routine`. IDs are code-owned: `priority_1`–`priority_3`; routine `product.category` with its 1-based `preview.products` position; and locked keys `further-care` → `further_care`, `tools` → `tools`. It records every deliberate trigger click, including repeat or already-open clicks; default-rendered `priority_1` is exposure, not an interaction. Never send visible copy, product names/keys, category labels, URLs, raw answers, identity, payment, or error data.

The delayed chat answer is an `offer_section_viewed` with `section_id=product_story_chat_answer`, registered only after its element renders through the provider's stable dynamic registration path. It keeps the normal 25%/750 ms visible-tab rule and can qualify independently of the chat wrapper. It is excluded from both `offer_engaged` depth and `distinct_section_count`, preserving that event's legacy meaning and Customer.io timing.

Guided-story preserves historical known `section_index` values and appends `product_story_chat_answer` at index 8. Therefore index is insertion/history order, not visual order; dashboards must use this explicit visual ID order: `personalized_analysis`, `mini_routine`, `locked_routine`, `product_story_chat`, `product_story_chat_answer`, `product_story_routine`, `testimonials`, `pricing`, `faq`.

For the finite guided-story family (`guided-story` plus the three experiment arms),
`offer_faq_opened` emits on every deliberate open with existing `faq_id`, zero-based `faq_index`,
and one-based per-view `open_index`; closes and incidental UI mechanics do not emit. Other variants
remain once per FAQ ID per offer view.

The Founder Letter arm inserts `founder_letter` between `personalized_analysis` and `mini_routine`.
The other two experiment arms retain the existing guided-story section order.

### Personal-plan offer revision 2

The approved personal-plan refocus is a semantic page revision, not a new
commercial offer. It keeps:

- `offer_variant=personal-plan-v1`;
- `funnel_package=meta_personal_plan_v1`;
- all price, checkout, billing, and Meta conversion identities.

It changes `offer_revision` from `personal_plan_v1` to
`personal_plan_v2` and adds one visual section. The v2 section order and
zero-based indices are:

| Index | Section ID                    |
| ----: | ----------------------------- |
|     0 | `hero`                        |
|     1 | `personal_plan_diagnosis`     |
|     2 | `personal_plan_complete_plan` |
|     3 | `personal_plan_method`        |
|     4 | `personal_plan_before_after`  |
|     5 | `pricing`                     |
|     6 | `personal_plan_survey`        |
|     7 | `testimonials`                |
|     8 | `guarantee`                   |
|     9 | `faq`                         |
|    10 | `final_cta`                   |

`personal_plan_before_after` emits only `offer_section_viewed` under the normal
25%-visible/750-ms-visible-tab rule. It has no new CTA or detail event. The
personal-plan `offer_engaged` depth threshold still qualifies after the first
three sections (`hero`, `personal_plan_diagnosis`, and
`personal_plan_complete_plan`), so the new section at index 4 does not delay the
normal Customer.io handoff. Keep the new ID in the closed Customer.io section
schema for parity with the typed analytics contract.

The same-tab `offer_engaged` session-storage key includes `offer_revision`.
A tab that spans the v1-to-v2 cutover can therefore qualify once again after
reload; this is not a durable cross-session deduplication mechanism. Before
deployment, inspect every active Customer.io consumer of `offer_engaged`; if
any consumer sends customer-facing communication, add a revision-aware
exclusion or equivalent deduplication so the page revision does not resend that
communication.

The persistent Meta offer-view guard is also revision-scoped. A returning
eligible result can emit the v2 view again, while its lead-derived Meta
`event_id` remains unchanged across the revision and preserves the existing
deduplication identity.

#### PostHog dashboard cutover

The product deployment and dashboard writes are separate release actions:

1. Deploy the v2 product code and record its production timestamp and SHA.
2. Complete one authorized fresh result journey and verify a
   `personal_plan_v2` `offer_section_viewed` for
   `personal_plan_before_after` at index 4.
3. Re-run the guarded dashboard migration in dry-run mode. It must fingerprint
   the current insight definitions and stop if they have drifted.
4. With explicit production-write authorization, apply the migration, re-read
   the affected insights, and add a deployment annotation.

The affected production resources are:

- dashboard `859068`, **Persönlicher Haarplan — Offer-Seite: Views & Klicks**
  - insights `5235347`, `5235348`, `5235350`, `5235351`, and `5245339` move
    their explicit revision filter to v2;
  - insight `5235348` inserts `personal_plan_before_after` between method and
    pricing, shifts later display numbers, and describes 11 visual sections.
- dashboard `858662`, **Persönlicher Haarplan — Funnel & Quiz-Drop-off**
  - insight `5233190` moves to v2 and inserts the new section in its ordered
    predecessor calculations;
  - insights `5233182` and `5233189` remain revision-agnostic.
- dashboard `825839`, **Quiz Result & Checkout — Letzte 24 Stunden**
  - insight `5033903` groups reach by `offer_variant`, `offer_revision`, and
    `section_id`;
  - its denominator must match the same variant and revision, and its ordering
    must use variant, revision, and the minimum observed section index. This
    prevents mixed v1/v2 traffic from diluting reach or misordering the shifted
    indices.

Capture the before-state before any PATCH. If only a query is wrong, restore
that insight without rolling back the product. If the product revision is
rolled back, redeploy the previous release, restore any already-migrated insight
definitions, and add a rollback annotation. Preserve recorded v1/v2 event rows
as historical truth.

Use the task-scoped operator in dry-run mode by default:

```bash
npm run posthog:personal-plan-offer-v2:dashboards
```

After the separately authorized production deployment and first verified v2
event, apply with an absolute backup path outside the repository:

```bash
npm run posthog:personal-plan-offer-v2:dashboards -- \
  --apply \
  --confirm-project=126788 \
  --backup=/absolute/outside-repo/posthog-personal-plan-v2.before.json \
  --annotation-at=<production-ISO-timestamp> \
  --deployment-sha=<deployed-git-sha>
```

For a guarded partial or complete restore, use the captured backup with
`--apply`, `--confirm-project=126788`, and
`--restore=/absolute/outside-repo/posthog-personal-plan-v2.before.json`. The
operator skips insights already at the reviewed before-state, restores only
those at the expected v2 state, and aborts on any third state.

### Personal-plan offer revision 3

The pricing-order refinement changes only the personal-plan page hierarchy. It
keeps the v2 copy, section set, commercial identifiers, payment behavior, and
event names, while changing `offer_revision` to `personal_plan_v3`.

The v3 visual order and zero-based indices are:

| Index | Section ID                    |
| ----: | ----------------------------- |
|     0 | `hero`                        |
|     1 | `personal_plan_diagnosis`     |
|     2 | `pricing`                     |
|     3 | `personal_plan_complete_plan` |
|     4 | `personal_plan_method`        |
|     5 | `personal_plan_before_after`  |
|     6 | `personal_plan_survey`        |
|     7 | `testimonials`                |
|     8 | `guarantee`                   |
|     9 | `faq`                         |
|    10 | `final_cta`                   |

The generic three-section `offer_engaged` rule is unchanged. In a normal
top-to-bottom v3 journey it can therefore qualify when pricing becomes the
third genuinely viewed section. A result-email focus or other non-linear entry
does not imply views of skipped sections; it qualifies only after three
eligible sections have actually met the normal visibility rule.

The v2 dashboard declarations and operator remain frozen historical artifacts.
The v3 cutover covers these reviewed resources:

- dashboard `859068`: insights `5235347`, `5235348`, `5235350`, `5245339`,
  and `5250265`;
- dashboard `858662`: insight `5233190`;
- dashboard `825839`: insights `5235351` and `5033903` are fingerprinted but
  intentionally unchanged.

The Personal Plan operator dashboard deliberately separates three scopes:

1. The primary business funnel and checkout path use the immutable
   `funnel_package_key` plus `funnel_session_id`, span page revisions and offer arms, and exclude
   internal QA. They answer how the Personal Plan journey performs; `offer_revision` is not their
   purchase identity.
2. Current-page reach and CTA diagnostics require `offer_revision=personal_plan_v3`, accept the
   base, membership, and one-time Personal Plan variants, and exclude internal QA. They answer what
   users saw and did on the current page structure.
3. The pricing-experiment overview contains only the membership and one-time assigned arms. The
   current runtime emits them on v3, but the overview stays arm/session scoped across page revisions
   because `offer_revision` is not purchase identity. It reports raw session and purchase counts
   alongside conversion, and keeps pricing navigation, checkout intent, checkout opening, provider
   initialization, and payment-option visibility as separate stages. The historical
   `personal-plan-v1` base is never an experiment denominator.

The tracking-quality tile owns missing or unexpected identity combinations instead of silently
dropping them from diagnostics. Keep the legacy raw package key `meta_personal_plan_v1` for audit and
historical joins, but label the journey **Personal Plan** in titles and descriptions.

Run the v3 operator without arguments for a GET-only dry run:

```bash
npm run posthog:personal-plan-offer-v3:dashboards
```

Only after the product deployment, a verified v3 event, and separate
production-write authorization, apply the dashboard migration with an
absolute backup path outside the repository:

```bash
npm run posthog:personal-plan-offer-v3:dashboards -- \
  --apply \
  --confirm-project=126788 \
  --backup=/absolute/outside-repo/posthog-personal-plan-v3.before.json \
  --annotation-at=<production-ISO-timestamp> \
  --deployment-sha=<deployed-git-sha>
```

Restore uses the captured v3 backup plus `--apply`,
`--confirm-project=126788`, and `--restore=<absolute-backup-path>`. Both apply
and restore reject any unreviewed third state. The operator preserves each
live insight's presentation object, patches only `description` and `query`,
re-reads every write, and never changes the two intentionally unchanged
resources.

## KPI definitions

Use the durable funnel session for anonymous-to-paid conversion, unique people for identified-user reporting, and unique `offerViewId` values for within-page diagnostics. Build every rate from an ordered cohort: the denominator event must occur first, and the numerator must match the same funnel session, offer view, or checkout attempt as stated below.

| Metric                  | Definition                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paid conversion         | Unique funnel sessions with `offer_viewed` and a later `purchase_completed` / unique funnel sessions with `offer_viewed`                                                                   |
| Checkout initialization | Unique funnel sessions with `offer_viewed` and a later `checkout_started` where `source = quiz_result_offer` / unique funnel sessions with `offer_viewed`                                  |
| Checkout-intent CTA     | Unique eligible funnel sessions with `offer_cta_clicked` and `destination = checkout`; report placements separately                                                                        |
| Sticky pricing jump     | Unique eligible funnel sessions with `cta_id = sticky_header` and `destination = pricing`; report later pricing reach separately                                                           |
| Checkout UI intent      | Unique offer views with `pricing_viewed` and a later `offer_checkout_opened` / unique offer views with `pricing_viewed`                                                                    |
| Checkout start success  | Unique opened `checkoutAttemptId` values with a later `checkout_started` where `source = quiz_result_offer` / unique opened `checkoutAttemptId` values                                     |
| Payment option reach    | Unique opened `checkoutAttemptId` and option pairs with a later `offer_payment_option_viewed` / unique opened attempts                                                                     |
| Section reach           | Unique offer views with `offer_viewed` and a later view of the section / unique offer views with `offer_viewed`                                                                            |
| CTA CTR by placement    | Unique offer views with the placement click / unique offer views with its source-section view or that placement click; use `offer_viewed` as exposure for hero or sticky-header placements |
| Checkout error reach    | Unique opened `checkoutAttemptId` values with a later `checkout_start_failed` / unique opened `checkoutAttemptId` values                                                                   |

For plan mix, use the interval on `offer_checkout_opened` and the purchase record. Do not rely only on `offer_plan_selected`, because quarterly is preselected and a user can proceed without changing it.

For provider failure rates, first require a matching `offer_checkout_opened`. Divide unique opened `checkoutAttemptId` values with a later provider failure by unique opened attempts associated with that provider through payment selection, successful start, or failure. Split the result by provider, stage, and stable error code. Do not divide raw repeatable clicks or failures by views; retries can otherwise produce rates above 100%.

Exclude orphan numerator events from rate calculations and monitor them separately as tracking-quality errors. For CTA rates, including clicked offer views in the exposure denominator ensures the numerator remains a subset even when the source-section observer was delayed or missed.

Recommended breakdowns are offer revision, offer variant, funnel package, entry context, device, need lane, suggested category, selected interval, and payment provider. Compare rates only after checking sample size and tracking coverage.

For meaningful actions, report both reach and volume: unique leads/views with an interaction are clickers; total clicks/opens are raw events; repeat volume is total minus distinct view-and-target interactions. Do not substitute raw totals for unique-lead or unique-view rates.

## Failure taxonomy

`checkout_start_failed` contains only stable, sanitized fields:

- `failureStage`: `configuration`, `duplicate_access`, `provider_intent`, `provider_session`, or `provider_approval`
- `errorCode`: a code owned by the application, such as `stripe_session_request_failed` or `paypal_approval_failed`
- `retryable`: whether retrying the same action could reasonably succeed

Never attach exception messages, names, email addresses, raw quiz answers, provider IDs, payment fields, or response bodies. Detailed exceptions remain in the existing observability path.

## Interpretation guardrails

- A section view measures exposure, not reading or comprehension.
- A CTA click does not prove checkout readiness; compare it with checkout opens and successful starts.
- Embedded Stripe field progress is not observable and must not be inferred.
- PostHog diagnostic delivery can be lost on very fast exits. Existing first-party funnel milestones remain the durable source for major business stages.
- Fine-grained PostHog diagnostics, including guided-story chapter and detail events, retain the existing ungated production behavior. `offer_engaged` remains the consent-gated exception. The separate global consent/compliance issue is known and unchanged; this specification makes no compliance claim.
- The repository's current analytics loading and consent behavior is unchanged by this specification.
- At the instrumentation deployment boundary, annotate existing dashboard `825839`: `mini_routine` changes from a chapter wrapper to its entry block, so users who scroll past that entry in under 750 ms may no longer trigger the three-section `offer_engaged`/Customer.io depth path; guided-story FAQ counts change from once-per-question to every open; and `distinct_section_count` continues to exclude the delayed chat-answer subsection. Do not use `offer_revision` as a schema-version substitute.
- `offer_revision` describes how to interpret fine-grained browser offer events. It is not the
  canonical offer identity and must not be used to join a confirmed purchase. Offer purchases join
  through `funnel_session_id`; PostHog resolves `funnel_package_key`, `landing_variant`,
  `quiz_variant`, and `offer_variant` from the immutable Supabase session snapshot.
- Browser vendor SDKs stay disabled on `localhost`, `127.0.0.1`, and local IPv6 by default. Set `NEXT_PUBLIC_ENABLE_LOCAL_VENDOR_ANALYTICS=true` only when local vendor delivery is intentional; this does not disable first-party `/api/funnel/session` behavior.
