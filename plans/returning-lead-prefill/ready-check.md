# Ready-check receipt

Date: 2026-09-19

Branch: `codex/returning-lead-prefill`

Base: `origin/main` at `81e32e8b`

Product-content fingerprint: `a73b3ed599ce86b289756d156bbb0520dd91abe0893d14f8437bfab57e1e32ec`

Fingerprint scope: all changed and untracked task files relative to `origin/main`, excluding this ready-check receipt and `code-review.md` to avoid self-referential receipt hashing.

## Outcome checked

- Returning leads who choose **Antworten bearbeiten** use the ordinary quiz and existing name/email screens with token-bound saved values prefilled.
- An unchanged saved email with prior marketing consent can reuse that consent; the server independently validates the exact source lead, email, consent, and Edit marker.
- A changed email, missing consent, forged/stale inheritance claim, or unavailable identity context falls back to the existing explicit-consent path.
- **Mit meinen Antworten weiter** remains unchanged and continues directly to the saved result/current Scanner offer.
- No name or email was added to the browser quiz draft.
- Customer.io receives a fresh quiz-completion timestamp and, only for validated inherited consent, the source lead creation time as the consent timestamp proxy.

## Decision coverage

All settled product decisions in `plan.md` are represented. No new consequential choice appeared during implementation or review. Missing historical names remain blank; saved names and emails are editable; changing the email invalidates inherited consent; transient identity-context failure does not block quiz completion.

## Verification

- Test-first red evidence was observed for the missing consent-timestamp behavior and missing inherited-consent rejection before implementation.
- Focused Node coverage: 34 passed, 0 failed.
- Broader related Node coverage: 50 passed, 0 failed.
- Playwright Chromium returning-lead journey: 6 passed, including prefill, consent reuse, changed-email consent, Continue/Edit, revoked link, and context-failure fallback.
- `npm run typecheck`: passed.
- `npm run ci:verify`: passed, including lint and production Next.js build (206 static pages).
- `git diff --check`: passed.

The commit hook then applied formatting-only changes to four TypeScript files. The hook delta was inspected directly, the fingerprint above was refreshed to the committed bytes, typecheck passed inside the hook, and the focused Node and browser journeys were rerun against that formatted tree.

The lint phase reported five unrelated pre-existing warnings in scanner preview, onboarding, avatar, and agent files; there were no lint errors and none of those files are task-owned.

## Residual risk and exclusions

- Historical `leads.created_at` is the best available proxy for original consent time because the source model has no dedicated consent timestamp.
- Customer.io unsubscribe/suppression authority was preserved in code but not live-tested against the provider in this local implementation pass.
- No commit, push, pull request, merge, deployment, migration, campaign mutation, or production write was performed.

Verdict: **locally review-ready; unpublished**.
