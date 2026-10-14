# Discovery operational helpers — bounded second-layer plan

Read-only proposal, 2026-10-05. Root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`. Main alone decides, edits and runs tests/faults. This lane wrote only its `/tmp/test-audit-discovery-operational163` artifacts and imported only the installed TypeScript parser for static analysis. No product import, test, browser, build, provider, database or environment-file execution/read.

## Exact scope and prior review reconciliation

`inventory.json` has all 24 current files and 163 exact declaration bodies, including every fixture/helper/literal row from their full before snapshots. `ledger.json` and `ledger.md` classify every site: **R157 / F1 / C5 / D0**. Native/PGlite/SSR/jsdom boundaries remain separate. No browser spec is in these 24 files. Runtime callback counts are not claimed from AST sites; rows and loops remain unchanged.

Earlier ledgers are different exact files, even where owner modules overlap:

- `/tmp/test-audit-discovery-participant-operator-complete-ledger.md`: participant132 (multi-product, add-flow, participant-flow, enrollment-service, admin-read-model, research-status, concern-recipes).
- `/tmp/test-audit-discovery-cockpit-owner-layer-ledger.md`: cockpit120 (cockpit-api/model/page/research/usage, comparison-table).
- `/tmp/test-audit-discovery-consult-complete-ledger.md`: consult189 (call-sheet-save, consult-generate/knowledge/lint, refined-routine, runsheet-frequency).
- `/tmp/test-audit-discovery-intake-complete-ledger.md`: intake163 (application, intake-api/intake-b7-api/intake-flat-api, claim-route).
- `/tmp/test-audit-discovery-runsheet-ledger.md`: runsheet-page.

These prior scopes do not constitute a complete semantic ledger for any of the present 24 exact files. Usage-correction, participant/consultation/prompt/billing cohorts and the pending Offer4 seven files are outside this proposal. No prefix-only coverage inference or removed historical site credit.

## The five conditional transfers

`candidates.json` includes complete donor, original keeper and prospective keeper bodies, all assertion expressions and hashes. `snapshots/{before,transfer,cut}/tests/` contains **all 72 complete files**, including unchanged files. `phase-map.json` pins every callback in all phases. `complete.diff` is prospective only.

### C1 — loading text into loading layout keeper

`discovery-products-loading.test.tsx`, donor ordinal1 (“reads exactly like…”) → ordinal2 (“reuses … layout classes and has no controls”). Both render `DiscoveryChecklistLoading` with no props and call the same `realEmptyScreen()` once. The latter renders `DiscoveryProductsScreen` with `items=[]`, `error=null`, camera false, landed null and no-op handlers. Keeper saves that existing call's output as `real` before passing it to existing `classes`; the transferred full text-sequence equality and fixed first-three labels reuse it. Two SSR calls remain two. Helpers `textSequence`/`classes`, all fixtures and exact labels stay unchanged. Both sides reach actual loading and real screen markup, not a copied hard-coded rendering.

Operative readset: loading component, products-screen default branch, six-slot/order/category copy, UI classes, `cn`, and SSR motion hook initialization. Empty items means no product cards or continue action; React SSR does not run effects or no-op handlers, and no image request or browser paint is proved. Current route loader is the Next loading convention; real screen is rendered by `discovery-intake-checklist.tsx:600` and its authenticated page (`beratung/produkte/page.tsx`). Neither route auth nor prefetch timing is transferred or claimed.

Fault: loading owner's h1 `Deine Produkte` → `Deine Pflegeprodukte`. The new keeper first fails transferred full-sequence `deepStrictEqual`, transfer line55/cut47. A synchronized incorrect real-screen copy would still be caught by the retained fixed first-three expectation. No visual pixel equivalence claim.

### C2 — recommendation comparison into default Neu-dazu keeper

`discovery-cockpit-complexity-dom.test.tsx`, donor6 → keeper5. Both run `renderCockpit()` once with exactly the same default props: null complexity, unlocked, submitted intake, `addSteps()` mask essential/oil optional, row-present `ROWS`, ideal-origin recommendation. Both select `entryOf("Maske")`; keeper already has this exact mask and oil. Append the original table query plus six assertions (compact attribute, four header presence/absence checks, ARIA row product/target). Keep original benefit and pronoun-free checks. Donor's helper-level mask-exists assertion is already executed by keeper's identical `entryOf("Maske")` call. No extra render, input or event.

Actual owner `DiscoveryCallCockpit` → `StepDecision` → choice → `DiscoveryComparisonTable`; ideal recommendation passes `RECOMMENDED_HEADER`, compact no-owned-row table uses the supplied header for visible and aria text. Fixture covers one scalp row; no all-dimensions/unknown-status claim. jsdom React/testing-library executes actual components; fake router avoids navigation. `getByText` reads DOM, does not invoke product callbacks.

Fault: sole constant `RECOMMENDED_HEADER` → `Anderes Produkt`; first intended failure is transferred header assertion at line281 in transfer/cut, explicit existing `header` diagnostic `Anderes ProduktZiel`. ARIA check remains in union but this one control does not independently fault every table clause. Null-row and actual packshot tests remain separate.

### C3 — immediate fold into existing pending/refused save keeper

Same file, donor9 → keeper2. Both install the same `deferredFetch()`, run default `renderCockpit()`, and click Super essenziell once before any response settles. Move original fold-absent check before keeper's click and fold-present check after keeper's existing optimistic aria check, **before** the existing `await act` settles HTTP500. Existing PATCH URL/method/body assertion, rollback and error-copy assertions remain. Donor's un-settled request is eliminated; keeper still settles its original request. No new call/input/row; this is an identical execution prefix with additional existing keeper suffix.

`ComplexityChoice.choose` calls parent `onValue(next)` before fetch; parent fold derives from local `complexityValue`. `foldedSwapEntries` selects optional new nonresearch steps. The network spy manufactures only response delivery, not DOM folding. Changing the parent to derive fold from stale `complexity` prop leaves optimistic button aria true but fails fold presence. Intended transferred assertion line212 in both phases, message `optional steps fold before the save settles`. Existing initial-state fold, accepted/network failure, locked read, and refresh-ticket race callbacks remain untouched; this transfer does not prove persistence outside the injected request.

### C4 — legacy own-key shape into same default composition keeper

`discovery-refined-usage.test.ts`, donor3 → keeper2. Both call `composeLegacy()` with default identical LEGACY_ITEMS (including third oil), LEGACY_STEPS, two decisions, presentation/recommendation and product-line map. Keeper's existing third-oil binding, outcome, hash-inequality and not-unassigned assertions remain. Append every original step/item key assertion and unassigned-key loop, including empty/null-item short circuits. No added composition, changed fixture or synthetic legacy default.

Actual `composeDiscoveryRefinedRoutine` (`refined-routine.ts`) binds items and conditionally spreads optional metadata. `semanticHash` canonicalizes sorted JSON and drops undefined values. That means serialized hash equality alone cannot protect own-key absence. The exact historical one-per-step golden callback remains independent; default keeper's old-golden inequality is not claimed to replace it. Positive production callers exist in `cockpit.ts:554,649`, shared by current cockpit/PDF composition. No obsolete-data inference.

Fault: sole conditional `...(usageLabel ? { ownedUsageLabel: usageLabel } : {}),` → `ownedUsageLabel: usageLabel ?? undefined,`. Existing binder assertions still reach same items and canonical JSON ignores new undefined property; transferred own-key check fails at line218. Explicit message `legacy entry omits ownedUsageLabel`. Only one representative metadata fault is supplied; all four original shape assertions are preserved, not all individually mutated.

### C5 — submitted unanswered summary into same submitted page keeper

`discovery-unanswered-categories.test.tsx`, donor4 → keeper3. Both await `renderCockpit("submitted")` with identical original defaults. The helper composes real routine from four ideal steps and owned shampoo/explicit-none oil; fake allowed admin/flag/enrollment/intake loaders return the same values, injected ready model supplies routine. Page still executes real build-view, child components, and SSR; no render is added. Append original redundant-oil-footer exclusion and full exact six-category German summary assertion after existing per-step and explicit-none checks.

Boundary: the helper injects `createAdminClient: () => ({})`, null lead and ready model. Its unstubbed default `loadDiscoveryCallSheet` calls `.from` on that object, throws and is caught as unavailable, equally in donor/keeper. It cannot issue a live DB request. This is a real page/HTML composition path with controlled admission, **not proof of real admin auth or persisted call-sheet loading**. `OutsideRoutine` runs actual `composeRunsheetOutsideRoutine`, excludes categories already represented and uses `UNANSWERED_PREFIX`/suffix. Draft, all-gaps-answered and sourceHash tests remain separate. HTML PDF callback remains unchanged: it is not binary PDF/page-layout proof; badge class substrings can match embedded CSS.

Fault: page prefix `Nicht angegeben:` → `Nicht erfasst:`. Per-step honesty strings use separate owner text and remain valid. Transferred exact summary assertion fails first at line286 (assert statement start, not message line) in both phases, message `summary names exactly the six unanswered categories without steps`.

## Full assertion union and static proof

Before/transfer/cut sites **163→163→158**, assertion call sites **573→589→573**. Five removed donors contain 16 assertions; all transfer to five existing keepers. **153 unrelated callbacks are byte-exact**, as are all imports, helpers, literal rows, comments and bytes outside callback spans. Extra blank lines are intentionally preserved support bytes. No table consolidation, skipped site, added input, extra owner invocation, source cleanup or F repair.

Eight transferred bare `assert.ok` calls gain only explicit diagnostic messages: C2 one, C3 one, C4 four, C5 two. This avoids recursive Node assertion formatting on DOM-related failure and does not alter the predicate. C1 aliases an existing render result. `verify.cjs` tokenizes assertion argument expressions while preserving literal text; it verifies each keeper's exact original+donor condition multiset, allowing only message arguments and C1's explicit render-result alias. All 72 complete TS/TSX snapshots and all five complete owner mutants parse. This is syntax checking, not TypeScript type checking or runtime success.

`manifest.json` pins all 24 file phase hashes, 81 immediate/import/operative/support readset files, eight installed dependency package manifests (TypeScript, tsx, React, React DOM, Next, testing-library, jsdom, PGlite), Node binary/version, branch/HEAD/root. Hashing an import does not imply full semantic reading of all its callees. `import-edges.json` identifies direct test imports including type-only edges, not an executable graph. A future main-only operator must pin its own full installed runtime/transitive guards; this proposal is not an editor or fault driver.

`verify.cjs` is read-only, starts zero children and imports no owner; it rejects repository test/readset drift. `build.cjs` is artifact construction only (writes `/tmp`, uses read-only git/diff children); it is not necessary to rerun and must not silently repin a later state. No tool here applies snapshots or source mutants.

## Retained second-layer boundaries and F1

Every retained site's credible distinct regression is recorded in `ledger.md/json`; the main comparisons are:

- SQL text tests plus PGlite are complementary. PGlite uses minimal predecessor tables/roles and runs actual constraints, but selected assertions do not pin the entire category/source vocabulary, positive token constraint, complete REVOKE ALL/grant/policy text or migration filename ordering. Preserve source bytes and executable constraint tests. No live Postgres, deployed lineage or concurrent transaction claim.
- Heat-flow conversion calls parser for `ok` and returns its constructed object. Flow deep equality cannot replace parser return-value roundtrip. Empty versus air-only sources, undefined versus answered-empty, protection conditionals and malformed rows remain separate.
- Product-label no-line expectation calls the label helper, so simultaneous label drift could pass it. Literal label and apostrophe/word-boundary cases remain independent. Domain/static labels are not low-value by being deterministic.
- Row-to-image projection and actual SSR image/fallback are distinct inputs/layers. Depth-helper tests include real need-plan snapshots; malformed target catch and fingerprint omission cannot be inferred from a hand-authored DOM row.
- Middleware, route exactness, auth-confirm continuation, identity resolver and lead persistence use different admission readsets. Revoked identity is not proved merely by anonymous denial or a fake route resolver. Flags off, current ordinary customer admission, origin/email mismatch, no-dedupe and consent boundaries remain intact.
- Reconcile CLI runner uses injected gateways; source adapter recorder separately pins query admission/CAS predicates. No concurrency proof from sequential fakes. Dry run no-write does not establish zero second eligibility query; initial eligibility does not replace between-read-and-write recheck.
- Locked-in real-click rollback/success/refresh and stale complexity refresh race remain distinct from deterministic section render. No lifecycle test is discarded because a static output resembles it.
- F1: search-sheet ordinal6 claims footer comes after dm rows. `findAll` returns preorder; `JSON.stringify(element.props)` at the root contains all nested dm content, so `dmRow` selects the root ancestor. Moving footer above dm rows while retaining both makes `footer > dmRow` pass. Retain callback unchanged, flag weak ordering oracle for separate decision. Existing row presence still has value. This lane performs no repair, fault execution or count credit.

## Read depth, callers, history and CI

Complete tests/helpers/tables: all 24 files. Complete operative small owners: loading/products-screen/motion/category/UI classes, comparison table, cockpit component and its save/copy/decision helpers, refined-routine/canonicalize, heat-flow/parser, frequency/product-label/swap-sort, quiz projection/journey/participant/context, reconcile library and CLI, quiz-answer projection, load-ideal-routine/property rows, current admin page and runsheet products, both migration texts. Full test helpers include jsdom `tests/helpers/dom.ts` and custom search-sheet dispatcher; latter calls component directly and walks children without rendering nested component functions.

Larger shared owners are deliberately bounded to reached entry/path and dependencies: middleware imports + participant route predicates + complete update-session body through ordinary member fallback; auth-confirm sanitization/redirect helpers and actual handler through final response; quiz lead factory/defaults, discovery/partner/fallback admission and deliverability/catch path (unreached normal billing/enqueue delegates not exhaustively audited); cockpit imports and complete view builder with observed compose callsites (not every live DB/mutation delegate); intake image row/view projection; verdict-loader complete dependency wiring and selected conversion path; search-sheet component hook/request/derived/render path (research-only form implementation not implicated by candidates); analytics destinations/routes/tracker and Meta dispatch/booking helper (not entire provider runtime). Candidate owners and all candidate callback support were read completely except imported unrelated delegate internals. Installed package sources are not claimed audited; versions/manifest bytes are guards only. No hidden production side-effect claim derives merely from an import graph.

Positive callers: loading file convention and authenticated products page; checklist products branch at line600; admin page default `createDiscoveryCockpitPage()` and cockpit render; real cockpit composition at `cockpit.ts:554,649`; scripts `discovery` package command; analytics destination exports consumed by event dispatch. `callers.txt` records symbol search for navigation, not D closure proof. No D proposed, so broad dynamic/public package export closure is not asserted.

Per-file last-four history is in `history/*.txt`, with candidate-owner last-twelve in `history/candidate-owners.txt`. Relevant commits explicitly introduced current contracts: `feb9284…` batch8 loading transition; `cf7f460…` batch9 multiple products; `3a774a2…` consult runsheet; `694cb9a…` verdict/frequency layer; `fae51db…` complexity/comparison; `21c2813…` fold/photo iteration. The comments identifying legacy finalization pins and intentional hash drift align with that history. None is evidence of retirement.

Package `test:node` glob includes all 24 files. `.github/workflows/ci.yml:146–164` quality-node runs npm ci, then test:node, nested and agent suites using `.nvmrc` Node22. `server-only-register.cjs` replaces only the server-only marker in plain Node. React DOM SSR, testing-library/jsdom and PGlite are actual dependencies; their fake auth/router/gateway boundaries are stated above. This review did not run CI or claim browser/DB security from native stubs.

## Main-only next checks and limits

`main-commands.md` gives exact native commands and focused escaped keeper patterns. Start with independent semantic review, current guards and baseline. If accepted, main needs a separate guarded phase editor/serial fault operator and clean1→fault1 intended named ERR_ASSERTION at first keeper frame→owned byte restore→clean1 for each control. Reject import/setup/SQL/signal/timeout/zero-selection/unrelated-assert outcomes. This proposal's source-mutant files are data, not executable mutation instructions.

No runtime outcome, coverage change, final deletion count or original 2,379 target credit is claimed. The five controls are representative loss-detection witnesses, not exhaustive mutation coverage of every preserved clause. Main's current frozen coverage proof and other agents' files are untouched.
