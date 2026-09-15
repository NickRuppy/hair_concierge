# Scanner page tracking repair

## Outcome and authorization
Nick approved keeping `/quiz` and explicitly tracking the scanner page experience: "Okay then fix it that way." This follows the read-only investigation and reviewed proposal. No end-user surface, copy, URL, checkout, timing, or payment behavior changes. Internal analytics reporting only; separate user-journey/mockup sign-off is not applicable.

## Decision coverage — confirmed
- Confirmed with Nick: shared URL; distinguish scanner quiz page viewed by assigned/displayed `scan_v1`; dashboard starts there; campaign attribution survives redirect; retry temporary identity loading failures.
- Inherited: signed server funnel identity, durable first-touch source; existing consent and test filters; one durable journey ID (90-day cookie), not browser visit. Meta StartTrial/Purchase definitions unchanged.
- Defaults: event `scanner_quiz_viewed`, version 1, explicit view ID, first question vs resumed position property, safe allowlisted campaign properties; count unique journey IDs. Retry bounded with timeouts; failures observable rather than silently relabelled organic.
- Open consequential assumptions: none. Broader entry-request measurement, visit IDs, new first-answer event, historical backfill and conversion replay excluded from this repair.
- Undiscussed consequential assumptions affecting this handoff: none.
- Coverage acknowledgement: Nick's explicit request above approves the narrowed tracking-only repair after choosing shared URL.
- Internal revalidation: source and affected live session prove entry `/lp/scan` -> scanner `/quiz` -> scanner offer; original dashboard incorrectly requires a rendered LP pageview. Prior Claude proposal review accepted entry/page/engagement distinction, UTM allowance, original-context authority, and avoiding expired touch as sole source.

## Contract
Event emits once per quiz mount when draft is ready and server-selected displayed package is scan_v1. It means the scanner quiz is displayed (including resume, explicitly labelled); it does not assert an answer. Emit with explicit server-validated journey identity and a safe original-acquisition snapshot. Keep legacy quiz_started for existing consumers. Never synthesize `$pageview /lp/scan`. Page-view events have per-mount IDs; charts dedupe by journey. Context GET returns only identity plus entry_path, issued_at, allowlisted UTM source/medium/campaign/content/term, test markers. Prefer durable funnel_sessions original entry/first_touch; signed pending touch only when matching and no durable source; no raw URLs, IDs for ads, or private data.

## Work
1. Context route: enrich safe response with original entry/campaign and test information, using existing signed context, and prohibit caching. No migration.
2. Browser context: bounded retries and timeout; failed bootstrap must be retryable; runtime late context updates register safely; queued events with explicit identities retain them. No broad stale registration across journeys.
3. Page telemetry: typed PH-only scanner_quiz_viewed, explicit view/flow/revision/context. No Meta/CustomerIO page event changes. Analytics must not block quiz rendering.
4. Dashboard: replace invalid LP-dependent primary and acquisition queries with scanner-page cohorts. During rollout include explicitly labelled legacy scanner quiz_started history alongside new page events, retaining the earlier start timestamp and labelling sessions without a new event as legacy; never invent page events. Shared cohort/selection for comparable main summary and offer milestones, independent optional offer-only drilldown retained only if already available. Preserve other charts/trial definitions. Missing upstream captures visible in health chart. Installer accepts exact previously published definitions and rejects unrelated drift; dry-run then validated live update under ongoing dashboard-fix authorization.
5. Tests: retry failure -> success, timeout/retry cap, explicit event attribution with delayed context, ordinary quiz emits no scanner event, mount/reload view IDs without journey inflation, campaign source survive consumed/expired touch via DB, no private fields, new+legacy cohort not doublecounted, scanner checkout without LP event counted in both relevant views. Actual PostHog query execution before dashboard write.

## Verification and review
Focused regression red/green, TypeScript/lint, browser proof with mocked vendor transport (no production fake events), query fixtures with independently expected values, live read-only query validation. Ready-check and one whole-branch Claude review; incorporate findings and refresh relevant checks.

## Release boundary
Implement and verify requested repair. Prior same-task make-live/dashboard authorization persists for the necessary reviewed dashboard correction and application release; exact-head CI and migration checks precede merge/deploy. No campaigns, Meta replay, or unrelated production mutation. Preserve prior retained worktree artifacts.

## Artifact disposition
Commit plan, source, tests and concise documentation. Transient review/test output outside repository.

## Final verification and findings
- Coverage remains confirmed under Nick's original acknowledgement above. Internal revalidation: no new product choice or surface change; signed identity, consent, trial and Meta contracts preserved.
- Browser: all four Chromium checks pass on isolated local transport: scanner redirect/cookie, prefetch, resume/back, scanner page event with campaign attribution. The optional transport check explicitly requires local vendor analytics in server and runner; normal routing tests remain enabled in their existing CI lane. Bot detection is disabled only inside this intercepted test.
- Deterministic red/green: original safe-context stub failed all three source/privacy cases; review regression failed both same-journey response-order cases before the identity-aware fix. Final focused and shared analytics suites pass: 91 tests, zero failures or skips. TypeScript passes; configured source lint passes (repository ignores scripts/tests).
- Actual PostHog SELECT-only fixtures match independently specified cohort, ordered funnel, offer, and missing-upstream expectations. Live preflight recognizes all sixteen current charts; four definitions change. Live queries count the known checkout in both repaired charts. No attributed v1 trial has arrived, so lifecycle metrics remain awaiting real telemetry.
- Whole-tree Claude correctness/structural review found same-journey POST-before-GET enrichment loss. Fixed identity-aware stale-response protection, awaiting an in-flight GET, and distinguishing an identity-only POST from completed acquisition lookup; two regression cases verify both arrival orders. Removed test debug logging and preserved cross-journey guards. Delta review recorded in transient release evidence.
- Test-isolation incident: one local QA journey reached the durable session table before endpoint interception was corrected. No lead/user/conversion was created. Exact row f5cf320e-43cf-45d5-92bf-72a33e6b9794 was marked internal with identity/time/fixture guards. Local server now uses an invalid service key, browser writes are intercepted, and all vendor requests are blocked. Do not treat this run as having zero production writes.
- Residual limits: historical absent events are not reconstructed; legacy quiz-start reporting is labelled. Consent-blocked traffic remains absent. Browser verification proves captured payloads with an isolated context fixture, not live Meta receipt or a genuine trial conversion.
