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

For authenticated reviews, do not stop at the auth gate unless no safe auth path exists. First look for a repo-supported test login, seeded account, Playwright auth helper, local dev login route, or documented QA credential. For Hair Concierge local development, prefer the supported local dev login flow when available, and verify that any required app-access state is seeded too, such as an active billing subscription row when middleware gates `/onboarding`, `/chat`, or `/api/chat`. For Hair Concierge production or preview testing, check for the reusable UX-audit account seeded by `scripts/ux-audit-create-test-user.mjs`; the script refreshes auth, profile, billing entitlement, and product usage, and prints the current test credentials. If no safe path exists, report exactly what is missing.

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
