# Payment / offer wiring: four-declaration cutover proposal

Status: read-only proposal against current302 campaign tree. No repository edits, native tests, browser, source mutations, providers, environment files or DB operations executed by this lane. Four original files contain **105 AST declarations =84R +17F +3C +1D**. Cutover is **105→101** in these files (Node73→69; browser32 unchanged). This is not campaign completion or coverage proof. Main owns adoption, execution, counterpart review and integration.

Machine inventory: `/tmp/test-audit-payment-offer-wiring-judgments.json`; each declaration has exact file, name, original line and assertion-based reason. Complete body ledger: `/tmp/test-audit-payment-offer-wiring-ledger.md`. Machine cut/transfer mapping: `/tmp/test-audit-payment-offer-candidates.json`. Fault proposals: `/tmp/test-audit-payment-offer-controls.json` (13 cut-preservation controls +3 distinct zero-quota F controls).

## C1 — sticky source replay into the actual offer

Donor: `tests/personal-plan-offer-page.test.tsx:272`, `sticky offer CTA morph preserves pricing navigation before checkout intent`.

Keepers in `tests/personal-plan-offer-motion.spec.ts`:

-122 `sticky header keeps its footprint and page containment across the viewport matrix`;
-171 `membership sticky CTA keeps fixed mobile geometry and switches from pricing to checkout`;
-240 `one-time sticky CTA never invents a billing interval after pricing is reached`.

Actual path: `/labs/offer-page?variant=personal-plan&pricingArm=membership|one_time` → `OfferPageLab` → real `PersonalPlanOffer` → real `ResultOfferPricing`; only provider/eligibility boundaries are stubbed. This is **not** the synthetic `variant=payment-overlay` PaymentFixture. Production `/result/[leadId]` uses `ResultPageClient` → the same `PersonalPlanOffer`. Lab model differs, but no model field controls the sticky state, callback delivery, billing arm or geometry branches. `personal-plan-offer.tsx:551–588,624–691,804–832` owns these mechanics.

Exact transfer:

1. After beforeBox non-null in existing122 viewport loop, assert desktop before width160px (e.g. `if (viewport.width >=640) expect(beforeBox!.width).toBeCloseTo(160,1)`). Existing matrix has one desktop1280 row; add no cases/declarations. Existing44px height and before/after equality remain. Membership171 already checks mobile142..146px, preserving former `w-36`; desktop addition preserves former `sm:w-40`.
2. In membership171 and one-time240 assert the existing sticky locator has `data-offer-cta="sticky_header"`, before and after pricing reveal. The locator uses `data-offer-sticky-cta`, so corrupting analytics identity does not merely make the locator disappear.
3. Preserve existing membership initial destination=pricing/source=hero/state=before_pricing/text; actual first click focuses pricing; state/destination changes; quarter and month values; second click opens dialog. Preserve existing one-time no selected interval and one-time summary.

Donor literal mapping: `useState(false)`→observed initial state; `handlePricingReached` + prop→actual reveal transition; summary setter prop→quarter-to-month summary; ternary destinations/actions→before-click focus and after-click dialog; 44/144/160 geometry→measurements above; membership check→one-time attribute absence; state/data attribute expressions→actual attributes. Private identifier/callback syntax is intentionally not copied. No other public assertion is missing after the two transfers. No FAQ height/chevron, final-CTA fieldTest action, analytics revision or request-token dedupe is claimed by this cut.

History: motion current history includes `f865a897` checkout recovery, `8a5e42c2` actionable activation errors, `97d1fc1b` CI isolation. The change retires the private source replay, not those behavior cases. Main must run native browser before/transferred/after and six C1 actual-owner controls. Source parsing alone does not license the cut.

CI limit: Node source test currently runs in `npm run test:node`; browser keepers are `@ci` under `playwright-smoke`, which is conditional on scope/live-secret availability (`ci.yml:295–311`). They are not an unconditional Node-equivalent CI lane. This proposal does not change CI policy. Record actual non-skipped local keeper proof; do not call a skipped browser job green.

## C2 — identical paid render, all unique copy retained

Donor603 `the paid screen's copy is frontier-agnostic and carries no duplicated eyebrow` → keeper565 `a paid personal-plan result hands the buyer their plan, never the retired onboarding`, same file.

Both render exactly the same `ResultPageClient` props: `entryContext=quiz_completion`, `focusRoutine=false`, `hasAccess`, same UUID lead, `name="Lea Sommer"`, same publicOfferModel, `quizAnswers=null`, `quizKind=personal_plan`. This is duplicated invocation, not combining independent inputs.

Append all four donor assertions to existing html:

```ts
assert.doesNotMatch(html, /Routinebereich/)
assert.doesNotMatch(html, /Zu meiner Routine/)
assert.doesNotMatch(html, /Dein Haarplan ist bereit/)
assert.equal((html.match(/ist bereit/g) ?? []).length, 1)
```

Retain the donor rationale: Personal Plan-only paid path uses middleware frontier redirect; copy cannot promise a particular stage. Preserve565's existing name, optional refinement, `/routine`, no `/onboarding` and no sequential onboarding language. History `2ae521b5` (#477) introduced all three paid tests from founder27.08 ruling: behavior remains, duplicated render is removed. Four C2 faults individually insert frontier-specific copy, wrong label, retired eyebrow and a second readiness sentence. They preserve the old main positive strings so transferred assertions do the work.

## C3 — executed route ordering, wrapper default stays independent

Donor `tests/billing-plan-change.test.ts:465`, `the initial plan-change route attempts the provider before requested analytics`.

Ordering keeper: `tests/billing-plan-change-route.react-server.ts:151`, `Stripe persists the provider result before requested and approved analytics`. It invokes actual `handleChangePlan` for pending Stripe month→year with subscription row and UUID operation. The fake records calls made by the real handler; it does not manufacture their order. Literal receipt is `[claim, provider:stripe, ledger:scheduled, metadata, analytics:requested, analytics:approved]`, alongside exact HTTP200/scheduled response. Production caller is authenticated `POST` in `src/app/api/billing/change-plan/route.ts:61–88`. History `f97965ed` (#228) reliability work and later `4b7f9943` pricing-family integration preserve distinction between local admission, provider call, ledger and auxiliary analytics.

Required **additional** keeper423 `plan-change ledger and routes enforce the locked safety boundaries`: add exactly `assert.match(command, /scheduleStripe: scheduleStripePlanChange/)` before removing465. Existing `/scheduleStripePlanChange/` can match the import and is not sufficient. The actual handler keeper injects scheduleStripe and therefore cannot prove POST's default binding. Transfer preserves that independent wiring guard explicitly; do not claim runtime wrapper proof. Existing423 SQL unique/CAS, authentication, other provider/default bindings, profile, webhook/defer assertions remain.

Controls: actual handler performs requested analytics before schedule (order assertion red, no harness throw); separate POST default replaced with a valid wrong-result adapter (transferred static binding regex red). No provider or auth code is deleted or changed permanently.

## D1 — private paid signature has no independent contract

Donor `tests/personal-plan-offer-page.test.tsx:626`, `the paid continuation no longer needs a lead id to build its destination`.

It only searches `export function PersonalPlanPaidContinuation({ name }` and exact `<PersonalPlanPaidContinuation name={name} />`. It does not render a missing-lead input or observe a request. The component takes `name`, renders fixed `/routine`; `result-client.tsx:133` is its real live caller. The meaningful migration contract is already exercised by565's actual paid rendering and destination assertions. A harmless destructuring or JSX prop-shape refactor fails donor without changing that contract. History is the same `2ae521b5` removal of retired onboarding.

Remove declaration only. **Do not remove component/export or any route.** No input or public output assertion needs transfer. The D1 real-owner control changes paid `/routine` to `/onboarding`; existing565 fails. No alleged zero-caller production closure is being claimed.

## F findings and precise bounded repair options

The17 F marks are retained contracts, not17 executable edits. Keep the payment/default/security assertions while their real boundary coverage is incomplete. Three concrete false-pass repairs have source-fault proposals:

**PayPal duplicate capture (`payment-method-checkout:280`).** Current `duplicateApproval` ends at the first `capturePayPalSubscriptionCustomerPaymentError` after duplicate branch starts; `doesNotMatch` is tautological. Inserting a real capture as the first duplicate-branch statement shortens the slice and still passes. Preferred repair invokes the actual PayPalButtons approval callback with a valid established intent and duplicate HTTP response, then observes zero customer-error capture plus positive access-recovery result. No such complete callback harness was proved in this lane. A bounded TypeScript-AST traversal of the actual `approved.duplicate` consequent could repair this source-only negative within the existing declaration, but establishes only static branch absence, not SDK execution, visibility or exactly-once telemetry. Do not replace with another endpoint-defined slice. Keep all other taxonomy assertions. The proposed mutation is valid in the actual component and preserves return/recovery flow. **Runtime repair is conditional, not ready-made.**

**Launch lookup (`billing-plan-change:742`).** Existing price.retrieve records args but returns supplied `launchYear` regardless of requested ID. Actual owner changed from `getStripePriceId(targetInterval,currentCatalog.family)` to standard returns wrong lookup `price_year`; fixture still returns launch price and old test can pass. In existing declaration, assert exactly one launch `price.retrieve` with `args[0] === "price_launch_year"`; optionally capture returned result.targetPriceId and emitted second phase price also equals `price_launch_year`, retaining mixed-catalog rejection unchanged. The lookup argument is the independent necessary oracle, not the result manufactured by fake. Prove original selected test passes with this actual source fault, repaired test fails for requestedID, then restored green.

**Renewal analytics (`billing-plan-change:1347`).** Before throwing in current `recordAppliedPhase`, increment a monotonic counter and record `phase`; assert one call and `["applied"]` after existing result assertions. Actual fault omits that call while returning applied result. Original selected test passes; repaired test must fail0vs1. Preserve current `analytics unavailable` throw and successful interval/status. Separate zero-quota maintenance; no new declaration.

Other F scopes remain as individual ledger entries: wrapper onBeforeConfirm/lifecycle/feedback-scroll/first-engagement source spellings; unrelated reporter state; default reveal helper; server-plan/analytics correlations; synthetic attempt counters; FAQ normal motion; pricing effect dedupe; final/fieldTest action; misleading restart title; actual event revision. None has a proven full stronger keeper in this pass, so no automatic deletion or implementation expansion.

## Proof sequence / commands for main

First transfer assertions, run same native owners, then remove exactly4 AST declarations, rerun. Preserve same original73 Node declarations/32 browser declarations through transfer; final69/32. Main's current302 count would become306 (11590→11586) only after all four legitimate removals; other simultaneous work changes integration count.

Native Node:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/payment-method-checkout.test.tsx tests/personal-plan-offer-page.test.tsx tests/billing-plan-change.test.ts tests/billing-plan-change-route.test.ts
```

The route wrapper itself starts its six React-Server cases; running selected ordering directly is:

```sh
node --conditions=react-server --import tsx --test --test-name-pattern='^Stripe persists the provider result before requested and approved analytics$' tests/billing-plan-change-route.react-server.ts
```

Browser: use a main-created isolated config importing local register, selecting only the motion/overlay specs, with localhost baseURL and no `.env.local` loader; do not use repository default config unmodified because it reads that file. On main's safe local fixture server run native Playwright selected C1 keepers, e.g. `node node_modules/@playwright/test/cli.js test --config=/tmp/test-audit-payment-offer.playwright.config.cjs --project=chromium --grep 'sticky header keeps its footprint|membership sticky CTA keeps fixed|one-time sticky CTA never invents'`. This config/server are prerequisites, not artifacts created or run by this agent. Isolate or abort external SDK/network requests before performing second checkout click. No hosted provider/DB required for keeper proof.

Each source fault: clean selected-before → fault → intended assertion red (no compile/module/provider error) → byte-exact restore in finally → selected-after green. Record source SHA, real command, exit, failure location and before/after receipts. Use fault scopes from JSON; ordinary substring replacement at file scope is forbidden when occurrence count differs. Temporary mutations are proposals only.

## Source closure, evidence and limits

No production closure is unlocked by these four cuts. All relevant functions remain live: actual paid caller in result-client; sticky owner in production result and lab; billing command POST and membership GET, Stripe schedules and PayPal validator/reconciler. Test readFileSync remains used after cuts. Do not de-export or remove support on quota grounds.

Read completely: all four scoped test files and all105 callback bodies/fixtures (3785 lines); PaymentMethodCheckout534, PayPalSubscriptionButton978, OfferPaymentOverlay396, overlay lab792, PersonalPlanOffer1164, model129, plan-change442, Stripe subscription-plan-change373, billing command460, billing membership route, PayPal approval route, stale PayPal reconciler, route behavioral fixture suite and wrapper; named motion keepers122/171/240/924/945 plus fixture helpers and selected neighboring paths. Inspected exact result-client/result-page and pricing-effect blocks, provider shape logic, two safety migrations, CI/package routing, relevant history and live call sites. Did not completely read the large StripeOfferElementsCheckout owner or every result-page/provider/webhook dependency: only pertinent callback/confirmation sections/navigation. No browser/provider SDK source evaluation or live contract proof. Consequently overlay retained rows describe tested scope and meaningful risk, not a fresh full transitive-domain certification.

Static validation only: all105 declaration names/lines counted by TypeScript AST; all16 proposed mutations resolve to one named function and one anchor in that function and parse in-memory with zero TS parse diagnostics. This is not typecheck, native pass, mutation sensitivity or full global coverage. Thirteen controls concern the cut set; three are repair proposals. No repository file was written by this lane. The fast census's six overlay “static” flags came from browser `page.evaluate` DOM inspection: all32 overlay declarations use browser execution. Payment-overlay fixture has synthetic PayPal buttons, local provider lock and constant attempt ID; it cannot certify production PayPal SDK wiring or actual pricing attempt identity.
