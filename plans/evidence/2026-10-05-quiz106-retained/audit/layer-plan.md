# Quiz taxonomy — second-layer preservation plan

Verdict: **NO CUT. 106 → 106 → 106 declarations; 135 → 135 → 135 expected registrations.** The parent's “113” navigation label is approximate; its exact eleven file counts sum to 106. No files or cases were added to make up the difference.

The ledger retains 101 declarations and holds five assertion repairs. No production or test edit, source seam retirement, consolidation, mutation execution, or deletion credit is proposed. The empty diffs and identical whole snapshots are intentional.

## Boundary owners and keepers

| Boundary | Existing owner/keeper | Distinct observed risk |
|---|---|---|
| Interactive choices | `quiz-normalization.test.ts:13,19` → `toggleTreatmentSelection` | Selection transitions and canonical order, not just final valid input |
| Stored input repair | normalization tests → `normalizeStoredQuizAnswers` | Legacy vocabulary, missing fields, malformed arrays, trimming and clamping |
| Current write admission | `quiz-validators.test.ts` → `quizAnswersSchema` | Invalid input rejection, required current facts, cross-field consistency |
| Canonical write shape | normalization + primary-concern canonical tests | Stale pick dropping and omission, conflict repair, current goal preservation |
| Persisted draft format | `quiz-draft.test.ts:41-229,295-360` → save/load | Raw storage version/shape, TTL, invalid-record clearing, v1 compatibility |
| Draft/store integration | `quiz-draft.test.ts:239-294,393-448` → actual Zustand store | Persisted next step, verified identity mode, current package authority during restore |
| Package screen contract | `quiz-screen-order.test.ts` → screen-order + actual store | Separate screen/history/question/progress behavior and actual forward/backward transitions |
| Stated concern | primary-concern resolver table | Raw optional/contained/stale/single/multiple choice semantics |
| Need lane | direct need tests | Exact legacy primaryConcern plus lane, conservative fallback and ordering among competing rules |
| User-facing narrative | primary-concern narrative tests, compared with full `quiz-result-narrative.test.ts` | Raw statement copy, neutral legacy fallback, no-goal score tie, medical boundary |
| Preview integration | `quiz-primary-concern.test.ts:281` → actual `buildQuizOfferPreview` | Raw statement passed through a lossy canonical/profile projection |
| Preparation scheduling | preparation tests → actual scheduler and readiness helpers | Matching user/lead receipt, deadline, cancellation, policy before side effects |
| Result routing | result helper tests → `QuizResults`' actual called helper | Safe encoded completion path and authority-dependent suppression |
| Return lead selection | selection tests → actual credential module's pure selector | Email normalization, eligibility, timestamp/ID ordering |
| Return choice transport | choice tests → actual route handlers | Emitted event/destination/body, real signed session serialization, branch-specific edit cookie |
| Return edit privacy | edit tests → actual context route/helper | Exact projected identity shape; zero identity reads before choice authority; same-email consent policy |

## Consolidations rejected after whole-assertion/input comparison

1. **Raw draft package test (`quiz-draft.test.ts:295`) → scan store restoration (`:393`).** The donor observes `version=2`, raw `step=16`, raw `funnelPackageKey`, then the loaded step/package. The keeper observes only restored store step/package. `restoreDraftWithPackageKey` reads and rewrites saved bytes around `reset`, but does not expose the raw parsed record or the loaded draft. `store.ts:141-145` takes the package from current store state, so a wrong saved package could still produce the keeper's expected package. `loadQuizDraft` always returns version 2 (`draft.ts:133`), so a wrong serialized version can also be hidden. Fixture thickness is fine in the donor and normal in the keeper: it is not an identical fixture. Adding a read/parse, changing shared helper result shape, or adding conditional assertions for only one helper call is not an authorized no-call-expansion transfer. **Retain both.**

2. **Direct frizz need result (`quiz-primary-concern.test.ts:131`) → raw preview (`:281`).** The direct call returns and checks both `primaryConcern='frizz'` and `lane='surface_support'`. Preview uses `frizz_flyaways`, runs canonical projection, and exposes only lane; `surface_support` also results from dryness/tangling or suitable goals (`need-lane.ts:134-143`). Its lane cannot prove the exact returned primaryConcern. The alias mapping and integration override are independently meaningful. **Retain both.**

3. **Hair-loss medical boundary (`quiz-primary-concern.test.ts:267`) → the hair-loss row of `NON_LEGACY_COPY` (`:250`).** The existing table uses two concerns, an explicit pick, and `goals=['moisture']`; the medical test uses a single concern and no goals. The former enters surface support and the latter base, with different `needs.mainLeverProducts` (`result-narrative.ts:968-1015`). A copied regex on the table row would not preserve the no-goal branch's medical promise boundary. Adding another call/row or packing a branch-specific condition into a table does not establish equivalence. **Retain both.**

4. **Need-lane table (`quiz-need-lane.test.ts:98`) → richer narrative/preview tests.** Full overlapping narrative and preview files were read. Their fixtures commonly add goals, switch texture/treatment, or use different concern sets. Those are consumed by `resolvePrimaryQuizGoal`, chemical-stress priority, and lane checks (`need-lane.ts:43-154`). A similar headline/product is not an exact rule-input keeper; no row is transferred or deleted. **Retain the 14 existing rows and overlap precedence test.**

5. **Normalization → strict validation.** Normalization intentionally filters/repairs/trims/drops fields; validation rejects malformed current writes. Stored schema makes hair length optional while current schema requires it (`validators.ts:106-118`). Raw read and canonical write also differ in handling missing concerns (`normalization.ts:206-212,233-254`). One cannot replace the other's negative or repaired-shape assertions. **Retain both layers.**

6. **Preparation readiness → result redirect or UI source grep.** They return different contracts and consume different state: checked user/lead identity versus completed subscription checks. Cleanup and timeout have opposing settled outcomes and independent scheduler paths. Pure artifact trigger policy cannot prove actual network delivery across mounts. The current scope's source-text assertions do not provide a stronger executable keeper. **Retain; record the three coupled source checks as F where applicable.**

7. **Selection's “remains bound” test → issuance/resolution tests.** Full `quiz-email-return-credential.test.ts` was inspected. Issuance does observe `source_lead_id` and hash passed to an injected insert; resolution uses a supplied RPC row. Neither mutates a persisted newest-lead set and then redeems an existing capability. The owned test only keeps an earlier returned object. A name or a mocked receipt is not lifecycle preservation. **Hold F unchanged, without deletion credit or new database fixture.**

## Five held F declarations

All five remain byte-for-byte unchanged, including their useful assertions.

| Location | Gap | Future proof requirement (not implemented) |
|---|---|---|
| `quiz-normalization.test.ts:126` | `indexOf`/`findIndex` verify first occurrence and exact object, not “once”; a later duplicate remains invisible | Verify uniqueness at the actual taxonomy and shared option outputs while retaining both ordering checks and all object fields |
| `quiz-screen-order.test.ts:288` | Useful runtime predicate assertions coexist with local identifier-sensitive page-source wiring regex | Preserve predicate cases and exercise actual step event emission/absence at a supported page boundary; identifier renaming must not fail |
| `quiz-preparation.test.ts:25` | Literal `router.prefetch` count and source-position ordering are not commitment delivery | Observe no precommit prefetch and one commitment-owned prefetch; retain actual offer-view side-effect concern from PR #242 |
| `quiz-result-routing.test.ts:66` | Six exact source expressions do not observe rendered focus/entry and fail a local rename | Existing real result route boundary must observe all focus, prop and `result_email` outputs for the original effective inputs before retirement |
| `quiz-email-return-selection.test.ts:72` | Two pure selections plus old-object identity do not prove persisted binding | Issue once, add a newer eligible lead, redeem the original persisted capability and observe the original source lead; existing Node mock receipts are insufficient |

The artifact trigger helper (`quiz-preparation.test.ts:147`) is retained as a narrow policy test. Its assertions catch premature/repeated same-lead permission; they do not establish actual delivery or exactly-once behavior across component lifecycles. Similarly, choice/context routes are real handlers with injected external collaborators, not proof of database ownership, cryptographic source validation or browser cookie transmission.

## Source reachability and retirement limits

The core helpers have current non-test consumers. Examples: treatment toggling in `quiz-question.tsx:73-78`; stated chooser in `quiz-concerns-question.tsx:55-66` and personal-plan quiz `:2841`; draft restoration in `/quiz/page.tsx:176-196`; step order in `store.ts:37,43`; motion order in `quiz-shell.tsx:31`; strict lead admission in `/api/quiz/lead/route.ts:141`; stored validation in `/result/[leadId]/page.tsx:174-178`; consent parser/inheritance in `quiz-lead-capture.tsx:253,329`; selector in credential issuance `email-return-credential.ts:200`. No default-unreachable or retired product path is inferred.

`buildResultNarrative` at `result-narrative.ts:1045` is a textual alias with no match in the bounded source/scripts/tests/docs/plan search outside generated evidence. No owned test calls it. This audit does **not** claim closed public/dynamic export reachability and proposes no deletion or credit for it. Step and motion forwarding functions remain live and have distinct production callers.

Historical rationale was checked against current source: #611 (`f452cb04`) replaced inferred ranking with a raw stated pick; #534 (`f8c28328`) introduced package-aware scan inserts and v2 draft metadata; #587 (`f918bf16`) introduced returning identity prefill; #242 (`fb96d014`) fixes premature offer views from speculative prefetch. These are historical local records, not deployment claims.

## Verification and limits

The AST parser imported only TypeScript tooling, never tests or owners. All 11 complete tests parsed; inline helpers, existing tables and every assertion/call expression are captured. Four literal-table registration sites expand the 106 sites to 135 expected tests (11+4+4 primary concern rows, 14 need-lane rows). This is a static count, not a TAP result.

All 32 original test/source pins are unchanged. The before/transfer/cut directories each contain the same 11 full files; all 106 callbacks, inline support, input rows and call topology are byte-exact. Empty source/test diffs mean no lost assertion and no new inputs/calls/rows/packing/skips. Controls are empty because nothing is proposed for removal.

`read-scope.json` separates complete reads, operative slices, and mechanical pins. The 87 entries are **not** 87 fully audited modules: package/lock/compiler hashes are mechanical; large consumers and Zod/Next/Node types are slice-scoped. Three overlap suites are comparison reads, not new ledger credit. No full Supabase/runtime dependency tree, provider, database schema/lifecycle, browser execution, integration/native suite, or coverage result is certified.

CI routes these top-level `.test.ts` files through `package.json`'s `test:node`; `.github/workflows/ci.yml:146-160` installs dependencies and runs that command using `.nvmrc`. No CI task was run here. The parent owns any current baseline reconciliation. This no-cut outcome contributes zero removals toward the campaign target and requires no integration command.
