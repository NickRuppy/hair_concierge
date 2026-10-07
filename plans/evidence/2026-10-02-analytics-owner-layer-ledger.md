# Analytics outbound tracking — owner-layer audit

Scope: read-only at `21e0e41f`; no test runner, network/provider, database, environment operation, mutation, or repository edit. I read all 47 AST declarations in `tests/analytics-tracking.test.ts` and all 20 in `tests/billing-analytics-destinations.test.ts`; `tests/freemium-analytics.test.ts` does not exist. AST count is therefore **67**, not runtime-loop-expanded count.

## Execution and ownership evidence

Browser events enter `trackAppEvent` (`src/lib/analytics/track-app-event.ts:27-49`), which removes undefined values, consults `eventRoutes` and independently fault-isolates PostHog, Customer.io and Meta. The policy matrix is executable data in `src/lib/analytics/routes.ts:9+`, not a source-import layout assertion. It is reached by 64 production `trackAppEvent(` callers under `src/app`, `src/components`, and `src/lib` (including offer checkout, quiz, checkout return, reactivation and scanner paths).

Browser Customer.io maps allowed app events and queue/flushes funnel context at `src/lib/analytics/destinations/customerio.ts:56-80,83-193`; browser Meta excludes non-commercial test kinds and selects the event-specific pixel calls at `src/lib/analytics/destinations/meta.ts:66-153`; PostHog maps then strips camel-case envelope keys before capture at `src/lib/analytics/destinations/posthog.ts:588-603`.

Server billing creates idempotent sanitized outbox events and destination rows at `src/lib/billing/analytics-outbox.ts:78-116,234-276`; it claims/records each delivery and dispatches concrete Customer.io/Meta/PostHog/Funnel adapters at `:279-350`. Current callers are Stripe webhook (`src/app/api/stripe/webhook/route.ts:157,184,207`), billing reconcile (`src/app/api/billing/reconcile/route.ts:389`), PayPal trial/webhook (`src/lib/paypal/trial-webhook.ts:132,319`, `src/lib/paypal/webhook-handlers.ts:1408`), one-time activation and plan change. The scheduled operational entry point is `scripts/billing-analytics/retry-outbox.ts:2,40`. Customer.io vendor calls are real request-shaped at `src/lib/billing/analytics-destinations/customerio.ts:66+`; Meta performs receipt/trace handling at `meta-capi.ts:96-248`; PostHog resolves attribution at `posthog-server.ts:57-128`; Funnel calls the persistence owner at `funnel.ts:25-64`.

CI includes both files through `package.json:49` `test:node`, called by `.github/workflows/ci.yml:158`. File history is active: `ca176e7d` (scanner trial lifecycle), `318cf157` (Stripe/PayPal trials), `8534bdc3` (checkout failure observability), `bfe83941` (resume privacy), `937aa463` (reveal telemetry), plus current analytics/funnel commits `04f35c11`, `cf72e68e`.

Strong relevant keeper reading: `tests/billing-analytics-outbox.test.ts:283-777` executes outbox idempotency, sanitization, claim/backoff, throw isolation, terminal state and profile-bypass behavior. `tests/meta-capi.test.ts:17-165` is a separate non-billing CAPI keeper (strict default-off, identity hashing, malformed cookie rejection and transport error privacy). `tests/customerio-quiz-sync.test.ts:15-111` is a separate quiz-sync request fake (failure containment plus identify/track consent traits). Neither duplicates the browser facade nor server billing adapters, so neither is proposed as a transfer target.

## Per-declaration disposition

All entries are **R**. “Observation” names the actual assertion exercised by the declaration, not a title-derived inference. The repeated browser spy is the concrete boundary of `trackAppEvent`; the repeated request fake is the concrete provider boundary of a different server adapter. No source-only or private import/call-shape declaration was found.

### `tests/analytics-tracking.test.ts` — 47 / 47 R

| Line | Declaration | Actual observation | Mark |
|---:|---|---|---|
| 138 | resume tokens suppress browser analytics and are stripped from owned analytics URLs | sensitive resume token is detected and URL loses token/query | R |
| 151 | quiz step views stay in PostHog and Customer.io but out of Meta | facade spy exact destination sequence PostHog, Customer.io | R |
| 165 | checkout preparation is technical PostHog telemetry without a browser funnel write | single facade destination and intercepted fetch has zero funnel writes | R |
| 200 | personal-plan quiz screen views stay PostHog-only and contain only stable identifiers | PostHog-only facade plus exact snake-case captured fields | R |
| 244 | personal-plan result reveal events stay PostHog-only with stable progress fields | PostHog-only facade plus days/lead/step snake-case payload | R |
| 288 | personal-plan result reveal completion stays PostHog-only with exact trigger fields | exact completion trigger/timing/step capture fields | R |
| 338 | offer engagement routes to PostHog but not browser Customer.io or Meta | facade spy has exactly PostHog | R |
| 363 | overlay checkout opening routes to Meta while its provider starts stay diagnostic-only | overlay event creates one InitiateCheckout; automatic/explicit starts return false | R |
| 432 | Meta checkout routing preserves inline and offer-external checkout starts | overlay is rejected; inline and pricing starts create exactly two Meta events | R |
| 482 | purchase completion browser event routes to Meta only | facade spy is exactly Meta | R |
| 500 | browser revenue return events only route to Meta | explicit two event route booleans for Customer.io/PostHog/Meta | R |
| 509 | checkout preparation telemetry stays out of business checkout and provider-selection routes | seven exact route matrices, including technical versus business events | R |
| 547 | checkout lifecycle is PostHog-only and maps only its bounded snake_case contract | one destination and excludes injected preparation/email/session/token keys | R |
| 607 | browser quiz lead capture does not route to Customer.io | route booleans plus PostHog/Meta-only spy calls | R |
| 625 | quiz lead capture keeps its lead and funnel join identifiers in PostHog | captured insert id, package/session/lead and consent keys | R |
| 659 | non-funnel lifecycle and engagement events stay out of Meta | first-chat facade calls PostHog and Customer.io only | R |
| 670 | facade strips undefined payload values once before destination dispatch | all three spies receive only defined source property | R |
| 683 | quiz completed analytics payload includes hair length when present | generated funnel ID, hair length and stable fields reach two destinations | R |
| 728 | destination failures are isolated and do not throw from the facade | throwing PostHog still attempts Customer.io then Meta | R |
| 761 | PostHog adapter strips undefined properties and sends the funnel package key | capture excludes undefined values and maps structure/package | R |
| 792 | PostHog keeps explicit legacy passthrough event payloads byte-equivalent | three legacy events retain exact event/property pairs | R |
| 815 | PostHog checkout preparation maps only opaque performance diagnostics | exact opaque timing/catalog/wallet capture payload | R |
| 853 | PostHog checkout preparation outcomes remain technical and map wait duration | PostHog-only facade and exact outcome/wait snake-case capture | R |
| 893 | offer diagnostics route only to PostHog with stable snake_case context | nine route matrices and full offer-section vendor payload | R |
| 977 | email deliverability rejection is privacy-safe PostHog-only telemetry | route/capture excludes email/domain while retaining reason/suggestion | R |
| 1022 | PostHog forwards the deliverability phase only when the caller knows it | phase present once and absent in legacy payload | R |
| 1055 | PostHog retains truthful payment option exposure context | complete commerce/offer/payment-option capture contract | R |
| 1111 | PostHog represents a one-time personal plan without a billing interval | one-time payload retains commerce/purchase kind and omits interval | R |
| 1161 | PostHog keeps one-time commerce identity on pricing and provider initialization | pricing and checkout-start captures preserve one-time identity | R |
| 1234 | PostHog retains the Stripe payment method dimension for offer checkout choices | exact payment_method_type with checkout/offer dimensions | R |
| 1288 | guided-story chapter and detail diagnostics map exact snake_case properties | three distinct chapter/detail/FAQ vendor payloads | R |
| 1378 | PostHog offer engagement keeps the reason and stable offer context | reason, section count and funnel/offer context are captured | R |
| 1428 | checkout failure dedupe is scoped to the attempt and stable failure branch | duplicate same attempt rejected; different attempt accepted | R |
| 1463 | PostHog joins offer checkout diagnostics by checkout attempt | captured attempt/error; injected sdk_error absent | R |
| 1504 | PostHog pricing view keeps offer diagnostics alongside historical pricing fields | exact historical + offer diagnostics vendor payload | R |
| 1555 | offer view payload only reuses a funnel event ID that was already persisted | fresh view has no ID; persisted ID is retained | R |
| 1578 | offer view facade persists a new browser milestone but does not duplicate a server milestone | fake endpoint receives one new milestone POST, then zero server-backed writes | R |
| 1616 | PostHog checkout start keeps offer context and commerce metadata | full checkout/offer/funnel vendor payload | R |
| 1679 | profile reactivation context reaches PostHog and Customer.io | both actual vendor clients receive checkout_context | R |
| 1725 | checkout presentation and start trigger reach PostHog and Customer.io | both actual vendor clients receive presentation and trigger | R |
| 1772 | Customer.io adapter maps app payloads to snake_case vendor payloads | live browser client fake receives uppercase currency and mapped checkout fields | R |
| 1812 | Meta adapter builds purchase payload from app-owned checkout fields | browser pixel queue exact Purchase payload and checkout event ID | R |
| 1848 | Meta purchase initialization respects the local vendor analytics boundary | localhost disabled/override script and pixel queue behavior | R |
| 1903 | Meta purchase includes the package key behind the browser custom-data flag | enabled flag puts package key in Purchase payload | R |
| 1934 | Meta adapter gates package keys and never sends funnel session IDs | disabled/enabled package difference and session ID absence | R |
| 1968 | Meta checkout-start payload includes structured commerce metadata | exact InitiateCheckout content/currency/interval/value/eventID queue entry | R |
| 1998 | Meta preserves early quiz event order while waiting for the sticky funnel package | delayed context preserves QuizStarted→QuizStepViewed→ViewContent order despite one synthetic dispatch throw | R |

### `tests/billing-analytics-destinations.test.ts` — 20 / 20 R

| Line | Declaration | Actual observation | Mark |
|---:|---|---|---|
| 19 | trial_started cannot reach paid lifecycle destinations even if a delivery is misrouted | each server adapter yields permanent/restricted outcome for trial path | R |
| 169 | Meta CAPI adapter hashes user data and uses Stripe checkout session as Purchase event_id | intercepted Meta POST asserts URL, hashes, Purchase, checkout ID, value/currency and trace | R |
| 218 | Meta CAPI reuses the Stripe checkout session for Subscribe deduplication | Subscribe wire payload still uses checkout-session event ID | R |
| 253 | Meta CAPI marks provider-driven billing events as system generated | PayPal payment wire payload has system_generated and no website URL | R |
| 289 | Meta CAPI requires an explicit event receipt before marking delivery successful | zero/unparseable/non-object success replies all return failure | R |
| 335 | Meta CAPI preserves trace ids without persisting response body details | trace selection retained while echoed/rejected sensitive response body is absent | R |
| 406 | Meta CAPI only includes package key behind its flag and never includes session id | server flag only enables key; three request bodies all exclude session ID | R |
| 456 | PostHog server adapter resolves canonical funnel experience for a purchase | request fake plus Supabase fake assert canonical snapshot fields and narrow selection | R |
| 519 | PostHog purchase marks missing funnel attribution without querying Supabase | zero lookup, missing status and reported-only untrusted package key | R |
| 555 | PostHog purchase rejects a provider package mismatch as non-canonical | resolved session mismatch becomes invalid and hides canonical fields | R |
| 599 | PostHog purchase marks an unknown referenced funnel session invalid | unknown session gets invalid/session_not_found and no canonical fields | R |
| 632 | PostHog purchase leaves transient funnel lookup failures retryable | query error returns non-permanent failure before vendor fetch | R |
| 664 | Customer.io adapter sends canonical event and transition-safe Stripe traits | two intercepted identify/track requests with canonical Stripe traits | R |
| 710 | Customer.io adapter preserves paid-through access on cancelled subscriptions | event traits retain canceled status plus paid access/period end | R |
| 761 | Customer.io cancellation trait comes from the event rather than a profile fallback | missing event cancellation flag remains absent despite profile | R |
| 791 | funnel adapter maps the outbox identity, provider time, and preferred Stripe reference | RPC arguments retain event/time/provider/preferred checkout/user identity | R |
| 814 | funnel adapter falls back to canonical provider references for older purchase events | Stripe source object and PayPal subscription references are separately selected | R |
| 842 | funnel adapter classifies invalid session data as permanent | four invalid session/package/time cases return permanent errors | R |
| 891 | funnel adapter keeps session query and RPC errors transient | query and RPC failures each remain non-permanent | R |
| 912 | funnel adapter rejects non-purchases and missing session metadata permanently | non-purchase and missing session both reject permanently | R |

## Decision

**No C/D/F proposal; 67 R, 0 F/C/D.** This is a live, two-boundary layer. The apparent overlap is intentional: browser tests cover app routing and browser vendor mapping; billing tests cover server outbox delivery, canonical attribution and vendor receipt/retry classification. Deleting any listed declaration would lose a named observation; no existing stronger test covers that exact failure at the same boundary. No source/support deletion is unlocked.

Read limits: I did not audit unrelated source-inspection suites such as `tests/acquisition-funnel-tracking.test.ts` or UI route-source tests. I read the listed sibling keeper bodies only to establish boundary distinction, not classify them.

