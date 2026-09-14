# Admin users: historical navigation and truthful hair-profile status

## Outcome and source context

Nick, 2026-09-14: “I need to go further back and also it needs to say that they have a hair profile. This is not sufficient.” Original question includes both test and buying users and asks who completed a profile and saw the product.
Outcome: the existing admin table can reach all retained registered accounts, including older test and buying accounts, and explicitly reports whether a saved hair-profile row exists.
Evidence on fresh main 318cf157: page fetches `/api/admin/users` without pagination, ignores response `total`, labels loaded length as total; API defaults to 50 with limit/offset already supported. Hair-profile cell tests a nonempty summary instead of row existence. A saved profile does not establish profile completion or product viewing.

## Chosen direction

Keep current table and admin access controls. Use existing server pagination (50 rows), show server total and visible range/page, and add Neueste, Zurück, Weiter, Älteste. Keep creation date descending and add id descending tie-break for deterministic ordering on unchanged data. Show Haarprofil: Vorhanden whenever `hair_profiles` has a row, otherwise Nicht vorhanden; display the existing summary below when available. No tester or payment filter, so all account types remain included.

## Scope and non-goals

Only table read/display behavior and deterministic ordering. Preserve contact/PayPal details and admin labels. No database writes, migrations, entitlement changes, deletes, publication or deployment. No new analytics or claim that row existence means complete or ever viewed. Only retained registered accounts are in this table; unregistered leads, deleted accounts and historical profiles removed by resets are not reconstructed.

## Target map

- `src/app/admin/layout.tsx`: let the flex main shrink so horizontal scrolling stays inside the table.
- `src/app/admin/users/page.tsx`: total, offset/request state, controls, profile badge, loading/error recovery.
- `src/app/api/admin/users/route.ts`: deterministic created_at/id ordering; preserve bounded limit/offset and auth/billing behavior.
- `tests/admin-users-pagination.test.ts`: focused route/query and failure behavior.
- `src/app/labs/admin-users/page.tsx`: development-only wrapper (notFound outside development), renders the actual AdminUsersPage directly (inline error handling needs no ToastProvider). No auth bypass for the production route.
- `tests/admin-users-page.spec.ts`: use that wrapper and intercept `/api/admin/users` with fictional responses before navigation; no auth setup or production seeding.
- `package.json`: include the new browser spec in the existing `test:playwright:personal-plan-stage3:journey` chromium command invoked by CI.
- `tests/admin-paypal-email-visibility.test.ts`: existing compatibility regression.

## Decision coverage

Status: confirmed.
Confirmed with Nick: ability to go further back; explicit hair-profile presence; inclusion of both test and buying users.
Inherited: current admin-only access, existing contact/role fields, all retained registered accounts from profiles; hair_profiles row existence is the evidence for presence.
Implementation defaults: bounded 50-row API requests, id tie-break, stale-response protection, no new dependencies, derive ranges from server count and returned length.
Open consequential assumptions: none. Historical completion/product-view audit and unregistered leads are parked out of scope as explicitly presented in the final walkthrough and accepted below.
Coverage acknowledgement: 2026-09-14 Nick replied “Yeah please fix this. Thank you.” to the reviewed mockup/journey and explicit presence-only scope question. This confirms evidence, journey, coverage and implementation; publication remains separate.
Internal revalidation: on implementation intake, plan and unchanged production files rechecked in the owned task worktree; reviewed scope remains intact. Previously inspected fresh main code and schemas/types; no production data query or production mutation. Live browser redirects admin route to chat, so actual admin screenshot unavailable with this session; before/current table is reconstructed from checked source.
Undiscussed consequential assumptions affecting this handoff: none.

## Designed user journey

1. An authorized admin opens Admin → Nutzer. Loading text is shown; controls cannot race an active request. Success shows all retained account types, newest 50, actual total and range.
2. Each account explicitly says Haarprofil Vorhanden or Nicht vorhanden. An existing row with no texture/concerns/goals still says Vorhanden. Existing summary is secondary. This does not claim completion or a product visit.
3. Weiter retrieves older pages; Älteste jumps directly to final page. Zurück and Neueste return towards recent accounts. Boundaries disabled; navigation stays visible on mobile while the existing table scrolls horizontally.
4. Initial or page-fetch errors show inline error and Erneut versuchen, with no false zero total/empty state or stale rows presented as the target page. Track requested and successful page separately or hide data until the requested page succeeds; discard stale responses. Retry the failed page. If deletion makes the page out of range, clamp to last valid page and refetch (zero total returns empty).
5. Empty successful result shows 0 Nutzer insgesamt and Noch keine Nutzer vorhanden. One page disables all navigation. Mobile controls wrap without horizontal page overflow.
   Completion: admin can reach oldest retained users and read accurate present-day hair-profile existence.
   Journey sign-off: confirmed by the acknowledgement above.

## Planning evidence

`admin-users-history/mockup.html`: source-grounded desktop/mobile table, illustrative oldest page, before/after empty-summary bug, loading/empty/error states. Fictional .test identities and clearly marked example count. Static planning evidence; controls not interactive. Decision: whether historical navigation and explicit presence meet Nick's immediate need. Rendered at desktop and 390px widths: table scroll stays contained and navigation remains visible. Evidence review: confirmed by the acknowledgement above; no additional visual corrections requested.

## Ordered tasks

1. Preserve API auth and existing bounded range/billing lookup, add deterministic secondary id ordering. Completion: request probes cover default and nonzero offset, existing numeric limit/offset bounds and equal-created_at ordering; existing unauthorized/forbidden paths preserved. Dataset-end page clamping is client-only: read returned total, compute last offset, refetch.
2. Consume `{users,total}` with paging, truthful range, request-race protection and recovery. Add presence badge based on row existence. Completion: browser fixtures prove >50 traversal through last page, empty profile summary, absent row, boundary controls and error/retry.
3. Add the development-only labs wrapper, mount actual page directly, and verify it using intercepted `/api/admin/users` responses. Wire the spec into the existing CI journey command; no real data mutation. Completion: desktop/mobile screenshots and first→older→oldest→newest flow plus request failure/retry pass; keep PayPal contact tests passing.

## Verification

Automated: focused node route tests and existing `admin-paypal-email-visibility.test.ts`; Playwright fixture tests for 123 accounts (50/50/23), true total, oldest index, row without summary, absent row, equal timestamps, loading lock, error/retry, zero and one page, count shrinking below offset. Check no tester/payment filtering. Browser tests visit `/labs/admin-users` and intercept `/api/admin/users` before navigation; no auth fixture or dev-login seeding. API unit probes separately assert unauthenticated 401 and nonadmin 403; the public-facing admin gate is not bypassed or changed. Add the spec to the existing CI journey chromium list; this dev-only wrapper follows `src/app/labs/profile-haarprofil/page.tsx` and is not available in production. Use Node 22 and repository ready-check to select required checks. No migration/live DB verification needed for no-schema read/display change.
Manual: render preview desktop and narrow layout; implementation browser flow and keyboard controls. This proves fixtures/layout, not production deployment or product-view history.

## Review and handoff

Task: `.worktrees/admin-users-history`, branch `codex/admin-users-history`, root stays clean main. Before implementation: one read-only terminal Claude plan review, reconcile technical findings, show final mockup/journey and obtain Nick's explicit evidence/coverage/journey acknowledgement. Then implementation-loop owns ready-check and request-code-review. No push/PR/merge/deploy without applicable authority.
Artifacts: commit this plan and HTML; transient counterpart output discard after verified findings are summarized below. Temporary preview server may remain for user review; stop when no longer needed. No production implementation files edited during planning.

## Findings ledger

Counterpart review: approve with revisions; read-only Claude Opus 4.8 at high. Verified all technical findings locally. No new product choices accepted on Nick's behalf.

| ID  | Type           | Evidence                                                                 | Decision               | Plan change                                                       | Revalidation                                   |
| --- | -------------- | ------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| R1  | defect         | Middleware protects admin; package.json uses explicit browser spec lists | accepted               | Named dev-only wrapper, intercepted API, existing CI command      | Existing labs guard and CI invocation verified |
| R2  | ambiguity      | Task 1 numeric bounds versus journey dataset-end clamp                   | accepted clarification | Numeric API bounds retained; dataset clamp explicitly client-only | API count/range query checked                  |
| R3  | scope decision | Presence does not prove historical completion or product visit           | accepted by Nick       | Presence-only scope confirmed                                     | Final walkthrough and acknowledgement above    |
| R4  | fidelity       | Current contact cell includes email labels                               | accepted               | Add Chaarlie/PayPal labels to mockup                              | Compared current page lines 113-129            |

These bounded clarifications do not change architecture or product behavior, so no second counterpart pass is needed. Self-review complete; evidence/coverage/journey sign-off confirmed. Transient reviewer output discarded after this ledger was written.

## Implementation progress

User approval recorded; implemented pagination, total, inline recovery, abort/stale-response guard and row-presence badge. Added id tie-break. Unit red proof exposed existing negative-offset clamp bug; fixed the optional maximum fallback to Infinity, preserving the intended nonnegative bound. API unit guards went from two intended failures to passing. Controls are hidden while loading/error; the same lock/recovery contract holds. Labs needs no toast provider because errors are now inline.

Verification progress: main-session API regression and existing compatibility tests 8/8 pass; main-session Chromium suite 3/3 passes on localhost:3717. Browser red proof restored the previous page temporarily: it failed because the true total 123 was absent, then all tests passed after restoring the fix. Typecheck passes; full lint passes with four pre-existing unrelated warnings. CUA inspected the actual labs error/retry surface without admin access.

Final integration: added explicit admin source/labs/spec paths to the existing CI journey classifier so future table-only changes also run this regression, and updated its existing command contract assertion. CI-classifier red proof failed before adding paths and passed afterward. Production build passed. Artifact disposition: retain plan/mockup and source/tests for commit; test screenshots/logs/receipts stay in temporary storage, generated tracked test-results state restored.
