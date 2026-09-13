# Partnerzugang robust: Zugang beim Claim, Neustart für bestehende Konten

Revision 2 · 2026-09-13 · Worktree `.worktrees/partner-access-robust` (`codex/partner-access-robust`)

## 1. Outcome and source context

**Bug (proven 2026-09-13):** invitation links only work for e-mail addresses without a Chaarlie account. For
an existing account with `profiles.onboarding_completed = true` the claim succeeds, the browser is sent to
`/quiz?partner=1`, `getAuthenticatedAppRedirect("/quiz", "ready")` (`src/lib/auth/intake-state.ts:65`)
bounces to `/chat`, `/chat` is subscription-gated, no partner grant exists yet, and the user lands on
`/reactivate?reason=expired`. The grant is only written by `activate_partner_access`, which needs the
partner quiz, which the redirect makes unreachable. Evidence: invitation `96c7a7e4` (Stefanie) claimed
08:05 UTC by pre-existing user `00765c28` (canceled subscription), `activated_at` null, funnel
`quiz_started_at` null, three logins in 35 minutes. Nick's own fresh-e-mail test activated normally.

Secondary fragility found in the same trace: the partner quiz, lead save and offer authorization are all
bound to the intent cookie plus an exactly matching funnel cookie (`src/lib/partner-access/journey.ts:53`,
`src/lib/partner-access/offer.ts:16`). Any cookie loss (other browser, in-app browser → Safari, cleared
site data) silently degrades the partner into the regular paid funnel or the "Zugang nicht verfügbar"
screen.

Superseded decision: `plans/2026-09-01-partner-access.md` §journey ("If the existing account already owns a
Personal Plan, activation grants partner access but does not overwrite its plan") is replaced by Nick's
2026-09-13 ruling below.

## 2. Chosen direction

1. **Grant at claim.** `complete_partner_access_claim` creates the indefinite `manual_access_grants`
   row (`reason = 'partner'`) the moment the invitation is bound to a user. The partner is an entitled
   user from that second on; the paywall can never route them to `/reactivate`.
2. **Fresh start on first claim, unless the account is currently paying.** The claim route decides
   `freshStart = !hasCurrentPaidAppAccess(user)` (provider subscription, one-time purchase or legacy
   profile period; manual grants never count) and passes it into the RPC. A fresh start puts the account
   into the state of a brand-new partner account: legacy onboarding flags reset, hair profile row removed,
   the `personal_plans` row upserted and pinned to the invitation with every current pointer cleared,
   open drafts/proposals/tester enrollments/result-return links closed. Plan history rows, leads, chat
   conversations, tracker entries and scans stay. Runs once per invitation (`fresh_start_at`); re-opening
   the same link later never resets; a new test round is a new invitation.
3. **Quiz stays mandatory for the plan.** Nothing about the quiz, result page or Stage 1 changes. The
   partner activation card still stamps `lead_id`/`activated_at`; it no longer creates the grant.
4. **User-bound partner journey.** Partner quiz context, lead save and offer authorization resolve from
   the authenticated user (`claimed_user_id = auth user`, `revoked_at IS NULL`) and take the funnel
   session from the invitation row. Cookies remain for analytics only. A revoked invitation makes the
   account an ordinary user again (regular quiz, regular offer), never a blocked one.
5. **Partner grant counts as independent access.** Where the middleware and the entitlement resolver
   re-check "independent paid access" after a moderator membership ended, an active partner grant
   satisfies that check too.

## 3. Scope and non-goals

**Changes:** migration (RPCs + one column), `journey.ts`, `offer.ts`, claim/activate/quiz-context/quiz-lead
routes, `billing/subscriptions.ts` (partner-grant predicate), middleware + `entitlements/access.ts`
moderator-ended branch, invitation and continuation clients (draft clearing), admin status derivation +
labels, invitation caption copy, docs, tests.

**Unchanged / non-goals:** quiz screens, result page layout, Stage 1–5 journey, middleware routing rules
other than §2.5, revoke semantics, e-mail templates, chat conversations, tracker entries, scans,
Merkliste, billing rows, auth users. No backfill of already-claimed invitations except the in-RPC
self-heal (T1). `user_memory_entries` is not a reset target: the table does not exist in production
(verified 2026-09-13 via `information_schema.tables`).

## 4. Target map

| Surface | Files |
| --- | --- |
| Migration | `supabase/migrations/20260913120000_partner_access_fresh_start.sql` (new) |
| SQL tests | `tests/partner-access-sql-execution.test.ts` (harness applies original + new migration) |
| Partner journey | `src/lib/partner-access/journey.ts`, `src/lib/partner-access/offer.ts` |
| Access predicates | `src/lib/billing/subscriptions.ts` (`hasCurrentPartnerAccess`), `src/lib/supabase/middleware.ts` (moderator-ended branch), `src/lib/entitlements/access.ts` (same) |
| Routes | `src/app/api/partner-access/claim/route.ts`, `activate/route.ts`, `quiz-context/route.ts`, `src/app/api/quiz/lead/route.ts` |
| Result page | `src/app/result/[leadId]/page.tsx` (drop funnel-cookie argument) |
| Clients | `src/app/partner/einladung/partner-invitation-client.tsx`, `src/app/partner/weiter/partner-access-continuation.tsx` |
| Admin | `src/lib/partner-access/service.ts`, `src/app/admin/partner-access/page.tsx` |
| Docs | `docs/partner-access-operations.md`, `docs/local-qa-access.md` |
| Tests | `tests/partner-access-{journey,quiz-context,claim-route,activation-route,service,ui,sql-execution}.test.ts*`, `tests/personal-plan-enrollment.test.ts`, `tests/auth-intake-state.test.ts`, `tests/auth-middleware-personal-plan-routine.test.ts` |

## 5. Decision coverage

Decision coverage: **confirmed**

**Confirmed with Nick (2026-09-13, this session):**
- D1 Fresh start on claim for an existing account: archive prior quiz/plan state, never delete history; billing and login untouched.
- D2 Access is granted at claim ("I don't care when, do whatever is robust").
- D3 The quiz remains mandatory to obtain a plan; only the access gate moves.
- A1 An invitee who is *currently paying* keeps their paid plan; no reset for them.
- A2 Fresh start happens only on the first claim of an invitation. Re-testing later = admin revokes and creates a new invitation. Re-opening the same link never resets.
- A3 Fresh start clears quiz + plan state only: legacy onboarding flags, hair profile row, plan pointers/drafts/proposals, nav lifecycle marks. Chat conversations, tracker, scans, Merkliste stay; old plan versions remain as history.
- A4 Copy: invitation caption gains "Hast du schon eins, startest du damit neu."; admin badges per mockup Variant B ("Zugang aktiv · Quiz offen", "Plan gestartet"). Nothing else changes visually.

**Inherited from evidence or contract:**
- A current paid source keeps precedence over the partner source: `findPersonalPlanEnrollmentForUser` order; `docs/partner-access-operations.md` ("Widerruf … entfernt keine unabhängig bezahlte Berechtigung").
- Partner activation still requires the exact `lead_id`/`activated_at` lineage for the Personal Plan — unchanged.
- Existing-account login stays the once-only mailbox link (security boundary from `plans/2026-09-01-partner-access.md`).

**Implementation defaults (no product consequence):**
- `fresh_start_at` column; RPC parameter `p_fresh_start boolean` and return column `fresh_start boolean`.
- Self-heal: a claimed invitation without an active grant and without `activated_at` (today's Stefanie row) receives grant + (paid-exempt) fresh start on its next claim call.
- Fresh start also closes: active `personal_plan_test_enrollments` / `regular_quiz_test_enrollments` of the user (status `revoked`) plus their tester grants, active `personal_plan_quiz_drafts` on the user's funnel sessions (status `expired`), and `personal_plan_result_returns` for the user's leads (`revoked_at`). These are technical consequences of "behave like a new partner account" (Codex F3, M2, M3).
- Funnel cookie is still issued at claim for analytics lineage; nothing reads it for authorization.
- A quiz draft left in a *different* browser from before the claim may prefill answers there; the draft has a TTL and the user can change answers. Accepted residual risk (Codex M1), no server-side reach into other browsers.

**Confirmed with Nick (2026-09-13, after Codex review, "good, start implementation"):**
- P1 Paying invitee who lapses later (Codex F2): the partner grant keeps the app open after the lapse, but the Personal Plan stays the paid one; a partner plan with a fresh start needs a new invitation at that point. Recommended: accept and document; alternative would be automatic re-pinning at lapse, which this plan does not build.
- P2 Browser draft clearing (Codex T1): clear the local quiz draft only when the claim performed a fresh start. Re-opening the link mid-quiz keeps progress. Recommended.
- P3 Partner quiz mode lifetime (Codex T3): after activation, a quiz retake by the partner stays in partner mode and updates the same partner lead; after revocation the account is a regular user. Recommended.
- P4 Owned products (Codex T4): `user_products` with `ownership_status = 'owned'` feed Stage 3. Recommended: archive them on fresh start (`'archived'`, recoverable) so the plan is built like a new account's; alternative: keep the inventory.

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick, 2026-09-13: "let's start fresh on claim … I don't really care when the access is granted … however it's robust"; quiz stays mandatory; A1–A4 and the mockup accepted with "to me, that sounds good"; P1–P4 recommendations and the journey accepted with "good, start implementation with subagents" (same session). Scope: partner-access flow only.

Internal revalidation: Revision 2 after Codex plan review (findings ledger §11). D1–D3, A1–A4 unchanged.

## 6. Designed user journey

**Actor:** invited creator, link received via WhatsApp or e-mail.

**Variant A — new e-mail (unchanged):** open link → card "Hi Lea, dein Zugang ist bereit." with e-mail → "Los geht's" → account created and signed in, grant written, quiz opens at step 1 → quiz → result page shows partner card "Dein Zugang ist bereit. Öffne jetzt deinen persönlichen Plan und deine Routine." → "Meinen Plan öffnen" → `/plan-bereit` → Stage 1.

**Variant B — existing account, not signed in (Stefanie today):** open link → same card, caption now also says an existing account starts over → "Los geht's" → "Schau kurz in deine E-Mails." → mailbox link → `/auth/confirm` → `/partner/weiter` ("Dein Zugang wird geöffnet …") → grant written, prior quiz/plan archived, browser quiz draft cleared → quiz opens at step 1 → as Variant A. Any later visit to `/chat`, `/routine`, `/anwendung` before the quiz is done routes to `/quiz`, never to `/reactivate`.

**Variant C — existing account, already signed in in this browser:** open link → card → "Los geht's" → no mailbox step → same as B from "grant written".

**Variant D — existing account with a Personal Plan (former launch subscriber, lapsed) or a former field-test moderator:** as B/C; the old routine, tester access and old result links stop being active; after the new quiz, Stage 1 builds a new initial need for the invitation. Chat history remains readable.

**Variant E — currently paying invitee (A1/P1):** claim binds the invitation and writes the grant, no reset; they land wherever their paid plan stands. If the subscription lapses later, the app stays open through the partner grant; a fresh partner plan needs a new invitation.

**Recovery states:** quiz abandoned → next login routes to `/quiz`, progress restarts from the cleared draft. Cookies lost / different browser after claim → quiz still runs in partner mode because the account is bound; lead save and activation succeed. Link revoked → invitation page says "Diese Einladung ist nicht verfügbar."; the account itself behaves like a regular user (regular quiz and offer). Same link re-opened after activation → `/quiz?partner=1` with the existing lead reused, no reset, draft kept (P2).

**Admin:** badge "Eingeladen" → after claim "Zugang aktiv · Quiz offen" → after activation "Plan gestartet" → "Widerrufen". Re-test recipe: Widerrufen, then create a new Zugang for the same e-mail.

Journey sign-off: **confirmed** (Nick, 2026-09-13, no corrections).

## 7. Planning evidence

- `plans/partner-access-evidence/partner-access-robust-mockup.html` — rendered before/after of the
  invitation card caption and the admin status badges. Selected: caption sentence added; badge
  Variant B. Evidence review: **confirmed** (Nick, 2026-09-13).
- No prototype: the state model is fully expressed in SQL functions with PGlite tests (T1).

## 8. Ordered tasks

### Task 1: Migration + SQL tests — grant at claim, fresh start, activation stamps

**Produces:** `supabase/migrations/20260913120000_partner_access_fresh_start.sql`; RPC signatures below.

- `ALTER TABLE partner_access_invitations ADD COLUMN fresh_start_at timestamptz`.
- `private.partner_access_fresh_start(p_user_id uuid, p_invitation_id uuid) RETURNS void`, revoked from PUBLIC/anon/authenticated:
  - `profiles`: `onboarding_completed = false`, `onboarding_step = 'welcome'`, `has_seen_completion_popup = false`.
  - `DELETE FROM hair_profiles WHERE user_id = p_user_id`.
  - `INSERT INTO personal_plans (user_id, enrollment_purchase_source_id) VALUES (p_user_id, p_invitation_id) ON CONFLICT (user_id) DO UPDATE SET enrollment_purchase_source_id = p_invitation_id, current_initial_need_version_id = NULL, current_refined_need_version_id = NULL, active_routine_version_id = NULL, pending_routine_proposal_id = NULL, unrefined_direct_accept = false, last_evaluated_source_fingerprint = NULL, last_rejected_auto_fingerprint = NULL, legacy_prefill_v1 = NULL, revision = personal_plans.revision + 1` (closes the in-flight creation race, Codex F6).
  - `personal_plan_refinement_drafts` `in_progress → stale`; `personal_plan_product_drafts` `active → stale`; `personal_plan_routine_proposals` `pending → superseded`; `DELETE FROM personal_plan_ui_lifecycle_marks WHERE user_id = p_user_id`.
  - `personal_plan_test_enrollments` and `regular_quiz_test_enrollments` of the user with `status = 'active'` → `status = 'revoked', revoked_at = now()`, and their `manual_access_grants` (`id = enrollment.manual_access_grant_id`, `revoked_at IS NULL`) → `revoked_at = now()`.
  - `personal_plan_quiz_drafts` `active → expired` where `funnel_session_id IN (SELECT id FROM funnel_sessions WHERE user_id = p_user_id)`.
  - `personal_plan_result_returns` → `revoked_at = now()` where `revoked_at IS NULL AND lead_id IN (SELECT id FROM leads WHERE user_id = p_user_id)`.
  - `user_products` `owned → archived` for the user (P4).
- `DROP FUNCTION public.complete_partner_access_claim(uuid, integer, uuid, uuid, uuid)` and recreate as `complete_partner_access_claim(p_invitation_id, p_token_version, p_claim_attempt_id, p_user_id, p_funnel_session_id, p_fresh_start boolean DEFAULT true) RETURNS TABLE (invitation_id, claimed_user_id, funnel_session_id, reused, fresh_start boolean)`; re-issue the REVOKE/GRANT lines. First completion: insert grant, set `current_manual_access_grant_id`; if `p_fresh_start`, set `fresh_start_at = now()` and call the helper. Reused path: if no active current grant and `activated_at IS NULL` and `fresh_start_at IS NULL` → same (self-heal, once). The helper runs inside the claim transaction; any failure rolls the claim back (no half-reset).
- `activate_partner_access`: reuse an active current grant; insert only when none is active; stamp `lead_id` and `activated_at`; lineage checks unchanged.
- `reactivate_partner_access`: create a new grant whenever `claimed_user_id IS NOT NULL`.
- Test harness: `migratedDatabase` applies the original migration, then the new one (upgrade path, function drop/recreate, grants). Extend `predecessorSchema` with `hair_profiles`, `profiles.onboarding_completed/onboarding_step/has_seen_completion_popup`, the extra `personal_plans` columns + `UNIQUE (user_id)`, `personal_plan_refinement_drafts`, `personal_plan_product_drafts`, `personal_plan_routine_proposals`, `personal_plan_ui_lifecycle_marks`, `personal_plan_test_enrollments`, `regular_quiz_test_enrollments`, `personal_plan_quiz_drafts`, `personal_plan_result_returns`, `user_products` (minimal columns).
- Tests:
  1. first completion with `p_fresh_start = true`: one active grant; profile, hair profile, plan pointers, drafts, proposals, marks, tester enrollments + grants, quiz drafts, result returns reset; plan row pinned to the invitation; `fresh_start = true`.
  2. completion with `p_fresh_start = false` (paying account): grant created, nothing reset, `fresh_start_at` null.
  3. replayed completion by the same user/funnel: `reused = true`, `fresh_start = false`, still one grant, pointers untouched.
  4. legacy state (claimed, no grant, `activated_at` null) self-heals once; a second call does not reset again.
  5. induced helper failure (e.g. a trigger raising on `profiles` update) rolls back the whole completion: invitation stays unclaimed, no grant row.
  6. activation after claim reuses the claim grant (count stays 1) and stamps `lead_id`/`activated_at`; revoke → reactivate of a claimed-only invitation creates a fresh grant; unique active-grant index holds across the sequence.
  7. existing "activation is replay-safe…" test updated for the new count semantics.

Completion: `npm run test:node -- tests/partner-access-sql-execution.test.ts` green.

### Task 2: User-bound partner journey, offer authorization and partner-grant predicate

**Consumes:** nothing new from T1 (reads existing columns). **Produces:** `resolvePartnerJourney({ getUser })`, `resolvePartnerOfferAuthorization({ userId, leadId })`, `hasCurrentPartnerAccess(supabase, { userId })`.

- `journey.ts`: load the invitation by `claimed_user_id = user.id AND revoked_at IS NULL` (unique index guarantees at most one). Found → `authorized` with `funnelSessionId` from the row. Not found (never invited or revoked) → `none`. `unavailable` only on read errors. Intent and funnel cookies are no longer read.
- `offer.ts`: row by `lead_id`, require `claimed_user_id = userId` and `revoked_at IS NULL`; `funnelSessionId` from the row.
- `billing/subscriptions.ts`: `hasCurrentPartnerAccess` = an unrevoked `manual_access_grants` row with `reason = 'partner'`, `user_id = userId`, `expires_at IS NULL`.
- `middleware.ts` moderator-ended/unavailable branch and `entitlements/access.ts` equivalent: `hasIndependentPaidEntitlement = hasCurrentPaidAppAccess || hasCurrentPartnerAccess` (Codex F4).
- `quiz-context/route.ts`, `api/quiz/lead/route.ts`, `activate/route.ts`, `result/[leadId]/page.tsx`: adapt call sites; remove `resolveFunnelSessionId` from the activate route.
- Tests: `partner-access-journey.test.ts` (authorized without cookies; revoked → none; other user → none; read error → unavailable), `partner-access-quiz-context.test.ts`, `partner-access-activation-route.test.ts`, `tests/auth-middleware-personal-plan-routine.test.ts` (ended moderator + partner grant → allowed; ended moderator without grant → still ended), lead-route partner branch.

Completion: a signed-in claimed user gets partner context with zero partner cookies; a revoked partner submits a regular lead.

### Task 3: Claim route + clients — paid exemption, fresh-start signal, draft clearing

**Consumes:** T1 RPC signature; T2 predicates.

- `claim/route.ts`: compute `freshStart = !(await hasCurrentPaidAppAccess(admin, { userId }))` before `completeClaim`; pass `p_fresh_start`; include `freshStart` (from the RPC result) in the JSON response. New-account claims always pass `true`.
- `partner-invitation-client.tsx` and `partner-access-continuation.tsx`: call `clearQuizDraft()` before `window.location.assign(destination)` when `freshStart` is true (P2).
- Tests: `partner-access-claim-route.test.ts` (paying account → `complete` called with `freshStart:false`; lapsed → `true`; new account → `true`; response carries `freshStart`), `partner-access-auth-continuation.test.ts`, `tests/partner-access-ui.test.tsx` (draft cleared only on `freshStart`).

Completion: a browser with a stale quiz draft starts the partner quiz at step 1 after a fresh-start claim and keeps its draft on a replay.

### Task 4: Admin status + copy

**Consumes:** grant-at-claim semantics from T1; Variant B labels.

- `service.ts` `derivePartnerInvitationStatus`: `invited` (no claim) · `claimed` (claimed, grant active, no `activated_at`) · `active` (activated, grant active) · `revoked` (revoked, or claimed/activated without an active grant).
- `admin/partner-access/page.tsx` labels: "Eingeladen", "Zugang aktiv · Quiz offen", "Plan gestartet", "Widerrufen".
- `partner-invitation-client.tsx` caption: "Damit erstellst du dein Chaarlie Konto mit dieser E-Mail. Hast du schon eins, startest du damit neu."; update `tests/partner-access-ui.test.tsx` and `tests/partner-access-service.test.ts`.

Completion: badge for today's Stefanie row after self-heal reads "Zugang aktiv · Quiz offen".

### Task 5: Enrollment, intake and routing regression guards

- `tests/personal-plan-enrollment.test.ts`: claimed partner with grant but no `lead_id`/`activated_at` → `emptyEnrollment`; claimed partner whose tester enrollment was revoked by fresh start → `emptyEnrollment` (not the old tester lead).
- `tests/auth-intake-state.test.ts`: profile after fresh start → `needs_quiz`; `/quiz` not redirected; `/chat` → `/quiz`.
- `tests/auth-middleware-personal-plan-routine.test.ts`: composed case paid-exempt partner (active subscription) is routed by the paid plan; lapsed partner with grant on `/chat` before quiz → `/quiz`.

Completion: suites green; no production code change expected beyond T2.

### Task 6: Docs

- `docs/partner-access-operations.md`: state table (four badges), what a fresh start clears and keeps, paid-exemption rule (P1), re-test recipe (revoke → create), self-heal note, post-revocation behavior (P3).
- `docs/local-qa-access.md` partner section: local recipe for the existing-account and former-moderator cases.

## 9. Verification

**Automated:** `npm run ci:verify` (typecheck, lint, node tests incl. the PGlite SQL suite; chat eval not required, no chat behavior changes).

**Manual (local dev, `npm run dev:worktree`, migration applied to local/branch DB):**
1. New e-mail → claim → quiz step 1 → result → partner card → `/plan-bereit`.
2. Existing account with `onboarding_completed = true` and a hair profile → claim → quiz step 1, not `/chat`; `/chat` mid-quiz → `/quiz`.
3. Existing account with a Personal Plan (dev account through Stage 3) → claim → quiz → Stage 1 builds a new need; `/routine` shows no old routine.
4. Cookie loss: after claim, log in with password in a private window and open `/quiz` → partner lead capture with locked e-mail; lead save + activation succeed.
5. Re-open the same link after activation → `/quiz?partner=1`, no reset, draft kept.
6. Revoke in admin → the account runs the regular quiz and sees the regular offer.
7. Admin badge transitions across 1–6.

**Migration / live state (post-merge, separately authorized):** `list_migrations` before apply (version
collision check), apply to prod, Stefanie's row self-heals on her next link open, Sentry check after
deploy per `CLAUDE.local.md`.

## 10. Review and handoff

- Branch: `codex/partner-access-robust` in `.worktrees/partner-access-robust`, base `f8c28328` = `origin/main`.
- Review gates: Codex plan review done (Revision 1 → 2, §11); then per `CLAUDE.md` finishing order (ready-check → Codex whole-branch review → `/ship`).
- Rollout risk: fresh start runs inside the claim transaction (all-or-nothing). Changed `RETURNS TABLE` needs `DROP FUNCTION` first; migration version must not collide.
- Artifacts: plan `commit`; mockup HTML `commit`; Codex review output `discard`.
- Stop point: draft PR via `/ship`; merge and production migration remain separate authorizations.

## 11. Findings ledger (Codex plan review, 2026-09-13)

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F1 paid exemption missing from T1 | defect | plan Rev.1 T1 reset unconditional vs A1 | accepted | T3 computes `freshStart` via `hasCurrentPaidAppAccess`; T1 takes `p_fresh_start` | Rev.2 |
| F2 paying invitee lapse leaves plan pinned to paid source | scope/product | `enrollment.ts:331`, `…paid_migration_admission.sql:687-691` | accepted by Nick (P1: document) | T6 | Rev.2 |
| F3 active tester enrollments override pre-activation | defect | `enrollment.ts:354-401`, routing RPC tester branch | accepted | T1 revokes tester enrollments + grants | Rev.2 |
| F4 ended moderator membership ignores partner grant | defect | `middleware.ts:498-505`, `entitlements/access.ts:135-145`, `subscriptions.ts:242` | accepted | T2 `hasCurrentPartnerAccess` in both branches | Rev.2 |
| F5 revoked invitation would block regular quiz | defect | `quiz-context.ts:31-34`, durable app_metadata | accepted | T2 revoked → `none` | Rev.2 |
| F6 in-flight plan creation race | defect | `stage1-service.ts:158-177` | accepted | T1 upserts the plan row pinned to the invitation | Rev.2 |
| M1 other-browser quiz draft | tradeoff | `draft.ts:145` | deferred | residual risk recorded (TTL) | Rev.2 |
| M2 `personal_plan_quiz_drafts` resumable | defect | `…quiz_drafts.sql`, resume route | accepted | T1 expires drafts on the user's funnel sessions | Rev.2 |
| M3 `personal_plan_result_returns` valid | defect | `result-return.ts:190-208` | accepted | T1 revokes returns for the user's leads | Rev.2 |
| M4 `user_memory_entries` legacy summary | defect | table absent in production (`information_schema`, 2026-09-13) | rejected | none; noted in §3 | Rev.2 |
| T1 draft clearing on every claim | scope/product | `draft.ts:145-150` | accepted by Nick (P2) | T3 clears only on fresh start | Rev.2 |
| T2 archive/delete wording | tradeoff | plan §2 | accepted | wording fixed in §2 | Rev.2 |
| T3 partner mode lifetime | scope/product | `lead/route.ts:178-209` | accepted by Nick (P3) | T2/T6 | Rev.2 |
| T4 owned products survive | scope/product | `user_products.ownership_status` | accepted by Nick (P4: archive) | T1 | Rev.2 |
| G1 migration-upgrade + privilege test | defect (test) | harness applies one migration | accepted | T1 harness applies both | Rev.2 |
| G2 rollback/interleaving tests | defect (test) | — | partly accepted | induced-failure test added; PGlite has no concurrency, race closed by design (F6) | Rev.2 |
| G3 composed routing tests | defect (test) | `middleware.ts:498-505` | accepted | T2/T5 middleware cases | Rev.2 |
| G4 lifecycle/recovery tests | defect (test) | — | accepted | T2/T3 revoked + re-invitation cases | Rev.2 |
