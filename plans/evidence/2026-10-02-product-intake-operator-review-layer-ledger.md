# Product Intake operator/review cohort — read-only ledger

Canonical reconciliation uses `/tmp/test-audit-final299-declarations.json`: **205** current syntactic sites — submissions51, review-app39 (`.test.ts`), workflow26, enrichment23, lookup23, matching22, research-jobs21. The prior final267 navigation inventory was stale: it still counted two already-applied final-handoff declarations in research-jobs, `"final handoff normalizes every category into approval-validator shape"` (historical :1087) and `"cockpit publish handoff promotes the processed image storage URL into the approval payload"` (historical :1347). They are excluded, with zero repeat credit.

**Disposition: R 205, F 0, C 0, D 0.** This audit supplies no executable candidate.

## Product Intake authority and closure

The canonical runbook `docs/product-intake-research-ops.md` requires explicit Nick-gated final handoff, preserves catalog-intake versus global-recommendation readiness, and keeps review-center state/preflight distinct from publishing. Current roots include customer intake routes (`src/app/api/product-intake/{chat,onboarding}/route.ts`), scan submit (`src/app/api/scan/submit/route.ts`), Personal Plan Stage3 intake, review-center workspace commands (`package.json:90-124`), and catalog-enrichment preflight/apply commands (`package.json:125-158`). `src/lib/product-intake/{submissions,repository,product-matching,review-workflow,category-validators}.ts` owns persistence/matching/approval contracts; review-app/workspace route code owns local review artifacts and image decision handling; research job migration/RPC/worker sources own queue/lease/role boundaries.

The 51 intake tests separately protect owner uploads, replacement/rollback, user/chat provenance, scan normalization/dedupe/race, route status mapping and image signature validation. Lookup/matching matrices are independently meaningful identity/admission cases, not regroupable duplicates. Review app/workflow/enrichment/research jobs preserve human approval, image provenance, schemas, preflight write guards, source/secret containment, worker lease/RPC/RLS and package/workspace boundaries. The exact values are DB/operator contracts under the runbook.

History and current command surface establish active maintenance rather than retirement: intake/review/research roots remain in package scripts and app routes; earlier durable evidence records maintained model/image QA and catalog enrichment. No provider, environment, DB or runner was invoked in this audit.

## Exact AST dispositions


### `tests/product-intake-submissions.test.ts` — 51 sites

- **R** `37` — "manual and photo intake accept the supported heat-protectant and scalp-care categories".
- **R** `442` — "product intake feature flag defaults production off and preview/dev on".
- **R** `460` — "manual intake schemas require category, frequency, brand identity, and product name".
- **R** `495` — "scan intake schema keeps brand and product name optional, requires category, and validates the scanned identifier shape".
- **R** `531` — "scan intake schema is a passthrough validator: it trims the identifier value but does not normalize it".
- **R** `543` — "matched manual intake links user usage to the existing product without creating a submission".
- **R** `564` — "matched photo intake verifies and clears tmp uploads without creating a submission".
- **R** `598` — "matched photo intake keeps tmp uploads if matched usage write fails".
- **R** `636` — "unknown manual intake creates a pending submission and pending usage slot".
- **R** `666` — "photo intake creates a pending submission with image paths and uncertain validation".
- **R** `701` — "photo intake cleans committed front image and does not create review row if barcode commit fails".
- **R** `738` — "photo intake cleans rows/images without mutating usage if pending replacement RPC fails".
- **R** `779` — "photo intake persists only server-derived uncertain validation state".
- **R** `823` — "photo intake rejects image paths that do not belong to the user".
- **R** `844` — "photo intake rejects stale committed image paths instead of reusing old submission photos".
- **R** `868` — "photo intake verifies tmp uploads exist before creating submission rows".
- **R** `893` — "empty onboarding placeholder usage can be claimed without replacement confirmation".
- **R** `910` — "tracked usage requires explicit replacement confirmation".
- **R** `931` — "onboarding same usage id can update a tracked slot without replacement confirmation".
- **R** `956` — "onboarding same pending photo usage can be saved again without reuploading the front image".
- **R** `1010` — "needs-more-info submission can be completed in place and reopened for review".
- **R** `1063` — "chat needs-more-info follow-up can update the pending submission in place".
- **R** `1118` — "stale chat follow-up card cannot update a different pending submission".
- **R** `1168` — "onboarding same pending photo usage updates the current reference when a new front image is uploaded".
- **R** `1223` — "onboarding mismatched usage id still requires replacement confirmation".
- **R** `1248` — "chat still requires replacement confirmation for a tracked slot".
- **R** `1269` — "confirmed unknown replacement stores previous slot state and cancels old pending submission".
- **R** `1325` — "failed pending replacement leaves old pending usage untouched".
- **R** `1369` — "cancelling an onboarding usage deletes the slot before closing the linked pending submission".
- **R** `1408` — "chat intake verifies source conversation ownership and preserves owned conversation id".
- **R** `1449` — "OPEN_SUBMISSION_STATUSES is exported for src/lib/scan/pending-submission.ts to share (no duplicated literal set)".
- **R** `1458` — "scan submit with a cataloged EAN resolves already_in_catalog and touches zero user_product_usage rows".
- **R** `1499` — "a catalog match that fails the scan eligibility gate (quarantined/inactive) falls through to a pending submission, same as a miss".
- **R** `1539` — "unknown scanned EAN creates an anchorless pending submission with the normalized identifier persisted, touching zero user_product_usage rows".
- **R** `1568` — "scan submission persists the explicit retailer match decision as privacy-safe provenance".
- **R** `1592` — "dm enrichment prefills absent scan text only after original scan matching falls through, and is staging provenance".
- **R** `1649` — "dm enrichment preserves user-supplied scan text while retaining dm provenance".
- **R** `1688` — "a mismatched dm GTIN cannot prefill or enter scan submission provenance".
- **R** `1721` — "a lost race on the one-open-scan-submission index returns the submission that won it".
- **R** `1761` — "a unique violation with no reloadable open submission still surfaces as an error".
- **R** `1794` — "scan submission normalizes the scanned identifier once before it is matched and persisted".
- **R** `1818` — "scan submission omits scanned_identifier columns and matchProductIntake's identifier when no identifier was scanned".
- **R** `1845` — "existing onboarding/chat submitProductIntake behavior is unchanged by the scan-anchor fix".
- **R** `1862` — "route handler returns controlled disabled response before auth or persistence".
- **R** `1882` — "chat route persists pending product context after product intake submission".
- **R** `1951` — "chat route upgrades a legacy offer row with atomic dual-written submission linkage".
- **R** `2047` — "route handler returns controlled client error for wrong-user upload paths".
- **R** `2081` — "route handler returns controlled expired response for missing tmp uploads".
- **R** `2115` — "route handler keeps storage verification failures as persistence errors".
- **R** `2157` — "storage upload verification classifies only missing objects as expired user uploads".
- **R** `2195` — "image validation accepts image signatures and rejects non-images".

### `tests/product-intake-review-app.test.ts` — 39 sites

- **R** `209` — "review app lists product-intake research packages".
- **R** `228` — "review app keeps researched packages in progress only after a local image candidate exists".
- **R** `265` — "review app classifies prepared draft shells as not researched".
- **R** `304` — "review app classifies validation-ready packages with approved image decisions as ready".
- **R** `317` — "review app reads package detail with submission, payload, and image decision".
- **R** `333` — "review app exposes reviewer source and image evidence".
- **R** `365` — "review app prefers package-local image candidates over brittle remote product images".
- **R** `409` — "review app serves package-local image files and blocks traversal".
- **R** `453` — "review app can process an approved image candidate into a finalization draft".
- **R** `537` — "review app can request a targeted replacement image search".
- **R** `576` — "review app searches source pages and attaches a replacement image candidate".
- **R** `684` — "review app falls back to dm product search for JS-backed product images".
- **R** `802` — "review app rejects unrelated retailer image-search results".
- **R** `861` — "review app excludes unsafe source and image urls from reviewer evidence".
- **R** `910` — "review app exposes property rows with values, rationales, and sources".
- **R** `971` — "review app explains grouped property rows with child-level rationales".
- **R** `1001` — "review app uses live validation status when stored validation is stale".
- **R** `1026` — "review app explains broken images and final image metadata".
- **R** `1069` — "review app renders property review as a compact table".
- **R** `1081` — "review app saves image candidate review decisions".
- **R** `1107` — "review app saves approved image candidate review decisions".
- **R** `1133` — "review app saves per-property review decisions".
- **R** `1166` — "review app preserves existing property decisions when another property is saved".
- **R** `1209` — "review app can bulk approve all properties".
- **R** `1216` — "review app rejects final package approval until image and properties are approved".
- **R** `1240` — "review app treats property approvals as stale when reviewed values change".
- **R** `1305` — "review app saves final package approval after image and all properties are approved".
- **R** `1375` — "review app keeps package approval unblocked when final image updates image url after property review".
- **R** `1428` — "review app can refresh signed user upload urls from stored paths".
- **R** `1448` — "review app rejects package paths outside research root".
- **R** `1460` — "review app saves approved image decision and patches payload image url".
- **R** `1481` — "finalize image script creates reviewable final asset metadata".
- **R** `1566` — "finalize image script uses the specifically approved image candidate".
- **R** `1661` — "finalize image script fails closed when cutout still contains a dark reflection tail".
- **R** `1745` — "finalize image script ignores a destructive prepared cutout when the alpha source is usable".
- **R** `1834` — "review app saves no-image decision and patches payload image url to null".
- **R** `1865` — "review app normalizes review-app image search provenance before final approval".
- **R** `1909` — "review app saves needs-image-work without injecting final payload fields".
- **R** `1951` — "review app rejects invalid approved image metadata before writing".

### `tests/product-intake-review-workflow.test.ts` — 26 sites

- **R** `343` — "unsupported category fails approval validation".
- **R** `352` — "approval payload rejects invalid barcode identifiers before product publish".
- **R** `364` — "every curated category requires its own exact canonical application protocol".
- **R** `375` — "multi-role Leave-in requires an exact canonical protocol for every executable role".
- **R** `389` — "heat-capable Oil keeps heat as a binary and requires only its leave-on protocol".
- **R** `421` — "treatment-only Shampoo is complete with its derived dandruff protocol".
- **R** `439` — "dual-role Shampoo requires both ordinary and dandruff protocols".
- **R** `481` — "Shampoo rejects an extra protocol for a role unsupported by its reviewed buckets".
- **R** `507` — "Mask and Leave-in emit every canonical v3 fact".
- **R** `527` — "canonical protocol validation retains the pre-insert placeholder but rejects invalid evidence".
- **R** `541` — "heat protectant requires verified tri-state capability and an exact pre-heat protocol".
- **R** `580` — "scalp care requires an exact role, cosmetic format and product protocol".
- **R** `627` — "missing base product fields fail approval validation".
- **R** `637` — "missing source evidence fails approval validation".
- **R** `647` — "unsupported identifier types fail before approval writes".
- **R** `657` — "identifiers are optional when reviewed source evidence is complete".
- **R** `668` — "null image URL is allowed for an explicit reviewed no-image approval path".
- **R** `681` — "barcode-like identifiers are canonicalized before approval writes".
- **R** `694` — "field rationales must cover product and category spec conclusions".
- **R** `706` — "manual review flag is required before approval".
- **R** `716` — "researched payload parser keeps draft and final JSON payloads".
- **R** `728` — "each supported category emits expected target table operation shapes".
- **R** `787` — "shampoo rows are emitted without Cartesian guessing".
- **R** `811` — "bondbuilder product relationships are optional and do not block approval".
- **R** `826` — "incomplete multi-row category specs fail".
- **R** `843` — "ready-for-review dry run only passes when approval validator passes".

### `tests/product-intake-catalog-enrichment.test.ts` — 23 sites

- **R** `179` — "new-product manifests require duplicate evidence, have no target id, and plan only catalog work".
- **R** `187` — "manufacturer SKUs are accepted while unknown identifier types remain rejected".
- **R** `219` — "new-product manifests require exact curated catalog content derived from the approved final payload".
- **R** `274` — "new-product insert content fails closed on drift or resolved B1 fields".
- **R** `287` — "new-product manifests require exactly one product insert before spec operations".
- **R** `310` — "new-product operations must be derived from the shared category validator".
- **R** `330` — "approved category specs cannot diverge from the operation-driving category payload".
- **R** `351` — "commercial price and currency must match the approved product payload".
- **R** `370` — "existing enrichment requires an exact current target fingerprint".
- **R** `386` — "existing enrichment validates every planned category upsert against the shared validator".
- **R** `455` — "eligibility deletes are allowlisted and carry the complete natural key".
- **R** `479` — "deletes stay scoped to the eligibility table and to the manifest's own product".
- **R** `507` — "only existing enrichment may plan deletes, and never against its own upsert".
- **R** `537` — "the placeholder cannot be used to smuggle a contradicting delete past the check".
- **R** `596` — "execution order runs the product row, then deletes, then upserts".
- **R** `617` — "duplicate candidates block a proposed new product".
- **R** `626` — "unknown schemas and unrelated tables fail closed".
- **R** `635` — "safe manifests reject traversal, user data, secrets, and signed URLs".
- **R** `673` — "approved review binds its exact content fingerprint".
- **R** `694` — "index generation is deterministic and refuses concurrent-key collisions".
- **R** `712` — "the frozen contract requires every catalog payload section".
- **R** `729` — "catalog_state remains a new-product-only contract".
- **R** `743` — "excluded, provisional, and verification manifests cannot plan product inserts".

### `tests/product-intake-lookup.test.ts` — 23 sites

- **R** `148` — "user-visible lookup does not return exact hits for non-Chaarlie-recommended products".
- **R** `169` — "intake-dedupe lookup can find active non-Chaarlie-recommended products".
- **R** `191` — "user-visible lookup can find active non-Chaarlie-recommended products owned by the user".
- **R** `216` — "user-visible lookup does not return exact hits for non-active-lifecycle products".
- **R** `242` — "lookup asks for more product identity when category is omitted and product text is generic".
- **R** `258` — "lookup offers intake when category and concrete product text are present but brand is unsplit".
- **R** `277` — "category-less lookup prefers explicit product type over oil ingredient wording".
- **R** `293` — "category-less lookup does not let oil wording override conditioner identity".
- **R** `309` — "lookup recognizes reviewed product title aliases for renamed catalog products".
- **R** `326` — "lookup rejects unsupported categories without offering intake".
- **R** `343` — "lookup asks the user to select a variant when same-category catalog neighbors exist".
- **R** `363` — "lookup treats a unique canonical product name as an exact product match".
- **R** `380` — "lookup asks for variant selection instead of exact match for a weak partial name".
- **R** `403` — "lookup can find unique No/Nr numbered products without a category hint".
- **R** `422` — "category-less lookup asks for variant selection when identity is still ambiguous".
- **R** `442` — "user-visible lookup can include current user's verified non-recommended products".
- **R** `467` — "lookup still shows a single same-category candidate for variant confirmation".
- **R** `490` — "lookup asks for confirmation instead of intake when generic oil text has one same-brand oil".
- **R** `510` — "lookup ignores weak wrong-category token overlap and offers intake".
- **R** `531` — "lookup surfaces strong identity matches in another category as category mismatch".
- **R** `554` — "lookup offers product intake only for a precise supported product not found in catalog".
- **R** `579` — "lookup treats unresolved brand plus generic category name as enough identity for intake".
- **R** `604` — "lookup asks for more identity before offering intake for generic brand category mentions".

### `tests/product-intake-matching.test.ts` — 22 sites

- **R** `85` — "GTIN/EAN plus selected canonical category returns exact matched product when one active row exists".
- **R** `99` — "GTIN/EAN without category or with a different category returns review candidates only".
- **R** `125` — "identifier path ignores inactive products".
- **R** `144` — "text matching uses snake_case clean_name rows from the repository boundary".
- **R** `177` — "GTIN/EAN with mixed-category exact evidence stays review-only".
- **R** `218` — "ambiguous GTIN/EAN review candidates include cross-category exact evidence".
- **R** `276` — "retailer identifiers do not collapse punctuation into false exact matches".
- **R** `328` — "retailer identifiers preserve diacritics for exact matching".
- **R** `364` — "brand plus line plus clean name plus canonical category exact match returns matched".
- **R** `380` — "brand plus name fallback does not auto-link a different product line".
- **R** `396` — "brand plus line plus name with mixed-category exact evidence stays review-only".
- **R** `432` — "ambiguous brand plus line plus name candidates include cross-category exact evidence".
- **R** `480` — "existing non-recommended active product can match".
- **R** `495` — "brand plus clean name and category can match when no line exists".
- **R** `510` — "brand plus name with mixed-category exact evidence stays review-only".
- **R** `545` — "ambiguous brand plus name candidates include cross-category exact evidence".
- **R** `592` — "multiple close candidates return ambiguous review without auto-linking".
- **R** `612` — "cross-category fuzzy candidates remain visible for review".
- **R** `634` — "retailer SKU matching requires matching source before auto-linking".
- **R** `707` — "missing category cannot match for usage from brand and name alone".
- **R** `722` — "category mismatch does not auto-link text matches".
- **R** `739` — "barcode identifiers match across UPC-A / EAN-13 / GTIN-14 spellings of the same number".

### `tests/product-intake-research-jobs.test.ts` — 21 sites

- **R** `111` — "worker packet keeps only exact-GTIN dm provenance and makes retailer images candidates".
- **R** `158` — "worker packet reports an exact-GTIN mismatch without preserving a packet or leaking payload".
- **R** `202` — "workspace wiring keeps review cockpit separate from root app checks".
- **R** `222` — "internal app and shared package expose the expected workspace contracts".
- **R** `232` — "research job status constants keep terminal and non-terminal sets explicit".
- **R** `257` — "research jobs migration is service-role protected and claim-safe".
- **R** `280` — "research job RPCs guard terminal submissions and non-retryable states".
- **R** `305` — "pending product submissions automatically enqueue durable research jobs".
- **R** `325` — "repository uses the real product_submissions schema and tolerates missing phase-one job table".
- **R** `340` — "service-role review routes are local-only unless explicitly overridden".
- **R** `348` — "review cockpit kicks the local Codex worker after enqueueing work".
- **R** `382` — "research job migration keeps one open job per submission and terminal statuses outside the partial index".
- **R** `400` — "artifact and review decision migration is service-role protected".
- **R** `429` — "model evaluation artifacts are part of the shared Product Intake contract".
- **R** `442` — "detail page exposes research artifacts, comments, rework, and preflight controls".
- **R** `583` — "review property rows show exact database field paths and raw approval values".
- **R** `715` — "shampoo approval specs require explicit scalp routes".
- **R** `784` — "codex worker can run preview-only or explicit codex cli mode and persists review output".
- **R** `956` — "publish route is fail-closed and leaves final writes to the CLI handoff".
- **R** `982` — "review decisions validate image and publish field paths".
- **R** `1006` — "queue overview keeps active and completed submissions filterable".

## Candidate / transfer and limits

`/tmp/test-audit-product-intake-operator-review-machine-candidates.json` is `[]`: no deletion or transfer candidate is ready in this scope. A separate cross-lens observation at `tests/product-intake-review-app.test.ts:1209` concerns a duplicate private identifier plus already-retained label assertion; it is **not integrated, not classified C/D here, and has zero credit** pending main's separate closure/transfer review.

The test summaries, fixtures and named owners were read statically. No command that loads environment, calls a provider, opens the review center, runs a worker, accesses Supabase or executes tests was run. The review app and worker have filesystem/process behavior that static fixture harnesses cannot prove; this is a limit, not evidence to remove their safety gates.
