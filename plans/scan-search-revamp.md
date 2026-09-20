# Scan: Manuelle Suche — name-only search + dm lane + research recovery (Rev. 7, 2026-09-20)

## 1. Outcome and source context

The `/scan` manual-search sheet ("Ohne Scan finden") is today a dead end for most users: a
live name search over the 348-product internal catalog, a "Nichts gefunden" empty state that
gives an instruction instead of an action, and a separate barcode field whose coral "Suchen"
button reads as the sheet's main CTA but belongs to a number nobody knows by heart
(user-screenshot review, this session 2026-09-20).

After this slice, the sheet is one search field for product name or brand — barcodes belong
to the scanner, not the keyboard (Nick ruling 2026-09-20: typing barcodes is unrealistic;
scanning is barcode-focused, the search bar is name-focused). Catalog results answer live
while typing (instant verdict on tap).
An explicit submit additionally queries the dm MCP `searchProducts` tool in parallel; dm hits
whose GTIN maps to an eligible catalog product surface as catalog results (instant verdict
the name search would have missed), true dm-only hits render in a clearly separated section
and a tap routes their GTIN through the existing resolve → dm-enriched unknown flow
(PR #583: "Gefunden – jetzt prüfen wir es", one-tap category confirm, pending research
submission). When catalog AND dm both miss, the empty state offers the terminal recovery
(Nick ruling 2026-09-20): a one-step name-based research intake — Marke + Produktname
(prefilled from the query) + the category grid → the existing pending receipt, as the
single CTA (minimal-first; the scanner stays one sheet-close away). Every path then ends
in a verdict or a research receipt; the flow has no dead end.

Source context: shipped dm enrichment (PR #583, `src/lib/scan/enrichment/`), dm probe
evidence (`.worktrees/scan-dm-enrichment/plans/scan-dm-enrichment/evidence/dm-probe/`:
`searchProducts` semantic search, ~180–230 ms, ≤15 rows with
`gtin,dan,brand,title,price,category,…`, no image column), iOS unified search field
(PR #586, `ios/Chaarlie/Scanner/ScannerView.swift` `ProductSearchView`), mobile
identity-title matching (PR #590, `src/lib/mobile/scan-service.ts`). Counterpart plan
review: Codex 2026-09-20 (findings F1–F17 folded into this revision; ledger in the
session report, transcript discarded).

## 2. Chosen direction

Rebuild `ScanSearchSheet` around one name-only field ("Produktname oder Marke"). It keeps
today's live debounced catalog search and, on explicit submit
(Enter / arrow button), fires a second request to a new server route that calls dm
`searchProducts`, normalizes and canonicalizes returned GTINs, partitions them against
`product_identifiers` into eligible catalog-mapped results (returned in catalog shape,
merged into the catalog section by product id) and dm-only rows. Tapping a dm-only row
closes the sheet and calls the existing `resolve({ identifier: { type: "ean", value } })` —
the whole downstream journey (verdict, or enriched unknown sheet → category confirm →
pending submission → result in chat) is the already-shipped, already-approved PR #583 flow;
this slice adds no new downstream surface.

Both search lanes fail independently: a dm timeout/error never blocks catalog results (quiet
inline notice under the dm section slot); the catalog lane is unchanged infrastructure.
Catalog matching gains mobile parity by extracting the identity-title matching
(`composeProductIdentityTitle` over canonical brand + line) into one shared module used by
both the web and mobile search routes.

The dm lane is a single server-derived capability: enabled only when BOTH
`SCAN_RETAILER_SEARCH_ENABLED` and the existing `SCAN_RETAILER_ENRICHMENT_ENABLED` are on
(search without enrichment would break the promised "Gefunden" journey after the tap —
review F2). The `/scan` page derives a `retailerSearchEnabled` boolean server-side and
threads it page → `ScanPageClient` → `ScanFlow` → sheet; flag-off renders no dm affordance
and issues zero dm-lane requests.

## 3. Scope and non-goals

**Changes:** `scan-search-sheet.tsx` (rebuild incl. intake state), `scan-flow.tsx` (props,
dm-row resolve wiring, research-intake submit wiring per the T5 auxiliary-ownership
lifecycle), one new `supabase/migrations/` file (§4), `/scan` page +
`scan-page-client.tsx` (flag threading), new `src/app/api/scan/search-retailer/route.ts`, new
`src/lib/scan/catalog-search.ts` (shared matcher + mapper),
`src/lib/scan/enrichment/dm-mcp-client.ts` (add `searchProducts` + search-payload parser),
`src/lib/observability/scan.ts` (search telemetry reporter),
`src/app/api/scan/search/route.ts` and `src/lib/mobile/scan-service.ts` (consume shared
matcher), analytics event map, labs harness, tests listed per task.

**Non-goals:** no iOS/mobile-API dm search (separate slice); no dm.de outlinks, prices, or
availability in the UI (dm's `instruction`/utm payload is ignored as data); no change to the
unknown-flow design, research queue, submissions contract, or resolve route; no
`ScanUnknownFlow`/verdict-sheet changes; no catalog-content changes; no change to the
shared scan rate-limit budget; no changes to the research queue, review center, or worker
beyond verifying the identifier-less path they already model. `ManualEanField` has no
consumer besides this sheet (verified) and is deleted with it. `src/app/api/scan/submit/route.ts`
joins the Changes list (optional-identifier schema per §4).

## 4. Target map (exact interfaces)

```ts
// src/lib/scan/catalog-search.ts (new; extraction of behavior shipped in PR #590) —
// the one authoritative matching/mapping contract, consumed by BOTH search routes and T3:
export type CatalogSearchCandidate = {
  id: string
  name: string
  brand: string | null
  category_key: string
  image_url: string | null
  sort_order: number | null
  brand_identity: { canonical_name: string | null } | null
  product_line: { canonical_name: string | null } | null
}
export function matchCatalogProducts(
  rows: CatalogSearchCandidate[],
  query: string,
): CatalogSearchCandidate[]
// substring over composeProductIdentityTitle(identity parts), exact-match-first ranking,
// sort_order → localeCompare(de) → id tiebreak (mobile scan-service behavior today)
export function toScanSearchResult(row: CatalogSearchCandidate): ScanSearchResult

// src/lib/scan/enrichment/dm-mcp-client.ts — extend the client type:
export type DmMcpClient = {
  getProductDetails(gtins: string[]): Promise<DmProductDetailsRow[]>
  searchProducts(query: string): Promise<DmProductDetailsRow[]>
}
// resolve-enrichment narrows its dependency to Pick<DmMcpClient, "getProductDetails">
// so existing narrow fakes stay valid (review F11).
// searchProducts payload differs from getProductDetails (review F1): content text →
// JSON {instruction, result}; result is a JSON-encoded array of TOON table strings whose
// header is name-prefixed with comma-separated keys ("products[15]{gtin,dan,…}:") and
// whose cells are comma-delimited with escaped-quote quoting. New parseSearchToonTables()
// beside parseToonTable, tested against the captured OGX probe payload verbatim.

// src/app/api/scan/search-retailer/route.ts — GET ?q= via createScanRoute (auth + the
// SHARED scan rate-limit bucket, SCAN_RATE_LIMIT 30/min — review F3: no dedicated limiter,
// dm calls stay inside the existing per-user scan budget)
export type ScanRetailerSearchResponse = {
  catalog: ScanSearchResult[]          // GTIN-mapped eligible catalog products
  retailer: ScanRetailerResult[]       // dm-only rows, dm ranking order preserved, capped at 8
  retailerOutcome: "ok" | "disabled" | "unavailable"  // timeout/transport/malformed → "unavailable"
}
export type ScanRetailerResult = {
  // The RESOLVE-COMPATIBLE EAN representation (implementation ruling 2026-09-20): the
  // 8-digit form when the canonical GTIN-14 has six leading zeros, else the 13-digit
  // form when it has a leading zero — mirroring normalize.ts's variant expansion —
  // because /api/scan/resolve's validateEanInput accepts only 8/13 digits and the tap
  // feeds this value straight into it. A true GTIN-14 (non-zero indicator digit) has no
  // EAN form and its row is dropped fail-closed.
  gtin: string
  name: string                         // dm title
  brand: string | null                 // title-cased dm brand (reuse scanRetailerBrandLabel)
  categoryLabel: string | null         // suggestCategoryFromRetailerName → CATEGORY_COPY label
}
```

**GTIN boundary policy (review F6):** dm returns numeric GTIN spellings with lost leading
zeros (probe: 11-digit `22796972200`). At the dm boundary only: all-digit values of length
< 12 are left-padded with zeros to 12, then passed through the unchanged global
`canonicalizeGtin`; rows still failing (bad checksum, missing GTIN) are dropped; duplicate
canonical GTINs keep the first (best-ranked) row. The global canonicalizer is not weakened.

**Partition eligibility (review F7):** a dm GTIN maps to the catalog section only when its
`product_identifiers` row resolves to exactly one product passing the same predicates as
`searchScanCatalog` (active, lifecycle active, plan category, not quarantined). Every other
case — no identifier row, inactive/discontinued product, dangling reference — presents as a
dm-only row, so what a tap resolves (the fail-closed `/api/scan/resolve` path) can never
disagree with what the list promised. Quarantined-product GTINs are dropped entirely
(ruling R7: never surfaced via search).

**dm category filter (confirmed with Nick 2026-09-20, review F14):** dm-only rows are kept
only when hair-relevant — dm `category` contains "Haar" (e.g. "Shampoo > Haarpflege") OR
`suggestCategoryFromRetailerName` maps the title to a plan category; other rows (household,
food, non-hair cosmetics) are dropped server-side.

**No barcode input in the sheet (Nick ruling 2026-09-20, supersedes review F16):** the
field is name-only; there is no digit detection, no EAN validation, no `onSubmitIdentifier`
path from this sheet. Digit strings are ordinary text queries (they find nothing and land
in the empty state). The earlier typed-EAN corner-case consequence is superseded by the
name-based research recovery below — no path is dead-ended.

**Name-based research intake (Nick ruling 2026-09-20):** `/api/scan/submit`'s body schema
makes `identifier` OPTIONAL; when absent, `brandText` (1–200) AND `productNameText`
(1–240) AND `category` are required. This relaxes only the route's v1 client restriction
(its "ean-only" comment, ruling R9) — `submitScanProductIntake` treats
`scannedIdentifier` as optional and already runs name-based dedup via brand resolution +
clean product name (`matchProductIntake`), so a name that matches an eligible catalog
product answers `already_in_catalog` → instant verdict instead of a receipt. The route
OMITS `scannedIdentifier` for name-only bodies (final-review F2: the shared input schema
is `.optional()`, not nullable — never pass an explicit `null` into it). Entry: only from
the post-submit empty state (catalog + dm both missed). Client sends the user-edited
Marke / Produktname fields (Produktname prefilled with the full query, Marke empty) plus
the tapped category — same one-tap grid semantics as the unknown flow; `frequency_range`
stays `null` as in the EAN lane. The dm enrichment lookup inside submit is
identifier-keyed and does not run for identifier-less bodies.

**Migration (final-review F1 — the "no migration" claim was wrong):** constraint
`product_submissions_scan_requires_identifier_check` is today
`source <> 'scan' OR scanned_identifier_value IS NOT NULL` and would reject every
name-only row. One new migration: (a) replace that CHECK with
`source <> 'scan' OR scanned_identifier_value IS NOT NULL OR (brand_text IS NOT NULL AND
product_name_text IS NOT NULL)`; (b) add the mirrored one-open invariant for name-only
rows (final-review F4) — a partial unique index over
`(user_id, category, lower(brand_text), lower(product_name_text))` scoped exactly like
`idx_product_submissions_one_open_scan` (source='scan', open statuses, and additionally
`scanned_identifier_value IS NULL`). Policy (inherited from the EAN lane's contract):
identical open name requests coalesce — on conflict the route returns the existing open
submission's pending receipt, mirroring `pending-submission.ts` semantics for repeated
scans. Migration is applied to prod at ship time like every other slice with migrations.

**Worker proof (final-review F7):** the research worker's null-identifier handling is
proven through a runnable oracle — extract or expose the worker's submission-loading /
packet-building seam so a test (extending `tests/product-intake-research-jobs.test.ts`
with a fake-repository case) asserts a null-identifier submission is loadable and its
packet carries brand/name texts without an identifier; no regex-over-source assertions.

**Request arbitration (review F4):** the sheet owns one query generation. Every query
change invalidates BOTH lanes (existing `useLatestRequest` per lane) and clears retailer
results/state; submit clears any pending catalog debounce timer and fires both lane
requests immediately, each carrying its lane token; closing the sheet invalidates all.
Tests cover out-of-order retailer responses across a query change and the no-double-fetch
guarantee on submit during a pending debounce.

**Flag:** `SCAN_RETAILER_SEARCH_ENABLED`, effective only AND-ed with
`SCAN_RETAILER_ENRICHMENT_ENABLED` (helper `isRetailerSearchEnabled()` in
`enrichment/flag.ts`); route answers `retailerOutcome: "disabled"` when off; client renders
the dm lane only when the server-derived `retailerSearchEnabled` prop is true (zero dm-lane
fetches when off).

**Telemetry (review F8):** new sanitized reporter in `src/lib/observability/scan.ts`
(`reportRetailerSearchOutcome`: outcome ∈ lookup-outcome union incl. timeout, durationMs,
counts — never query text, user id, or payload). `reportRetailerLookupWarning` stays
untouched.

**Route/query logging note (review F9, rejected):** the route stays `GET ?q=` — the
existing `/api/scan/search` catalog lane already carries the same user-typed queries in
GET URLs, so this adds no new logging boundary; application telemetry never records the
query (above).

**User-facing naming (Nick ruling 2026-09-20):** "dm" never appears in UI copy — matching
the shipped PR #583 precedent, whose user-facing flow also never names the retailer, and
prudent while the dm terms email is unsent. Section label „Weitere Treffer", subline
„Noch nicht geprüft — tippe drauf, wir übernehmen das.", empty state „Dazu haben wir
nichts gefunden." The name dm stays in code, flags, telemetry, and this plan only.

**Analytics** (event map additions, no query text ever included):
`scan_retailer_search` { catalogCount, retailerCount, outcome, durationMs } on submit
response; `scan_retailer_result_opened` { categoryLabel: string | null } on dm-row tap.
Emitted through `ScanFlow`'s existing `analytics` port, passed into the sheet as a prop
(review F12).

**Privacy/anti-leak (inherited from PR #583 rules):** only the user-typed query string goes
to dm — no user id, no auth headers, no barcode history; no dm URLs, DANs, prices, or raw
payloads reach the client beyond the `ScanRetailerResult` fields; route tests assert the
exact response key set.

## 5. Decision coverage

Decision coverage: **confirmed** (Rev. 3 journey approved 2026-09-20; Rev. 4 recovery
states approved 2026-09-20).

**Confirmed with Nick (this session, 2026-09-20):**
- Add dm-backed name search to the web manual-search flow; found-at-dm products route into
  the existing "wir prüfen es und melden uns" research journey.
- Trust model: dm's GTIN may serve as the sole identifier for a name-initiated submission.
- Privacy: transmitting the user-typed query to dm is acceptable.
- Ordering: parallel fetch on submit, catalog section pinned first, dm hits deduped/mapped
  by GTIN, visually separated sections (chose over two-step and over live dm-per-keystroke).
- Scope: one combined slice including the single search field, actionable empty state, and
  mobile matching parity.
- No barcode typing anywhere in the sheet (2026-09-20): "scanning is barcode-focused,
  typing in the search bar is name-focused" — supersedes review F16 and the earlier
  unified name/barcode field idea.
- dm-only rows filtered to hair-relevant products (review F14).
- Rev. 3 journey + mockup sign-off: "Approved" (2026-09-20) for the name-only sheet and
  two-section presentation.
- Persistent recovery link (2026-09-20, post-implementation live finding): „Nicht dabei?
  Für dich prüfen lassen" under the results after any submitted search (§6 step 7b) —
  option 2 chosen; option 3 (filtering dm's semantic ranking) explicitly rejected.
- Name-based research recovery (2026-09-20): when neither catalog nor dm finds the query,
  the standard recovery is "enter brand + name, submit for research" — supersedes the
  earlier "no name-only submissions" non-goal, the typed-EAN corner-case consequence, and
  the client-side EAN-only restriction (route ruling R9) for exactly this path.
- No "dm" in user-facing copy (2026-09-20): neutral labels per §4 — amends the earlier
  approved mockups, which named dm; matches the shipped PR #583 precedent.
- Empty state carries exactly one CTA, "Für dich prüfen lassen" (2026-09-20): the
  "Barcode scannen" secondary from the Rev. 4 approval is removed; the scanner remains
  reachable by closing the sheet.

**Inherited from evidence or contract:**
- Downstream unknown/pending journey, copy, image proxying: PR #583 (approved + shipped).
- Resolve is EAN-only in both directions (`scan-flow.tsx` v1 contract).
- Quarantined products never surface via search (ruling R7, `catalog-eligibility.ts`).
- Identity-title matching semantics: PR #590 mobile implementation.
- Shared scan rate-limit budget (`SCAN_RATE_LIMIT`, one bucket across scan routes):
  `src/lib/rate-limit.ts` contract.

**Implementation defaults:** route path and response shape above; flag AND-ing and
threading; GTIN boundary padding policy; partition eligibility contract; dm-only cap at 8
in dm ranking order without a truncation notice (semantic relevance decays fast; the
empty/actionable states remain the recovery path — review F17); placeholder thumbs for dm
rows (`searchProducts` has no image column); telemetry reporter shape; GET route
consistency (F9 note); live catalog debounce (250 ms / min 2 chars) unchanged; sheet's
default title becomes "Produkt finden" while the timeout entry keeps "Barcode nicht
lesbar?" + subline (review F13).

**Open consequential assumptions — resolve before handoff:** none (Rev. 4 recovery states
approved 2026-09-20).

**Parked out of scope** (Nick's existing parked items, unaffected by this plan): dm terms
email; "Vorläufig" provisional-verdict ruling; iOS parity for dm search.

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick 2026-09-20 — "Write a plan and align any decisions with me
that are needed. For the trust model, I think that is fine. Also, the privacy nuances and
the part about DM transmission are fine." plus the two recorded AskUserQuestion answers
(parallel/catalog-first; combined slice).

Internal revalidation: Rev. 2 folded in the Codex counterpart review (F1–F13 accepted as
technical corrections, F9 rejected with rationale, F14–F17 raised to Nick or recorded as
defaults). Rev. 3 records Nick's rulings: F14 hair-relevant filter confirmed; barcode
typing removed entirely (supersedes F16 and the unified name/barcode field); mockup and
journey updated to the name-only sheet, sign-off given. Rev. 4 adds Nick's name-based
research recovery ruling (supersedes the "no name-only submissions" non-goal, the
typed-EAN corner-case consequence, and route ruling R9's client EAN-only restriction for
this path); verified against the repo: `product_submissions.scanned_identifier_*` nullable,
`submitScanProductIntake` accepts a null identifier and dedupes by brand/name identity;
the two added mockup states were approved 2026-09-20. Rev. 5 applies two further Nick
corrections to the approved states (no "dm" in user-facing copy; single-CTA empty state,
dropping the camera prop) — precise corrections to the approved proposal, no new open
choice; coverage remains confirmed. Rev. 6 folds in the second Codex review (2026-09-20,
final pass): F1 the scan-requires-identifier DB CHECK forces a migration (verified;
"no migration" claim corrected, name-scoped one-open index added per F4 with the
coalesce policy inherited from the EAN lane's contract), F2 omit-not-null for
`scannedIdentifier` (verified against the shared schema), F3 the search-origin submit
lifecycle keeps the auxiliary open until the outcome, F5 PostHog destination mapping for
`intakePath`, F6 leftover "dm-Suche" copy neutralized, F7 runnable worker oracle, F8 task
renumbering (intake T5 before the final T6 pass) and stale marker removed. All technical
corrections within approved rulings — coverage remains confirmed. Rev. 7 (post-
implementation): adds Nick's persistent-recovery-link ruling (journey step 7b, Task 8)
after the live manual finding that dm's semantic search makes the terminal empty state
rare; coverage remains confirmed.

## 6. Designed user journey

Actor: signed-in user on `/scan` (mobile or desktop web), camera running or unavailable.

1. Opens the sheet via "Produkt suchen", the 3 s timeout, or camera failure. Headers stay
   reason-driven: timeout keeps "Barcode nicht lesbar?" + "So findest du's trotzdem.";
   manual and camera entries show the new default title "Produkt finden".
2. Sees one search field (placeholder "Produktname oder Marke", no barcode affordance).
   Types a name → catalog results appear live under the field, each row tappable →
   instant verdict.
3. Live catalog search finds nothing (pre-submit): no "Nichts gefunden" claim yet — a
   quiet invitation instead: "Drück Suchen für mehr Treffer." (review F15; only when the
   dm lane is enabled, otherwise the terminal empty state shows directly).
4. Presses Enter / the submit button → catalog section stays (pinned, labeled
   „In deinem Chaarlie-Katalog" once a second section exists), dm section appears below
   („Weitere Treffer", subline "Noch nicht geprüft — tippe drauf, wir übernehmen das."),
   skeleton while loading. GTIN-mapped dm hits appear as catalog rows instead.
5. Taps a dm-only row → sheet closes, resolving skeleton, then either the real verdict
   (GTIN resolvable in catalog) or the PR #583 enriched unknown sheet: product image +
   name, "Gefunden – jetzt prüfen wir es.", one-tap category confirm → pending sheet
   "Meist innerhalb von 24 Stunden – wir melden uns im Chat."
6. Nothing found anywhere (post-submit) → empty state: "Dazu haben wir nichts gefunden."
   with exactly ONE CTA, "Für dich prüfen lassen" (minimal-first ruling). No scan button:
   scanned-unknown products never reach this sheet (they get the unknown flow directly),
   and the scanner stays one sheet-close away for anyone holding the product.
7. "Für dich prüfen lassen" → one-step intake in the sheet: "Wir prüfen es für dich" +
   "Das Ergebnis kommt in den Chat – meist innerhalb von 24 Stunden.", editable Marke
   (empty) and Produktname (prefilled with the full query), category grid ("Tippe die Kategorie an – das
   reicht uns schon.") — the category tap submits. `already_in_catalog` answer → the
   sheet closes and the real verdict resolves instead; otherwise the existing pending
   sheet. Submit error keeps the intake state with the standard error copy.
7b. Results shown but the searched product is not among them (dm semantic search returns
   neighbors for most real queries — live finding 2026-09-20, so the terminal empty state
   is rare): one quiet line under the results after any submitted search — „Nicht dabei?
   Für dich prüfen lassen" — opens the same prefilled intake (Nick ruling 2026-09-20,
   option 2; fighting dm's ranking, option 3, explicitly rejected). Hidden pre-submit and
   in the terminal empty state (whose primary CTA already owns recovery); renders with
   dm rows and/or merged catalog results alike, flag-off included (the intake is not
   dm-gated).
8. dm lane fails/times out/rate-limited → catalog results render normally; dm section slot
   shows one quiet line ("Die erweiterte Suche ist gerade nicht verfügbar.") only in the
   failed-after-submit case; flag off renders no dm affordance at all.

Error/recovery: catalog search error keeps today's copy; a dm row whose resolve fails lands
in the existing resolve error toast + return to scanning.

## 7. Planning evidence

`plans/scan-search-revamp/evidence/search-sheet-mockup.html` — four rendered states
(typing/live catalog, post-submit two-section result, empty state with recovery entry,
one-step intake form) in app tokens; the mockup shows the default "Produkt finden" title
(timeout entry keeps its existing approved header). Question it answers: is the two-section distinction
(Sofort-Check vs. Prüfen lassen) legible enough to separate instant verdicts from research
handoffs, and does the empty state read as an action rather than a dead end? Status:
approved by Nick 2026-09-20 in two passes — Rev. 3 (name-only revision; the Rev. 2
name/barcode variant was rejected, barcode typing removed on his ruling) and Rev. 4
(recovery states 3+4). Disposition: commit (durable decision evidence).

## 8. Ordered tasks

**T1 — shared catalog matcher (mobile parity).** Create `src/lib/scan/catalog-search.ts`
per §4 (`CatalogSearchCandidate`, `matchCatalogProducts`, `toScanSearchResult` — extracted
from `src/lib/mobile/scan-service.ts` behavior); consume it from `searchScanCatalog` (web —
gaining the brand-identity/product-line join and identity-title matching; update the stale
"256" catalog comment) and `searchMobileScanCatalog` (behavior-preserving refactor).
Produces: the §4 catalog-search contract for T3/T4. Tests: extend
`tests/scan-search-route.test.ts` with a canonical-brand-only query that misses today and
hits via identity title; existing mobile suite stays green unchanged (regression guard).
Done when both routes share one matcher and both suites pass.

**T2 — dm client: `searchProducts`.** Extend `dm-mcp-client.ts` with a `searchProducts`
tool call mirroring `getProductDetails` (session bootstrap, timeout, `DmMcpError`
taxonomy) plus the dedicated search-payload parser per §4 (F1). Narrow
`resolve-enrichment`'s client dependency to `Pick<DmMcpClient, "getProductDetails">` (F11).
Consumes: probe fixture (`search-name-OGX…` captured payload verbatim). Produces:
`DmMcpClient.searchProducts`. Tests: parse of the exact captured payload, empty result,
malformed inner JSON, malformed TOON, timeout; existing enrichment suite green without
touching its fakes. Done when the client returns typed rows for the OGX fixture and every
error path maps to the existing reason union.

**T3 — retailer search route.** New `GET /api/scan/search-retailer` per §4 via
`createScanRoute` (auth + shared `SCAN_RATE_LIMIT` — F3), flag gate
(`isRetailerSearchEnabled()` → `"disabled"`), query bounds (2–120 chars, trimmed), dm call
with `retailerEnrichmentTimeoutMs()` deadline, GTIN boundary policy (F6), partition
eligibility contract (F7) via one `product_identifiers` + `products` lookup, dm category
filter per §4 (F14, confirmed), `toScanSearchResult` for mapped rows, dm-only cap 8 in
dm order, telemetry per §4 (F8). Consumes: T1 contract, T2 client. Produces:
`ScanRetailerSearchResponse`. Tests: new `tests/scan-search-retailer-route.test.ts` — flag
off; shared-bucket rate-limit refusal; dm error/timeout → `"unavailable"` with catalog
array untouched; GTIN matrix (11-digit padded hit, leading-zero loss, bad checksum dropped,
duplicate canonical kept-first); partition matrix (active mapped, inactive → dm-only,
dangling identifier → dm-only, quarantined dropped, non-hair category dropped); anti-leak
(exact response key set; no dan/appLink/price/description). Done when route tests pass and
no dm field beyond §4 crosses the boundary.

**T4 — sheet rebuild.** Rework `scan-search-sheet.tsx` per mockup + §4: single name-only
field + submit affordance (no digit detection, no `onSubmitIdentifier` — drop the prop and
the `ManualEanField` usage), live catalog lane unchanged, submit arbitration per §4 (F4),
section labels only when the dm section exists, pre-submit invitation state (F15), dm rows
with placeholder thumb + "Prüfen lassen" pill, empty/error/unavailable states per §6,
new `retailerSearchEnabled` and `analytics` props (no camera prop — the empty state's
single CTA needs no camera knowledge). Thread props in `scan-flow.tsx` (flag boolean from
`/scan` page → `scan-page-client.tsx` → `ScanFlow` — F2) and wire `onSelectRetailerResult(gtin)` → `dispatch auxiliary_closed` +
`resolve({ identifier: { type: "ean", value } })`. Consumes: T3 response shape. Produces:
the sheet props consumed by T5/T6. Tests: extend the sheet/flow UI suites — text submit
renders both sections from mocked responses; GTIN-mapped result renders in catalog
section; dm-row tap closes sheet and resolves its GTIN; empty state renders exactly one
CTA and no retailer name anywhere in copy; dm failure leaves catalog results standing; flag-off renders no dm affordance
and performs zero dm-lane fetches; out-of-order retailer response across a query change is
dropped; submit during pending debounce issues exactly one catalog request. Done when the
sheet has exactly one input, no barcode path, and all listed states are covered.

**T5 — name-based research intake (incl. migration).** DB: the §4 migration (CHECK
relaxation + name-scoped one-open unique index), with a route-level test proving the
coalesce path (second identical open name request returns the first submission's pending
receipt). Server: extend `submitBodySchema` in `/api/scan/submit/route.ts` per §4
(`identifier` optional; require `brandText` + `productNameText` when absent; skip the dm
lookup and its event log for identifier-less bodies), OMITTING `scannedIdentifier` on the
`submitScanProductIntake` input (F2 — the shared schema stays untouched). Client: intake
state inside the sheet per §6 (Produktname prefilled with the full query, Marke empty,
category grid reusing `CATEGORY_COPY` + the primary/expander split), `ScanFlow` callback
`submitResearchFromSearch(input)` reusing the `submitUnknown` fetch/dispatch machinery.
Search-origin submit lifecycle (final-review F3 — the gap is auxiliary-sheet ownership,
not the step machine): the search auxiliary STAYS OPEN through `submit_started` and on
`submit_failed` (the form must remain visible with the error); `auxiliary_closed` is
dispatched only when the outcome arrives — before `resolve({ productId })` on
`already_in_catalog`, and together with the `submitted` dispatch so the pending step is
never covered by the sheet. Analytics: `scan_submission_created` gains
`intakePath: "scan" | "name_search"` — event map AND the PostHog destination's explicit
property mapping (final-review F5), asserted in `tests/scan-analytics.test.ts`. Consumes:
T4 sheet states. Produces: the intake seam T6 polishes. Tests: route test —
identifier-less body accepted, missing brand/name rejected, dm lookup not called, insert
row carries null identifier + both texts, coalesce-on-conflict; name matching an eligible
catalog product → `already_in_catalog`; the §4 worker oracle (extend
`tests/product-intake-research-jobs.test.ts` via the extracted seam, no source-regex
assertions); UI test — recovery entry only in the post-submit empty state, prefill
correctness, category tap submits, pending sheet reached and not covered by the auxiliary,
error keeps the form open. Done when a name-only submission round-trips to a pending
receipt in tests and the EAN path is byte-identical.

**T6 — analytics + a11y + copy pass.** Add the two search events per §4 through the
sheet's `analytics` prop, `aria-live` regions for both result sections and the intake
state, focus handling on submit and on entering the intake form, final German copy per
approved mockup (incl. F13 titles) across search AND intake states — asserting no
retailer name appears in any user-facing string. Consumes: T4 props, T5 intake seam.
Tests: event emission asserted in the T4/T5 suites. Done when `npm run test:node` and
`npm run ci:verify` pass.

**T7 — labs + e2e.** Extend the `/labs/scan` harness for the retailer route via Playwright
route stubbing (`page.route`, the existing spec's pattern — F12; no new fetch DI seam), add
cases to `tests/scan-flow.spec.ts`: search → two sections → dm-row tap → unknown sheet
reached; empty result → recovery intake → pending sheet; flag-off spec asserting no
`/api/scan/search-retailer` request. Consumes: T4, T5. Done when
`npx playwright test tests/scan-flow.spec.ts` passes locally alongside the existing cases.

## 9. Verification

- **Automated (explicit commands — review F10):** `npm run test:node` (full suite —
  scan-hardening learning), `npm run ci:verify` (typecheck + lint + build),
  `npx playwright test tests/scan-flow.spec.ts`. Coverage named per task: races (T4), flag
  matrix (T3/T4/T6), exact MCP arguments + parser payloads (T2), GTIN and partition
  matrices (T3), shared rate limit (T3), analytics anti-leak payloads (T3/T5).
- **Manual (dev, flags on, real dm MCP — free/no-auth):** drive `/scan` via localhost (not
  127.0.0.1): live catalog while typing; submit with a dm-only product (e.g. a Balea SKU
  outside the catalog) → dm section → tap → enriched unknown sheet → category confirm →
  pending sheet; camera-denied entry; a query
  missing everywhere (e.g. a salon brand) → "Für dich prüfen lassen" → prefilled intake →
  category tap → pending sheet, and the submission row lands with null identifier +
  brand/name texts in the research queue; mobile viewport + desktop;
  restart the dev server before verifying (deep-lib change rule).
- **Failure paths:** flags off (no dm affordance, zero dm requests), dm timeout via
  stubbed route (catalog intact + quiet notice), shared rate limit.
- **Post-deploy:** Sentry `search_events` for new errors in the first hour; watch
  `scan_retailer_search` outcome mix and `scan_retailer_result_opened` → submission
  conversion in PostHog.

## 10. Review and handoff

Worktree `.worktrees/scan-search-revamp` on `codex/scan-search-revamp` (base = origin/main
4f9938dd, verified). Gates: plan self-review done; Codex counterpart plan review done
(2026-09-20, verdict rework → folded into Rev. 2; F1/F3/F6/F10 verified against the repo
before acceptance; transcript discarded); Rev. 3 journey and Rev. 4 recovery states both
approved 2026-09-20 — no items remain before implementation; whole-branch Codex review
before push per repo workflow. Rollout: ship with `SCAN_RETAILER_SEARCH_ENABLED` off,
enable after the manual smoke on production (rollback = flag off for the search lane; the
T5 migration ships with the slice and is applied to prod at ship time — its CHECK
relaxation and new unique index are backward-compatible with every existing row and with
the EAN lane, so it needs no coordinated rollback). Risks: dm semantic ranking quality on short/misspelled queries (probe evidence is
anecdotal; catalog lane + actionable empty state keep the flow usable); dm
availability/terms (parked email); no dm images in rows (accepted default); name-based
submissions add operator research load with weaker identity (no GTIN) — bounded by the
recovery being reachable only after a double miss, the shared scan rate limit, and the
operator's existing reject path. Artifacts:
plan + mockup evidence commit; review transcripts discard. Stop point: PR via `/ship`
after implementation + ready-check; merge is separate authorization.
