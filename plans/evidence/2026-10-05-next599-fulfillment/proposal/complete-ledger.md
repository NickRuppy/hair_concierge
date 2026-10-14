# One-time fulfillment: complete 75-site ledger

Read-only judgment at pinned HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`; frozen test hashes match navigation575. No runtime execution.

{'R': 64, 'F': 10, 'C': 1}; one conditional cut, ten held repairs, no source retirement. All2,677 target lines, all helper bodies and existing parameter rows read. Each title below is the exact AST site; body/hash/byte anchors are in judgments.json. R describes the actual observable contract, not a claim that every title clause is fully proven.

## tests/stripe-one-time-confirmation.test.ts

- **R :251 — canonical Stripe one-time activation sends confirmation, records delivery, and activates access**
  Retrieved complete paid Stripe fixture with latest-charge timestamp, no customer, unbound consent: real Stripe adapter→canonical activation→artifact finalizer must persist one bound purchase, sent confirmation, prepared-artifact delivery and one analytics event. Catches wrong provider/date/result mapping; route tests replace ensure and core activation does not construct this Stripe payment.

- **R :272 — one-time activation links the prepared artifact before finalization even when called with deferred linking**
  profileLinkMode=defer plus captured defer queue is operative: Stripe adapter must force artifact link synchronous while vendor work alone remains deferred (exactly one callback). Normal activation does not exercise this scheduling request.

- **R :289 — Stripe finalization binds the prepared artifact when generic profile linking no-ops**
  linkQuizToProfile deliberately no-ops; finalizer must invoke real binding RPC seam and return artifact-1 for user-1. Normal fixture already links and cannot expose reliance on that side effect.

- **R :305 — confirmation failure leaves the captured Stripe purchase in paid pending for retry**
  Sender rejection after valid paid verification preserves bound purchase, pending confirmation and failed job. Distinct confirmation failure before delivery; does not establish Customer.io HTTP behavior.

- **R :318 — missing prepared locked plan leaves the captured Stripe purchase in paid pending**
  Artifact superseded triggers RPC missing-artifact error after sent confirmation; requires paid_pending, null delivered_at and failed job. Null locked_plan is a separate post-RPC validation branch.

- **R :330 — a null prepared locked plan leaves the captured Stripe purchase undelivered**
  Attached artifact RPC returns null locked_plan; adapter must reject meaningless content, leave delivery provider/timestamp unset and job failed. Superseded fixture fails before this validator.

- **R :343 — a Stripe one-time session cannot activate a different stored consent**
  Stored consent has different Stripe session id; explicit checkout_one_time_invalid and zero purchases protect provider→consent identity before write.

- **R :354 — a Stripe one-time session cannot activate consent with different lead or funnel metadata**
  Present valid UUID funnel_session_id differs from canonical consent; checks metadata conflict (actual fixture covers funnel, not independently lead). Missing metadata recovery does not exercise mismatch.

- **R :365 — missing historical Stripe one-time lead and funnel metadata resolves from bound consent**
  Both legacy lead/funnel metadata keys absent: real recovery verifier and activation obtain canonical stored values and link exactly that lead. This compatibility branch is distinct from present metadata validation.

- **R :388 — present Stripe one-time offer metadata must match the bound consent**
  Present offer_variant differs from consent: checks optional offer provenance and zero writes; missing optional metadata is admitted elsewhere and cannot catch bypass.

- **R :400 — a fully refunded latest Stripe charge is rejected before one-time fulfillment**
  Latest charge fully refunded while session remains paid: Stripe adapter must reject before account, purchase, analytics, send or artifact bind. Dispute is a separate producer flag.

- **R :426 — a disputed latest Stripe charge is rejected before one-time fulfillment**
  Latest charge disputed while otherwise paid: rejects before same side effects. Refund-only guard cannot cover dispute producer flag.

- **R :450 — user-bound prepared artifact is required before one-time finalization**
  Generic link fixture assigns artifact to another user; binding refusal must keep paid purchase undelivered/failed. No-op fixture would permit binding, so not equivalent.

- **R :464 — Stripe one-time recovery verification is read-only and omits email from refs**
  Direct read-only Stripe recovery verifier returns private email only in payment and references without email; state.calls and purchases stay empty. Activation necessarily writes, so cannot replace this read-only contract.

- **R :480 — Stripe fulfillment job retry reuses stored Checkout Session validation**
  Already stored paid purchase plus processing lease enters retry processor, retrieves session with absent legacy metadata, binds user/artifact and delivers stored canonical lead. Initial activation entry does not exercise stored job lookup/reverification.

- **R :529 — Stripe fulfillment retry marks deterministic provider identity mismatch permanent**
  Stored pi_stored versus retrieved pi_1: real retry verification maps deterministic mismatch to failed_permanent, attempts2, no backoff and no user creation. Core resolver stubs do not establish provider adapter error conversion.

- **R :579 — Stripe fulfillment retry keeps provider outages retryable**
  Stripe retrieve throws503 with fixed now: retry stays failed, attempts2, exact10:04 backoff and no account work. Permanent identity mismatch must not subsume transient provider outage.

- **F :632 — a sent and delivered activation is idempotent during Stripe replay**
  F1: full sent/delivered consent and repeat activation preserve password capability and one purchase, but throwing send stub is swallowed by canonical activation; stored evidence can still resolve active. Add monotonic sendCalls=0 over both original calls; retain existing outputs. No idempotency deletion credit.

- **R :655 — an unclaimed prepared one-time session is rejected before account creation**
  checkout_preparation_status=prepared with preparation id reaches actual claimed-metadata guard before account creation; metadata-free historical session follows different compatibility path.

## tests/one-time-recovery-command.test.ts

- **R :122 — defaults to dry-run and performs no activation writes**
  Default parse argv omits apply: exact verifyStripe→readReceipt sequence and dry-run/false guard prohibit activation. C1 keeper explicitly applies, so branch differs.

- **R :134 — expired PayPal reset is dry-run by default and reads the provider before local eligibility**
  Valid merchant-owned VOIDED order with empty captures exercises reset provider GET before local eligibility; full dry-run receipt and no apply/order/token leak. Not equivalent to payment reconciliation command.

- **R :172 — expired PayPal reset requires an exact order confirmation before any provider lookup**
  Apply reset has wrong confirm order: rejects exact apply_confirmation_mismatch before provider lookup (empty calls). Valid dry-run does not cover destructive-action admission.

- **F :202 — expired PayPal reset rejects any provider state or capture other than voided with no captures**
  F2: all four negative reset fixtures also lack valid merchant evidence; CREATED row additionally has zero purchase units. Removing status, capture or id guard can still reject at merchant/shape guard. Repair existing rows to keep unrelated fields valid (no extra rows); missing-unit row remains its own shape case. Preserve exact error code.

- **R :234 — expired PayPal reset rejects 404 before local eligibility because provider environment is unproven**
  Provider GET404 with otherwise confirmed apply must stop before eligibility/apply, using unverified-environment error. Not treated as proof of voided order.

- **R :269 — refuses all recovery modes before provider or database seams while the experiment is enabled**
  Experiment flag true blocks actual command before verifier/receipt seams; env restored in finally. This directly tests exact runtime flag gate, not production environment state.

- **R :291 — receipt preserves the verifier's computed canonical-consent proof**
  Verifier returns canonicalConsentMatch=false with otherwise valid payment; output must preserve false instead of deriving/hardcoding true. C1 uses true, so no equivalence.

- **R :302 — requires both --apply and exact --confirm-session before applying**
  Existing two malformed apply requests (missing and mismatched confirm) reject. Retained because normal apply receipt is not evidence of missing-confirm denial; note callback does not independently assert zero provider calls.

- **R :330 — applies only when confirmation exactly matches the target**
  C1 keeper: exact confirmed Stripe apply request and default fakeDeps; observes apply mode, true guard, ordered verification/activation/receipt calls. Absorbs complete donor privacy/fixed price output assertions on same receipt, no new owner calls.

- **R :351 — delegates PayPal token verification to provider seam without activating on dry-run**
  PayPal token dry-run routes verifyPayPal, preserves existingPurchaseFound and correct targetKind/provider; Stripe apply is a different dispatch branch.

- **F :364 — keeps apply idempotent by delegating repeated apply to canonical activation**
  F3: two PayPal order+capture applies produce equal receipts and two injected activation calls; fixture activation always returns ok and receipt is constant. It proves repeated delegation, not canonical idempotency. Narrow title; keep pair target/confirmation and two calls. Actual idempotence remains canonical activation/SQL concern.

- **F :381 — PayPal apply persists a verified capture before canonical activation**
  F4: source slice index ordering permits removed tryMarkPayPalOrderIntentCaptured (-1 < activationIndex) and only matches private names. Keep live default binding/capture-before-activation contract; require nonnegative anchored positions as minimum repair, preferably real default-dependency capture on existing scenario once separately established. Current status-route owner is not this CLI default binding.

- **R :392 — Stripe receipt uses the Checkout Session canonical event key and counts deliveries**
  Real receipt reader queries Stripe event_key anchored to Checkout Session and counts delivered/processing exactly; injected rows do not implement key selection or reducer. PayPal capture anchor is distinct.

- **R :413 — PayPal receipt uses the capture canonical event key and counts deliveries**
  Real receipt reader uses PayPal capture event key and pending/permanent counts; Stripe fixture cannot reach this provider branch or these statuses.

- **R :434 — rejects missing, mismatched, and ambiguous target identifiers**
  Four existing target normalization requests cover missingStripe, incompletePayPal pair, ambiguous token+pair and cross-provider identifiers; specific messages preserve CLI admission protocol. Valid command calls do not reach failures.

- **C :471 — redacts provider, user, lead, consent, token, session, and email values from output**
  C1: same default fakeDeps, same exact parse argv and same runOneTimeRecoveryCommand operation as applies-only keeper. Transfer original JSON receipt sensitive-value loop and amount/currency assertions; delete only this callback after proof.

## tests/billing-one-time-fulfillment-reconcile.test.ts

- **F :16 — one-time fulfillment retry claims at most five due jobs and dispatches by stored provider**
  F5: three jobs exercise provider dispatch and full independent stats well, but claimedLimit compares imported constant to owner using same constant; changing both via constant5→50 stays green. Preserve dispatch/stats, independently assert literal5 (title says at most five). Mock returns3, so no actual SQL cap proof.

- **R :68 — a returned failed job is counted and reported before an otherwise active result**
  Result state active plus returned job failed/attempts2 must prioritize failure stats and exact provider_dispatch details, suppress active and identifiers. Generic paid_pending result does not exercise conflicting producer outputs.

- **R :98 — a returned permanent failure is not counted active after delivery**
  Active result with failed_permanent/attempts5 prioritizes terminal counter and retry_exhausted details. Retryable failure cannot exercise permanent precedence.

- **F :126 — one-time fulfillment retry isolates provider failures and reports count-only stats**
  F6: real reconciler records terminal mismatch and safe details/counts; negative JSON.stringify(captured[0]) does not inspect Error.message (nonenumerable). The raw error is intentionally passed into injected captureException; privacy sanitization belongs to actual capture owner. Narrow this oracle to stats/details and repair F7 capture-owner negative; retain mismatch/count contract.

- **R :171 — one-time fulfillment retry records provider-vs-database gaps without dispatching**
  Purchase provider missing prevents dispatcher call, marks terminal unknown bucket with exact purchase_provider_lookup/reason. Throwing DB read must instead remain retryable.

- **R :203 — a throwing provider dispatcher releases a genuinely unhandled processing claim for retry**
  Unhandled dispatcher timeout while original lease still current must release processing→failed, attempts1, clear lease and set backoff; actual chain filters/patch drive fake row. Not proof of PostgreSQL concurrency, but distinct adapter CAS use.

- **R :243 — a stale outer dispatcher release does not overwrite a newer processing lease**
  Claimed old lease and stored renewed lease: failed CAS must reread and preserve processing/attempts0/new timestamp/no backoff. Current lease timeout cannot catch stale overwrite.

- **R :286 — a processor-persisted permanent failure survives an outer dispatcher error**
  Processor has persisted permanent result before throwing: outer cleanup must preserve attempts2/terminal status/reason; stale lease alone has different stored status and output bucket.

- **R :333 — a processor-persisted retryable verification failure stays retryable**
  Processor persisted failed with checkout_session_incomplete code: outer stage inference otherwise looks permanent, so stored retryable result must prevail. Distinct from persisted terminal and ordinary timeout.

- **R :369 — a throwing purchase lookup immediately releases the claim for retry**
  Purchase lookup itself returns DB error before provider known: release claim as unknown retryable, clear lease, increment attempts/backoff and exact details. Provider-dispatch error starts with known provider.

- **R :405 — one-time fulfillment retry Sentry payload has stable fingerprints and no raw identifiers**
  Actual payload builder receives paypal/retry_exhausted/failed_permanent/attempts5: literal fingerprint/tags and identifier-free JSON. Capture keeper uses stripe/permanent_mismatch; changing stage-specific tags would escape it. Cannot add owner call/input for quota.

- **F :420 — one-time fulfillment retry captures sanitized Sentry errors**
  F7: capture sink checks code included in safe Error.message and exact fingerprint, but JSON.stringify(Error[]) drops message. Appending raw original message to sanitized error can escape negative. Observe captured Error.message (and any sent context/tags if claimed) directly; retain existing actual capture call, no new input.

## tests/one-time-activation-status-route.test.ts

- **R :29 — one-time activation status rejects mixed provider identifiers without caching**
  Mixed Stripe session+PayPal token invalid request: HTTP400, no-store and exact terminal public body. Valid provider requests do not exercise parser rejection.

- **R :40 — one-time activation status maps Stripe paid-pending without returning identifiers**
  Real handler calls verifier then activation and strips private account/payment fields to paid_pending with200/no-store; injected activation supplies outcome but not mapping/order/privacy.

- **R :71 — one-time activation status preserves a revoked Stripe purchase**
  Stripe revoked producer result survives public mapping as revoked200. PayPal result uses status not state; keep provider wiring distinctions.

- **R :91 — one-time activation status retrieves an already-captured PayPal order without capture or recovery**
  PayPal verifier finds capture missing from local intent: real handler forwards exact token/order/capture, passes persisted capture into activation once and returns active/no-store. Source negatives additionally guard no capture/recover imports by current names; not actual default/provider network proof.

- **R :149 — one-time activation status reuses an already-persisted PayPal capture**
  Existing intent.capture avoids marker entirely (monotonic markerCalls0) and still active. Missingcapture positive fixture cannot catch needless rewrites.

- **R :188 — one-time activation status keeps an uncaptured PayPal order pending without activation**
  Verifier capture_pending error returns pending200 and zero activation calls; transient activation race throws at a different stage.

- **R :208 — one-time activation status keeps a transient PayPal user race pending**
  After valid captured verification, activation user_race_unresolved remains pending200. Missing intent is terminal and must remain distinct.

- **R :241 — one-time activation status keeps a missing PayPal intent terminal**
  Verifier intent_missing emits400 failed_permanent; cannot be merged with generic mixed identifier400 because this reaches PayPal error classification.

- **R :258 — one-time activation status preserves a revoked PayPal purchase**
  PayPal activation status revoked maps revoked200 with accountnull; not equivalent to Stripe state mapping branch.

- **R :291 — one-time activation status allows the normal fifteen pending polls**
  Fifteen existing request iterations exercise handler delegation, provider calls and rate configuration limit>=15. Stub always allows, so this proves wiring/budget configuration, not production Redis window accounting. Retain existing cases; do not pack into other callback.

- **R :326 — one-time activation status rejects abuse before Stripe or PayPal provider work**
  Denied limiter for each provider returns429/no-store/neutralpending with explicit zero calls to both provider seams. Distinct security boundary before provider work.

- **R :360 — one-time activation status rate-limit keys hash Stripe and PayPal references with request context**
  Reference and forwardedIP inputs produce two64hex identifiers, distinct and raw-ID-free; source log negative supplements identifier privacy. Does not independently prove each entropy component because both input provider/IP/reference vary; retain current observable contract.

## tests/personal-plan-one-time-confirmation.test.ts

- **R :26 — builds the new one-time confirmation payload without labeling context as acceptance**
  Exact new purchase-context text with trailing newline must survive complete payload shape (German product/price/noabo/payment/links), trimmed recipient/reference and absence of consent/quiz/diagnostics keys. Sender keeper uses text without newline; byte-preserving contract not equivalent.

- **R :56 — historical waiver rows retain their explicit-consent confirmation fields**
  Historical waiver kind emits consent_version/accepted_at and no purchase_context timestamp. New context branch cannot catch relabeling legal historical evidence.

- **R :71 — uses the configured transactional message ID and trims it**
  Explicit config inputs numeric42, symbolic name and absent fallback exercise pure configuration parsing independently of ambient environment. Existing send call uses default, not three config branches.

- **R :90 — fails closed for malformed confirmation input**
  Invalid email and whitespace-only payment reference hit independent schema failures; successful send/payload cases cannot establish fail-closed validation.

- **R :105 — returns a stable sent reference only after Customer.io accepts the request**
  Real send wrapper invokes injected sender once and returns deterministic normalized Stripe reference. Builder does not establish delivery to sender; shared transactional transport uses other payloads. No real Customer.io acceptance receipt claimed.

- **R :120 — propagates Customer.io failures without returning a sent reference**
  Injected sender rejection must propagate exact unavailable failure and prevent success; success-reference path alone cannot cover failure propagation.

## tests/one-time-paid-pending-ux.test.ts

- **F :17 — plan-bereit resolves the canonical source from the owned enrollment or pending entitlement**
  F8: canonical enrollment/pending entitlement source grep preserves current ownership intent but is coupled to identifiers/assignment shape; dead matching source or unused reads can satisfy it. Keep pending owner-boundary oracle; no existing full page invocation with same resolved inputs established, so no C/D.

- **F :32 — paid-pending plan-bereit stays on recovery instead of looping to onboarding or pricing**
  F9: source switch-slice and German copy assertions do not execute page delivery; upstream early redirect could bypass them. Existing SSR observes recovery component, and predicate observes decision, but neither proves page selects it. Preserve routing contract pending real existing page-boundary proof; no removal.

- **R :48 — paid-pending access chooses recovery before the normal ready client**
  Five explicit existing resolver inputs cover paid_pending with/without lead precedence, none→pricing, active/noLead→onboarding, active/lead→ready. Different states are meaningful; do not collapse into new table or SSR fixture.

- **R :79 — paid-pending recovery renders no onboarding, pricing, or duplicate-purchase CTA**
  Real recovery component SSR with canonical UUID requires exact retryhref, German status/headings and absence of pricing/onboarding/refine/buy CTAs. Predicate returns only surface enum and cannot enforce emitted HTML/copy.

## tests/one-time-payment-recovery-migration.test.ts

- **R :14 — migration backfills only incomplete paid purchases into the private fulfillment queue**
  Exact migration text guards create-before-backfill, paid personal_plan_once only, confirmation+all6delivery fields, onconflict idempotency and exclusion of refunded IN clause. Sibling migration test checks different FK/claims/RPC contracts; no actual executed migration replaces these literal policies.

- **R :41 — migration keeps fulfillment jobs service-only**
  Queue RLS enable, revoke anon/authenticated and grant service_role are independent storage permissions. Backfill assertion is not permission proof. Keep separate policy owner; no SQL runtime executed in this review.

- **R :56 — runbook records read-only counts before migration and verifies pending jobs afterward**
  Runbook exact read-only/no-authorization wording plus pre/post counts and revoked exclusions are normative operator safety contract. Code cannot enforce operator instructions and no runtime keeper substitutes for document policy.

## tests/personal-plan-one-time-first-access.test.ts

- **R :155 — records matching active one-time plan access once**
  Real first-access helper twice with matching active paid evidence must write exact timestamp once then returnfalse; query fake implements conditional updates from actual filters. This is TS adapter idempotence, not real transactional concurrency proof.

- **R :172 — `does not record first access for ${name}`**
  One template declaration/four existing rows: different lead, incomplete confirmation+delivery, refunded purchase, wrong product kind each must returnfalse/no writes. Distinct security/evidence clauses retained; pending row is deliberately compound and does not prove each conjunct separately.

- **F :190 — result rendering keeps the existing client surface while the evidence write is best effort**
  F10: result source grep checks private helper/createAdminClient/catch/client syntax but never executes best-effort failure continuation or hasAccess delivery. Keep public nonblocking evidence-write/client-access contract pending an actual existing route fixture; no source retirement or deletion justified.

