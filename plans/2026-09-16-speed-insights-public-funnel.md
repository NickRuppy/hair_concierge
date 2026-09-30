# Public funnel Speed Insights coverage

## Outcome and scope

Collect anonymous Vercel Speed Insights vitals for the public homepage (`/`), quiz (`/quiz`), and current landing paths (`/lp/haarplan`, `/lp/scan`), in addition to the seven app route groups already measured. The public routes are exact matches; no separate variant identifier is sent. The existing exclusion of auth, result, payment, admin, offer, archived or unknown landing paths, and all other paths remains in force. No UI flow, consent flow, payment, or server telemetry changes.

The existing instrumentation and privacy boundary were introduced in [the non-payment latency plan](2026-08-13-non-payment-latency-improvement.md). On 2026-09-16, the Vercel project reports Speed Insights enabled but `hasData: false`; the current production deployment serves `/_vercel/speed-insights/script.js`. Unauthenticated visits to all seven app paths redirect to `/quiz` or `/auth`, which the current filter drops. Vercel documents that vitals requests occur on tab blur or unload.

## Decision coverage

- **Status:** confirmed.
- **Confirmed with Nick:** “Proceed” in response to extending collection to the public funnel and its privacy notice; Nick subsequently clarified that landing and quiz variant paths should still be measured even without separate variant labels.
- **Inherited from evidence or contract:** only fixed public path labels may leave `beforeSend`; existing pre-consent measurement and seven app areas remain as previously approved.
- **Implementation defaults:** match the four named public paths exactly; retain the event's origin while replacing path, query, and fragment with a fixed path, so the `url` remains an absolute URL on all eleven included paths. The seven app areas previously returned relative URL labels; converting them consistently retains their canonical path labels and avoids relying on unverified ingestion of relative `href` values. Keep the SDK's route template behavior; the live script applies `beforeSend.url` to `href` but does not apply `beforeSend.route` to its route field. `/lp/scan` currently redirects to `/quiz`, so visits are measured at `/quiz`; the allowlist also covers `/lp/scan` if it serves a page again.
- **Open consequential assumptions:** none.
- **Undiscussed consequential assumptions affecting this handoff:** none.
- **Coverage acknowledgement:** Nick's 2026-09-16 “Proceed” to the public collection expansion, followed by the explicit clarification to measure landing and quiz variant paths without separate variant labels.
- **Internal revalidation:** task base `2b42dfb8`, production paths and SDK behavior checked on 2026-09-16. `/lp/haarplan` serves a landing and embedded quiz; `/lp/scan` currently redirects to `/quiz`; archived `/lp/scalp-check` returns 404 and `/lp/routine` redirects to `/`. Claude's initial plan review found an unjustified third path; Nick's later clarification resolves that scope choice. The absolute URL convention applies to every included route. Recheck if scope or data fields change.

## Work and checks

1. Extend `src/lib/observability/speed-insights.ts` with exact public route matching and absolute canonical URLs for all included paths. Preserve the seven app route groups and drop every other path. Add independent fixtures for query strings, fragments, both landing paths, `/quiz/results`, `/lp/haarplan/angebot`, archived/unknown landing paths, and sensitive routes in `tests/speed-insights-integration.test.ts`; observe a failing guard before implementation.
2. Update the Vercel paragraph in `src/app/datenschutz/page.tsx` to name homepage, quiz, and public landing paths alongside seven app areas, preserving the existing field and pre-consent disclosure. Update its regression assertion.
3. Run the focused test, TypeScript/lint or repository checks required by `ready-check`, and inspect the diff. Verify the public routes still render, and use the review router plus one Claude whole-branch review. A production data point requires deployment and a qualifying browser visit; no dashboard data claim follows from local tests.

The operator outcome is a review-ready branch with a narrow, disclosed collection boundary. There is no user-visible flow or feedback change, so a UI mockup and separate journey sign-off do not apply. Keep this plan in the branch; report the verification receipt at handoff and discard transient reviewer output outside the repository. Stop before commit, push, PR, merge, deployment, or production write without separate authorization.
