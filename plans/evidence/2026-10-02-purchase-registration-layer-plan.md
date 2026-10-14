# Freemium purchase-layer independent second pass — 2026-10-02

Read-only review of the 23 conditional C/D proposals in /tmp/test-audit-freemium-purchase-layer-ledger.md. I read every proposed declaration and named keeper body in tests/freemium-purchase-completion-journey.test.ts, tests/free-registration-contract.test.ts, and tests/auth-intake-state.test.ts, plus their proposed journey/scan/middleware keepers and source owners. No repository changes, test runs, mutations, providers, environment loading, or DB access.

## Verdict

**23 sites remain supportable, conditionally: C14 / D9.** No proposal earns credit before its stated assertion transfer/source cleanup and owner-level test pass. The original mapping needs two corrections:

1. The webhook throw transfer (old 681 into retained 734) needs a one-provision-call counter and exactly one capture reason in addition to the retry error. Merely observing an exception class/reason does not rule out a duplicate attempt or swallowed initial failure.
2. The retired quiz alias must be replaced in resolveIntakeState with hasCompletedQuizDiagnostics, not inferred from scan access. Scan access is the real completeness boundary; middleware still independently calls resolveIntakeState with profile/onboarding inputs. Do not describe the in-memory journey linker as proof of storage/RPC behavior.

## Execution-path evidence

- Purchase client: PremiumSheet posts the completion callback at src/components/premium-sheet/premium-sheet.tsx:186. The actual route handler gates flag/auth before parsing at src/app/api/freemium/purchase/complete/route.ts:161-180; Stripe ownership is before classification at :198-205, Stripe and PayPal both enter provisionAndAnswer at :267 and :359, and provision response mapping is :388-438.
- Webhook: real Stripe route calls freemiumCheckoutProvisioningUserId then awaits runFreemiumCheckoutProvisioning at src/app/api/stripe/webhook/route.ts:521-522 and :575-576. The runner turns every retryable outcome into FreemiumWebhookProvisioningRetryError at src/lib/stripe/webhook-handlers.ts:286-315. The helper captures a thrown provision exactly where it returns provisioning_error at :193-213.
- Registration: actual POST handler calls requestFreeRegistrationLink. The function validates before limiter/lead reads at src/lib/auth/free-registration.ts:327-354; canonical address limiter/write/send order is :381-413. Actual confirm resolves nesting at src/app/auth/confirm/route.ts:247-254 and calls resolveFreeRegistrationBind before linker at :285-348.
- The journey’s delivered-mail shape is not a copied URL constructor: realEmailConfirmUrl invokes the real supabase/functions/send-email/message-builder.ts buildCustomerIoEmails at tests/free-registration-journey.test.ts:243-258. Its linkQuizToProfile implementation is nevertheless a local fake at :328-376, so it cannot be cited for real persistence/RPC correctness.
- Intake: canonical completion is src/lib/quiz/completion.ts:24-40. Current alias hasQuizDiagnostics only delegates in src/lib/auth/intake-state.ts:28-30 and its only source consumer is resolveIntakeState at :40. Production callers of resolveIntakeState are middleware :738, onboarding page :183, and admin users route :97. Scan independently calls canonical hasCompletedQuizDiagnostics at src/lib/auth/authenticated-app-route-access.ts:54-66.

## Supported cutover, exact keeper requirements

### Purchase P1–P4: 11 sites (C7 / D4)

- C purchase:103 and :143 -> keeper :196. Preserve first call as pending with provisionCalls=0, then flip the same real Stripe scenario and assert HTTP 200 plus exact complete/routineReady true. This covers the identical happy result and prevents early provisioning.
- C purchase:119 -> keeper :158. Keep foreign metadata; add activateCalls=0 and provisionCalls=0 beside existing exact 403/forbidden and classified=0. The route returns before all three operations.
- D purchase:109 and :114 -> keeper :573. Same handler gates are before body parsing/provider dispatch (route :163-180); PayPal body is unread at both gates.
- D purchase:264 -> keeper :279. Its first request already uses provisioned/routineAccepted=false and asserts exact provisioning/routine_not_accepted; :279 additionally proves convergence.
- C purchase:450 -> keeper :456. Add HTTP 200 to first pending response; same owned PayPal intent/activation pending input.
- C purchase:681, :700, :714 -> keeper :734. Expand one real runner declaration with: (a) thrown provision has provisionCalls=1, captured exactly [freemium_webhook_provisioning_failed], and RetryError provisioning_error/session ID; (b) provisioned/routineAccepted=false throws RetryError routine_not_accepted/session ID; (c) each BLOCKED_OUTCOMES value returns exact blocked reason, never throws. This reaches helper + runner; helper-only output is insufficient.
- D purchase:725 -> keeper :734 success branch, which already invokes runner and asserts exact provisioned result.

### Registration P5–P8: 7 sites (C4 / D3) plus F481 repair

- C registration:127 and :193 -> actual HTTP keeper :529. Retain its successful handler request, but destructure recorder and assert one original-address send, zero lead writes, expected lead limiter state, and capabilityChecks empty before later requests alter recorder. This proves route-to-real-service behavior rather than just helper output.
- D registration:247 -> journeys :478/:534 (new free bind), :733 (foreign established skip, no linker/provision/profile mutation and scan?konto=bestehend), and :778 (same-owner retry bind). Confirm route uses real resolveFreeRegistrationBind at src/app/auth/confirm/route.ts:307, before the linker. The fake linker means this is evidence for bind-policy invocation/output only, not real persistence.
- D registration:308 -> journey :663: actual registration POST then confirm claims lead; later capability-carrying correction returns 409 lead_claimed, leaves email and delivery count unchanged.
- C registration:376/:383 -> real request/delivery keeper :391, with literal expected input=>address-key pairs: opfer@example.com=>opfer@example.com; opfer+1/+2/+anything@example.com=>opfer@example.com; o.p.fer@gmail.com and o.p.fer+x@gmail.com=>opfer@gmail.com; o.p.fer@googlemail.com=>opfer@googlemail.com; o.p.fer@example.com=>o.p.fer@example.com. Each call must record outcome sent, raw delivery address, zero/expected writes, and independent literal address rate key. Do not calculate the expected key using buildAddressRateLimitKey. Use fresh dependency state per mapping or deliberately document correction state.
- D registration:643 -> journeys :478 loop (both signup next and magiclink redirect_to) plus :534 direct shape. These reach real buildCustomerIoEmails, then actual confirm route/parser and redirect/bind outcome. Keep :668 hostile nesting/depth cases.
- F registration:481 -> add loadLeadCalls counter to createDeps or local override; assert zero alongside existing zero rate/send for each malformed shape. The source validates bad lead/email before line :342 limiter and :353 lookup.

### Intake P9–P10: 5 sites (C3 / D2)

- C intake :24/:28/:32 requires source closure: delete alias export and direct import; replace resolveIntakeState’s alias call with canonical hasCompletedQuizDiagnostics. There are no other source consumers of the alias.
- Transfer null profile to actual scan keeper authenticated-app-route-access.test.ts:72 and preserve redirect /quiz. Transfer scalp_condition:null completed profile to :62 and assert allow. Transfer the five malformed shapes from :32 (density absent and null; empty chemical_treatment; concerns null and undefined) to :79, each independently built and each redirecting /quiz. These are real canonical scan inputs, not generated expected values.
- Keep middleware distinctions explicit: middleware fetches onboarding_completed and hair profile then calls resolveIntakeState at frozen source /tmp/test-audit-freemium-original/src/lib/supabase/middleware.ts:726-739. Existing middleware :494 has complete profile/onboarding false (needs_onboarding); :973 has hairProfile null (needs_quiz and /quiz). Do not claim the scan transfer proves middleware route ordering, and do not collapse incomplete, onboarding false, and missing quiz into one input.
- D intake :54 -> existing :62 has identical onboarding_completed:false/null resolveIntakeState assertion plus redirect behavior.
- D intake :161 -> auth-intake-state.test.ts:427-465 tests hasActivePersonalPlanEntitlement:false with paid access both absent pointers and proposal+active pointers, and asserts routine onboarding redirect. Source returns false before pointer checks for /routine at intake-state.ts:111-120.

## Source closure and native focus

No production source is deletable except the P9 transparent alias if its three callers/tests are adjusted as above. The purchase, registration and completion functions remain current entry paths. Proposed focused native command, not run:

node --import ./tests/server-only-register.cjs --import tsx --test tests/freemium-purchase-completion-journey.test.ts tests/free-registration-contract.test.ts tests/auth-intake-state.test.ts tests/free-registration-journey.test.ts tests/authenticated-app-route-access.test.ts tests/auth-middleware-personal-plan-routine.test.ts

Controls for a later owner: move Stripe ownership after classification; provision on pending; enable body dispatch before flag/auth; swallow/retry twice in webhook runner; bypass capability or alias normalization; restore direct alias instead of canonical import; classify null scalp as incomplete; accept incomplete/missing profile; treat paid/pointer access as routine entitlement. Restore source after each mutation; none performed here.
