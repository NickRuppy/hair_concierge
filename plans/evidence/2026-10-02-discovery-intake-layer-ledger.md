# Discovery intake/classification coherence audit — read-only

Scope is the four existing requested files; tests/discovery-intake-normalization.test.ts does not exist. AST inventory: **91 declarations**: intake API 38, flat API 38, classify 8, classify-b7 7. Dynamic endpoint/table loops are annotations within those declarations, not extra declarations. The previously deleted classify-b7 fixture is not counted.

Read against participant routes, src/lib/discovery/intake.ts, classify.ts, intake-research.ts, shared guard, migration/PGlite intake keepers, CI, and history. No runner, provider, or repo write was used.

## Execution path and layer conclusion

build guard flow: guardDiscoveryIntakeRequest -> resolveDiscoveryIntakeContext before the legacy/flat branch. POST owns legacy row construction or flat type/usage/research composition; PATCH owns type/usage correction; submit uses either legacy heal/freeze or atomic confirmation RPC. classifyDiscoveryProduct is the deterministic UI producer, while its output persists later through the route.

This is not a mock-only layer: route fixtures invoke real handlers and real shared guard with dependency fakes only at I/O boundaries. PGlite migration tests prove DB constraints/RPC persistence but cannot prove HTTP status, request parsing, cross-origin ordering, research handoff, or response projection.

Marks: **R 86, C 3, D 2, F 0**. C preserves its assertion in a named retained route test; it is not table/grouping pruning credit.

## tests/discovery-intake-api.test.ts — 38 AST declarations

| line | mark | declaration / contract and keeper |
|---:|:---:|---|
| 177 | R | dynamic shared-guard unauthenticated test: four real endpoints return 401. |
| 183 | R | dynamic no-enrollment 404 mapping across those endpoints. |
| 189 | R | dynamic revoked-enrollment 404 mapping; revocation is filtered by live loader contract. |
| 196 | R | dynamic intake-owner mismatch 403, a code-only pairing with no DB FK. |
| 206 | R | dynamic enrollment-claim mismatch defence-in-depth 403. |
| 215 | R | dynamic kill-switch 404 before endpoint work. |
| 221 | R | dynamic enrollment failure maps 503, avoiding auth/data outage ambiguity. |
| 241 | R | POST freeze blocks writes. |
| 256 | R | DELETE freeze blocks deletion. |
| 268 | R | submit freeze blocks second submission. |
| 282 | R | legacy product write inserts before clearing none, returns safe browser projection, and scopes post-insert clear. Absorb C transfers: exact legacy insert payload and zero catalog-type reads from flat L422. |
| 327 | R | legacy none pre-clear/replacement order is distinct due to partial unique index. |
| 362 | R | failed product insert preserves prior category answer. |
| 381 | R | failed none insert pre-clears only information-free none rows. |
| 399 | R | post-insert clear failure returns stored answer rather than inviting duplicate write. |
| 417 | R | scan-ineligible product is 422 with no writes. |
| 438 | R | catalog-category divergence is stored under opened shelf category, not refused. |
| 480 | R | absent submission is indistinguishable 422/no write. |
| 494 | R | reviewer-filed-other-category submission persists under participant shelf category. |
| 517 | R | foreign submission gets same refusal/copy as absent, preventing ID probing. |
| 542 | R | own submission check receives guard session user id, not request data. |
| 562 | R | SQL-shaped ownership predicate includes id and user id; independent security guard for service read. |
| 603 | R | none sends no catalog identifiers and performs no identity lookup. |
| 622 | D | plain legacy happy-path 201/item-id replay. Keeper L282 uses same validCapture, real handler, 201, response projection and clear ordering. No assertion is lost. |
| 630 | R | malformed capture rejects before table write. |
| 654 | R | DELETE missing/intake-mismatched item is 404. |
| 661 | R | DELETE own item passes intake-scoped id to persistence. |
| 682 | R | legacy submit rejects no stored answers. |
| 695 | R | one stored answer is sufficient; untouched categories remain untouched. |
| 711 | C | full-checklist success repeats submit success. Move its response-state assertion to L695, then remove this declaration; L695 remains minimal-rule keeper. |
| 732 | R | contradiction heal is ordered before freeze. |
| 763 | R | empty submit refuses before heal/write. |
| 778 | R | healer deletes only contradicted categories' none rows. |
| 832 | R | consistent input produces no heal write. |
| 855 | R | identify rejects invalid EAN before catalog access. |
| 867 | R | identify returns identity only, no suitability/commerce verdict. |
| 889 | R | ineligible catalog hit is unknown. |
| 908 | R | unknown barcode is unknown. |

## tests/discovery-intake-flat-api.test.ts — 38 AST declarations

| line | mark | declaration / contract and keeper |
|---:|:---:|---|
| 165 | R | catalog type overrides client type while participant usage/role and post-insert clear persist. |
| 205 | R | flat catalog capture eligibility 422/no write. |
| 216 | R | typed product opens research from product type under current user, while usage remains separate. |
| 240 | R | dm capture opens EAN research with textual prefill. |
| 260 | R | research catalog match replaces type/identity but does not mutate participant usage. |
| 284 | R | failed research deliberately still stores item without submission. |
| 304 | R | unknown product stores null type/usage and opens no research; response omits optional fields. |
| 323 | R | unknown barcode remains its own identity in unknown flow. |
| 334 | R | insufficient research identity stores typed item without scan call. |
| 347 | R | usage without type returns product_type_required before write. |
| 359 | R | invalid pair returns HTTP 400/no write; PGlite CHECK alone cannot prove route mapping/order. |
| 373 | R | strict flat body rejects supplied submission id/unknown keys/legacy none abuse. |
| 398 | R | flat shape is frozen before parsing/insert; legacy shape cannot keep this branch safe. |
| 409 | R | flat-path insert exception maps 503. |
| 422 | C | move exact legacy insert payload and zero catalog-type reads to intake API L282. Keeper discovery-intake-items.test.ts:37 remains canonical builder/persistence-row proof; then remove this declaration. |
| 506 | R | PATCH changes usage only and preserves typed identity/research. |
| 524 | R | PATCH unknown usage does not clear/reopen research. |
| 533 | R | PATCH stores oil role with usage. |
| 545 | R | PATCH type-open item opens research from newly selected product type. |
| 565 | R | PATCH may type open item while usage remains unknown. |
| 574 | R | PATCH type locking protects catalog/known identity. |
| 587 | R | PATCH rejects usage on type-open item but permits remaining unknown. |
| 600 | R | PATCH filters foreign, missing, and none rows before writes. |
| 613 | R | conditional update race maps 404. |
| 622 | R | PATCH schema and invalid usage-pair mapping. |
| 637 | R | PATCH draft-only freeze. |
| 648 | R | PATCH owns missing guard coverage absent from original four endpoint loop. |
| 663 | R | PATCH persistence exception maps 503. |
| 722 | R | confirmed submit is one atomic RPC call, no legacy helper calls. |
| 735 | R | confirmation RPC outcomes map to exact HTTP responses plus outage. |
| 755 | R | non-confirm body rejects before RPC. |
| 765 | R | submitted check happens before confirmation RPC. |
| 772 | R | no-body legacy submit remains supported compatibility path. |
| 781 | R | RPC wrapper sends intake id and maps/validates all outcomes. |
| 836 | R | catalog-type adapter filters unsupported/missing categories. |
| 842 | R | row/view projection carries product type/role only when present. |
| 896 | R | cockpit read loader preserves legacy object shape while surfacing typed row. |
| 930 | R | POST/PATCH/submit reject missing/foreign Origin before guard; CSRF/order contract. |

## tests/discovery-classify.test.ts — 8 AST declarations

| line | mark | declaration / contract and keeper |
|---:|:---:|---|
| 116 | R | TYPE_FIXTURES table covers T1–T12 precedence, never-guess, compound/word-boundary and unknown behavior at classifier producer. |
| 279 | R | STEP_FIXTURES table covers P1–P8 question/preselection/fixed behavior. |
| 354 | R | adversarial end-to-end table composes type and step; isolated T/P tables do not replace it. |
| 371 | R | exact German oil question/options/roles are participant-visible and persistence-linked. |
| 393 | R | exact care/shampoo vocabulary includes pre-wash conditioner; participant-visible protocol. |
| 415 | R | emitted-question to independent-validator composition: catches a newly added or changed invalid option even where individual static maps still compile. PGlite does not consume UI option constants. |
| 422 | R | exhaustive role/category predicate, including routine-role rejection, guards API validator vs DB contract. |
| 456 | R | product-family legitimacy is a one-directional classifier rule and has distinct allowed/denied pairs. |

## tests/discovery-classify-b7.test.ts — 7 AST declarations

| line | mark | declaration / contract and keeper |
|---:|:---:|---|
| 27 | C | move explicit fourth-option key conditioner_pre_wash into classify L393 alongside its existing label/usage assertion, then remove this declaration. |
| 36 | D | D1 pre-wash-only-conditioner matrix duplicates classify L422 exhaustive role/category matrix. No lost assertion. |
| 49 | R | styling is intentionally a discovery type but excluded from evaluated categories. |
| 85 | R | spray type fixture table covers T13 priority against typed/catalog/never-guess cases. |
| 94 | R | exact German spray question/options are user-visible D2 protocol. |
| 150 | R | spray preselection table covers P9–P12 at composed classifier boundary. |
| 161 | R | never-guessed versus typed spray end-to-end step routing. |

## Redundant sublayer plan

Deletion-ready declarations: **2**: intake API L622 and classify-b7 L36. Exact retained proof is identified above. Do not count dynamic-row/table reshaping as pruning.

Consolidations: **3**, transfer assertions first:
1. intake API L711 response state/submittedAt assertion -> L695, then remove L711.
2. flat API L422 exact legacy inserted row assertion and zero catalog-type-read assertion -> intake API L282, then remove L422. Its producer/persistence keeper remains discovery-intake-items.test.ts:37 and PGlite row suite.
3. classify-b7 L27 explicit fourth-option key conditioner_pre_wash -> classify L393, then remove L27.

No source or test-support seam is unlocked: all route dependencies, schemas, classifier exports, and persistence helpers have non-test callers. Consumers include participant checklist components/pages, intake POST/PATCH/submit/identify routes, and admin cockpit projection/read paths.

Risks:
- Removing route tests because a DB migration has the same CHECK loses HTTP status/no-write/order semantics.
- Removing classifier T/P tables loses German precedence and preselection before persistence.
- Apply C only after moving exact assertions; table reshaping earns no line-count credit.

Validation for an applying owner, not run:
- node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-intake-api.test.ts tests/discovery-intake-flat-api.test.ts tests/discovery-classify.test.ts tests/discovery-classify-b7.test.ts
- node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-intake-items.test.ts tests/discovery-intake-usage-migration.test.ts
- git diff --check
