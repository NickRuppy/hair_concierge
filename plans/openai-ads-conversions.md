# OpenAI Ads conversions — approved implementation

## Outcome and scope
Integrate Chaarlie OpenAI measurement through existing provider-confirmed billing events. Trial start is primary; first successful paid purchase is secondary. Add permitted public landing page views. Keep the cookie banner/settings and other providers unchanged. Nick owns account payment recovery and business verification.

Branch: `codex/openai-ads-conversions`; worktree `.worktrees/openai-ads-conversions`; refreshed source base `cf72e68e` on 2026-09-15. Local implementation only: publication, production migration/deployment and live conversion tests are separate operator actions.

## Decision coverage — confirmed
- **Confirmed with Nick:** selected events; unchanged banner/settings; continue to completion using the final consent-respecting proposal.
- **Inherited from approved proposal:** current marketing consent synchronization; purpose-specific signed identity; exact signed funnel session/visitor attribution; 90-day lifetime; raw reference-only matching; `opt_out: true`; release flags initially off; OpenAI may suppress events that unchanged other providers send.
- **Implementation defaults:** bounded calls, service-only RPCs, stable canonical event IDs, terminal skipped status, additive migrations and focused tests.
- **Coverage acknowledgement:** after the final proposal, Nick instructed: “Well, do it. What's the problem here? Continue until you're finished and if you're blocked let me know so I can help you unblock.” This approves local implementation of the presented proposal. Earlier requests to disregard consent were not implemented.
- **Internal revalidation:** current implementation follows this narrowed scope. No banner, profile enrichment or other-provider policy changes. Source refreshed to `cf72e68e`; final verification is recorded separately from user acknowledgement.
- **Open consequential assumptions:** none for local implementation. Credentials, provider settings and production authorization remain activation prerequisites.
- **Undiscussed consequential assumptions affecting this handoff: none.**

## Behavior and integration journey
1. Existing marketing choice is read without changing its UI/storage format. With permission and acknowledged server state, the Pixel measures only canonical public landing routes.
2. Consent changes synchronize through a same-origin endpoint with a signed HttpOnly purpose-specific identity. Denial stops browser measurement immediately; stale grants cannot overwrite a recorded denial. Failed background synchronization is retried conservatively. Offline withdrawal cannot instantly reach the server; already in-flight reports cannot be recalled.
3. Exact signed funnel context is associated before checkout on a best-effort path bounded to one second. Private routes do not generate Pixel page views; source URLs exclude query and fragment data.
4. Canonical provider-confirmed trial/first-paid events create eligible OpenAI delivery rows. Current unexpired consent and event-time grant are checked before dispatch. Regrant does not revive old events; there is no historical destination backfill.
5. Operators see delivered, skipped or failed outcomes. Missing context, disabled rollout and invalid events skip; transient failures retry with stable IDs and original timestamps. Reporting failure cannot change payment/access outcomes.

No visible UI/copy/feedback change is in scope. Earlier consent mockups are historical planning evidence superseded by the user's unchanged-banner instruction; they are not application components.

## Architecture and files
- `src/lib/openai-ads/browser.ts` and `src/providers/openai-ads-provider.tsx`: Pixel lifecycle, existing consent events and bounded checkout handoff. Mounted once beside the existing consent UI in the root layout so settings changes on every route synchronize; Stripe and both PayPal checkout entry points await best-effort sync.
- `src/lib/openai-ads/server/{consent-cookie,context}.ts` and `/api/openai-ads/context`: HMAC identity, same-origin bounded input, no-store responses, raw reference parsing, exact-session resolver and cleanup.
- `20260915141251_openai_ads_consent_context.sql`: private service-only consent/context tables, revisioned RPCs, CAS grant fence, denial precedence, grant-time isolation and bounded expiry cleanup.
- `event-payload.ts` and `server/capi.ts`: documented OpenAI schema, validated amount/currency/time/source and bounded server-only transport. No contact or quiz enrichment; explicit personalization opt-out.
- Billing destination adapter, outbox, types, retry CLI and reconcile route: event-scoped dispatch, terminal skips and independent cleanup.
- `20260915141328_openai_ads_billing_delivery.sql`: additive destination/status constraints and existing guard extension. A new AFTER INSERT trigger at the common outbox boundary covers both SQL trial producers and JS producers atomically. This replaces the proposal's direct edits to the much larger trial capture function while preserving event selection. Optional trigger failures cannot roll back billing.

## Verification contract
- Payload/timestamp/money/reference validation, HTTP failure classification, idempotence and consent-skipped stats.
- Browser failure-closed behavior, late SDK/response races, explicit regrant vs stale state, private routes and bounded checkout.
- SQL producer parity for Stripe and PayPal trial/first-paid events; no changes to Meta selection. Real disposable PostgreSQL multiconnection grant/revoke and privilege tests supplement PGlite.
- TypeScript, changed-source lint, production build and installed skill scanners; final whole-tree correctness/structural review via the repository router and read-only Claude counterpart.
- Tests use fixtures/intercepted network; they do not prove live deployment, provider acceptance or attribution. Activation needs the private CAPI key, approved migrations/deployment, settings check and controlled provider evidence.

## Planning evidence and artifact disposition
Retain this plan, operator setup report and historical HTML/research decision evidence under `plans/openai-ads-conversions/` with the eventual PR. Transient review, logs and verification receipts remain outside the repository under `/tmp`. No unrelated work is included. Root checkout remains clean main.

## Activation and rollback
See [operator setup](../docs/openai-ads-setup.md). Existing Ads Manager Pixel `HQtJsN7wjuS5gYccnqd3vd` and trial/purchase definitions were observed on 2026-09-15. Installation of the conversions plugin is confirmed by the locally available skill. Account status and live receipt must be rechecked before claiming activation. Disable both rollout flags and redeploy to stop this integration.

## Full integration authorization — 2026-09-15
Nick explicitly instructed: “Well, do it. ... Continue until you're finished and if you're blocked let me know”. This follows the consent-respecting implementation proposal and the answer identifying consent integration as the remaining decision. Coverage is now **confirmed for the full local implementation**: current marketing consent for OpenAI, background synchronization with the stated offline limits, 90-day lifetime, reference-only matching, personalization opt-out, and release flags off until activation. Existing banner and other tracker semantics remain unchanged. Original event and scope approvals are preserved; this is the new acknowledgement for previously pending integration choices. Internal revalidation: source refreshed to `cf72e68e`; prior groundwork passed 34 tests; full integration verification is recorded in the final receipt. Undiscussed consequential assumptions affecting local implementation: none. Production migration/deployment/key provisioning still require their concrete operator steps after verification.

Implementation contract: complete browser provider, same-origin consent/context endpoint, private DB state, exact-session resolver, billing routing, regression/concurrency/browser verification, setup report and final review. API coordination: GET /api/openai-ads/context initializes signed consent identity and returns {revision,marketing,expiresAt}; POST {action:'choice'|'context',requestId,expectedRevision,marketing?,sourceUrl?}. Choice grants require matching revision (bootstrap true only rev0 or explicit user action); denial wins stale revision. Context never grants. Conflict409 returns acknowledged state; never silently retry a stale grant. Both responses no-store. Only exact signed funnel cookie associates attribution. Resolver returns eligible OpenAIEventContext or null, throws on transient store failure. Event-specific OpenAI candidate destinations are created once for new canonical events; sender/retries check current consent.

## Release authorization and review fixes — 2026-09-15
Nick replied “Okay let's do these steps” to the concrete activation sequence (secure key provisioning, production migrations, deployment and Ads Manager verification). Publication, merge and the migration-first deployment are authorized; both rollout flags remain off until the private key and provider settings are ready. Nick provisions the CAPI key directly in Vercel.

Internal revalidation: GitHub review identified two defects within the approved scope. Additive migration `20260915145322_openai_ads_canonical_test_exclusion.sql` checks the exact canonical funnel session's internal/field/partner classification at enqueue and dispatch, including already queued events. The browser clears its page-view marker when leaving public routes so returning to the same landing page records a new view. The consent endpoint is explicitly inventoried as public and bypasses session lookup using its exact path. These fixes preserve the approved event and privacy semantics. Previously applied migrations are unchanged.
