# Auth page-tier alias reachability — bounded second pass

## Decision

**No test declaration cut. R14 / F0 / C0 / D0; 14 → 14.** A supported, zero-quota source simplification is available: remove the old `resolveScanPageTier` and `ScanPageTierDependencies` aliases and point the existing five tier callbacks plus their fixture type at the canonical names. This removes no behavior, fixture, input, assertion, call, loop row, dependency, route, loader, or supported operator path. `loadScanPageTier` stays because `/scan` actually calls it.

The prior `2026-10-02-auth-layer-plan.md` said the resolver alias was not dead because `loadScanPageTier` was used by `/scan`. These are different symbols. The loader invokes `resolveAuthenticatedAppPageTier` directly; it never references `resolveScanPageTier`. That is the new evidence, rather than a reclassification of the previously removed generic allowed-tier test. The old resolver alias has real test consumers but no application/operator consumer; the tests can retain exactly their behavior through the canonical function identity. Do not call the underlying tier owner obsolete.

## Scope and read accuracy

Read the complete current 184-line `tests/authenticated-app-route-access.test.ts`, all fixture helpers and both pre-existing tables; the complete 238-line `src/lib/auth/authenticated-app-route-access.ts`; full `entitlements.ts`, its index, `entitlements/access.ts`, `entitlements/flag.ts`, `quiz/completion.ts`, `gated-preview/gate.ts`, and the scan page, tracker layout and profile layout. Read the exact field-test discriminator at middleware:241–243, not all middleware. Read the complete relevant overlap callbacks in `freemium-lapsed-user-matrix.test.ts` (three-state page mode plus thrown-auth/paid composition at 392–431) and `gated-example-pages.test.tsx` (flag-off loader at 23–40); those two entire suites were not reread. Source registration shim read completely. Package/TS config and CI command wiring inspected; downstream paid-subscription, Supabase and keepsake implementation internals were not comprehensively reread because none is removed or retargeted.

Static inventory uses TypeScript parsing, not text declaration counting. `sites.json` retains all 14 exact callback bodies/names/lines/SHA before and after. `receipt.json` pins 18 dependency/readset files, current dirty source/test bytes, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, root and branch. A pin records sensitivity to a file; it does not claim every line of a large pinned module was read. Parse/structural comparison only: no test, compiler, application import, mutation, provider, browser, DB, or environment operation was run.

## Real current entry/call closure

- `src/app/tracker/layout.tsx:5` → `loadTrackerRouteAccess` (:35) → `resolveTrackerRouteAccess` (:25), actual auth read. Only the pure resolver is dependency-injected in its tests; this does not establish Supabase request delivery.
- `src/app/scan/page.tsx:27` → `loadScanRouteAccess` (:69) → `resolveScanRouteAccess` (:54) → `hasCompletedQuizDiagnostics`. The loader explicitly reads the nine profile fields from `hair_profiles`, filters `user_id`, and calls `maybeSingle`; the resolver tests verify the resulting profile behavior, not SQL/client construction.
- Same scan page :39 → **live** `loadScanPageTier` alias (:173) → `loadAuthenticatedAppPageTier` (:163) → **canonical** `resolveAuthenticatedAppPageTier` (:128). Profile layout :24 also calls the canonical loader. Gated-page mode uses `loadAuthenticatedAppAccessState` and its canonical tier loader.
- `resolveAuthenticatedAppPageTier` is independent of spelling: get user; no user→premium; forward exact id/email/field-test signal to paid composite; unavailable→premium; otherwise real `getEntitlements` maps access===allowed to tier. Old alias :148 is simply the same function object. Old type :105 is exactly the canonical dependency type.
- Whole-tree symbol/module searches over source/tests/scripts/docs/apps/packages/.agents/package configuration found old resolver/type only in their definitions and this test file, apart from historical audit text. The current module consumers are explicit named imports; none imports a namespace for dynamic property lookup or re-exports the module. No barrel or package export exposes it as an SDK: root package is private and lacks public main/exports/bin for this source module. No CLI/registry/route discovery uses arbitrary exported helpers from `src/lib/auth`; Next discovers the page/layout entries listed above, not this internal utility.
- Dynamic-name search is necessarily repository-scoped; no claim about unknown out-of-repository code. Unlike a documented operator API, there is no current manual invocation/runbook contract for these two names.

## Exact per-declaration ledger

Each R is retained under the same current owner and inputs. No evidence-ready same-input stronger replacement exists in the overlaps read. This is not a claim that every possible repository keeper was fully audited.

| Current line | Exact declaration | Verdict and concrete escaped regression / overlap distinction |
|---:|---|---|
| 41 | tracker boundary only checks the authenticated user | R. `user-1` gives exact `{kind:allow}` without profile dependency. A tracker owner changed to unconditional quiz redirect escapes scan success because that is a different live resolver. |
| 46 | tracker boundary fails closed without an authenticated user | R. Null auth gives exact `/quiz` redirect. Auth throw is a separate catch path and cannot catch a null-specific allow bug. |
| 51 | tracker boundary fails closed when the authenticated-user read is unavailable | R. Rejected auth is converted to exact redirect; deleting tracker catch makes this reject while null case remains green. |
| 62 | scan boundary allows an authenticated user with a completed quiz | R. Existing full profile and explicit null scalp-condition rows both allow. Null scalp-condition is an admitted completed scalp step; treating null as missing blocks a supported quiz result. Tracker does not read diagnostics. |
| 71 | scan boundary redirects without an authenticated user | R. Null user exact redirect before profile resolution; a scan-only guard removal permits complete default profile. Tracker auth has different owner. No no-profile-read claim is made by this callback. |
| 76 | scan boundary redirects when the quiz diagnostics are incomplete | R. Null whole profile redirects. This exercises the `!profile` guard, whereas a populated but invalid profile only tests field predicates; deleting null guard causes a throw which scan catch still redirects, so the stronger retained meaning is denied result for absence, not sensitivity to that private guard. |
| 83 | scan boundary redirects when a single quiz field is missing | R. Preserves all five current rows: absent density, null density, empty chemical-treatment array, null concerns, undefined concerns. All exact `/quiz` redirects. Dropping these validation terms admits malformed stored records; the null-whole-profile test cannot detect that. No new rows proposed. |
| 100 | scan boundary fails closed when the authenticated-user read is unavailable | R. Scan owner catches auth rejection. Tracker's separate catch cannot protect this owner. |
| 111 | scan boundary fails closed when the hair-profile read is unavailable | R. Auth succeeds then profile rejects. An implementation moving profile await outside the protected region fails here while auth-error case remains green. |
| 132 | scan page tier: a paid-access composite of 'denied' is free | R. Real canonical resolver receives denied and derives free. Page-mode overlap injects already-derived free, and composed overlap throws before deriving a denied tier. Both would miss denied→premium regression here. Canonical symbol retarget only. |
| 139 | scan page tier: an email-only manual/moderator grant is premium (C1 repro) — the nav classification's id-only lookup would have called this user free | R. Dependency emits allowed only on exact `grant@example.com`; exact recorded `[user-1, grant@example.com, false]` plus premium retained. This protects argument delivery and allowed mapping. The already removed bare allowed test is not recredited. |
| 156 | scan page tier: a field-test guest is passed through to the paid-access composite | R. Actual metadata discriminator produces true at paid-composite call. Output is deliberately not asserted; do not inflate to a tier/lookup-skip proof. Other tier fixture lacks guest metadata and would not catch dropping the guest signal. |
| 174 | scan page tier: fails closed to premium (never free) when the paid-access composite is unavailable | R. Resolved `unavailable` reaches this owner's special return, not the outer composed exception path. Removing it derives free from false; thrown-error composition and flag-off bypass keep passing. |
| 181 | scan page tier: no authenticated user is premium (never free) | R. Null user reaches own premium fallback before composite call. Removing fallback rejects while the present-user unavailable callback remains green. It does not independently assert zero composite calls. |

Exact declarations/line numbers are also mechanically recorded in sites.json. Nine non-tier callback bodies are byte-identical. The five tier callback changes are exclusively `resolveScanPageTier` → `resolveAuthenticatedAppPageTier`; every argument/assertion is byte-identical. Helpers change only the type alias spelling; one section comment is updated. All current campaign edits (scalp null acceptance and malformed profile rows) remain intact.

## Why nearby keepers do not license cuts

The matrix's ordinary premium/lapsed/free cases inject the final access state into the page-mode owner. They cannot prove the upstream page-tier resolver mapped denied or unavailable correctly. Its two real composed cases intentionally throw from auth or paid lookup: they prove exception normalization to premium and no keepsake reads, but never exercise resolved `unavailable`, null user, denied→free, or guest/email delivery. The flag-off callback calls real loaders, but the flag short-circuit prevents the tier resolver and paid owner from running. Therefore neither is an equivalent keeper for these five tier tests. Retargeting to the canonical symbol is an exact input/assertion union of size one, with zero new owner calls.

## History and present authority

`git show 1cc03a97` (2026-09-11, PR527) shows the canonical generic resolver/type introduced by renaming their PR2 definitions, with old names kept as source aliases. The same change makes the canonical loader call the generic resolver directly and adds a separate old **loader** alias. This establishes the distinction mechanically. PR526 (`f3790784`) created the email-aware free-scanner tier contract; PR529 (`bad594d6`) added current lapsed/keepsake behavior. `plans/freemium-scanner-first/` retains current paid/free/keepsake behavior, not a documented external requirement to import the two obsolete source spellings. Historical plan/audit prose remains historical evidence, not executable callers to retarget wholesale.

CI `.github/workflows/ci.yml:158` invokes `npm run test:node`; package.json:49 includes this top-level `.test.ts` file. Both overlaps are in that same native lane. Their presence in CI is not treated as behavioral equivalence.

## Optional main-only source cleanup

Prospective complete diff: `complete.diff`; frozen dirty original and after versions in `before/` and `after/`. Remove exactly the two alias declarations and their obsolete alias comments. Retarget test import/function calls/type uses and section comment. Keep canonical exports, all three live loaders, every import dependency, every test declaration, all assertions, all current campaign edits. No dependency or entire-module removal unlocked; no declaration credit.

Main should compare the two current file hashes and all relevant readset pins before application. No applying editor is supplied for this zero-quota proposal; the snapshots are review material only. Canonical identity makes source fault reproof unnecessary for a naming-only edit, but focused native validation and typechecking are appropriate when main integrates. Exact commands (NOT run here):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/authenticated-app-route-access.test.ts tests/gated-example-pages.test.tsx tests/freemium-lapsed-user-matrix.test.ts
npm run typecheck
```

If main wants to defer zero-quota alias hygiene, retain all source and tests; there is no material correctness defect requiring a product change. Removing the live loader alias would be different scope and is explicitly excluded.

## Screening limits / rejected orphan

`createPaymentIntegrityRunner` was screened from the stale no-static-import census and rejected immediately on actual callers: payment-monitor route module constant at :32/dynamic import :663/property invocation :665–666; billing/reconcile constant :55/dynamic import :437/property invocation :439–440. The configured monitor is a supported operator route. No full payment-runtime test audit is claimed: a combined large source/test read was truncated and was navigation only. Existing oldquiz/RAG/CompareLab/research retirements were consulted but are neither repeated nor credited here. This report establishes one narrow obsolete spelling closure, **not** a new dead application subsystem or progress toward the remaining test target.
