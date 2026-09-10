# `freemium_scanner_first` flag-flip runbook

The freemium scanner-first restructure (`plans/freemium-scanner-first/plan.md`, PR1-PR6) ships
entirely behind one server-read flag: `FREEMIUM_SCANNER_FIRST_ENABLED`
(`src/lib/entitlements/flag.ts`). Every PR1-PR6 task shipped with the flag OFF in production.
This runbook is the reversible operation that turns it ON — and back off again. On Vercel that
is TWO steps in each direction (set the env var, then redeploy), not one; see "The flip".

**Full-switch semantics (ruled):** no percentage rollout, no per-user cohorting. The flag is
the switch, for every new user, everywhere it is read, at once.

## What flipping the flag actually changes

With `FREEMIUM_SCANNER_FIRST_ENABLED=true`:

- **New users** completing the Personal Plan quiz land on the free-registration flow
  (`/registrierung` → magic link → `/auth/confirm` → `/scan`) instead of the paid offer reveal.
  Single switch: `resolveQuizCompletionDestination` (`src/lib/auth/free-registration.ts`),
  the only call site is `personal-plan-quiz.tsx`'s `onSaved` handler (verified — see
  `.superpowers/sdd/plan/task-19-report.md` §"Cutover verification").
- **Any authenticated user with no paid access** (this new free-registration path, or anyone
  who is otherwise signed in without a subscription/one-time/moderator grant) is admitted to
  the app shell instead of being redirected to `/reactivate`: `/scan`, `/chat`, `/routine`,
  `/anwendung`, `/profile`, `/tracker`, `/api/scan` (`FREEMIUM_ADMITTED_ROUTE_PREFIXES`,
  `src/lib/supabase/middleware.ts`). They see the same five-tab nav as a paying customer, with
  lock markers on the premium-gated tabs (`navigation-access.ts`).
- Premium-gated API mutations stay denied per
  `plans/freemium-scanner-first/enforcement-matrix.md` (save/wishlist writes, `/api/chat` POST,
  Haar-Check edits, Stage-1 previews, …); `/api/scan/resolve|search|submit` are free by design.
- **Existing subscribers, lapsed subscribers, field-test guests and moderators** are unaffected
  beyond the keepsake read carve-outs already ruled and shipped in T17 (lapsed users keep
  reading profile/Merkliste/routine; field-test and moderator quiz completions keep the paid
  reveal — `freeRegistrationFunnel = freemiumScannerFirst && !fieldTest && !moderator`).
- **Legacy offer routes stay routable regardless of the flag** — `/pricing`, `/lp/<slug>` (incl.
  `/lp/<slug>/angebot`), `/result/<leadId>/reveal` never consult the flag at all
  (`src/lib/auth/route-classification.ts`'s `classifyRoute` takes no flag input), so this is
  true by construction, not by test discipline alone.

With the flag OFF (today, and after rollback): every one of the above is byte-identical to the
pre-restructure funnel. See "Stealth-control finding" below for what "byte-identical" does and
does not still mean for the scanner specifically.

## Stealth-control finding (T19 first sub-step)

The plan's T19 brief assumed the scanner might still be sitting behind the original
"LIVE in stealth since 2026-08-20" nav-tab-comment control (`plans/scan-public-launch.md`,
`PR #455/#457/#458` era) and asked to locate and name it before touching anything.

**Finding: that control no longer exists.** `plans/scan-public-launch.md` ("Produkt-Scan —
Public Launch") already executed the full de-stealth for every existing paid Personal-Plan
user, and shipped as `f61a7c64` — `feat(scan): Produkt-Scan Public Launch — fünf feste Tabs,
Erfolgs-Flow, Retention (#487)`, merged to `main` on 2026-09-01. That commit is an ancestor of
this branch's base (`d2efa414`), i.e. it predates the freemium-scanner-first work entirely.

Verified directly in the current tree (all unconditional, no flag involved):

- `src/lib/personal-plan/navigation-access.ts`: `PERSONAL_PLAN_NAVIGATION_ITEMS` lists
  `chat, routine, scan, application, profile` unconditionally for every real Personal Plan
  journey access — no commented-out entry, no stage gate (product ruling 2026-08-31: "the
  navigation never changes composition").
- `src/app/scan/layout.tsx` calls `schedulePersonalPlanNavSurfaceVisit(navigation, "scan")` —
  the unvisited-dot clearing that scan-public-launch.md's Task 2 added; the "would leave a
  permanent dot after launch" stealth comment is gone.
- `src/lib/auth/intake-state.ts`'s `isPersonalPlanOnboardingBypassRoute` already includes
  `/scan` (Task 3 of that plan).
- `next.config.ts` already noindexes the bare `/scan` path, not just `/scan/:path*` (Task 5).

**Consequence for this task:** there was nothing left to "de-stealth" for the _existing paid_
population — that population has had a fully public, discoverable scanner since 2026-09-01,
independent of `FREEMIUM_SCANNER_FIRST_ENABLED`. The only population the flag still gates out
of the scanner today is a signed-in user **with no paid access at all** — which, before this
restructure, includes every new user (since there was no way to be signed in without paying).
That gate is not a "stealth" mechanism in the PR #455 sense (a feature hidden from entitled
users); it is the ordinary paywall (`SUB_REQUIRED_PREFIXES`), and flipping this flag is what
turns it into the intended freemium admission for exactly that population, via
`FREEMIUM_ADMITTED_ROUTE_PREFIXES` / `shouldRedirectToReactivation`
(`src/lib/supabase/middleware.ts`, built in T2, PR1). No additional nav or route-guard code
needed to be added or changed for de-stealth in T19 — it was verified, not built.

This is also why "flag off: stealth exactly as today" (binding constraint) is automatically
true: the nav composition and the admission carve-out are the only two places the flag is
consulted for visibility, both fail safely to the pre-existing behavior when the flag reads
`false`/unset (verified in `tests/freemium-cutover-journey.test.ts` and
`tests/freemium-admission-middleware.test.ts`).

## Preconditions (verify ALL before flipping)

1. **Migrations applied** to the target Supabase project (`pqdkhefxsxkyeqelqegq`), in order:
   - `supabase/migrations/20260905090000_scan_free_reveals.sql` (T7 — reveal-credit ledger)
   - `supabase/migrations/20260910090000_freemium_plan_admissions.sql` (T14 — freemium
     enrollment admission)
   - `supabase/migrations/20260910091500_leads_free_provisioning_terminal_outcome.sql` (T18
     fix round 2, N3 — provisioning terminal-outcome marker; code degrades safely if this one
     specifically is missing, but ships stale Sentry noise on every stuck-free-account render
     until applied — do not skip it)
   - `supabase/migrations/20260910120000_leads_free_registration_provenance.sql` (PR6 review,
     V3 — `leads.free_registration_requested_at`, the server-side provenance `/auth/confirm`
     branches on). **This one is hard-required, not degrade-safe:** without the column the
     bind-evidence read errors, every free confirm fails closed, and free registration lands
     on `/scan?konto=bestehend` with nothing provisioned. Apply it BEFORE the flip.

   Verify with the Supabase MCP `list_migrations` against the target project before flipping;
   this session had no live Supabase access, so these are _documented as required_, not
   confirmed applied. Apply in this exact order (each migration's own header states its
   dependencies).

2. **`FUNNEL_COOKIE_SIGNING_SECRET` (≥16 chars) is set** in every environment where the flag
   will be on. It already is in production (funnel attribution requires it). This is the
   signing key for the free-registration correction capability (T18 fix round 1, W1a) under
   the domain separator `:free-registration-correction:v1`
   (`src/lib/auth/free-registration-capability.ts`, same idiom as
   `src/lib/partner-access/intent.ts`). **If unset, the correction path silently degrades**:
   no HMAC capability is minted at quiz completion, and `/registrierung`'s "Andere
   E-Mail-Adresse" goes straight to the honest `correction_blocked` refusal screen — sending
   and resending the magic link are unaffected. The same refusal is expected (by design, PR6
   review V1) whenever the save RPC REUSED an existing lead rather than creating one — an
   identical e-mail and identical answers inside 15 minutes — so a support report of
   "correction refused on my second attempt" is not necessarily a missing secret. This has no user-visible failure mode in a
   preview/local environment that never sets it (it degrades, it does not error), so verify
   the secret explicitly rather than trusting the absence of an incident.

3. **Stripe/PayPal test-mode verification state.** The in-sheet contextual purchase completion
   (T14) must have a green local/test-mode purchase on record for this branch (see T14's
   report / `docs/local-qa-access.md` §3's caveat about analytics side effects from a local
   test purchase — verify the destination env keys before running one). Confirm before
   flipping in any environment that will see real purchase attempts:
   - Stripe test-mode webhook delivery is healthy for `checkout.session.completed`.
   - PayPal completion lands in the same contextual finish (no bare `/welcome` navigation from
     the sheet — T14's rewrite of the PayPal button).
   - The standard price catalog (`src/lib/stripe/pricing-plans.ts`, 14,99 / 34,99 / 99,99) is
     what the sheet actually serves, independent of the launch-pricing flag (T13's pinned
     assertion — re-verify live, not just in `test:node`).

4. **The standard-test-account journey drive, and Nick's explicit go.** Re-drive the plan's §6
   journey on the environment about to receive the flip, using the standard test account
   (complete profile, products, wash days — Nick's stated requirement in plan §9
   "Evidence-sensitive"): quiz → registration → magic link → `/scan` → a mismatch verdict → the
   reveal CTA → a proactive trigger → the sheet → a real test-mode purchase → provisioned
   Routine/Anwendung. Capture screenshots per the plan's evidence-sensitive pass. **Do not flip
   without Nick's recorded GO** — this is evidence-sensitive by the plan's own §9 ruling, not a
   mechanical checklist item.

5. **Full automated suite green** on the exact commit being deployed: `npm run ci:verify` +
   `npm run test:node` (only the pre-existing, unrelated
   `tests/billing-plan-change-route.test.ts` reporter-format failure is expected) +
   `npx tsc --noEmit`.

## The flip

> **An env-var change on Vercel is NOT live on its own** (PR6 Codex review, finding V6). Vercel
> binds environment variables to a DEPLOYMENT: changing a value in the project settings affects
> the next deployment that is built, and every function of the currently promoted deployment
> keeps serving the value it was created with. Both the flip and the rollback below are
> therefore two steps — set the variable, then redeploy — and both have a window in which the
> old behaviour is still being served.

1. Confirm the reviewed PR6 head is what is actually deployed (Git SHA == Vercel production
   deployment SHA) — do not flip against a stale deployment.
2. Set `FREEMIUM_SCANNER_FIRST_ENABLED=true` in the Vercel project's environment variables, for
   the Production environment only. Nothing changes for live traffic at this point.
3. **Redeploy production so the new value is bound.** Either redeploy the current production
   deployment from the Vercel dashboard (Deployments → the promoted deployment → Redeploy,
   with build cache reuse) or push/promote the same commit again — `vercel redeploy <url>` or
   `vercel --prod` from the reviewed head. Do NOT redeploy a different commit than the one
   verified in step 1.
4. **Wait for the new deployment to be promoted, then verify.** Until promotion completes, the
   old functions are still running with the flag off, so quiz completions in that window still
   land on the paid reveal — expect a mixed-behaviour window of roughly the build+promote time,
   and do not read it as a failed flip. Once promoted,
   `process.env.FREEMIUM_SCANNER_FIRST_ENABLED === "true"` is read fresh on every request
   (`isFreemiumScannerFirstEnabled()`, Edge-safe, no caching), so there is no further
   propagation delay inside the new deployment.
5. Confirm on the live site that a fresh quiz completion routes to `/registrierung`, before
   working through the smoke checklist below.

## Post-flip smoke checklist

Run immediately after the flip, on production, before calling it done:

- **New-user journey**: fresh quiz completion → `/registrierung` (not the paid reveal) → magic
  link → `/auth/confirm` → `/scan` (not `/reactivate`) → five-tab nav with lock markers → a
  mismatch verdict shows the masked comparison table → first reveal CTA works → a second
  mismatch shows "Was passt stattdessen?" → the sheet opens with `{feature: "empfehlungen"}`.
- **Premium regression**: an existing paying user's journey is unchanged — five tabs (already
  true pre-flip per the stealth finding above), no lock markers, `/api/scan/save` and
  `/api/scan/wishlist` still work, chat still works, Haar-Check edits still work.
- **Lapsed keepsakes**: a lapsed subscriber can still read `/profile`, the Merkliste
  ("Gemerkt"), and their routine (no bounce to `/reactivate` on those reads); a mutation
  attempt on a premium surface still 403s / prompts payment.
- **Purchase completion**: one real test-mode purchase from the sheet completes in-sheet,
  activates entitlement, provisions the initial routine, and lands the buyer on unlocked
  Routine/Anwendung content immediately (T14's "no dead ends" contract).
- **Legacy offer routes**: `/pricing`, `/lp/<slug>`, `/lp/<slug>/angebot`,
  `/result/<leadId>/reveal` (an existing shareable link) all still load normally — confirms the
  "legacy offer routes remain routable" constraint held live, not just in `classifyRoute`'s
  static test coverage.
- **Sentry / PostHog**: no new error cluster in the first smoke window; `scan_started` /
  `scan_result_shown` and the free-registration funnel events are flowing.

Any smoke-checklist failure is a rollback trigger — see below, not a "monitor and see."

## Rollback = flag off + redeploy

1. Set `FREEMIUM_SCANNER_FIRST_ENABLED=false` (or unset it) in the Vercel project's Production
   environment. **This alone changes nothing for live traffic** — see the note under "The
   flip": the promoted deployment keeps serving the value it was built with.
2. **Redeploy production immediately** (same two options as flip step 3). This is the step that
   actually rolls back, so treat the rollback's clock as "set + redeploy + promote", not "set".
   Until the new deployment is promoted, the free funnel is still live: new free accounts can
   still be created in that window (they persist — see below), so if the rollback trigger is
   user-facing damage rather than a metric, prefer the fastest promotion path available and do
   not assume the flag "took" the moment it was saved.

   If a redeploy is not possible fast enough, the only faster levers are Vercel-level (roll back
   to the last deployment that was BUILT with the flag off — Deployments → an earlier production
   deployment → Promote), which is a code rollback, not a flag rollback: it also reverts to that
   deployment's code, so only use it knowingly.

3. Confirm: a fresh (or repeat) quiz completion now routes to `/result/<leadId>/reveal` again;
   a signed-in user with no paid access is redirected to `/reactivate` from `/scan` and every
   other admitted route; nav for that user reverts to the legacy shell (no five tabs, no lock
   markers).
4. Confirm existing paying users are unaffected throughout (their nav/access never depended on
   the flag — see the stealth-control finding above).

### What rollback does and does NOT undo

**Does NOT undo (persists after rollback):**

- Free accounts already created while the flag was on (Supabase auth users, `leads` rows bound
  to them, `hair_profiles`, provisioned `personal_plan_need_versions` snapshots). These users
  keep whatever data they accumulated; they simply lose the ability to sign up via the free
  path again until the flag is re-enabled, and they are no longer admitted past the paywall on
  their next visit (their existing account has no paid access, so `/scan` etc. now redirect
  them to `/reactivate` like any other non-paying signed-in user).
- Reveal credits consumed (`scan_free_reveals` ledger rows) and any Merkliste
  (`scan_wishlist`) entries created by free users during the window.
- Any completed purchases and the resulting Personal-Plan enrollments/provisioned routines
  (T14's freemium-purchase → enrollment → provisioning chain) — these buyers are now ordinary
  paying customers regardless of the flag and are entirely unaffected by rollback.
- Any Sentry/PostHog/analytics events already emitted during the window.
- The three migrations — rollback is a flag change only; no migration is reverted, and none of
  the schema added is destructive to roll back independently even if ever desired (out of
  scope for this runbook).

**Does undo (reverts immediately on flag-off):**

- The free-registration entry path itself — `/registrierung` returns 404 again (its page and
  API route both check the flag and 404/dark-behind-flag when off, per T18).
- New-user quiz-completion routing (back to the paid reveal).
- Middleware admission for any _new_ free-tier signed-in user (existing free accounts from
  during the window included, per above — the admission check re-evaluates on every request,
  it does not grandfather).
- The five-tab free-tier nav and its lock markers for anyone without paid access.
- The T17 lapsed-keepsake read carve-outs and the T2/T17 frontier-redirect bypass — a lapsed
  subscriber goes back to bouncing to `/reactivate`/`/plan-start` exactly as before this
  restructure (their pre-restructure behavior, not a regression from it).

## Ownership

- Primary operator: Nick.
- Supabase project: `pqdkhefxsxkyeqelqegq`.
- No flip without the preconditions above satisfied and Nick's recorded GO on the
  evidence-sensitive standard-test-account drive (plan §9).
