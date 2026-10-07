# Retailer recognition/lookup boundary — complete second-layer ledger

{"R":86,"F":1,"C":12,"D":0};99 AST declaration sites across9 files. Current prospective cut:12 C,99→99→87. The existing MCP JSON/SSE loop is one AST site/two runtime tests; no table rows converted into declaration credit. All99 callbacks and fixtures/helper bodies were read in full. Per-site complete bodies and hashes are in sites.json/judgments.json.

## tests/scan-dm-enrichment.test.ts (9)

- **R 43 — exact canonical hit maps the trusted draft and measured lookup**: Actual resolver must deliver canonical GTIN, trusted required/optional fields, source/date, deadline1500/duration73 and zero warnings from one Weleda row. SDK parser positive keepers do not run resolver mapping/timing.

- **R 66 — EAN-13/GTIN-14 and EAN-8 spellings match; false rows remain not found**: GTIN14 and EAN8 match via canonicalization while found=false yields not_found without warning; a exact string match or treating false rows as malformed escapes SDK parsing.

- **R 77 — wrong generation GTIN cannot seed identity; warning carries only route and reason**: Mismatched generation GTIN must return mismatch and route/reason-only warning; accepting an unrelated valid row would seed the wrong product. Positive hit cannot detect it.

- **R 82 — flag off and invalid check digit skip the outbound call and all timing**: Flag false and invalid checksum must bypass outbound request and leave timing null; counts are observed in the actual injected client, not a thrown-negative swallowed by resolver.

- **R 98 — all failures fail open and expected timeout does not alert**: Five distinct error taxonomies including non-Dm unexpected are mapped to fail-open outcomes; timeout stays silent and other warnings contain no provider exception. MCP error sanitation alone does not prove consumer policy.

- **R 116 — invalid image hosts, protocol, path, credentials and port become a placeholder**: Eight unsafe image URL variants (protocol/hostname/path/credentials/port/traversal) become null while enrichment remains a hit; a catalog URL positive cannot enforce this allowlist.

- **R 132 — required identity and row shape must be valid, optional empty cells map to null**: Required name/DAN/found and row shape failures reject; optional whitespace fields become null. Parser intentionally preserves raw strings so cannot own semantic identity admission.

- **R 162 — reporting failure cannot turn enrichment failure into a scan failure**: Reporter throwing on actual mismatch must not reject resolveRetailerEnrichment; SDK/route default reporter is not exercised by sibling happy paths.

- **R 169 — timeout configuration is bounded and feature flag is exact opt-in**: Timeout fallback for nine invalid configurations and valid integer endpoints plus exact true opt-in; tests restore env. This is a live operator config contract, not an exported-name inventory.

## tests/scan-dm-mcp-client.test.ts (12)

- **R 82 — a stalled SDK close cannot hold a timeout result or leave a live request**: Actual SDK connect enters stalled initialized notification, then real originalClose aborts transport while only close completion is held. Before release typed timeout, active0/aborted1/calls0 and after release no late call are observed. Canonical notification lifecycle keeper.

- **R 138 — "official SDK accepts " + (sse ? "SSE" : "JSON") + " framing and sends only numeric GTIN arguments"**: Actual official SDK JSON and SSE decoding, initialization/session propagation and numeric GTIN tool arguments. C01 adds fixed captured-table content here; fake fetch supplies wire body, not parsed rows.

- **R 160 — expired session reconnects once with a fresh session**: One HTTP404 requires a second initialize/session and successful result; concurrent isolation does not prove retry count or success after expiration.

- **R 175 — two expiries return sanitized session_expired without a third attempt**: Two HTTP404s reject sanitized session_expired and exactly two sessions; successful reconnect cannot detect a third retry/unbounded loop.

- **R 185 — absolute budget includes initialize, notification and tool call**: getProductDetails public method must spend one55ms deadline across three20/20/30ms exchanges, not per-step timers. Search method sibling cannot catch a details wrapper bypassing deadline dependencies.

- **C C11 192 — a stalled initialized notification aborts at deadline and never issues tools/call**: Exact same stall notification, EAN,30ms deadline, mock timer and monotonic clock. Stronger wrapper invokes original Client.close (which actually aborts transport) then delays only completion. Every donor observation is already present before close release. UNION: Existing active1 → active0, aborted1, calls0, typed DmMcpError timeout and no late tools/call. No cleanup-completion assertion existed in donor.

- **R 219 — retry shares the original budget**: Expiry plus delayed reconnect consumes original220ms budget; ordinary connect timeout does not test reset-on-retry fault.

- **R 229 — concurrent calls on the same factory never share sessions**: Two concurrent calls through same factory produce distinct request sessions and both results; sequential reconnect cannot detect cross-call session reuse.

- **R 245 — malformed table, missing JSON result and tool isError fail with sanitized errors**: Three wire failures (TOON width, missing JSON result, isError) become sanitized malformed. Lower parser negatives cannot test adapter envelope/error conversion.

- **R 260 — transport error contains neither original exception nor its URL**: Transport rejection strips original URL and cause and emits exact generic message; parser error tests do not test exception privacy.

- **R 277 — searchProducts sends a plain-string query and parses the captured OGX probe payload**: Actual searchProducts public method sends plain string query and official SDK lifecycle with captured search result. C02 carries complete fixed field bytes here.

- **R 296 — searchProducts respects the same absolute timeout budget as getProductDetails**: Search wrapper independently passes55ms absolute budget to common operation; details-only timeout cannot detect a search wrapper setting an unbounded deadline.

## tests/scan-dm-suggest-category.test.ts (2)

- **R 7 — only unambiguous name keywords suggest one supported category**: Complete38-row lexical table covers dry/deep precedence, singular/plural/category aliases, compound blockers and ambiguous/color/bodyoil/shampoobar/empty outcomes. Existing route Conditioner/Weleda examples lack these operative tokens.

- **R 51 — all found products from the real probe have the expected suggestion**: Six actual captured found product names must classify (five shampoos, BALI CURLS conditioner). Synthetic table and Weleda-only resolver do not cover all observed punctuation/brand wording; no same-input stronger six-name result exists.

## tests/scan-dm-telemetry-migration.test.ts (4)

- **R 17 — adds bounded resolve telemetry and private submit telemetry**: Static database column/outcome vocabulary and submit table forbidden joinable fields. Runtime inserts only hit/timeout/disabled and do not inspect all enum labels/private field inventory; keep schema byte contract with explicit static limits.

- **R 52 — adds a privacy-safe daily aggregate before deleting either dm raw source**: Static aggregate dimensions, replace-not-increment conflict update and rollup-before-both-delete source order. PGlite has no preexisting aggregate conflicting bucket, so two runs after deletion alone do not prove overwrite strategy; source guard remains independent.

- **R 78 — keeps both new relations service-role-only and preserves the invoker retention boundary**: Static both relation RLS/revoke/all-service grants plus function SECURITY INVOKER/search_path. Optional PostgreSQL test checks three privileges only; does not assert security invoker or complete revoke declarations.

- **R 95 — migration rolls up each source exactly once across two retention runs and preserves the 30-day boundary**: Actual PGlite migration/function executes both raw sources, repeated retention and exact UTC30day boundary/latency/count/sum. Static strings cannot detect wrong WHERE/grouping, optional Docker uses no exact-boundary fixtures.

## tests/scan-dm-telemetry-postgres.test.ts (1)

- **R 27 — dm telemetry migration: real PostgreSQL RLS, grants, and two-run retention**: Optional real Postgres17 process checks role privileges and two-run counts after actual SQL; PGlite is a different engine. Default skip means this is not always-on CI proof. No Docker/provider run in review.

## tests/scan-dm-toon.test.ts (9)

- **C C01 18 — dm probe parses all ten rows without losing identity, URLs or ingredient text**: Identical details-all-gtins.txt bytes enter actual parseToonTable through the retained official SDK JSON/SSE response. Both transport variants already exist; no new calls or inputs. UNION: Retain rows.length=10 and copy found count=6, missing GTIN found=false, Balea name/brand/full URL/full ingredient text.

- **R 35 — quoted pipes, quotes, escapes, empty cells and CRLF stay intact**: Hand-built quoted pipe/quote/newline/empty/CRLF input exercises lexical combinations absent from captured happy payloads; fixed parsed object literal must remain.

- **R 44 — malformed headers, width, quoting and row counts fail closed**: Six malformed pipe-table variants plus empty declared table enforce header/width/count/quote/duplicate-key failure taxonomy. SDK malformed case covers only one width fault, not complete parser language.

- **C C02 57 — dm search probe parses all 15 rows from a name-prefixed, comma-delimited table**: Identical search-ogx-argan-oil-shampoo.json result string passes actual search parser at existing searchProducts request. UNION: Copy all OGX first-row fields and all GUHL last-row fields; retain 15-row count and request/query/method assertions.

- **R 84 — empty search result yields no rows**: Empty search JSON array is valid and returns []; positive search fixture has one15row table and malformed array test cannot prove empty success.

- **R 87 — malformed inner JSON on the search result fails closed**: Four malformed search JSON shapes fail actual parser before table decoding; SDK malformed examples target details/envelope and do not reach this decoder.

- **R 91 — malformed search TOON (bad header, width, quoting or short row count) fails closed**: Six search-table malformed grammar cases enforce name prefix/key uniqueness/count/quote/width; pipe parser has different grammar and search SDK positive cannot reject them.

- **R 102 — declaring fewer rows than the table actually contains fails closed instead of truncating**: Well-shaped undeclared indented row must throw; other malformed tables fail earlier width/count checks. Distinct fail-closed truncation regression.

- **R 109 — a genuine trailing footer (blank line + unindented tip) does not trip the extra-row check**: Blank line and unindented comma-bearing footer remain accepted; rejecting all trailing data would pass preceding extra-row negative.

## tests/scan-identifier-lookup.test.ts (17)

- **C C03 45 — validateEanInput: valid EAN-13 passes checksum**: Both actual validateEanInput calls read exactly 4006381333931 after its first raw.trim(). Existing surrounding-whitespace keeper already asserts the entire identical result. UNION: Already covered: {ok:true,type:"ean",value:"4006381333931"}. No transfer.

- **R 50 — validateEanInput: valid EAN-8 passes checksum**: EAN8 length/checksum acceptance is independent from13digit and14digit rejection; keeper whitespace EAN13 cannot catch removing allowed8 length.

- **R 56 — validateEanInput: corrupted digit fails checksum, not length**: Bad EAN13 checksum rejects with exact checksum reason, not length; length failure can mask absent checksum validation.

- **R 61 — validateEanInput: wrong length rejected before checksum is computed**: 6digits and14digits reject before checksum; GTIN14 accepted by catalog canonicalizer but forbidden at user-facing EAN validator.

- **R 66 — validateEanInput: non-digit characters rejected as length**: 13-character non-digit string must report length; normal length/checksum inputs cannot detect dropping digits-only check.

- **R 70 — validateEanInput: surrounding whitespace tolerated**: Canonical successful validator keeper: trim first then complete EAN13 success object. Absorbs C03 without new assertion/input.

- **R 75 — lookupCatalogProductByIdentifier: normalizes whitespace and matches active product**: Actual catalog query canonical whitespace ownership key, exact product ids, is_active and lifecycle filters, then returned product/category. Fake checks query arguments, not database filtering; remains query-policy owner.

- **R 98 — lookupCatalogProductByIdentifier: hyphenated spelling queries canonical ownership**: Hyphen removal must reach canonical key query; whitespace case does not protect distinct hyphen branch in shared regex.

- **R 112 — lookupCatalogProductByIdentifier: leading zeros preserved**: Leading zeros in EAN8 must yield exact14digit lookup key; EAN13/GTIN14 examples cannot protect short zero-padding count.

- **R 127 — lookupCatalogProductByIdentifier: searches all barcode identifier types, interchangeably**: Identifier type gtin is accepted and actual in-filter includes barcode/ean/gtin; no route-only ean fixture can detect missing stored aliases.

- **C C04 146 — lookupCatalogProductByIdentifier: inactive-only match is a miss**: Same scanned EAN, one identifier, products response []; dummy product IDs differ but are not read after empty activeProducts early return. Neither fake enforces SQL filtering. Existing discontinued keeper also observes lifecycle filter. UNION: Already covered: null on zero returned eligible products. Positive lookup keeper independently asserts is_active=true and lifecycle_status=active. No SQL-execution claim.

- **R 158 — lookupCatalogProductByIdentifier: a discontinued product is filtered out too**: Observed products query lifecycle_status=active plus null on empty eligible result. Not real SQL execution. Owns C04 empty returned-products branch; independent positive lookup owns is_active.

- **R 176 — lookupCatalogProductByIdentifier: no identifier row is a miss**: No identifier rows stops with null before eligible-product materialization; zero active products has already found an identifier and reaches another branch.

- **R 188 — lookupCatalogProductByIdentifier: collision fails closed instead of picking a winner**: Multiple active matches fail closed and emit one sorted product ID collision receipt; exact single/empty rows cannot detect arbitrary winner or unsorted diagnostics.

- **R 222 — lookupCatalogProductByIdentifier: equivalent stored GTIN spellings use one ownership key**: 13digit stored-compatible spelling gives exact canonical ownership key00022796976116; preserve current public lookup input representation, not SQL legacy migration proof.

- **R 236 — lookupCatalogProductByIdentifier: canonical input uses the same ownership key**: Already canonical14digit lookup input must use same key; EAN validation deliberately rejects14 but this internal lookup accepts it. A caller pre-validating as EAN would break only this fixture.

- **R 250 — lookupCatalogProductByIdentifier: invalid GTIN never reaches the catalog query**: Invalid barcode returns null and actual table recorder stays empty; returned-empty fake alone would mask an unnecessary DB call.

## tests/scan-search-retailer-route.test.ts (29)

- **R 41 — scan search-retailer: unauthenticated is rejected**: Factory route authentication gate returns401; actual GET default auth binding not exercised. Catalog search is a separate handler and cannot prove retailer wrapper passes through auth.

- **C C05 47 — scan search-retailer: rate limited returns 429**: Byte-equivalent handler dependencies, URL ?q=ogx and allowed:false input. UNION: Already covered: status429; keeper additionally bounds Retry-After using retailer bucket.

- **R 55 — scan search-retailer: consumes only its own retailer bucket, never the shared scan bucket**: Actual rate-limit dependency receives retailer bucket only; fixed40/min and prefix distinct from shared budget prevent auto-search starving resolve/save.

- **R 72 — scan search-retailer: a 429 carries the retailer bucket's Retry-After**: Identical denied-input canonical keeper asserts429 and valid Retry-After interval; absorbs C05 status check.

- **R 82 — scan search-retailer: flag off returns disabled with no dm or catalog calls**: Disabled route yields exact disabled envelope and rejects any dm/partition invocation via different error outputs. A normal empty query returns ok, not disabled.

- **R 103 — scan search-retailer: a too-short query is empty ok, not a dm call**: Present1-character query yields exact empty ok and no dm call; missing query normalization is a separate boundary.

- **R 116 — scan search-retailer: a missing query is empty ok, not a dm call**: Absent query yields exact empty ok and no dm call; removing null default or treating absent as400 would escape present-query tests.

- **R 129 — scan search-retailer: an over-length query is empty ok, not a dm call**: 121character query yields exact empty ok and no dm call; minimum-length invalid input cannot catch absent max bound.

- **R 142 — scan search-retailer: a dm timeout maps to retailerOutcome unavailable, catalog still an empty array**: DmMcpError timeout yields HTTP200/unavailable with empty arrays and one timeout telemetry.429 is distinct HTTP failure; must not collapse producer outcomes.

- **R 168 — scan search-retailer: a non-DmMcpError dm throw still resolves to unavailable, reported as unexpected**: Ordinary Error maps to unavailable with unexpected telemetry. Typed timeout cannot protect fallback error classification.

- **R 190 — scan search-retailer: a successful dm-lane attempt reports ok with the partitioned counts**: Actual route forwards query and configured1234ms budget, raw dm rows to partition dependency, partition output to JSON and exact ok/count/duration telemetry. Partitioner is mocked, so this is composition not catalog behavior.

- **R 297 — partitionDmSearchRows: an 11-digit gtin is padded to 12 and then maps**: Actual boundary pads11digit OGX to12 before canonicalize, matches mapped product and excludes retailer duplicate. Canonical keeper for equivalent HASK C12 dummy identity relation.

- **C C12 319 — partitionDmSearchRows: a leading-zero-lost 11-digit gtin maps after padding**: Both captured 11-digit valid GS1 values use raw.padStart(12,"0"), canonicalize to14, a single matching identifier and an eligible product. p1/p2 and product display fields are fixture identity variables; donor only observes count1/id from its one product. Neither value takes a distinct arithmetic weighting length or branch. UNION: Existing mapped catalog.length1 and catalog[0].id=p1 are same selected-identity relation; stronger keeper additionally retailer.length0. Do not transplant unrelated literal p2.

- **R 340 — partitionDmSearchRows: a bad-checksum gtin is dropped**: 11digit bad GS1 checksum drops complete row; padding recovery must not admit arbitrary digit strings.

- **R 346 — partitionDmSearchRows: a missing gtin is dropped**: Missing gtin property safely drops without calling string operations; bad-checksum string does not exercise type guard.

- **C C06 354 — partitionDmSearchRows: a duplicate canonical gtin keeps the first (best-ranked) row**: Same two titles, first GTIN and no ownership rows; second raw GTIN differs only zero-prefix spelling and becomes exactly the same canonical key before seenGtins decision. UNION: Already covered: retailer length1, first-ranked name. Keeper additionally asserts outward EAN.

- **R 364 — partitionDmSearchRows: dedupe is keyed on the canonical form, not the raw string**: Canonical-form dedupe with13/14spellings retains first name and outward EAN. Absorbs raw-identical C06 assertions and additionally detects using raw key.

- **R 381 — partitionDmSearchRows: an 8-digit-source row surfaces an 8-digit gtin**: EAN8 source emitted8digits even after internal12/14padding; common13digit outward result is another conversion branch.

- **R 390 — partitionDmSearchRows: a 12- or 13-digit-source row surfaces a 13-digit gtin**: UPC12 zero-extends to13 and EAN13 round-trips; both observed runtime rows retained, no regrouping.

- **R 405 — partitionDmSearchRows: a non-zero-indicator GTIN-14 has no EAN form and is dropped**: True nonzero indicator GTIN14 must be dropped rather than emit unresolvable barcode; zero-indicator canonical case cannot detect invalid13 slicing.

- **C C07 414 — partitionDmSearchRows: an active mapped product goes to catalog via toScanSearchResult**: Exact same p-active ownership row and product fields, exact same dm mapped row. Existing mixed keeper additionally has the independent Conditioner row; no data dependency lets that row alter mapped projection. UNION: Copy entire literal catalog array; represent donor retailer.length=0 as no retailer row with mapped EAN3574661818450 in mixed output. Keep exact key sets/counts.

- **F 445 — partitionDmSearchRows: an inactive/discontinued mapped product presents as dm-only**: F: owner is given one identifier and no returned products; demonstrates fallback to dm-only, not actual inactive/discontinued filter application because fake eq is a no-op. Retain declaration/branch, narrow title or record actual filter arguments in existing fake before claiming eligibility. No F fix staged.

- **R 459 — partitionDmSearchRows: a dangling identifier (no product_identifiers row) presents as dm-only**: No identifier mapping yields dm-only; mapped-but-ineligible row enters eligible loading, so its fallback fixture cannot guard no-mapping branch.

- **R 468 — partitionDmSearchRows: a quarantined product's gtin is dropped entirely (ruling R7)**: Quarantine removes row from both catalog and retailer lanes; inactive fallback deliberately keeps retailer, independent policy.

- **R 489 — partitionDmSearchRows: a non-hair dm-only row with no category suggestion is dropped**: Nonhair category plus no name suggestion drops row; Conditioner positive cannot enforce conjunction needed to reject household product.

- **C C08 501 — partitionDmSearchRows: a hair-relevant dm-only row keeps a suggested categoryLabel**: Exact same Conditioner dmRow after default brand=OGX expansion. Additional mapped catalog candidate in keeper is another canonical GTIN; no ownership mapping exists for this row. UNION: Existing retailer.length1 plus transferred retailer[0].categoryLabel="Conditioner"; retain strict keys and leak negatives.

- **R 515 — partitionDmSearchRows: caps dm-only retailer rows at 8, preserving dm order**: Nine distinct valid GTIN rows produce first8 original ordered names; dedupe/mapped tests cannot catch wrong cap/order in dm-only output.

- **R 539 — partitionDmSearchRows: an identifier-lookup error throws a stable error**: Identifier storage error throws stable lookup-failed error; provider failure mapping uses another dependency/error owner.

- **R 549 — anti-leak: catalog and retailer rows carry exactly the contract's keys**: Existing mixed partition owner: exactly one catalog and one retailer, strict key inventories and forbidden retailer provider/private fields. Absorbs C07 full catalog value and mapped absence plus C08 label, using its unchanged actual input.

## tests/scan-search-route.test.ts (16)

- **R 27 — scan search: unauthenticated is rejected**: Catalog handler auth401 is separate from retailer handler wiring; actual default GET auth remains outside injected factory test.

- **R 33 — scan search: rate limited returns 429**: Catalog handler rate-limit denial429; retailer different config cannot detect catalog wrapper gate regression.

- **R 41 — scan search: rate limiter unavailable fails closed with 503, without a Sentry capture**: Limiter service_unavailable returns503 without Sentry; ordinary denial429 and search throw capture represent different failure ownership.

- **R 56 — scan search: a too-short query is empty results, not a 400**: Present1character query returns200/empty and does not invoke search; a swallowed search exception returns503, so negative is not vacuous.

- **R 69 — scan search: missing q param is empty results**: Absent q returns200/empty rather than invalid request. Unlike short query current fake does not count calls; retained title only promises envelope.

- **R 76 — scan search: returns the injected search results**: Exact injected product entry reaches HTTP JSON unchanged; actual DB helper tests cannot prove route serialization preserves it.

- **R 93 — scan search: an unexpected lookup error maps to 503 and captures to Sentry**: Unexpected search error maps503 and exact Sentry reason/user/error identity; limiter failure deliberately emits no capture.

- **R 157 — searchScanCatalog: matches across brand+name, case-insensitive**: Actual candidate loading/matching case-insensitive canonical keeper; add independent raw-page truncated=false, not inferred from match count. C10 donor fields have no bearing on that branch.

- **R 182 — searchScanCatalog: an exact label match ranks first regardless of sort_order**: Exact composed label outranks prefix despite worse sort_order; substring-only matcher would pass brand match and cap cases.

- **C C09 205 — searchScanCatalog: caps results at 8**: Existing full-page input contains the complete original12 product prefix with identical id/name/brand/sort_order and same shampoo query, then higher sort_order rows. Same MAX_RESULTS slice; donor observes only length8, not truncation or a 12-row-specific output. UNION: Already covered: results.length8. Keeper additionally asserts truncated=true for page size1000.

- **R 219 — searchScanCatalog: a query load error throws a stable error**: Products query error rejects stable catalog-unavailable string; route error capture sees only injected thrown error, not actual query outcome.

- **R 227 — searchScanCatalog: excludes a disposition-quarantined product (ruling R7)**: Quarantined candidate removed even when it otherwise outranks remaining match; zero/no-quarantine examples cannot detect ignoring dispositions.

- **R 256 — scan search: the truncation flag is passed through to the response**: Truncated true is passed through HTTP response; direct full-page helper alone cannot guard route dropping this field.

- **R 265 — searchScanCatalog: a full candidate page reports truncated**: Actual full candidate load reports truncated=true and caps8; keeps whole C09 observable output on an input containing identical original12row prefix.

- **R 280 — searchScanCatalog: a canonical-brand-only query misses raw brand+name but hits via the composed identity title**: Joined canonical brand Neqi displaces raw brand LN0042 for matching and full result. Raw-brand match test cannot catch losing the identity relation.

- **C C10 309 — searchScanCatalog: a partial candidate page is not truncated**: Donor observes only truncated=false. This value reads raw rows.length===1000, independent of fields/query/matches. Existing two-row brand keeper is already a nonempty partial page; no new input. UNION: Destructure and assert truncated=false on existing searchScanCatalog(client,"EINHORN") result, retaining all matching/category assertions.

