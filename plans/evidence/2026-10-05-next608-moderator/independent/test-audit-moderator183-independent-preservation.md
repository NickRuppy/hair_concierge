# Independent Moderator183 C1 preservation review

**Conditional PASS — no blocking preservation finding.** Reviewed the complete current `tests/personal-plan-field-test-ui.test.tsx`, both full donor/keeper callbacks, full proposal diff/candidate/control/layer-plan, operative `ResultPageClient` imports/defaults/branch prefix through its ended return, and complete ended leaf. Independently reconstructed all 81 phase snapshots across 27 files. This is candidate preservation review, not a second semantic audit of all retained 181 sites.

Frozen proposal manifest SHA-256: `736ce42f2cc6dcb915680facd3c0e0b52bb2c22a4fe5616a4abfe53425089288`. Root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, expected HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`. Current 27 test files and all 111 declared readset guards matched proposal bytes during static review; all declared artifact hashes matched.

## Why this transfer preserves the independent contract

Donor at test line95 directly renders `<PersonalPlanFieldTestEnded />` and observes two regexes. Keeper at line76 already uses real React `renderToStaticMarkup` on `<ResultPageClient ... />` with `quizKind="personal_plan"`, `hasAccess={false}`, `fieldTestUnavailable`, null offer/answers and supplied fixed lead/name/focus props.

In `src/app/result/[leadId]/result-client.tsx:33–138`, defaults and three local scalar derivations precede the result branch. `returningScannerOffer` defaults false, so its earlier scanner branch does not run. `quizKind` takes the Personal Plan branch; `hasAccess=false` skips paid continuation; `fieldTestUnavailable=true` returns `<PersonalPlanFieldTestEnded />` at line137 **before** null-offer recovery. The leaf receives no forwarded props: both paths reach `{}` and `unavailable=false`.

The whole leaf (`src/components/personal-plan-field-test/personal-plan-field-test-ended.tsx:1–19`) is a pure JSX function: no context, hooks, I/O, clock, state, imported collaborators or dynamic data. Its default branch emits the same heading/paragraph/classes in both paths. The extra parent identity props do not reach the leaf and therefore are not independent operative inputs for these assertions. Actual React SSR invokes function components; the test does not replace this leaf or manufacture HTML. The common preload only substitutes the `server-only` marker. Installed `react-dom/server.node.js` selects its actual SSR implementation; the inspected development implementation invokes the function through renderWithHooks, then renders its returned value. This supports the path analysis; no renderer or owner module was imported/executed in this review.

The keeper's prior negative `/Stripe|PayPal|Plan sichern|reactivate|checkout/i` does **not** subsume `/Abo|Zahlung|Stripe|PayPal|Preis/`. The proposal correctly moves both donor assertions verbatim, including regex case behavior, after all three existing keeper assertions. There is exactly one existing keeper render, no added inputs/calls/rows/tables/skips. The leaf's direct test import is unused after donor removal and removed only from that test. No production symbol/seam/file is removed.

I rejected a broader “leaf is retired” interpretation. Current callers include the result client and server result handling, standalone `test/haarplan/beendet/page.tsx:10`, moderator account ended state, and unavailable recovery branches. The true `unavailable` variant has different copy and is not claimed covered by C1. Current symbols and history provide no retirement basis, nor is retirement proposed.

## Independent reconstruction

`/tmp/test-audit-moderator183-independent.cjs` reads/parses without product imports or child processes. It separately verifies:

- 27 files / 81 complete snapshots parse; declaration phases 183→183→182.
- Transfer is precisely the original keeper plus the two verbatim donor assert statements.
- Cut is precisely transferred source minus the original donor registration and the single direct leaf import.
- All 181 unrelated callback bodies match byte-for-byte; all 13 held F callbacks remain unchanged; all other 26 complete files match.
- Existing keeper 3 + donor 2 = final ordered 5 assertion statements, exactly preserved.
- All 111 current source/dependency guards and manifest artifact hashes match.
- Both unique owner replacements produce the declared full-mutant SHA and parse as complete TSX. Their assertion start lines match the phase snapshots.

No original support bytes change beyond the explicitly removed test import and whitespace adjoining the removed donor registration. Source cleanup count is zero. No F fix or deletion credit.

## Controls are suitable, unrun witnesses

`C1-copy`: replace only default paragraph with `Der Testzugang wurde pausiert. Bitte frage das Chaarlie-Team, wenn du weiter testen möchtest.`. Existing heading, team and original negative remain satisfied by source analysis. New copied-positive regex fails first, expected `ERR_ASSERTION`, operator `match`, transfer first test frame93 / cut92. This demonstrates why heading/team assertions alone are weaker.

`C1-payment`: append ` Abo` only to the same default paragraph. Original heading/team, original negative (which lacks Abo), and transferred positive remain satisfied. Transferred payment-free negative is the first intended failure, expected `ERR_ASSERTION`, operator `doesNotMatch`, transfer94 / cut93. Its case-sensitive exact donor regex remains unchanged.

Both recipes target a real owner, not a fixture or test assertion. Shared paragraph anchor is unique; mutants remain full parseable TSX. Controls and messages are statically plausible; actual Node error operator/message/first frame, clean/restored success and exactly-one selection remain main-only runtime gates. Any setup/import/render crash, timeout, signal, zero selection, unrelated assertion or missing restore must not count as preservation evidence.

## Verification and limits

Static receipt: `/tmp/test-audit-moderator183-independent-static.json`. Result CONDITIONAL_PASS, zero repository writes, zero tests, zero source faults, zero owner imports, zero child processes. Only independent `/tmp` script/report/receipt were written. The report does not certify actual browser hydration, real auth, paid access, network, hosted operations, SQL or deployment; those untouched layers retain their original evidence/limits. Main must finish baseline, transfer, both serialized intended owner faults with byte-exact restoration and green keeper, then cut/full campaign gates. No operator tool prepared and no main decision presumed.
