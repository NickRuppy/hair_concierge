# Operator-leaves audit — pinned `21e0e41f`

## Scope and method

Read-only audit; no runners, environment loading, provider, database, or network calls.  I read the complete bodies and local fixtures of the 53 AST declaration sites below, their owners, the listed script entrypoints, package/CI/docs references, and file history.  `/tmp/test-audit-reachability181.json` was used only to obtain the AST count: its `testCounts` gives 6+6+11+11+4+6+4+5 = **53**. `files` is an array of paths, not retirement evidence.

Disposition key: R = retain; F/C/D = no such finding/control/deletion here.  Every row is R: no test/source/support deletion is unlocked.  “keeper” names the real caller/entrypoint that would lose the observation.

## Cross-cutting reachability and history

* **Affiliate research is an operator recovery/batch path, not a product-navigation leaf.** `scripts/validate-slice.ts` consumes `data/affiliate-research/missing-<slug>.csv` and `results-<slug>.csv`, records validation, and exits nonzero on invalid accounting. `scripts/aggregate-affiliate-research.ts` refuses missing/extra ID accounting before producing approved/review queues. The checked-in runbook executes the validator at [runbook:36] and [65], aggregate at [89], then requires manual review before write-back [99-106]. `2e0d8cda` (2026-05-26) records the completed 226/227-link backfill. Completion is not proof that a documented, fail-closed rerun/recovery path can be retired. `url-gate` is also live support: `src/lib/product-metadata/{health,buyability}.ts` and `scripts/price-audit/run.ts` import it.
* **Legacy chunks are deliberately executable only for recovery.** `scripts/ingest-product-chunks.ts:70-75` stops unless `ALLOW_LEGACY_PRODUCT_LIST_CHUNKS=1`; `docs/excel-ingestion.md:51-57,77-80` calls it a legacy rollback/regeneration path, while `docs/codex-review-map.md:26` names it and `tests/product-list-chunks.test.ts` as a CI review surface. The absence of normal AgentV2 use is therefore the reason to retain the guard tests, not evidence to delete them.
* **Product metadata remains an active operational boundary.** `package.json:77` exports `npm run audit:products`; its script invokes `checkStoredLinkBuyability` at `scripts/audit-product-metadata.ts:186` and `auditProductMetadata` at :214. `buyability.ts` is also used by the September recurring price-audit lane. `scripts/ingest-products.ts:617` calls preflight before filtering/writes, and :652 merges commercial fields; `docs/excel-ingestion.md:59-68` documents the catalog ingestion path. History: `2ae3d7e0` added the metadata audit (2026-06-11); `21e0e41f` added the recurring price-audit consumer (2026-09-30).

## Exact AST dispositions

### Affiliate aggregate and CSV boundaries (12 R)

| Test declaration | Disposition and failure observation | Actual keeper / source-support deletion |
| --- | --- | --- |
| `affiliate-research-aggregate.test.ts:24` `dedupe...highest confidence` | R — catches lower-confidence result replacing the selected product ID. | `aggregate.ts:17-31`, called by `aggregate-affiliate-research.ts:72`; none. |
| `:36` `dedupe...tie-breaks` | R — catches non-allowlisted duplicate winning equal confidence. | `aggregate.ts:8-14,27`; approved CSV producer; none. |
| `:51` `classify...approves high...tokens` | R — catches valid reviewed-row failing to enter approved queue. | `aggregate.ts:40-52`; aggregate script’s `approved.csv`; none. |
| `:63` `classify...medium to review` | R — catches medium evidence entering approval. | `aggregate.ts:41-43`; manual review gate in runbook:99-106; none. |
| `:76` `classify...denylisted ... review` | R — catches unsafe host bypassing review. | `aggregate.ts:47-50` + live `url-gate`; none. |
| `:89` `classify...empty tokens to review` | R — catches unsubstantiated high-confidence approval. | `aggregate.ts:44-46`; approved/review split; none. |
| `affiliate-research-csv.test.ts:9` `parse...simple rows` | R — catches baseline row decoding corruption. | `csv.ts`, inputs of validator/aggregate/price-audit; none. |
| `:17` `parse...quoted fields` | R — catches comma/quote corruption in names/URLs. | `csv.ts`, aggregate input reader; none. |
| `:25` `parse...trailing newline` | R — catches empty field/row handling change. | `csv.ts`; slice result input; none. |
| `:30` `stringify...quotes` | R — catches malformed generated approved/review CSV. | `csv.ts`, aggregate output and price-audit CSV; none. |
| `:42` `round-trip...recovers data` | R — catches cross-function CSV loss, independently of parser examples. | `readCsv/writeCsv`, scripts above; none. |
| `:54` `readCsv...header mismatch` | R — catches schema drift acceptance. | `slice-validator.ts:30-42`, aggregate’s expected headers; none. |

### Slice validation and URL policy (16 R)

| Test declaration | Disposition and failure observation | Actual keeper / source-support deletion |
| --- | --- | --- |
| `affiliate-research-slice-validator.test.ts:16` `valid slice` | R — preserves success contract for exact ID set. | `validateSlice`, CLI `validate-slice.ts:36-39`; none. |
| `:32` `missing id` | R — catches incomplete operator slice marked valid. | `slice-validator.ts:53-57`; runbook blocks aggregate at :65-70; none. |
| `:44` `duplicate id` | R — catches duplicate result rows. | `slice-validator.ts:46-60`; none. |
| `:56` `wrong output header` | R — catches incompatible worker CSV schema. | `readCsv expectedHeader`; none. |
| `:65` `invalid confidence` | R — catches unknown confidence reaching aggregation. | `slice-validator.ts:49-51`; none. |
| `affiliate-research-url-gate.test.ts:14` `isUsableUrl` | R — catches malformed/unsupported links treated as usable. | `url-gate`, reused by `health`, `buyability`, price-audit; none. |
| `:24` `hostOf` | R — catches host normalization/policy bypass. | `url-gate`; none. |
| `:29` `isAllowedHost` | R — catches allowlist or www-normalization drift. | `url-gate` consumed in aggregate and metadata health; none. |
| `:43` `isDeniedHost` | R — catches marketplace/aggregator acceptance. | `url-gate`; none. |
| `:51` `normalizeBrandSlug` | R — catches brand-direct normalization mismatch. | `passesBrandDirect`; none. |
| `:59` `passesBrandDirect` | R — catches short/sloppy brand host acceptance. | `buyability.ts:49-63` and URL gate; none. |
| `:72` `urlGate allows allowlisted` | R — catches approved retailer rejection. | Aggregate classifier and metadata audit; none. |
| `:80` `urlGate rejects denylisted` | R — catches prohibited retailer approval. | `health.ts:91-100`; none. |
| `:89` `urlGate rejects malformed` | R — catches parse failure pass-through. | `health.ts:91`; none. |
| `:98` `urlGate accepts brand-direct` | R — catches valid brand-direct link rejection. | aggregate and buyability generic rule; none. |
| `:106` `urlGate rejects unknown host` | R — catches unrestricted affiliate/retailer acceptance. | metadata audit and aggregate approval gate; none. |

### Guarded legacy product-list path (11 R)

| Test declaration | Disposition and failure observation | Actual keeper / source-support deletion |
| --- | --- | --- |
| `product-list-chunks.test.ts:10` `hyphenated oil subtype` | R — catches degraded German concern rendering in recovery chunks. | `buildProductListChunks`, guarded ingestion; none. |
| `:25` `texture not thickness` | R — catches legacy shampoo metadata silently becoming thickness. | `normalizeShampooBucketPairs`, catalog semantics; none. |
| `:39` `requires explicit pairs` | R — catches invalid legacy shampoo fallback. | same canonical eligibility boundary; none. |
| `:52` `accepts explicit pairs` | R — catches valid canonical pair normalization failure. | same boundary; none. |
| `:69` `ingestion refuses unflagged` | R — real subprocess guard: catches accidental legacy chunk regeneration. | `ingest-product-chunks.ts:70-75`; rollback-only contract; none. |
| `:87` `flag proceeds` | R — real subprocess: catches the recovery override being permanently blocked. | `ingest-product-chunks.ts:70-114`; none. |
| `:131` `Excel conversion emits pairs` | R — source-level guard for the named converter output schema; catches removal/renaming of exact canonical fields before ingestion. No stronger test exercises converter output-to-ingest pair transfer. | `convert_sources.py` -> `ingest-products.ts:178-200`; retain pending a behavioral transfer; none. |
| `:140` `markdown ingestion guarded` | R — real subprocess guard for the second product_list ingestion path. | `scripts/ingest-markdown.ts` guard; docs/excel-ingestion:57; none. |
| `:158` `guard spares unrelated source` | R — catches over-broad legacy guard disabling non-product_list ingestion. | `ingest-markdown.ts` selector path; none. |
| `:201` `preflight before writes` | R — source-order safety control: catches moving/removing preflight before filter/embedding/upsert. A failure permits invalid shampoo source to reach a DB writer. | `ingest-products.ts:617` and writer path; no behavioral no-DB keeper exists in this lane; none. |
| `:219` `PRODUCT_NAMES cannot bypass preflight` | R — subprocess contract: catches targeted ingestion evading invalid unselected shampoo validation. | `ingest-products.ts:617` before :620 filter; none. |

### Metadata audit and catalog identity (14 R)

| Test declaration | Disposition and failure observation | Actual keeper / source-support deletion |
| --- | --- | --- |
| `audit-product-metadata-script.test.ts:22` `missing/unusable links` | R — catches bad stored link labelled usable/unknown rather than unavailable. | `buyability.ts:95-97`, `audit:products`; none. |
| `:33` `known retailer content` | R — catches retailer unavailability phrase no longer classified. | `buyability.ts:38-42`, audit script :186; none. |
| `:48` `dm unavailable wins` | R — catches cart markup overriding unavailability. | `buyability.ts:50-54`; recurring price audit shares helper; none. |
| `:63` `Mueller unavailable wins` | R — same precedence defect for Mueller. | `buyability.ts:44-48`; none. |
| `:78` `Rossmann unavailable wins` | R — same precedence defect for Rossmann. | `buyability.ts:38-42`; none. |
| `:93` `inconclusive returns null` | R — catches guessed availability on unreadable page. | `buyability.ts:109-112`; audit writer must not create fact; none. |
| `product-metadata-health.test.ts:30` `suspicious marker` | R — catches catalog footnote marker omission. | `health.ts:37-45`, audit:products; none. |
| `:35` `numeric price` | R — catches comma/equivalent price parsing corruption. | `health.ts:47-58`; stale-price audit; none. |
| `:41` `known metadata issues` | R — catches loss/order of multi-finding audit output. | `health.ts:80-124`, audit script :214; none. |
| `:58` `stale price` | R — catches watched price delta threshold loss. | `health.ts:60-68`, known-price audit support; none. |
| `product-metadata-ingest-identity.test.ts:19` `missing explicit id` | R — catches dangerous fallback to name/category after an explicit-ID miss. | `ingest-identity.ts:90-99`, `ingest-products.ts:262`; none. |
| `:33` `missing alias row` | R — catches stale alias silently selecting/upserting by name. | `ingest-identity.ts:101-111`, ingestion writer; none. |
| `:52` `name/category fallback` | R — catches valid no-ID/no-alias match regression. | `ingest-identity.ts:113-116`; none. |
| `:68` `preserves commercial fields` | R — catches import blank values erasing affiliate/image/price unless force selected. | `ingest-identity.ts:62-83`, ingest script :652; none. |

## Result and limits

**53/53 AST sites read and classified: R=53, F=0, C=0, D=0.** No coherent redundant layer was proven. In particular, the two source-oriented product-list controls are retained with their owner/observation documented above; they are not proposed as static-pattern cuts. The affiliate backfill’s historical completion and legacy chat retirement do not satisfy the required proof that its documented recovery scripts and shared URL policy are dead. No runner result, provider state, database state, or current data-directory contents was claimed.

