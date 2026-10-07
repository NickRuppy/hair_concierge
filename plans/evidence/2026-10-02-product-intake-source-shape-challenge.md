# Product Intake source/private-shape challenge — 2026-10-02

## Decision

**One whole declaration C; no whole declaration D.** Also identify three assertion-only F repairs, with **zero quota credit**. The earlier R206/C1 ledger overstates the value of private implementation-name assertions and uses stale counts. Current final299 inventory is **205 sites**: submissions51, review-app39, workflow26, enrichment23, lookup23, matching22, research-jobs21. The two old final-handoff sites are already removed and excluded.

This is a bounded second lens, not a re-audit of all205 callbacks. Complete contested callback reads: research-jobs202,222,232,257,280,305,325,340,348,382,400,429,442,784,956,982,1006 (17); review-app1026,1069,1209 (3); submissions1449 (1). These21 declarations contain the direct source/private-shape leads assessed here. Additional full reads: research-jobs583 property-row oracle, review-app1216/1240/1305 approval keepers, all three finalized-image-route tests, all three product-intake-repository tests, and review-scripts62 package entrypoint assertion. Source/caller reads were focused on the actual candidate and limiting evidence below; no claim of fully reading the 3,500-line renderer module or entire Next cockpit/worker implementations.

## C1 — remove one redundant label/private-name declaration

**Donor:** `tests/product-intake-review-app.test.ts:1209`, `review app can bulk approve all properties`.

Complete body:

```ts
test("review app can bulk approve all properties", () => {
  const html = renderAppHtml()
  assert.match(html, /saveAllPropertiesApproved/)
  assert.match(html, /Alle Eigenschaften passen/)
})
```

**Primary retained keeper:** same file:1026, `review app explains broken images and final image metadata`. It calls the same actual `renderAppHtml()` with the same empty argument list and already asserts the exact literal `/Alle Eigenschaften passen/` at:1063. No fixture distinction, environment distinction, branch or argument is lost. No assertion transfer/new test site required.

**Unique removed assertion:** `/saveAllPropertiesApproved/`. The function is a lexical name inside the generated HTML's inline script. Source census finds only the actual callback invocation at `scripts/product-intake/review-app.ts:3188`, definition:3433, and this test assertion. No exported API, HTML ID, query selector, persisted field, RPC, package command, prompt or operator instruction consumes that identifier. The button's actual DOM id is `approve-all-properties` and HTTP endpoint is `/api/package/property-review`; neither is the asserted identifier. A consistent rename of definition and invocation preserves behavior and fails only the donor's private-name assertion.

**Actual source trace:** `createReviewAppServer` → `routeRequest` GET `/` at:1856 → `renderAppHtml`:2045 → generated button markup:3138 → private click callback:3188 → loop:3433–3458 → HTTP property-review route and package-local writes. Fully read those source sections and the entire helper body. The helper sends each row's path/value, approved status, null reviewer_value, empty notes, reviewer nick and one timestamp, then reloads detail. The donor never executes any of this client behavior. Deleting the click binding while leaving the function text would pass the donor; its title is therefore not evidence of bulk approval behavior.

**Loss/risk:** no new loss of a tested interaction, row-count, request or write-order invariant. Bulk-click execution remains unproven by both source-string tests; do not describe the retained label keeper or per-property persistence tests as proving the bulk click. Existing actual package approval tests:1216/1240/1305 preserve missing-image/finalization, stale-value invalidation and successful fully approved package persistence. These are distinct gates and remain.

**History and reachability:** source/test introduced under July6 consolidation `b4fb21f4`; actual operator remains registered and documented as fallback (next section). This cut is redundant observation/private-name removal, **not feature retirement**. Root `test:node` selects `.test.ts`, invoked by CI quality-node; the generated HTML owner remains reached after removal.

**Integration:** remove only donor block. Keep `renderAppHtml` import (used by two retained tests); no source/support/module/package cleanup. Exactly1 AST site, not a table/case regrouping.

**Parent-run controls, not run here:**

- Baseline focused donor+keeper green.
- Actual-source behavior-preserving control: consistently rename exactly the two inline-script `saveAllPropertiesApproved` occurrences to `approveEveryVisibleProperty`. Old donor must fail its identifier regex; retained keeper must stay green. Restore exact bytes. This validates the claimed private-name dependence, not bulk correctness.
- Actual-source public contract control: change the sole `>Alle Eigenschaften passen</button>` label to `>UNEXPECTED BULK LABEL</button>` in `review-app.ts`. Retained keeper must fail its literal label assertion. Restore exact bytes and verify green.
- After deletion, selected keeper remains green. Native command: `node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='review app (can bulk approve all properties|explains broken images and final image metadata)' tests/product-intake-review-app.test.ts`. Complete focused file and whole coverage are parent's integration gates; no coverage equality claimed without measurement.

## Old generated-HTML operator is not proven retired

The new Next cockpit is a separate implementation, not a stronger execution boundary around the old HTML renderer. `tests/product-intake-review-app.test.ts` imports **scripts/product-intake/review-app.ts**. The giant research-jobs inventory reads **apps/product-intake-review** pages/routes/CSS. Do not cross-credit one app's render or persistence tests against the other's delivery.

Evidence against inferring legacy retirement merely from age/package registration:

1. Current canonical `docs/product-intake-research-ops.md:43–49` explicitly retains the legacy package's approve-package handoff;:77–83 separately defines package-local review files and the legacy UI's no-Supabase-write boundary versus the new cockpit's durable state writes. These are different operational contracts. :783–793 describes property values, evidence, per-row actions, bulk approval and reapproval after changed payloads.
2. The new cockpit plan is explicit: `plans/2026-06-30-product-intake-review-cockpit.md:600–607` introduces workspace/app and states **“Keep local package app available as fallback.”** Its goal replaces the old package-app mindset, and:329 allows replacing prototype-bound parts, but neither is a full retirement declaration. :825 leaves continued local-package support as a question. The current runbook still preserves its boundaries.
3. `package.json:94` has `products:intake:review-app`;:93 has research-queue; new cockpit commands:117–121 coexist. Old app `main()` still binds only127.0.0.1 with port3908 default and configurable package root. Route GET `/` still serves actual generated HTML.
4. Executable `scripts/product-intake/research-queue.ts:7–14` imports `classifyReviewPackageState`, `listReviewPackages`, `readReviewPackage`, `requestReplacementImageSearch` plus types from old app. It calls these at:111,166,197,279,302,318. Thus **whole-module** deletion would break a separate research/package operator even if HTML UI retirement were later authorized.
5. July6 `b4fb21f4` consolidates both implementations and introduces the runbook distinction. August10 `12619247` later updates the old HTML's category labels for heat/scalp, showing it was maintained after the cockpit's introduction. Current runbook's latest history is September27 `14127b07`. These edits corroborate support but do not establish present operator usage.

**Truthful limit:** no current UI-traffic/operator-session evidence was collected, nor any local package contents opened. I cannot establish how often Nick uses the old app today. The evidence establishes an intentionally preserved fallback with current callable entry and downstream helpers; it does not establish active daily usage. No large legacy closure is deletion-ready under the current record.

## Assertion-only F repairs: exact private dependence, no AST credit

**F1 — research-jobs:442, detail page inventory.** Earlier blanket R is too broad. Seventeen `assert.match(reviewCockpitCss, /.../)` checks only pin these private selector spellings: `cardProgress`, `actionMessage-error`, `cardActions`, `reviewActionPanel`, `completedButton`, `jobActivityPanel`, `jobActivity-running`, `workerSnapshotPanel`, `workerSnapshotCard`, `workerSnapshot-current`, `imageSearchProgress`, `imageProcessingProgress`, `progressStep-active`, `progressStep-error`, `brandReviewCard`, `identityEditor`, `identityCandidate`. CSS definitions were located in actual globals.css and corresponding JSX class use in page/actions. Consistent selector+JSX renaming preserves rendering and fails these assertions. They do not establish computed style, visibility, pending/error state or accessible progress. Remove these identifier-only assertion lines or replace with a real rendered-state observation when an appropriate fixture is available; **retain the declaration**, its public operator text and exact protocol/security distinctions. Do not mistake `position:sticky` negative rule for a private-name assertion: it encodes an actual layout behavior and needs a separate decision/behavior keeper.

**F2 — research-jobs:1006, queue inventory.** `QueueFilter` type spelling, private constant/function/variable names (`completedSubmissionStatuses`, `isCompletedQueueRow`, `filteredRows`), exact `.map` spelling and CSS `queueFilters`/`filterButton-active` fail harmless implementation refactors. Current queue page uses local state/memo filtering and actual buttons, while queue route preserves special waiting_for_review/exhausted-attempt behavior. No retained executable Next queue rendering/filter keeper was found in inspected test references. Repair towards actual approved/submission done and waiting_for_review/max-attempt fixtures before deleting this whole declaration. The separate CLI queue-reporting tests concern a different owner and are not replacements. Whole-site deletion not justified.

**F3 — review-app:1069, compact property table.** The two class-name assertions and negative `/property-card/` assertion are private presentation spelling. The `<th>Eigenschaft</th>`, `<th>Entscheidung</th>`, `Aenderung anfordern`, `Codex diese Eigenschaft ueberarbeitet` assertions observe generated operator artifact text and remain distinct. Owner: renderPropertyRows generated template at review-app:2936–2980. Canonical runbook:783–793 requires inspectable row values/actions/evidence. Keep whole declaration; existing:1026 does not already assert these table headers. Folding the remaining distinct table contract into an adjacent test only for count would be regrouping, not this lane's recommended cut.

These F repairs do not justify claiming runtime UI coverage. Main may leave them for a behavior-test improvement if unable to preserve the intended observation proportionally.

## Other contested sites: reasons not to cut here

- research-jobs:202/222 workspace package scripts/exports/exclusion: actual operator command and build-boundary contracts, not private helper names. The old Phase4A scripts keeper covers different command keys; combining lists is quota-only regrouping.
- :232 status constants/concurrency and :382 SQL partial-index membership: storage lifecycle vocabulary and concurrency defaults, plus explicit terminal exclusion. They are not arbitrary TS member spellings. No matching stronger input-complete execution keeper shown.
- :257/280/305/400/429 migration/RPC/RLS/auto-enqueue/artifact sets: retain in this lane. Some local SQL identifiers could be improved, but role grants, lock predicates, lease ownership, trigger behavior and persisted artifact enum are distinct actual schema contracts. No claim source grep substitutes for PostgreSQL execution; no blanket D.
- :325 repository schema: the apparent sibling `tests/product-intake-repository.test.ts` tests **src/lib/product-intake/repository.ts**, while source inventory reads **packages/product-intake-core/src/repository.ts**. Different implementations. Its three tests cannot absorb job-table fallback and alias projections without actually invoking the package repository. Whole C rejected.
- :340 local-only guard: finalized-image-route test executes its GET and proves remote403/local404 through the real helper, but does not invoke queue GET; queue composition remains a separate guard. Moreover real helper loads local env files on first call; any future focused execution must use a deliberately env-free isolated cwd/harness. Do not treat existing image test as all-route security proof or run it here.
- :348 worker kick: mixes private names with actual watch/concurrency/poll/environment/external-worker command contract across five different mutation routes. No actual spawn/route keeper identified; whole cut rejected.
- :784 worker inventory: mixed private names and uniquely asserted prompt literals, reviewer authority instructions, source restrictions, lease refresh/locking and persist-before-shadow-evaluation ordering. Two actual writePromptPacket tests in name-only seam are useful navigation but not proven complete keepers; no wholesale transfer claimed.
- :956 publish gate and :982 decision gate: actual Next publish route remains409 and preflight writes only preview. Decision paths/flags/human override and worker readiness are not removable just because their source test also pins helper names. Local HTML final-approval tests use a different owner; no complete equivalent route keeper inspected.
- submissions:1449 OPEN_SUBMISSION_STATUSES exact four values: this is query/state vocabulary used by pending scan and submission dedupe, not only an export-name assertion. No input-complete stronger same-owner keeper demonstrated; retain pending such evidence.
- lookup/matching/enrichment/workflow: navigation found no comparable direct source-text inventory requiring a new whole-site challenge. Their fake catalog/repository seams do not, by themselves, mean the real matcher/validator observations are mock-owned. Those callback cohorts were not re-read in full; no new R/F/C/D verdicts fabricated.

## Scope and handoff

Machine candidate: `/tmp/test-audit-product-intake-source-shape-candidates.json` contains C1 only, with exact anchors, keeper, losses and controls. No new files or source extraction needed; no repository edits, test runner, source mutation, browser, provider, DB, env-file read or publication occurred. Main owns the pending baseline/rename/label controls and final integration. This report recommends **1** new whole-site cut, subject to those controls, and no automatic legacy-app retirement.

## Main integration

C1 only is applied, exactly one AST site; F1–F3 assertion-only proposals remain unapplied. Actual owner consistent two-occurrence private rename made donor fail `/saveAllPropertiesApproved/` at original:1212 while same-input retained keeper passed. Sole public label fault made keeper fail `/Alle Eigenschaften passen/` at:1063. Complete logs/green surrounding cases/byte-exact restoration: `/tmp/test-audit-product-intake-private-controls/receipt.json`. Before the cut, Discovery+review-app214 native cases pass; after the cut and formatting the combined Stage4+Discovery+review-app287 pass (74+175+38). No bulk-click interaction or provider/DB proof is inferred. This mini-slice contributes1 net test deletion; generated app/code remains supported unchanged.
