# Returning-lead Edit identity prefill

Status: **implemented and locally review-ready; unpublished**. Base: `origin/main` at `81e32e8b` on 2026-09-19.

## Outcome

When a recognized returning lead chooses **Antworten bearbeiten**, the ordinary quiz remains unchanged but its existing name and email screens are prefilled from the exact completed lead bound to the return credential. The visitor confirms or corrects those existing fields instead of entering them from scratch. Existing marketing consent is reused only for the same email address; otherwise the existing optional consent screen appears. **Mit meinen Antworten weiter** remains unchanged and goes directly to the saved result/current scanner offer.

## Constraints and non-goals

- Reuse the existing regular-quiz name, email, and consent UI; add no new page or compact confirmation screen.
- Keep source identity server-authoritative and token-bound. Do not store name or email in the ordinary local quiz draft.
- Historical rows may lack a name. Prefill every stored value that exists and leave only a genuinely missing field empty.
- Name may be corrected normally. Email may be corrected normally, but consent recorded for the old address must not be inherited onto a changed address.
- Preserve the original consent timestamp/provenance when consent is inherited. Editing the quiz must not manufacture a fresh opt-in timestamp or bypass Customer.io unsubscribe/suppression state.
- Invalid, revoked, or temporarily unavailable identity context must never claim that saved identity or consent was loaded. At lead capture it degrades to the ordinary blank name/email screens and explicit consent prompt, so a transient prefill failure cannot trap an otherwise completable Edit.
- Do not change Continue routing, offer presentation, token lifetime, campaign selection, checkout, account creation, post-access missing-fact collection, or production configuration.
- Implementation and local verification are authorized. Commit, push, PR, merge, deployment, migration, Customer.io campaign changes, and production writes remain outside this request.

## Current gap

- `src/app/api/quiz/email-return/choose/route.ts` loads only `id, quiz_kind, quiz_answers` and returns only projected answers for Edit.
- `src/app/quiz/page.tsx` deliberately clears `lead.name`, `lead.email`, and `lead.marketingConsent` when the return link opens, then saves only answer progress before returning to `/quiz`.
- `src/lib/quiz/draft.ts` intentionally persists quiz progress only, so identity must be re-resolved from the HttpOnly return context rather than added to local storage.
- `src/components/quiz/quiz-lead-capture.tsx` therefore reaches the ordinary name/email/consent sequence with blank identity and always opens consent.
- `/api/quiz/lead` treats an email-return Edit as a fresh completion but currently cannot distinguish a consent newly answered in this run from consent inherited from the source lead. Customer.io consequently uses the new completion time as `consent_timestamp`.

## Chosen implementation

1. Add one reusable server-owned source-identity helper for a valid return cookie. It loads the exact source lead selected by the return credential and exposes normalized `{ name, email, marketingConsent, consentTimestamp }`. Both the Edit context route and lead submission validation use this helper; neither duplicates the source lookup.
2. Extend the existing email-return context route with an Edit-only response that requires both the fresh `customerio_scan_return_v1` funnel session and a scoped HttpOnly Edit marker whose signed value matches the current return cookie. The choice endpoint sets that marker only for Edit and clears it for Continue, so a stale funnel session from another return link cannot unlock identity. The initial prompt-status request continues to return status only.
3. On the ordinary lead-capture screen, recognize Edit through `useQuizFunnelPackageKey() === QUIZ_EMAIL_RETURN_PACKAGE_KEY`, load that context before showing the form, set the existing Zustand lead fields, and render the current name screen with its existing input prefilled. The following email screen is prefilled in the same way.
4. If the normalized email is unchanged and the source lead has consent, submitting the email skips the consent sheet and saves with an explicit client `inherited` provenance marker. The marker expresses which UI path occurred but is never trusted by the server. If the email changed, or source consent is false, continue to the existing consent sheet; either answer still proceeds normally.
5. In `/api/quiz/lead`, read the provenance marker from the raw request body before `leadSchema.parse` strips unknown keys, then independently recompute inherited eligibility from the valid return cookie, exact source lead, normalized source email, and stored `marketing_consent=true`. A stale, forged, or mismatched inherited claim returns `422 return_consent_unavailable`; the client clears the inherited attempt and opens the existing consent sheet so the visitor can answer explicitly. It never downgrades or promotes consent silently.
6. Allow Customer.io quiz sync to receive a separate consent timestamp. New consent continues to use the new completion time; inherited consent uses the source lead creation time, while the new completion retains its own `quiz_completed_at`. Customer.io suppression/unsubscribe remains independently authoritative.
7. Make bypass-consent recovery explicit. The inherited save starts from the email screen. A deliverability rejection keeps that screen and its correction UI visible, clears the inherited-attempt marker, and ensures a changed/retried address goes through consent. A generic failure stays retryable on the email screen. The dedicated inherited-validation rejection opens the existing consent sheet. No failure may leave `consentAnsweredRef` dirty or depend on `returnToEmailStep()` being called from the consent substep.

## Claude plan-review findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | Bypass-consent submission starts on the email substep while existing recovery assumed the consent substep | accepted | Added explicit inherited-save recovery and dirty-ref clearing | Focused route and browser tests pass |
| C2 | defect | Unknown top-level keys are stripped by `leadSchema.parse` | accepted | Read provenance from raw request body and recompute it server-side | Forged inherited-consent test passes |
| C3 | defect | Context and lead submission both need the same exact source identity | accepted | Added one reused server helper | Typecheck and focused tests pass |
| C4 | tradeoff | Exact runners and Edit recognition signal were implicit | accepted | Named `useQuizFunnelPackageKey()` signal and verification commands | Plan revalidated; no product change |
| C5 | tradeoff | A transient Edit-context failure blocked the ordinary lead-capture screens | accepted | Degrade to normal blank identity and explicit consent rather than a retry trap | Browser fallback test passes |
| C6 | defect | Server email-mismatch consent guard lacked direct coverage | accepted | Added resolved-source/different-email rejection test | Focused route tests pass |

No Claude finding required a new product, scope, architecture, or risk decision from Nick.

## Target surfaces

- `src/app/api/quiz/email-return/context/route.ts`
- `src/lib/quiz/email-return-server.ts` or a focused server helper for exact source identity
- `src/components/quiz/quiz-lead-capture.tsx`
- `src/app/api/quiz/lead/route.ts`
- `src/lib/customerio/quiz-sync.ts`
- `src/lib/customerio/quiz-traits.ts`
- focused email-return, lead-route, Customer.io, and browser tests under `tests/`

## Test-first and verification plan

1. Add focused failing tests proving:
   - Edit context returns the stored name, normalized email, and consent for the exact token-bound lead only after the Edit funnel session exists;
   - unchanged source email plus prior consent skips the consent prompt and submits inherited provenance;
   - changed email does not inherit prior consent and uses the existing consent prompt;
   - the lead API rejects forged/stale inherited consent and accepts the exact source identity;
   - Customer.io keeps the original consent timestamp while recording a fresh quiz completion timestamp;
   - missing historical name remains empty while email is prefilled.
2. Run the focused tests before implementation with the repository runner and record that they fail for the missing behavior: `npm run test:node -- tests/quiz-email-return-context.test.ts tests/regular-quiz-field-test-lead-route.test.ts tests/customerio-quiz-sync.test.ts tests/customerio-quiz-traits.test.ts` (adjust the new context test filename if a neighboring test is extended instead).
3. Implement the smallest server/client changes above, then rerun those focused tests, `npm run test:node` for the broader Node suite, the configured Playwright command for `tests/quiz-email-return-browser.spec.ts`, and `npm run ci:verify`.
4. Run the worktree app and inspect the real flow in a browser for at least:
   - saved name/email + consent true;
   - saved name/email + consent false;
   - missing name;
   - edited email;
   - Continue regression.
5. Confirm from the current Customer.io contract or provider behavior that setting the `marketing_consent` trait does not override an independent unsubscribe/suppression flag; treat an unavailable confirmation as a residual risk, not as permission to resubscribe.
6. Run `ready-check`, then the repository `request-code-review` router. Because this touches token-bound identity and consent provenance across multiple source files, include the required read-only Claude whole-branch code review before review-ready handoff.

## Decision coverage

Decision coverage: **confirmed**.

- **Confirmed with Nick:** Edit uses the ordinary quiz screens; saved quiz answers, name, and email are prefilled; the visitor briefly confirms them by continuing through those existing screens; genuinely missing historical values alone remain empty; existing consent is preserved and the optional consent prompt appears only when consent is absent; Continue skips the quiz and identity screens and goes directly to the current offer.
- **Inherited from evidence or contract:** the personal return credential identifies one exact completed lead; local quiz drafts intentionally exclude identity; marketing consent belongs to an email identity and Customer.io suppression/unsubscribe remains authoritative; the existing lead API creates a fresh completion for Edit.
- **Implementation defaults:** resolve identity server-side from the existing HttpOnly return cookie; require the Edit funnel session plus a same-link HttpOnly Edit marker before returning identity or inheriting consent; compare normalized emails; preserve source `created_at` as inherited consent provenance; fail closed on unavailable or mismatched context; reuse existing loading/retry treatment.
- **Open consequential assumptions:** none.
- **Undiscussed consequential assumptions affecting this handoff:** none.
- **Coverage acknowledgement:** Nick approved “Edit = normal quiz journey, fully prefilled; Continue = straight to the offer,” then explicitly clarified that both name and email should use the existing screens and be prefilled for brief confirmation. He accepted the resulting plan on 2026-09-19 and requested Claude review followed by implementation.
- **Internal revalidation:** current `origin/main` at `81e32e8b` was inspected on 2026-09-19. The existing implementation returned answer prefill only, cleared lead identity on return entry, and always routed regular capture through consent. Claude Opus 4.8 reviewed the plan and complete worktree read-only at high effort. The plan findings were incorporated; the code review found no hard defects. Its two actionable residual items—non-blocking fallback when identity prefill is unavailable and direct server email-mismatch coverage—were implemented and reverified without altering the approved successful journey or opening a new consequential decision.

## Execution handoff

Implement sequentially in `codex/returning-lead-prefill` because client prefill, server validation, and consent provenance share one contract. Keep the plan and verification receipts with the branch. Claude plan review output is transient unless a material finding needs durable documentation.
