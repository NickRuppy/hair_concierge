# Moderator tests through the organic quiz

## Outcome and source context

Follow-up to `2026-08-27-moderator-personal-plan-access.md` and PR #472. Nick wants the five existing moderators, including his account, to test the regular organic quiz and receive the new Personal Plan. He prefers login at the offer but explicitly permits login first if postponing authentication substantially expands the change. He rejected the extra post-login introduction screen. No further account reset is requested or allowed.

Source baseline: reviewed task head `6d4d3bc9`; refreshed `origin/main` is `69f1651d`. The relevant source directories are identical between those refs. This plan and evidence reuse the clean original task worktree; unrelated root untracked files and the original worktree's ignored Supabase metadata are preserved. Before implementation, branch from fresh `origin/main` in an isolated task worktree and carry these planning artifacts forward; do not republish the merged branch.

## Chosen direction

Invitation → email login → organic `/quiz` → existing organic result/offer → free activation → saved Personal Plan.

Keep authentication first, using the existing email login option; a password is not required. Remove the standalone introduction and automatically initialize a moderator quiz after authenticated account validation. No redesign of the ordinary login page or ordinary checkout.

Quiz-first login is possible, but deferred: it needs a secure anonymous-result claim across magic-link redirects, account switching and potentially different devices. This is more than changing a button. The existing guest organic test path cannot substitute: it creates a temporary Auth user instead of using the invited account.

## Scope, non-goals and authoritative contracts

- Preserve the existing invitation URL, campaign ID, token hash, five memberships, Auth IDs/emails, reset receipts and existing enrollment foreign keys. No campaign update or reissue is needed.
- Campaign remains `flow_kind=personal_plan`, `identity_mode=email_bound`. The destination stays Personal Plan; only the source of **new starts** becomes `default_organic` / `legacy-quiz-v1` / lead `quiz_kind=legacy`.
- The exact existing roster account owns the funnel session, quiz result and enrollment. No synthetic guest user, no identity transfer based on a typed quiz email.
- Access is still **2160 hours (90 elapsed days)** beginning at successful first activation, not login or quiz start. Replay never extends it.
- Retain existing `personal_plan_test_enrollments` and `personal_plan_test_members.enrollment_id` ownership contracts. Do not switch the campaign to `regular_quiz` (immutable type; different guest enrollment table).
- Organic initial need uses the existing `stage1_source_kind='legacy_quiz_lead'`, `stage1_source_lead_id=<owned lead>`, `prepared_artifact_source_id=NULL` contract. Do not fabricate a Personal Plan prepared artifact. The current enrollment table nevertheless requires `prepared_artifact_id NOT NULL`: add `quiz_source_kind` (`personal_plan` default, or `legacy`), replace that NOT NULL with a check requiring an artifact for Personal Plan sources and forbidding one for legacy sources, and admit legacy writes only for the exact email-bound moderator membership. Existing rows retain the default and their artifacts. The dedicated RPC and a database validation trigger must enforce campaign/member/lead/source consistency; browser roles keep no enrollment writes. Update nullable/discriminated readers before making organic entry reachable.
- Owner decisions: use a separate organic moderator RPC because its legacy source contract differs from the old artifact contract; leave the old RPC intact for in-flight users. Reuse `PERSONAL_PLAN_FIELD_TEST_ENABLED` as the existing shared test-entry gate; no additional flag. Disabling it affects test entry generally, not only organic moderators, and must not revoke activated access.
- In-progress `meta_personal_plan_v1` sessions retain their old quiz and activation contract. Dispatch by the persisted session package plus exact moderator intent, never an untrusted client package selector. Existing active enrollments still return to `/plan-start`.
- No reset, deletion, ban, paid grant rewrite, ordinary-customer checkout change or provider event. Suppress commercial test traffic through the existing field-test boundaries.
- No new promise of cross-device resume for an unfinished quiz. Returning to an activated plan through email login on another device remains required.

## Designed user journey

1. An invited moderator opens the **same invitation**. If signed out, the existing login page opens. They enter their invited email and select “Login-Link per E-Mail senden”, then open the fresh email link. Already signed-in eligible users skip login.
2. The account-return page validates the account and starts the organic test with an authenticated POST. A brief “Dein Haar-Check wird geöffnet …” state replaces the full introduction; no second start button on success. This operation initializes only a test funnel, never resets an account or activates access. Make retries/React remounts idempotent; GET/email scanners do not consume seats or start grants.
3. The standard organic quiz opens at its first question. Clear stale unrelated browser quiz answers exactly once for this new moderator session, before the quiz reads them. Reload/back in the same session retains current work. Preserve the organic questions, order, branching, assessment and lead-capture layout; the invited account remains authoritative. A different typed email is rejected with a correction message; it cannot change account ownership or link another person's lead.
4. The existing organic result/offer page is shown, including its current explanatory content. Its purchase slot and every purchase CTA are replaced by the moderator test action. Copy says “90 Tage”, “Keine Zahlungsdaten · kein Abo” and that the plan stays in the account. Never describe this as a temporary guest or seven-day test.
5. “Kostenlos mit Chaarlie fortfahren” activates once and leads into the current new Personal Plan onboarding. The user completes that normal flow. Their plan belongs to their existing account.
6. Returning later through ordinary email login or the invitation opens the existing plan; it does not restart the quiz or extend the 90 days.

Recovery and variants:

- Wrong/unconfirmed account: no quiz start; explain that the invited email is needed and offer the existing account-switch/login recovery. No roster email disclosure.
- Expired/used magic link: request a fresh link; retain the moderator return destination. This change does not implement one-time-link replay or general Auth redesign.
- Start failure: neutral error with explicit retry, no endless auto-loop and no paid-flow fallback.
- Activation failure: retain the result and allow retry, no payment, no guest fallback, no false success. Expired/revoked/missing intent yields the existing unavailable/re-entry recovery.
- Old ad quiz already underway: allow it to finish with its existing signed session. Do not delete or rewrite its answers. A genuinely new start uses organic.

## Planning evidence

`evidence/moderator-organic-journey/mockup.html` is a local, non-production annotated mockup of the organic first question and the offer's activation section, using the current quiz assets, question copy, offer hierarchy and brand colors. It also shows startup, wrong-account and activation-retry states. Other offer sections are intentionally condensed and clearly marked; the production page keeps them.

Question answered: is login-first acceptable when the redundant screen disappears and moderators see the organic quiz/offer with a saved-account 90-day activation?

Incorporated feedback: organic rather than ad quiz; no redundant introduction; existing email ownership; no additional reset.

Evidence review: **confirmed**. Nick reviewed the linked preview, requested a concise journey walkthrough, and then explicitly instructed “do it then, implement”.
Post-review user-journey sign-off: **confirmed 2026-08-27** for the six-step email-login → organic quiz → organic offer/free activation → saved 90-day Personal Plan journey. No extra intro and no account reset.

Execution: reuse this planning worktree on fresh branch `codex/moderator-organic-journey` from `origin/main` (`69f1651d`). Outcome and verification are the contracts below; no real moderator is to be reset or activated during testing. Release status must be reported separately from implementation status.

## Target map

- Entry/start: `src/app/test/haarplan/[token]/route.ts`, `src/app/test/haarplan/konto/moderator-account-page.tsx`, `moderator-account-entry.tsx`, `src/app/api/personal-plan/field-test/moderator/start/route.ts`.
- Ownership/dispatch: `src/lib/personal-plan-field-test/moderator.ts`, `moderator-journey.ts`, funnel session creation and signed intent/cookie readers.
- Organic persistence: `src/app/quiz/page.tsx`, `src/lib/quiz/{draft,store}.ts`, `src/components/quiz/quiz-lead-capture.tsx`, organic lead/preparation APIs located through their callers.
- Result/offer: `src/app/result/[leadId]/{page,result-client}.tsx`, `src/components/organic-plan-offer/organic-plan-offer.tsx`, `src/components/regular-quiz-field-test/activation-card.tsx`, `src/funnels/types.ts`.
- Activation: `src/app/api/personal-plan/field-test/moderator/activate-organic/route.ts` beside the existing moderator activate handler, a new service-only `activate_personal_plan_moderator_organic_test` RPC, existing legacy Stage-1 adaptation in `src/lib/personal-plan/persistence/{stage1-service,stage1-supabase}.ts`, access and return readers. Success returns `{ destination: "/plan-bereit?lead=<owned-lead-id>" }`, matching the existing card parser and old moderator response.
- Routing source: narrowly extend `private.personal_plan_get_own_routing_source()` so an active email-bound moderator enrollment may use its exact owned legacy lead. The current Personal Plan enrollment branch requires `lead.quiz_kind='personal_plan'`; leaving that predicate unchanged would activate access but fail to open the new plan. Keep both guest enrollment branches' checks unchanged and require matching campaign/member/enrollment ownership for this exception.
- Schema evidence: `supabase/migrations/20260827100624_personal_plan_moderator_email_bound_access.sql` and `20260813091352_regular_quiz_field_test_personal_plan_routing.sql`. Add a new migration; do not edit applied migrations.
- Reuse existing tests matching `moderator`, `regular-quiz-field-test`, `organic-plan-offer`, `auth-confirm-replay` and field-test journey contracts.

## Ordered tasks and acceptance

1. **Organic account ownership and activation contract, test first.** In a new migration, implement the enrollment source discriminator/check/trigger above, service-only `save_personal_plan_moderator_organic_lead`, and service-only `activate_personal_plan_moderator_organic_test` alongside the old implementation. Consume the existing confirmed user + campaign + signed session + exact owned legacy lead; persist `leads.moderator_campaign_id` and `user_id` atomically with `funnel_sessions.lead_id`. Do not accept ownership from contact-email input. Activate the existing enrollment/member/grant records transactionally, preserving locking/replay/expiry checks. The new handler and `moderator.ts` service wrapper return the normal plan destination; `private.personal_plan_get_own_routing_source()` and existing Stage-1 service consume the legacy lead without an artifact. Update every enrollment decoder selecting `prepared_artifact_id` to distinguish sources. Acceptance: source constraint rejects a null artifact for ordinary/Meta enrollment and an artifact for legacy; wrong user/campaign/session, expired/revoked intent, concurrent activation and replay tests pass; legacy activation reaches Stage 1 and old Meta activation remains unchanged.
2. **Authenticated organic start and persistence.** In the moderator start route and `createModeratorFunnelSession`, produce `default_organic` owned sessions and signed intent from the same invitation/member. In `moderator.ts:resolveModeratorIntent`, allow the exact organic pairing while retaining Meta. In `moderator-account-entry.tsx`, auto-POST after account resolution and reuse valid same-session initialization on retry; reopening the invitation creates an organic start even when the browser has an old Meta session. The old Meta endpoints remain available for an in-flight page to finish; no old session or answers are deleted. In `src/app/api/quiz/lead/route.ts`, branch on validated moderator identity before ordinary/guest save and call the dedicated legacy save RPC; do not enqueue legacy leads in the Personal Plan-only Customer.io outbox; keep the durable moderator marker and return before any commercial dispatch. In the client entry before navigation, clear the global `chaarlie:quiz-draft:v1` and in-memory quiz store once using a sessionStorage sentinel keyed to the returned, validated funnel session ID. Do not add global draft namespacing. In `src/app/quiz/page.tsx`, ensure the fresh-start boundary runs before draft restoration; reload/back for that same session must not clear current answers. Storage failure must not restore a stale draft or loop initialization. Acceptance: first question after login, no intro click, stale answers not restored, same-session reload/back safe, exact legacy lead ownership, no commercial dispatch/guest Auth, uninvited accounts denied.
3. **Organic offer integration.** In `src/app/result/[leadId]/page.tsx:285-315`, load `leads.moderator_campaign_id` and persisted funnel authorization for legacy leads too; do not gate those checks solely on `quiz_kind=personal_plan`. This preserves account-only result reads, active-member redirect and ended/unavailable states. Resolve this email-bound branch before `resolveRegularQuizFieldTestOfferAuthorization` in `server.ts`; the shared `default_organic` package alone is not enough to distinguish guest and moderator tests. Pass an explicit discriminated moderator context through `result-client.tsx` and `src/funnels/types.ts` to `OrganicPlanOffer`. At `organic-plan-offer.tsx:374-378` / `activation-card.tsx`, require the moderator-organic endpoint (never allow the guest default for this mode) and saved-account copy with a dynamic 90-day heading. Preserve ordinary and guest branches. Use the exact destination contract above through the updated routing source to the new plan. All header/footer/inline CTAs must target free activation. Acceptance: first-render/hydrated tests show no pricing fallback, seven-day/guest copy or guest endpoint; correct retry, expired/wrong-user rejection and saved-plan navigation.
4. **Verify and release without touching the roster.** Run the existing focused suites, TypeScript/lint/format and relevant browser contract tests. Verify a disposable exact-mode fixture through email authentication → organic quiz → owned result → free activation → new plan → a separate-browser return; never fill or activate Nick's account. Separately prove old Meta in-flight, existing active member, guest organic and ordinary paid users retain their routes. No Docker. Hosted fixture creation/cleanup must be explicitly scoped and recorded before any production writes; absence of hosted proof must be reported, not replaced by mocks.

## Verification and rollout

- Automated: exact identity and ownership, RLS/RPC grants, artifact adaptation, replay/locking/2160h, stale local draft, auth return, full first-render CTA gating, no external commercial events, old Meta and regular guest regression.
- Browser: desktop/mobile critical states against the reviewed mockup; one complete disposable fixture flow, then normal account return from a separate browser. Fresh magic-link verification is distinct from merely generating a token. No real moderator quiz/activation during verification.
- Live read-only preflight: current deployment/schema; exact campaign remains email-bound; membership/enrollment/plan counts and persisted session package distribution. Do not assume everyone is still ready. Keep already-started sessions functional.
- Migration: additive source column, scoped enrollment constraint change and service-only functions first; check schema and grants before deploying callers. Preserve the old RPC and live campaign. Before any legacy activation, old application rollback remains viable. After a legacy enrollment exists, rollback must preserve legacy enrollment readers/routing; prefer disabling new test entry with the shared flag and a forward fix. Never reset or delete enrollments to make old code work.
- Release gates remain separate: implementation-loop owns ready-check and request-code-review; explicitly authorized publication/merge/deployment stages must verify exact reviewed SHAs. Do not describe this planning artifact as shipped.

## Review and handoff

Preview checks: desktop quiz images load; desktop activation and mobile (390px) retry state rendered; mobile document width equals viewport width; preview console has no warnings/errors. Screenshots are retained beside the HTML. These are mockup checks, not application or backend verification.

Plan counterpart review: completed one Claude high-effort read-only pass; verdict “approve with revisions”. Verified and incorporated the legacy result-page authorization gate, browser-local draft sentinel, explicit moderator endpoint, durable lead marker and legacy Stage-1 source. Independently found the enrollment's NOT NULL artifact constraint, which the reviewer omitted; the scoped source-discriminator migration above resolves that instead of blindly copying the review's artifact-free insert. Dedicated-RPC and shared-flag decisions are explicit. Report archived outside the repository at `/tmp/moderator-organic-journey-claude-review-20260827.md`. No second review pass was run, and no implementation verification is claimed.

Artifacts: plan + HTML + browser proof screenshots = **commit**; transient Claude report = **archive outside repository**; temporary preview tabs = close unless retained for Nick's review. Implementation is now authorized. Publication, deployment and production verification must be accounted for separately; no account reset or real-moderator test activation is authorized by this follow-up.


## Implementation verification — 2026-08-27

Implemented on `codex/moderator-organic-journey`, base `69f1651d74fecc2873eb1345a75d1992612a7274`. No commit, push, migration apply or deployment in this implementation turn. No real account mutation.

- Dedicated organic save/activation, explicit source schema, legacy Stage-1 enrollment decoder and authenticated return routing implemented.
- Entry automatically opens organic quiz; invitation re-entry replaces an empty old Meta start with a new organic session, without deleting old sessions. Active accounts go to their saved plan. The initialized-session and one-shot draft markers prevent stale answers and preserve same-session retries.
- Organic offer uses account-bound free activation with 90-day copy. Wrong email, origin, campaign/session, ownership and persistence failures fail closed. Ordinary email deduplication excludes moderator-owned leads; result emails and commercial dispatch remain suppressed.
- Final SQL review found that legacy saves must not enqueue the Personal Plan-only Customer.io background job. Removed those inserts. The regression failed with one unexpected outbox row, then passed with none. Activation expiry is explicitly tested as 2160 elapsed hours and stable on replay.

Fresh checks: full Node suite 4,813 passed; focused moderator/guest/organic/access/result suites 141 passed; nested Personal Plan suite 706 passed; post-fix SQL migration suite 8 passed. TypeScript and production build passed. Repository lint passed with five pre-existing warnings and no errors. Tests overlap; counts must not be summed as unique coverage.

Browser proof uses the actual development components with a loopback-only fake Supabase configuration, not a hosted account: organic first question, desktop/free-only CTA inspection, 390px mobile activation retry with no overflow. The existing protected offer lab now has an explicit moderator scenario. `implemented-mobile-retry.png` and `implemented-offer-desktop.png` are implementation evidence, not hosted activation proof. The mobile viewport was reset afterwards.

Live read-only check: production advanced independently to `0a5cbdceeeec1f93a5cf2c54a05b5cb32a162e48` (#473 arrival-screen presentation only; no overlapping files in this task). The original campaign remains active/email_bound/personal_plan with five members, 2160 hours, zero activations. Nick remains ready without enrollment. The new source column is absent: this organic change is not live.

Remaining release gates: publish/reviewed merge, apply the migration before deploying callers, then a separately authorized disposable hosted email-login/full-plan/return-browser check. No claim of hosted end-to-end completion, fresh-email delivery or cross-device proof is made here. After any legacy activation, rollback must preserve the legacy readers and routing; do not roll application code back blindly or reset users.


### Final review disposition

One Claude Opus high-effort read-only whole-branch review completed (normal correctness/security plus structural lens). No confirmed hard defects. Root inspected all findings and the full integration diff.

- Email mismatch: retain explicit correction/rejection rather than silently substituting the authenticated email. The submitted contact email never determines ownership. Clarified the existing security boundary in the journey text; no account email rewrite or guest fallback.
- Customer.io legacy outbox: resolved by removing the unsupported job entirely. The reviewer initially described possible profile delivery; the actual dispatcher rejects `quiz_kind=legacy` before delivery, so the concrete defect was a failing retry job. New red/green SQL guard proves no job is enqueued.
- Missing discriminator column: deployment-order risk is real and explicitly gated. Added a code comment; do not mask a schema error as proof of no access or guess the quiz source. Migration must precede callers; after legacy enrollment, rollback must preserve the new reader.
- 90-day heading: intentionally fixed to this unchanged five-account, 2160-hour campaign. No speculative configurable campaign UI added.
- Review's missing production preflight/build are covered by the root's live read-only checks and successful build above. Hosted full-flow remains unverified. The reviewer reported one initial failure without a retained failure trace, then four passing reruns. Root's final focused and SQL runs pass; no flaky-test cause is claimed.

Reviewer report archived outside the repository at `/tmp/moderator-organic-code-review-20260827.md`. The final SQL/test, deployment comment and evidence/doc delta were reviewed by root and affected SQL checks rerun; no second counterpart pass was needed. Verification and review receipts use the same final manifest fingerprint and remain outside the repository to avoid a self-referential hash.
