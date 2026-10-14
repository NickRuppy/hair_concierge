# Auth boundary cutover

Task worktree `codex/test-audit-pruning`, original base `21e0e41f`. This follows the applied 182 declaration checkpoint; its final integrated proof remains pending. Original target remains 2,379 declarations, no count credit for table regrouping. The current auth-only before runs are complete: 62/62 native Node cases in two files, 86/86 Playwright cases in two files: 85 pure contracts and one local Chromium Back/Forward case against an ephemeral in-process HTTP fake. The isolated configuration does not load .env files or start the application server; dependencies perform no provider or database action. No production policy, access/payment behavior, environment, publication or deployment change.

Decision coverage remains governed by the parent plan and current audit authorization. Independent value ledger and layer plan are required before edits; main will resolve any discrepancies. Routine assertion repairs and test-only export cleanup are within the existing request. This batch may remove four declaration sites (three Node, one Playwright), with zero replacement declarations.

## Retained owners and cuts

1. `authenticated-app-route-access.test.ts`: delete `scan page tier: a paid-access composite of 'allowed' is premium`. Existing email-only grant reproduction calls the same real tier resolver with allowed, asserts premium, and additionally observes identity/email/guest arguments. Keep denied, unavailable, null-session and guest branches. Control the actual allowed entitlement calculation to return free; exact reproduction must fail.
2. `auth-middleware-personal-plan-routine.test.ts`: carry the observed-table and Personal Plan frontier zero-read assertions from `tracker still redirects an authenticated user without current access to reactivate` into the existing explicit unset-flag keeper `flag off: FREEMIUM_SCANNER_FIRST_ENABLED unset still redirects tracker to reactivate (byte-identical)`. Scope/restore the environment in finally as currently done. Both inputs have currentAccess false and no guest metadata; keeper is stronger because it controls the flag explicitly. Remove donor after transfer-only green. Temporarily perform an actual profile read in tracker path; keeper must fail on its no-read assertion, then restore bytes.
3. Same middleware file: delete `an ended moderator account receives the field-test end state unless paid access is valid`. Keeper `an ended moderator without paid or partner access is still routed to the ended screen` uses the same routine URL, same ended status, same independently denied paid and partner evidence, and asserts exact redirect. Its stale currentAccess true is overwritten unconditionally in the actual ended branch, so it additionally rejects stale manual-access leakage. Keep active-paid, partner, unavailable and other-route tests. Mutate actual ended access recomputation to keep stale active; keeper must fail, restore bytes.
4. `checkout-activation.spec.ts`: delete `verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is card`. Retain complete-unpaid SEPA keeper and the offered-SEPA case: source no longer fetches subscription default method on this unpaid path, so direct card/default field is incidental to uncalled dependency. Exact retrieved sessions otherwise match apart from opaque identity. The retained SEPA case protects the historical regression. Mutate actual unpaid-session assertion to allow unpaid; retained keeper must fail, restore bytes. No meaningful input or payment rule is removed.

## Repairs and source cleanup

Repair `ensureCheckoutAccount creates a missing profile for duplicate auth users` locally. Current duplicate-create stub writes the profile itself before reporting duplicate, so the claimed auth-only fallback is never reached. In this test only, return actual duplicate-style error without writing profiles and supply a valid admin.listUsers response from the auth-user fixture. Require profile absent before the owner call, monotonic auth lookup count, actual returned identity/password-capability fields and the real recorded profile upsert plus persisted subscription fields. Other duplicate race fixtures remain unchanged. Demonstrate actual owner auth fallback suppression passes the old fixture but fails the repaired test, restore bytes and require green. Do not invent a production seam or change the common fixture globally.

Retarget existing `deprecated setup link route returns 410 without side effects` in `auth-post-checkout-routes.spec.ts` to actual route POST: assert response status 410 and awaited JSON exact German error body. Remove the duplicate test-only handleSendSetupLink export and exclusive RouteResult type from its route module. POST stays and requires no provider/client. Verify repository caller search: no non-test caller needs helper; preserve all other routes. Temporarily change actual POST status 410 to 200; exact retained test must fail. Restore route bytes including applied deletion, not the older whole file.

Repair `rejects missing request body before rate limiting or Stripe work` with independent monotonic rate-limit and checkout-verifier counters returning valid success fixtures. Keep existing 400/session-error and empty Supabase operations. The old calls array never observed either dependency. Inject one early limiter call and one early verifier call separately into actual handleSetCheckoutPassword while retaining 400; each must pass old assertions and fail its corresponding repaired zero-count assertion, with byte-exact restoration. This is another retained declaration repair, zero count credit.

Hold the welcome source guard: no independently verified local browser replacement currently exists. No external fixture or historical wording deletion is inferred from title similarity.

## Sequence and verification

Owned writes: exactly four existing tests plus `src/app/api/auth/send-setup-link/route.ts`. Read-only audits are in `/tmp/test-audit-auth-runtime-ledger.md` and `/tmp/test-audit-auth-layer-plan.md` and will be copied into evidence. Counterpart review is terminal/read-only. Never edit checkout code while any native runner or c8 report remains active.

After both read-only passes and review: repair/transfer/POST retarget first, format affected files, run `node /tmp/test-audit-auth-node.cjs transferred` and `node /tmp/test-audit-auth-playwright.cjs transferred`; these use recorded isolated native commands/config without .env loading. Then remove four donor declarations, repeat with after labels and compare coverage/AST inventory. Actual-owner controls are serialized, expected red reasons inspected, source hashes restored exactly. Independent preservation then main whole-suite frozen final coverage/failure comparison, typecheck/lint/build as justified by route-source change, diff/full branch review. Current integrated proof is against the pinned original base; newer main is not yet incorporated.

Expected final campaign accounting only after completed checks: 182 to 186 net removals, Node 11,177 to 11,174, Playwright 533 to 532; no claim of 20% completion. Three fewer native Node cases and one fewer pure Playwright case here, separate from the prior 19 runtime-only classifier cuts. No commit/push/PR authorization is inferred.


Review disposition: Claude independently grounded all four cuts and repairs and found no technical defect or required Nick decision. Its two reproducibility/accounting concerns are corrected here: the applied 182 checkpoint is separately labeled from fully measured 181 in the parent, and exact native commands/config construction are below. Durable ledgers are [value ledger](2026-10-02-auth-runtime-ledger.md) and [layer plan](2026-10-02-auth-layer-plan.md). The main executes this batch directly. Add the unpaid keeper's monotonic subscription-read count, requiring zero; controls cover an output-preserving early subscription fetch. Undiscussed consequential assumptions affecting this batch: none. Chosen plan and concise preservation receipts stay in repository evidence; temporary runners, complete reports and reviewer output remain archived outside the repository, with no commit inferred.

Reproducible native focused commands from the task checkout:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/authenticated-app-route-access.test.ts tests/auth-middleware-personal-plan-routine.test.ts
node <<'NODE'
const fs = require('node:fs')
const root = process.cwd()
const source = `const {defineConfig}=require(${JSON.stringify(root + '/node_modules/@playwright/test')}); require(${JSON.stringify(root + '/tests/server-only-register.cjs')}); module.exports=defineConfig({testDir:${JSON.stringify(root + '/tests')},testMatch:['auth-post-checkout-routes.spec.ts','checkout-activation.spec.ts'],outputDir:'/tmp/test-audit-auth-native-results',retries:0,workers:1,projects:[{name:'chromium',use:{browserName:'chromium'}}]});`
fs.writeFileSync('/tmp/test-audit-auth-native.config.cjs', source)
NODE
node node_modules/@playwright/test/cli.js test --config=/tmp/test-audit-auth-native.config.cjs --project=chromium --workers=1
```
