# Independent preservation review: free/provisioning67

Verdict: **CONDITIONAL PASS for C1; no semantic preservation blocker found.** One consolidation is supported after the main operator proves the two actual-source controls and focused before/transfer/cut runs. This report neither executes those checks nor awards removal credit. No source retirement or F repair is proposed.

Frozen packet: `/tmp/test-audit-free-provisioning67`, manifest SHA `c93ab0f88ad471a0bddda81ebeef2db9b5c0cccecbbbb20b039bc000e9c041a1`; handoff SHA `5437899e0ab6a8da0c6a4841c1e96503e08e6c07ec6b59394794a7271ab5ca30`. Root `test-audit-pruning`, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`. Independent static receipt checks 822 conditions with zero errors and zero readset drift at the independent static-check observation. No metadata or source was repinned. Root subsequently announced temporary dormant-owner controls; this report does not claim a fresh live readset check during those mutations. Main must close/restore them before applying this packet.

## Exact accounting and union

Seven full original test files contain 67 AST declarations: 65 R, one held F and one conditional C. Transfer preserves 67; cut leaves 66. The two-row `corrupt_need_hash` / `stale_publication` registration in acceptance accounts for **68→68→67 literal runtime registrations**. These are statically derived counts, not a native PASS receipt. Sixty-five unrelated callbacks, including the held F, stay byte-identical; one keeper gains one assertion; one donor disappears. Six whole files are unchanged. Full-file reconstruction confirms that surrounding imports/helpers/fixtures and every other byte survive, apart from the donor and its adjacent blank line. No new inputs, owner calls, loop rows, skips or generated expectations.

C1 donor is `freemium-sheet-checkout-contract.test.ts:40`, “the submitted catalog is standard for the sheet in BOTH launch-pricing states”. Keeper at original line61 is “the submitted price id equals the price the sheet rendered, both flag states”. Both already use literal `[false, true]` and call `resolveCheckoutPricingCatalog({source: "premium_sheet", launchPricingEnabled})` once per row. Source at route449–511 contains the complete pure selector: only those two fields decide the result. No clock, environment read, collaborator or additional object field distinguishes the donor call. The keeper already captures its result as `catalog`.

The entire donor assertion transfers by replacing only that identical call expression with `catalog`; expected `"standard"` and the per-flag message remain verbatim. It occurs at transfer67/cut57, before `premiumSheetPlans()` iteration and all pricing/ID lookups. This placement independently catches a wrong catalog even when the price list were empty or unconfigured price IDs compared equal. Existing amount, analyticsId and configured ID equalities remain exact. The separate ordered numeric `[99.99,34.99,14.99]` assertion stays, since these equality oracles alone cannot fix absolute rendered prices. No actual HTTP checkout or provider-delivery equivalence is asserted.

## Real owner and retained risks

The selector is live in POST at route945 onward: it feeds `getStripePricingPlan`, `getStripePriceId`, then configured-price/catalog validation. Actual PremiumSheet consumes `premiumSheetPlans()` at component137. Standard/launch literals, pricing arrays, lookup behavior, request schema and contextual/default checkout-parameter builder were read. C1 does not remove or alter production exports, HTTP authentication, provider creation, default `/welcome` bytes, absence of `redirect_on_completion`, idempotency key, strict request exclusions, return-path sanitization or marker/user identity assertions.

All 13 registration SSR declarations were read with the full client/controller and Button/Input owners. They preserve German copy, phase-specific recovery, exact error cardinality, accessibility linkage, cooldown attributes and resolving shell. Their renderer does not execute handlers/effects, mount focus, or prove timer behavior. The React server dispatcher explicitly uses noop effects. No SSR claim is upgraded to browser behavior.

All eight recovery declarations preserve initial-need short circuit, terminal and transient outcome distinctions, stage/user report values, sequential marker reuse and best-effort marker failures. Their memory marker is not durable database proof. Full recovery owner/default marker code was read, plus live scan entry.

All nine acceptance declarations (ten registrations) preserve actual free-service/Supabase-adapter/scanner-owner composition: attached source, missing diagnostics, corrupt hash, stale publication, enrollment collision, email-only manual grant and moderator allowed/unavailable branches. The shared fake implements storage deduplication, enrollment comparison and stale publication response. Tests run real projection/hash/source compatibility logic but do not prove SQL uniqueness, real CAS concurrency, RLS, or actual HTTP409. In particular, the “scanner still409s” title asserts null context, not a route status. Those limitations remain explicit; no such declaration is cut.

All14 paid-provisioning declarations and all7 free-service declarations preserve order/error mapping, pin ownership, admission/source guards, source identity/hash/input/absent enrollment, no-local-cache calls, and paid/unavailable early exits. The free service's exact request/negative counters remain independently useful beyond the composition fake's success outcome. Direct acceptance classifier cases distinguish false/true/null readiness, independently established already-accepted, typed unknown failure and generic error; no classifier is retired.

The three cutover declarations preserve flag-on, flag-off and established Personal Plan navigation contracts at actual pure/composed owners. Their inputs intentionally differ in paid-access collaborator and journey state; this review does not invent a packed replacement. They are not a browser journey. The live auth-confirm provisioning branch, registration page, scan page, purchase completion route and PayPal/Stripe factories establish supported consumers even when a feature flag is off. No owner is called obsolete from navigation or flag state.

Held F1 at paid-provisioning156 remains exact. Its title promises “no second accept”, but `fakeDeps` increments acceptance on both calls and manufactures `already_accepted` on the second. No counter or persisted activation oracle verifies that phrase. It still checks stable fake admission/need identity and readiness; the packet neither repairs it nor counts it as removed. Retention classifications here mean the present proposal preserves meaningful existing assertions, not proof that no further independently reviewed consolidation could ever exist.

## Two proposed source controls

Both use the complete named selector anchor and pinned whole route SHA `fc8db1376b2825ae31976913eaab2e963175e8ee3c643aea93dd3165e4027a79`. Independent parsing confirms exactly one scoped replacement, the declared whole mutant SHA, valid TS syntax, exact selected test argv and one matching declaration in that command's selected file. Parsing is not compilation or execution.

- `C1-launch-false` returns launch catalog only for premium_sheet/false. The first existing flag row reaches the transferred `catalog === "standard"` assertion; it precedes every pricing collaborator.
- `C1-launch-true` returns launch only for premium_sheet/true. False first remains standard and completes its original comparisons; the second existing row reaches the same transferred assertion before its comparisons.

Each expects `ERR_ASSERTION`, `strictEqual`, actual `personal_plan_launch_v1`, expected `standard`, a flag-specific decoded diagnostic, and the FIRST keeper frame at transfer67 or cut57. The `.equal` method is imported from `node:assert/strict`, so this operator is appropriate. No throw/TypeError/import/setup failure can substitute for that proof. False and true are independently faulted; neither changes the unrelated-source branch. Both source strings and message descriptors are sound statically. Main must still prove clean selected1 → intended red1 → byte-exact restore → clean selected1. These controls do not prove SDK or real purchase behavior.

## Read depth, CI, history and limits

All seven tests were independently fully read, including every callback/helper/fixture/table and all original assertion texts. The per-site machine companion records all67 exact callback hashes and the independently corroborated contract/failure judgment; no filename-only semantic credit is used. All21 phase snapshots were independently parsed and reconstructed.

The companion `independent-read-depth.json` distinguishes35 full production/support file reads from precise slices of shared large owners and installed dependency definitions. Complete tested free/provisioning/recovery/renderer/scanner owners and their immediate typed adapters were read. The Stripe route schema/selector and relevant POST call path were read, not its unrelated full2295-line handler; auth confirm/middleware/shared webhook/quiz and sheet consumers are bounded slices. The247 manifest hashes and231-module static import closure are byte/syntax guards, not a claim to have semantically reviewed every transitive billing/recommendation/migration owner. No live SQL, provider, RLS or concurrency validation was performed; those unchanged owners retain their separate test obligations.

Local history independently confirms free scanner core PR526 (`f3790784`), contextual purchase PR528 (`a68c6d04`) and free registration/cutover PR530 (`521f8da8`). No deletion relies on history-only intent. CI's quality-node job runs `test:node` for six top-level files and `test:personal-plan:nested` for the nested free service; the nested script recursively selects `.test.ts/tsx`. The server-only preload supplies an empty marker for plain Node; it does not manufacture the pricing selector result. React SSR, PromiseLike PostgREST and Stripe redirect type slices were read for honest execution boundaries. No environment files or values were inspected.

Independent checker: `node /tmp/test-audit-free-provisioning67-independent-static.cjs`. It imports only Node built-ins and the TypeScript parser, reads pins/snapshots/metadata, prints JSON, and launches no children or owner/test modules. The static JSON was captured under `/tmp`; no repository/config writes occurred. Both actual source controls and all native runs remain NOT_RUN by this reviewer. Commands for the main operator are frozen in packet `commands.json` and each control's exact argv; no new runner command is proposed.

## Complete independent declaration decisions

The following judgments were reconciled against the complete bodies and actual owners, rather than inferred from titles. Full input/assertion prose and callback hashes are in `independent-sites.json`; original bytes remain in the immutable packet.

| Site | Decision | File:line / exact title |
|---|---|---|
| 1.1 | R | `tests/free-registration-screen.test.tsx:38` — inbox names the address the link went to and offers resend + correction |
| 1.2 | R | `tests/free-registration-screen.test.tsx:47` — inbox falls back to generic copy when the address is unknown |
| 1.3 | R | `tests/free-registration-screen.test.tsx:53` — sending shows the in-flight line and no inbox hint yet |
| 1.4 | R | `tests/free-registration-screen.test.tsx:60` — resend is disabled during the cooldown and counts it down |
| 1.5 | R | `tests/free-registration-screen.test.tsx:66` — the resend notice is announced politely |
| 1.6 | R | `tests/free-registration-screen.test.tsx:72` — correction shows the labelled e-mail form |
| 1.7 | R | `tests/free-registration-screen.test.tsx:82` — a correction validation error is wired to the field via aria |
| 1.8 | R | `tests/free-registration-screen.test.tsx:89` — W1a: the missing/refused-capability state is honest and points back to the quiz |
| 1.9 | R | `tests/free-registration-screen.test.tsx:99` — expired explains itself and offers a fresh link |
| 1.10 | R | `tests/free-registration-screen.test.tsx:107` — no_lead sends the visitor back to the quiz |
| 1.11 | R | `tests/free-registration-screen.test.tsx:115` — claimed offers the login, with our own heading (W7) |
| 1.12 | R | `tests/free-registration-screen.test.tsx:126` — W7: a failed send prints the reason once, not twice |
| 1.13 | R | `tests/free-registration-screen.test.tsx:135` — resolving renders the empty shell (no flash of the wrong state) |
| 2.1 | R | `tests/free-registration-recovery-terminal.test.ts:30` — N3: a NOT-yet-terminal account attempts provisioning and marks a terminal outcome |
| 2.2 | R | `tests/free-registration-recovery-terminal.test.ts:52` — N3: invalid_source is also marked terminal |
| 2.3 | R | `tests/free-registration-recovery-terminal.test.ts:68` — N3: an ALREADY-terminal account short-circuits — no provision call, no report call |
| 2.4 | R | `tests/free-registration-recovery-terminal.test.ts:80` — N3: second render after a terminal first render fires exactly ONE Sentry report total |
| 2.5 | R | `tests/free-registration-recovery-terminal.test.ts:115` — N3: temporarily_unavailable is never marked terminal — retry stays allowed every render |
| 2.6 | R | `tests/free-registration-recovery-terminal.test.ts:151` — N3: a failed marker write is swallowed — the render still succeeds |
| 2.7 | R | `tests/free-registration-recovery-terminal.test.ts:165` — N3: a provisioned/paid_user outcome is never marked terminal |
| 2.8 | R | `tests/free-registration-recovery-terminal.test.ts:190` — N3: an already-provisioned account (hasInitialNeed) never consults the terminal marker at all |
| 3.1 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:256` — a free account with no enrollment is provisioned and then passes the scanner's profile-context read (no profile_missing) |
| 3.2 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:289` — a provisioned need without linked diagnostics still has no scanner context |
| 3.3 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:300` — `provisioned scanner context fails closed on ${fault}` |
| 3.4 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:332` — provisioning twice is idempotent: no duplicate need_versions row, enrollment stays null |
| 3.5 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:351` — a user with no linked quiz artifact is not provisioned and the scanner still 409s profile_missing |
| 3.6 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:362` — a plan already pinned to a real enrollment id fails the free service permanently with enrollment_mismatch (I1's collision, not self-healing) |
| 3.7 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:394` — an active moderator/field-test user is refused with paid_user and not provisioned |
| 3.8 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:409` — a user with only an email-keyed manual access grant (no user_id row) is refused with paid_user |
| 3.9 | R | `tests/free-snapshot-provisioning-acceptance.test.ts:428` — an unreadable moderator lookup with no independent paid entitlement fails closed with temporarily_unavailable, not provisioning |
| 4.1 | C | `tests/freemium-sheet-checkout-contract.test.ts:40` — the submitted catalog is standard for the sheet in BOTH launch-pricing states |
| 4.2 | R | `tests/freemium-sheet-checkout-contract.test.ts:50` — the flag still moves every other source — the pin is the sheet's, not a global change |
| 4.3 | R | `tests/freemium-sheet-checkout-contract.test.ts:61` — the submitted price id equals the price the sheet rendered, both flag states |
| 4.4 | R | `tests/freemium-sheet-checkout-contract.test.ts:84` — the rendered amounts are the standard ones, so the assertion above cannot pass vacuously |
| 4.5 | R | `tests/freemium-sheet-checkout-contract.test.ts:91` — the request schema accepts the sheet's contract and refuses every legacy protocol |
| 4.6 | R | `tests/freemium-sheet-checkout-contract.test.ts:112` — returnPath belongs to the sheet alone |
| 4.7 | R | `tests/freemium-sheet-checkout-contract.test.ts:123` — a repeated CTA press recovers the same Stripe Session |
| 4.8 | R | `tests/freemium-sheet-checkout-contract.test.ts:133` — contextual completion keeps the buyer in the sheet and off /welcome |
| 4.9 | R | `tests/freemium-sheet-checkout-contract.test.ts:150` — every pre-T14 caller keeps today's /welcome return, byte for byte |
| 4.10 | R | `tests/freemium-sheet-checkout-contract.test.ts:159` — contextual completion without a return url is a programming error, not a silent /welcome |
| 4.11 | R | `tests/freemium-sheet-checkout-contract.test.ts:169` — the return path is an allowlist, not a redirector |
| 4.12 | R | `tests/freemium-sheet-checkout-contract.test.ts:195` — the completion endpoint is authenticated but NOT behind the paywall |
| 4.13 | R | `tests/freemium-sheet-checkout-contract.test.ts:209` — only a marked Session with a user id is a freemium purchase |
| 5.1 | R | `tests/freemium-plan-provisioning.test.ts:133` — a converting free user's plan is re-pinned off null, then derived and accepted |
| 5.2 | R | `tests/freemium-plan-provisioning.test.ts:145` — WITHOUT the pin step the same call fails enrollment_mismatch — the T6 carry-forward, red |
| 5.3 | F | `tests/freemium-plan-provisioning.test.ts:156` — replaying provisioning is a no-op: one admission, one need version, no second accept |
| 5.4 | R | `tests/freemium-plan-provisioning.test.ts:174` — a plan already owned by another enrollment is never overwritten |
| 5.5 | R | `tests/freemium-plan-provisioning.test.ts:186` — a buyer with no plan row yet is admitted and the plan is created pinned |
| 5.6 | R | `tests/freemium-plan-provisioning.test.ts:194` — no attached quiz artifact means no admission is written at all |
| 5.7 | R | `tests/freemium-plan-provisioning.test.ts:203` — a failed Routine acceptance still provisions — the purchase is never undone |
| 5.8 | R | `tests/freemium-plan-provisioning.test.ts:221` — an unavailable admission write reports a retryable stage, never a fake success |
| 5.9 | R | `tests/freemium-plan-provisioning.test.ts:239` — Y2: the conflict LOSER does not claim a Routine that does not exist yet |
| 5.10 | R | `tests/freemium-plan-provisioning.test.ts:255` — Y2: the conflict loser converges once the winner has committed |
| 5.11 | R | `tests/freemium-plan-provisioning.test.ts:263` — Y2: an unconfirmable read is never optimistic |
| 5.12 | R | `tests/freemium-plan-provisioning.test.ts:271` — Y2: `plan_already_accepted` is proof on its own and needs no extra read |
| 5.13 | R | `tests/freemium-plan-provisioning.test.ts:285` — Y2: every other acceptance failure stays unavailable |
| 5.14 | R | `tests/freemium-plan-provisioning.test.ts:299` — Y2: an in-flight Routine provisions the plan but never reports it ready |
| 6.1 | R | `tests/freemium-cutover-journey.test.ts:59` — flag ON — new user: quiz completion routes into the free-registration destination, /scan is admitted, five-tab free nav renders, and legacy offer routes remain public |
| 6.2 | R | `tests/freemium-cutover-journey.test.ts:103` — flag OFF — new user: quiz completion stays on today's paid destination, /scan is NOT admitted (scanner back in stealth for a non-paying account), and nav stays the unchanged legacy shell |
| 6.3 | R | `tests/freemium-cutover-journey.test.ts:140` — existing premium (paid Personal Plan) users are unaffected by the flag in either state — de-stealth and cutover only ever touch the NEW free-tier entry path |
| 7.1 | R | `tests/personal-plan/persistence/free-snapshot-service.test.ts:30` — provisions a free initial snapshot from the user's linked quiz artifact, without any enrollment field |
| 7.2 | R | `tests/personal-plan/persistence/free-snapshot-service.test.ts:58` — calling it twice re-derives and re-submits, but the persistence layer owns dedup — the service itself performs no local caching |
| 7.3 | R | `tests/personal-plan/persistence/free-snapshot-service.test.ts:84` — no linked quiz artifact yields a typed outcome without attempting a write |
| 7.4 | R | `tests/personal-plan/persistence/free-snapshot-service.test.ts:102` — maps an unusable artifact and storage failures to safe typed outcomes |
| 7.5 | R | `tests/personal-plan/persistence/free-snapshot-service.test.ts:131` — refuses a user whose paid-access composite resolves 'allowed' (subscription/one-time/manual-grant/moderator), without reading the artifact or writing |
| 7.6 | R | `tests/personal-plan/persistence/free-snapshot-service.test.ts:162` — a paid-access composite resolving 'unavailable' (e.g. an unreadable moderator lookup) maps to temporarily_unavailable, without reading the artifact or writing |
| 7.7 | R | `tests/personal-plan/persistence/free-snapshot-service.test.ts:186` — a throwing paid-access check maps to temporarily_unavailable rather than proceeding |
