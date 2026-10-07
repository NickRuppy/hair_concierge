# iOS product identity and retailer confirmation refinement

Status: **implementation-ready**. Date: 2026-09-19. Base: `origin/main` at `4d256179` (PR #588). This plan authorizes local implementation and verification only; it does not authorize commit, push, merge, deployment, migration, or App Store release.

## Outcome and chosen direction

All catalog-backed iPhone product cards use the same mature identity shape as the production routine: category is separate, while one deduplicated title is composed from brand, product line, and product name. The DM-assisted unknown-product sheet stops asking the contradictory “Ist das ein Shampoo?” question. It presents the candidate as `Produkt gefunden`, asks `Als was verwendest du das Produkt?`, preselects the suggested category, and submits only through `Zur Prüfung einreichen`.

The user can reject the DM candidate with `Nicht dein Produkt?`. The new client sends an explicit retailer-match decision (`accepted` or `rejected`) with the research request. The server persists that decision in the submission intake history for analysis. A rejected match suppresses the repeated submit-time DM enrichment for that research request; it does not create a permanent retailer-candidate blacklist for future resolved scans.

## Scope and non-goals

In scope:

- one server-owned product identity title formatter shared by the routine and mobile contracts;
- an additive, backward-compatible render-ready `displayName` for mobile search, assessment, alternatives, history, and identified DM candidates;
- category as separate card metadata and no repeated brand beneath an identity title;
- the approved compact German DM confirmation copy and interaction;
- an optional submit contract field recording `accepted` or `rejected`;
- durable, queryable retailer-match decision provenance in `product_submissions.intake_history`;
- unit, contract, native unit/UI, and visual fixture coverage.

Not in scope:

- editing a retailer product name or brand on iPhone;
- inventing or parsing a product-line name from unstructured DM text;
- permanently suppressing a rejected retailer candidate on future scans;
- asking whether the user owns/uses the product beyond choosing how they use it;
- adding a product directly to the routine;
- changing catalog publication or Product Intake review authority;
- a database migration, contract-version bump, new retailer, or production activation.

## Decision coverage

Decision coverage: **confirmed**.

- **Confirmed with Nick:** use the production routine identity shape for mobile product cards; category remains separate; adopt `Produkt gefunden`, `Als was verwendest du das Produkt?`, suggested category preselection, `Andere Kategorie`, `Zur Prüfung einreichen`, and `Nicht dein Produkt?`; do not ask a separate ownership/usage question. Nick additionally confirmed on 2026-09-19 that the technical retailer-match decision should proceed and that accepted versus rejected matches should be available for analysis.
- **Inherited from evidence or contract:** the server remains product identity and presentation authority for `/api/mobile/v1`; canonical brand and product-line names come through the same `brands` and `product_lines` relations used by the production routine, with scalar `products.brand` only as a legacy fallback; DM remains review-only evidence; installed clients must continue to work; `product_submissions.intake_history` already stores scan and retailer-enrichment provenance and is the durable analysis surface. While the native sheet checks an existing request it displays a busy state, then `In Prüfung`; it offers no second accepted/rejected action. The existing-open service path is therefore retry/race deduplication, not a second user observation.
- **Implementation defaults:** add optional `displayName` without bumping contract version 1; old clients ignore it and new clients fall back to existing fields when absent. Search matches canonical brand, product line, and product name server-side; iOS does not receive an otherwise-unused separate line field. Add optional `retailerMatchDecision: "accepted" | "rejected"` to submit. Omission preserves the current submit-time lookup for old clients. Explicit rejection skips that lookup and records a `retailer_match_decision` history entry on the newly created submission; explicit acceptance reruns the trusted server lookup, records the decision, and stores enrichment when available. The existing-open dedup path does not append duplicate decisions. The decision entry itself contains no barcode, account identifier, or raw product text.
- **Open consequential assumptions:** none.
- **Undiscussed consequential assumptions affecting this handoff:** none.

Coverage acknowledgement: Nick approved the concrete card hierarchy and one-screen DM proposal in the conversation ending with “We can work with that,” then explicitly approved the technical decision field and its analytical use.

Internal revalidation: checked against `main` `4d256179`, the production routine formatter in `src/lib/routines/shape-for-ui.ts`, mobile resolve/search/history contracts and services, `ScanResultPresentation.swift`, `ScannerView.swift`, `AssessmentSheet.swift`, `HistoryView.swift`, and submit-time DM enrichment in `scan-submit-service.ts`. The current submit route always reruns DM and has no rejection signal, so a contract field is required to make `Nicht dein Produkt?` truthful.

## Designed user journey

1. A signed-in user scans a valid barcode that is absent from the catalog and receives an exact DM candidate.
2. The sheet shows `Produkt gefunden`, a first-party-proxied image, and the best available deduplicated identity. DM-only candidates use only fields DM actually returned; no product line is guessed.
3. `Nicht dein Produkt?` rejects the candidate, removes its identity preview, and exposes the existing manual category path for the same barcode. A later submit carries `rejected` and does not attach DM enrichment.
4. If the product is correct, `Als was verwendest du das Produkt?` shows the suggested category selected. `Andere Kategorie` expands the existing supported category grid without rejecting the product identity.
5. `Zur Prüfung einreichen` sends the selected category plus `accepted`. The server revalidates DM independently, persists the match decision, and attaches trusted enrichment when still available. A DM timeout remains fail-open after the explicit category choice.
6. The existing compact `In Prüfung` confirmation and History handoff remain unchanged.

Catalog-backed search, assessment, alternative, and History cards show category separately and use the render-ready identity title. Price/status remains secondary. Older API payloads remain readable through native fallbacks.

Error and recovery behavior stays current: loading and retry states remain reachable, controls disable while submitting, Dynamic Type and Reduce Motion behavior remain intact, and `Nicht dein Produkt?` never discards the barcode.

Evidence review: the current device screenshots supplied by Nick established the duplicated/absent identity problem and contradictory DM copy. Nick approved the exact proposed hierarchy and copy. This is a faithful refinement of the existing native sheet, so no additional prototype is required.

## Target map and ordered tasks

### 1. Shared identity title and additive mobile payloads

Write failing tests for brand/line/name deduplication and mobile render-ready fields. Extract only the pure `(brand, product line, product name) -> title` composer behind the production routine's `appendDistinct` behavior; keep routine-specific pending/text-only branches in `shape-for-ui.ts` and keep their output unchanged. Mobile catalog queries join `brand_identity:brands(canonical_name)` and `product_line:product_lines(canonical_name)` through their existing foreign keys, matching the routine's authority order (`brand_identity.canonical_name ?? products.brand`, then `product_line.canonical_name`, then `products.name`). Thread optional `displayName` through `loadProductById`, `toMobileProduct`, primary results, alternatives, search, and History, and add category metadata needed by History. Search matching and exact-match ranking use canonical brand, product line, and product name server-side. DM candidates receive a render-ready `displayName` from available brand/name only; no line is parsed from text.

Consumes: catalog `brand_identity.canonical_name`, scalar `products.brand` fallback, `product_line.canonical_name`, `products.name`, and `category_key`; current routine behavior.

Produces: a single server formatter and backward-compatible mobile response fields.

Complete when: routine regression tests and mobile resolve/search/history contract tests prove canonical-brand parity, deduplication, line-aware searchability, separate category, and graceful absence of a relation.

### 2. Retailer match decision and durable analysis provenance

Write failing submit and Product Intake tests for accepted, rejected, omitted, existing-open, and DM-unavailable cases. Extend the request schema with the optional enum. Pass the decision into `submitScanProductIntake`, append `{ at, source: "retailer_match_decision", retailer: "dm", decision }` to the newly created submission's intake history when present, and suppress submit-time DM lookup/enrichment for rejection. Keep omitted behavior unchanged for installed clients. The existing-open race/retry path returns the existing submission without a duplicate decision entry.

Consumes: optional client decision and existing trusted server DM resolver.

Produces: queryable accepted/rejected provenance and rejection-safe submission behavior.

Complete when: tests prove rejection makes zero submit-time DM calls and stores no retailer enrichment; acceptance records the decision and only server-derived enrichment; omission behaves exactly as before; the existing-open path neither looks up DM nor appends a duplicate decision; failures remain fail-open.

### 3. Native product cards and approved confirmation interaction

Write native/unit/UI regression guards before changing the views. Decode optional identity fields and render `displayName` with legacy fallback. Use the title across search, assessment, alternatives, History, and DM preview; keep category separate and remove the repeated brand metadata. Replace the old category question/one-tap submission with an explicit selected-category state and final CTA. Track candidate rejection separately from category changes and encode the correct submit decision.

Consumes: additive mobile fields and decision request contract.

Produces: the approved one-screen flow and consistent mobile product identity.

Complete when: fixtures cover accepted suggestion, accepted alternate category, rejected candidate/manual category, legacy payload fallback, large Dynamic Type, retry, and pending confirmation; UI tests assert the new copy and absence of old copy.

## Verification, review, and handoff

Automated:

- focused TypeScript identity, mobile DM, submit, History, and Product Intake npm-script tests with recorded red/green proof; use repository scripts carrying the server-only shim rather than a bare `npx tsx --test` invocation;
- `npm run typecheck`, targeted lint/format checks, and final `npm run ci:verify`;
- native unit and focused UI tests on the iOS Simulator;
- the repository mobile delivery/contract checks affected by the additive payload.

Manual:

- simulator walkthrough of catalog search card, assessment header, alternative card, History card, accepted DM suggestion, alternate category, rejected product, retry, and confirmation;
- largest Dynamic Type and Reduce Motion checks for the modified sheet;
- inspect the rendered card hierarchy against the approved device screenshots.

No migration or production-state check is required. The implementation must stop before publication. `ready-check` and `request-code-review`, including one read-only Claude whole-branch review, are required before handoff.

Artifact disposition: this plan and any durable verification receipt are committed with the eventual PR; transient Claude output and simulator build artifacts are discarded.
