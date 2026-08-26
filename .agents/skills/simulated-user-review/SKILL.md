---
name: simulated-user-review
description: Persona-based browser review for Hair Concierge and similar product experiences. Use when Codex needs to simulate a motivated but non-expert user, navigate a local or preview flow with browser automation, assess German clarity, readability, explanation quality, recommendation fit, and trust, and return a report-ready qualitative review for local QA, pre-ship checks, or post-ship sanity reviews.
---

# Simulated User Review

## Overview

Run a first-pass product review from one stable user persona. Use this skill to catch rough inconsistencies, confusing wording, weak explanations, and recommendations that feel generic, mismatched, or hard to trust before a human reviewer has to do the first pass.

Load these references before starting:

- `references/persona.md`
- `references/rubric.md`
- `references/report-template.md`

## Inputs

Collect only the minimum needed to run the review:

- Target URL or clearly implied local app URL
- Target flow if the user names one
- Review mode: unauthenticated, authenticated, or both
- Optional auth details, seed state, test account, or repo-supported local dev login path
- Optional release context if the report should mention a branch, build, or shipment

If the URL is missing and cannot be inferred from the conversation or active dev setup, ask for it. If the app fails to load or access is blocked, stop and report the blocker instead of inventing observations.

## Workflow

### 1. Establish scope

Review one meaningful user journey end to end. If the user does not specify a flow, prefer the most important user-facing path for the change, usually onboarding, quiz completion, chat guidance, or recommendation presentation.

Decide the authentication mode before navigating:

- **Unauthenticated review:** Use for public marketing pages, quiz entry, lead capture, pricing, login, and redirect behavior.
- **Authenticated review:** Use when the user asks to test full functionality, profile, onboarding edits, chat, recommendations, saved state, subscription-gated pages, or anything behind an auth/paywall gate.
- **Both:** Use when a release touches handoff between public and private areas, such as quiz-to-onboarding, checkout-to-welcome, or login redirects.

For authenticated reviews, do not stop at the auth gate unless no safe auth path exists. For local and preview reviews, follow `docs/local-qa-access.md` — it is the contract of record for local QA access. In short:

- **Authenticated app surfaces** (`/chat`, `/profile`, `/routine`, `/scan`, `/tracker`, …): open `http://localhost:<port>/api/dev/login?next=<route>`. Requires `LOCAL_DEV_LOGIN_ENABLED=1` in `.env.local` and the `localhost` hostname (never `127.0.0.1` — it renders without hydrating). A 307 to `/quiz` from that URL means the flag is unset or the server predates it; restart the dev server.
- **Personal Plan stage UIs in isolation**: use the dev-only `/labs/*` harnesses (no auth needed), e.g. `/labs/personal-plan-stage-2?scenario=ready`.
- **Local post-payment handoff** (checkout → `/welcome` auth → `/plan-bereit` → `/plan-start`): the dev-login account can never reach this — it has app access but no enrollment, so `/plan-start` shows the unavailable state by design, and there is no supported seeded shortcut (the QA-owner RPC was retired). The only real local path is the test-mode checkout lane in `docs/local-qa-access.md` §3, which is currently blocked on internal-test analytics suppression for Meta/Customer.io — read its blocker note before using it, include the `/welcome` password/magic-link step in the reviewed journey, and report a blocker instead of improvising service-role seeding.

For a production Personal Plan Stage 1–5 review, use a valid shareable field-test campaign link supplied by the user or campaign operator:

1. Start in a fresh browser context at `/test/haarplan/<token>`. Never expose, log, or place the raw token in a repository artifact.
2. Complete the real Personal Plan quiz with the chosen persona. Verify the field-test banner remains visible through the result and offer.
3. Confirm that payment UI is absent and use **„Kostenlos mit meinem Plan fortfahren“**. This creates a limited field-test guest, attaches the prepared artifact, signs the browser in, and enters the same five-stage journey used after payment.
4. Continue through Stage 1–5 in the same browser context. Preserve the guest state long enough to test refresh and resume behavior, then discard any exported browser storage state after the review.

The field-test activation writes isolated production test state and consumes campaign capacity, but it does not create a payment, subscription, or commercial conversion. Do not use a customer account or invent a direct-login shortcut. If the link is invalid, expired, revoked, exhausted, or already opened inside an authenticated customer session, stop and request a valid campaign link or a fresh browser context rather than falling back to paid checkout.

#### Production post-payment route verification without a provider charge

Use this setup when the user explicitly asks to verify a production checkout-to-Personal-Plan handoff but a real Stripe or PayPal charge is unnecessary. It is an internal synthetic-entitlement test, not a payment-provider test. Production activation and production database writes require explicit authorization; ordinary invocation of this skill does not grant either.

1. Put the release behind the intended internal-only eligibility gate. Confirm migrations and the exact production deployment are ready before creating test state, and do not widen the rollout to customers for this review.
2. In fresh browser contexts, complete every relevant real production quiz through its actual result, offer, and checkout boundary. Stop before submitting payment. Record the exact lead ID, quiz kind, funnel session, and checkout correlation for each flow; never substitute a convenient older lead.
3. Create a separate confirmed QA identity for each flow. Prefer a repository-supported operator helper or narrowly scoped RPC. If none exists, use the minimum service-role operation needed to create app-recognized synthetic access. Never use a customer identity, expose the service-role credential, or make authorization decisions from user-editable metadata.
4. Correlate each QA identity only to its exact lead and funnel session, using a timestamp that satisfies the release cutoff. Mark every synthetic record with explicit internal-test metadata and a stable test kind such as `synthetic_post_payment`. Use non-colliding QA-only provider references only where the application schema requires them; they are not real provider records.
5. Preserve source truth. A legacy quiz must enter Stage 1 from the exact legacy lead and answers. A Personal Plan quiz must enter from its exact prepared Personal Plan artifact. Do not translate one source into the other merely to make routing pass.
6. Sign in as each QA identity in its own clean browser context and open the exact `/plan-bereit?lead=<lead-id>` route. Verify the readiness state completes, continue through `/plan-start`, and confirm the Personal Plan shell and Stage 1 load. Record that `/onboarding` was not visited.
7. Verify the durable source provenance after entry: the legacy case identifies `legacy_quiz_lead` plus the exact lead ID and no Personal Plan artifact; the Personal Plan case identifies `personal_plan_artifact` plus the exact prepared artifact. Check runtime errors for both journeys.
8. Revoke, expire, or schedule prompt expiry of synthetic access, according to the application's supported cleanup path. Confirm internal-test records remain excluded from customer analytics and operational payment handling, and leave the public rollout unchanged.

The report must label this as **synthetic post-payment application-state coverage**. It proves the application's eligibility, redirect, readiness, source-provenance, and Stage 1 entry behavior. It does not prove payment confirmation, provider webhooks, settlement, refunds, or provider-owned subscription lifecycle unless those events actually occurred and were separately verified. If exact lead-to-user correlation cannot be established safely, stop with a blocker rather than testing a different journey.

### 2. Use browser automation

Use the browser to navigate the experience directly. Re-snapshot after page changes, stay oriented to the active step, and record concrete evidence such as the screen, state change, and short text snippets that explain why a moment felt clear or confusing.

### 3. Stay in the default persona

Use the stable persona in `references/persona.md`. Do not invent a new personality for each run. If the flow requires answers that are not explicitly covered, choose the option closest to the default persona and note the assumption in the report.

Judge the product from that user's point of view:

- Is the German easy to follow?
- Does each step feel coherent with the last one?
- Are explanations practical and understandable?
- Do recommendations seem to reflect the answers that were given?
- Does the product feel honest about uncertainty and limits?

### 4. Evaluate with the rubric

Use `references/rubric.md` to classify what happened. Base findings on observed behavior, not on guesses about implementation. Separate:

- language or readability issues
- flow coherence issues
- explanation quality issues
- recommendation-fit issues
- trust or caveat issues
- usability friction

When evidence is thin, say so. If something feels wrong but the root cause is unclear, report the user-visible symptom first and keep the diagnosis tentative.

### 5. Produce a report-ready review

Use the structure in `references/report-template.md`. Keep the report high signal:

- Include an overall verdict
- Call out 2-3 strengths when they are real
- Prioritize the top findings instead of listing every minor nit
- For each finding, include location, what happened, why it matters, and a suggested fix
- Cap the main findings list at 5 unless the user explicitly asks for exhaustive output

## Guardrails

- Do not review from an engineer's perspective. Review from the user's experience first.
- Do not claim a recommendation is factually wrong unless the evidence is visible in the flow or the user asked for an evidence audit.
- Do not drift into medical or diagnostic judgment. If the product crosses into medically adjacent territory, flag the trust issue and recommend a second pass with `hair-care-expert`.
- Write the report in the user's current conversation language unless they ask otherwise. Preserve short original German UI snippets where helpful.
- Avoid vague praise. Positive notes should be as concrete as negative notes.
- If the journey is blocked early, return a blocker report rather than a fake full review.

## Deliverable

Return a report that another teammate can read without rerunning the flow. It should be ready to paste into a task, PR comment, launch checklist, or QA note with minimal cleanup.
