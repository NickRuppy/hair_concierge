# Residual scanner119 complete declaration ledger

Full21testfiles/callbacks/helpers/tables read.119AST sites; catalog TYPO_TABLE tenrows remain oneAST site. No runtime, provider, DB, browser or repository edits. This is a conditional proposal, not removal credit.

Classification: {'R': 103, 'F': 2, 'C': 12, 'D': 2}

## tests/scan-alternative-comparison.test.ts

- **C** `20` deriveAlternativeComparison: no criteria yields an empty comparison with a zero score — C1: empty-array projection is already called by the retained undefined-criteria masking keeper; exact {rows:[],summaryScore:0}. SHA `bd11fa9fea1568f35fd3e40edb7da22a48f882bacc201e7e9ee9572e9645f7b6`
- **C** `25` deriveAlternativeComparison: a pass criterion becomes a match row — C2: pass->match/id-label verbatim/score1 complete row is owned by the composed payload keeper, strengthened for its existing first default alternative; generic copied string fields differ but no category/identifier branch exists. SHA `467685d63abe628ae23b9dd5a6553b380d9f4ddfa6a421cfacc9c4f6e448bce1`
- **R** `33` deriveAlternativeComparison: caution/fail/unknown map to partial/mismatch/unknown — R: caution/fail/unknown exercise three distinct switch arms; pass-only composed fixtures cannot catch swapped mismatch/unknown mappings. SHA `1769db287075f1e3861a999cc55f69ec508d6293bf2d842151b4ce646c39a82e`
- **R** `45` deriveAlternativeComparison: summary score is the fraction of matching rows — R: two matches among four rows constrain denominator and unknown inclusion; all-pass/empty score probes cannot catch denominator counting only measured rows. SHA `af9fb4aa9f2558b3f8329334efb4e68818e6dc4d8e166c7dacd5081fd257a34f`
- **R** `55` deriveAlternativeComparison: preserves criteria order and copies id/label verbatim — R: two ordered distinct row IDs and labels constrain order; the retained route label oracle sorts and cannot detect row reversal. SHA `6cf8d4cabecdb85c988c95726257ec4e2d84b8b51e5564667859fa0182982f74`
- **C** `69` deriveAlternativeComparison: a row never carries anything beyond rowId/label/state — C3: exact composed comparison deepEqual forbids every extra own row field, subsuming sorted own keys on the default one-row projection. SHA `cd1fb731efb10eac375837ba8c22b0974fc84a68c3fbfb4554d375af39ec1f24`
- **R** `75` deriveAlternativeComparison: is a pure function — same input, same output, no mutation — R: two calls on the same frozen array reject unstable output and array mutation; this is not a deep-freeze proof against mutation of the nested criterion object. SHA `eb5f7b397166dab0ec4675c843a6dfeeaeef8557bd80916a04c2d680e569944d`

## tests/scan-analytics.test.ts

- **R** `47` Scan analytics is PostHog-only — R: literal destination booleans prevent scan events being forwarded to Customer.io/Meta; direct PostHog mapper tests cannot detect routing leaks. SHA `8ed8202284961b1e70345a27c7a12df2f19e51bc814e8648117c7757870970f6`
- **R** `53` noOpScanAnalytics never forwards events — R: explicitly injected/default no-op port must not forward. Consent factory is a separate callable object and cannot detect accidental no-op implementation forwarding. SHA `aadd90b824b03fe516cd30d6bd82348a8156988e32d516b51d54868c262c28fa`
- **R** `71` Scan analytics factory only fires with analytics consent — R: declined/unset consent suppresses events; granted consent forwards all original typed payloads. Serializer siblings call the destination directly and bypass this policy. SHA `4ef929f2ce208666e669e412964d4432da1401dc8e96d5721664e069714b5f9b`
- **R** `156` Scan events map to PostHog with the documented snake_case properties — R: actual destination maps ten scan events to independent literal snake_case outputs; swapped/deleted properties fail. Provider capture is only the observed sink. SHA `00cf246eee88c6ff5be1d6f42ed14ae82af99ec7b610c15543c3edff1034c64f`
- **R** `234` scan_submission_created's intakePath distinguishes the barcode-scan unknown flow from the search sheet's name-based recovery — R: name_search and null suggestedCategory preserve distinct public recovery attribution; prior table emits scan with nonnull category. SHA `627181cbdb5cf5da30ffd3336dea2bf707c4017ac056383b04129abe69628d4d`
- **R** `270` scan_result_shown reports a not_needed verdict as a catalog hit, not a miss — R: product-bearing not_needed remains catalog hit; null product becomes false. A kind-only predicate fails the independent null/header check. SHA `0cb68bdaad04be39fc73416a24deb864975434a0e0c61277fe277afda852efe7`

## tests/scan-catalog-search-typo.test.ts

- **R** `71` `matchCatalogProducts typo table: ${label} ("${query}")` — R: ten table rows cover deletion/substitution/long-token edit budget/transposition/reject bounds/multiple tokens/prefix distance. One AST site, no row regrouping or removal proposed. SHA `348c9729f3bda59cdb51defb60c4d7cb37fe552aacc13be1a7d584768667a4f5`
- **R** `76` matchCatalogProducts: tokens under 5 chars compare whole words, not word prefixes — R: short-token whole-word guard rejects oil while longer/whole deletion matches; dropping the prefix-length guard broadens unrelated product hits. SHA `64998bb35fdc88175ad765d2db2fdbd2df48c95202ee9c1574ee56e86dd6dc3b`
- **R** `84` matchCatalogProducts: very short tokens (< 3 chars) get no typo tolerance — R: a two-character query receives no typo budget; the three/five-character fixtures do not prove this boundary. SHA `b29b745f2eeafa88eae96c7b2663507cfc2f6d81b1e2ce88d68611fca3150b03`
- **R** `89` matchCatalogProducts: exact title → substring → token → typo-only tiers, sort_order only breaks ties within a tier — R: all four ranking tiers conflict with sort_order, so putting sort ahead of tier produces a wrong full order. SHA `7742388d728c6e6a7e09ade7d96b9ce80d65d2d5e18e8732984df699c2236b14`
- **F** `100` matchCatalogProducts: within the typo tier the existing sort_order → name → id tiebreak holds — F: still protects sort_order then name within typo tier, but every name differs; the claimed final id tiebreak is not exercised. Retain full callback, no added fixture or zero-credit repair here. SHA `a167cbd1d1a7c678fe87769af0a397055b7eaa0ab9396dbaa7f6d72eb24f7094`
- **R** `112` matchCatalogProducts: plain substring matching is unchanged (case-insensitive, over the identity title) — R: uppercase and multiword substring route bypass edit distance and constrain compatibility of preexisting search. SHA `56c045ea901e0c2b90ce0a226a0628b214368ddf25a038c0669bfee8e8d0ac7a`
- **R** `117` matchCatalogProducts: numbers never match by typo — sizes and product numbers are exact — R: digit-bearing query/title tokens preserve numeric identities; allowing edit distance on them would mix100/200 or No3/No4. SHA `e6124fe00c03d0b83df63c93889ec6823b7af110835f8aa0f3a2e145cc65843b`

## tests/scan-masked-alternative.test.ts

- **C** `34` maskAlternative: withholds identity, productId, image, price and net content — C4: payload keeper already calls actual maskAlternative for each existing alternative and checks exact outer key set on both. SHA `aea7852f96a98ff0aecd08d4e14da0f111ef9563fd17c81359b612f86c485994`
- **C** `39` maskAlternative: keeps the alternative's own verdict and verdict label — C5: actual resolve masked alternativeB already carries supportive/Passt eingeschränkt; transfer both literal assertions to that existing HTTP response. SHA `ba68a0355154eb3bce7a9813146e74c794fb9dad028e3f8978cae9d98ed427ed`
- **C** `47` maskAlternative: derives comparison rows from the alternative's own criteria — C6: first payload alternative is exactly alternative() with the same criterion; add exact existing rows/score union there, no new invocation. SHA `f5ea0c4c2aa355115d7b6030929465616582f1986e062e91d5afd043ce2bf66d`
- **R** `55` maskAlternative: an alternative with no carried criteria yields an empty comparison — R: undefined criteria must enter ??[] and yield empty rows/zero; explicit [] only tests the downstream projection and misses fallback removal. SHA `0abfca9727993099427b024d820211a7223e3b487eed6c69d3c9e8411d4926e5`
- **R** `60` maskAlternative: does not mutate the input — R: full JSON snapshot before/after catches mutation of input identity and nested criteria; merely comparing output keys cannot. SHA `42a69e09bdd7213df2b78ed133667b9705c1488c6e148b8a75a2d6f416b4a0ef`
- **R** `83` maskScanVerdictPayload: masks every alternative, leaves every other field untouched — R primary keeper: two alternatives both masked while exact verdictTitle/coverage/dimensions references survive; now owns first default comparison row/score assertions too. SHA `075ffd2af6a0cf8e878b29ea13147454cc75ca1b0ad82715e5539093751a3f7e`
- **R** `94` maskScanVerdictPayload: an empty alternatives list stays empty — R: empty alternative list must remain empty; a fallback/recommendation placeholder insertion is not exercised by the two-item keeper. SHA `1b0db810a55d9de25675860d7db15190ca5a0387decf8f0e573dbadc1b89ed25`

## tests/scan-name-only-submission-migration.test.ts

- **D** `48` scan name-only submission migration: identifier-based scan rows are unaffected (byte-identical EAN lane) — D1: exact same EAN INSERT runs first in retained two-lane coexistence SQL keeper; final count2 observes both surviving insertions. SHA `3ebff1d75e7be6f4c55330f2fecec624dffec0c2c34a41f19510a30fbe469676`
- **D** `62` scan name-only submission migration: a name-only scan row (no identifier) is now accepted — D2: same name-only identity and INSERT is accepted in retained coexistence keeper; existing EAN row is excluded by name-index predicate, and count2 observes both. SHA `3cf68cccf33d5e70aa92266afb6132117a2404de76026748ee5afc3a2a8434f5`
- **R** `75` scan name-only submission migration: a scan row with neither identifier nor brand+name still fails the CHECK — R: missing both identity forms must fail the named CHECK; allowing incomplete scan rows would pass happy SQL replays. SHA `f19a060b36dca16d1ebe83083526a0190c24dab5369a6feb462a944d07ec8416`
- **R** `89` scan name-only submission migration: a scan row with only brand_text (no product_name_text, no identifier) still fails — R: brand-only differs from completely absent name data and must still fail AND constraint; weakening AND to OR is caught. SHA `a479d3f590107a2381901b3a2fc5a4298cf9a9669a7f3cc3d15944a4ccd3196c`
- **R** `103` scan name-only submission migration: non-scan sources are untouched by the relaxed CHECK (the rule only ever constrains source='scan') — R: non-scan source bypasses scanner-specific CHECK. Applying scan restrictions to onboarding is distinct regression. SHA `bbc0b3f49abdbfce1fe987ea1faca36406b9f591b0e95291a8ec3e8d5f63f92a`
- **R** `118` scan name-only submission migration: one-open-name-only-submission index rejects a second open duplicate (case-insensitive) — R: lowercased duplicate across two open states must fail named unique index; dropping lower() or researching from predicate escapes simple happy inserts. SHA `37c38e2ebecc5280c1533428fa886c9872910b0d9e513ec4ca404b4a37b2cd86`
- **F** `138` scan name-only submission migration: the index scopes to (user, category, brand, name) -- a different user, category, brand, or name is not blocked — F: actual rows independently vary user/category/name, not brand despite title. Retain three proven scope dimensions/count4; no extra input or cut claimed. SHA `a313b27424599811459bf9cccbdf530aa501d557abe991b81e9fd53590b3068a`
- **R** `171` scan name-only submission migration: a CLOSED prior submission (not in the open-status set) does not block a new one — R: prior rejected state must not block a new open request; including closed status in partial index fails second insert. SHA `7ffc534da6a64f31a7246e6826f41793898011cfc1b8b79224594ca6b046aaee`
- **R** `192` scan name-only submission migration: the name-only index never overlaps an identifier-based row for the same user+category — R primary keeper: same user/category can store EAN and name-only rows concurrently; exact original INSERTs/count2 subsume two isolated happy callbacks. SHA `ca7a42d9af7c7608f2046e2f0618dad57967c4c62b2cdb6c5e89204daf4caaa0`

## tests/scan-observability.test.ts

- **R** `10` captureScanException tags and scopes the event under scan.* — R: actual capture builds tags/string status/context/error severity and passes same thrown error to sink; wrong scope transformation fails literal dictionaries. SHA `7b4ee5382d2416b43f3fb6e9192a0b645503dd0a6c3244799be39ba04b9f01c5`
- **R** `54` captureScanException honours an explicit warning level, without leaking it into tags/context — R: explicit warning overrides default severity and stays absent from serialized tags/context; default-error test does not cover it. SHA `62265034ad8d5214b1b512e2dc787b32e9d489e3fabe962b064d2c557a83ada0`
- **R** `93` buildScanSentryPayload omits reason/userId when absent, never emits empty tag values — R: undefined reason/user omitted rather than emitted empty; populated error fixture cannot constrain absence. SHA `2bc166992dbd0ee8ac23c1941e566bdbbacdbc8cd2d65700f7f2b741c1c5f2a5`
- **R** `99` buildScanSentryPayload carries a distinct tag per scan route, for filtering — R: five distinct public route tag values retained. They are operator filtering identifiers, not private implementation names; no stronger actual sink keeper covers their complete literal union. SHA `90a849448f8f93d4feecb18e59bdb8f3a09c6edd8449ab2c6939c8d544629826`
- **R** `107` dm lookup warnings capture only a fixed message and low-cardinality reason, once per window — R: fixed safe message and reason plus throttle suppression/window expiry protect privacy and incident-volume behavior, independent of payload builder. SHA `432691cf8f451d85ec2fd9ad2d27b17a385195de282635b2347e7a52601b91df`

## tests/scan-pending-submission.test.ts

- **R** `31` findOpenScanSubmission: open submission found — R: real query adapter emits user isolation, complete open statuses, GTIN variants and maps id/status from returned data. Stubs only record actual query; route deps replace this owner. SHA `9883b8ad86fa15200e2dff32880a466e79a4d17f8832bebb0cadff0af0533e87`
- **C** `51` findOpenScanSubmission: no open submission is null — C12: existing variant-query keeper also receives {data:null,error:null}; wrap its existing await with null assertion. Query variant differences are consumed in request construction, but not after the data-null return predicate; all variant assertions retained. SHA `bc87ee349f0c90a25154ecebd2a58a456adc59e45ccf30212accffe7694a62f7`
- **R** `59` findOpenScanSubmission: queries every GTIN spelling of the same number — R primary keeper: three GTIN spellings including UPC preserve query compatibility; now also observes actual null-data output on that existing call. SHA `33a8b17835e38913e532f0dae8d444eb8d2b73812ecffd15378fef18081e89f2`

## tests/scan-presentation-rows.test.ts

- **R** `55` the active-product lookup requires both the active flag and the active lifecycle — R: actual factory must request products id/category and both active gates; injected route loader siblings never observe this SQL-builder protocol. SHA `60eb25ec9227ce509a56d6683947933adcbd4e08b578507c644e97acd5a239bf`
- **R** `73` the active-product lookup reports a miss as null and a query failure as the caller's error code — R: no row -> null and query error -> caller-specific reveal code are distinct response branches; successful row mapping cannot prove them. SHA `204530d12b7c3ee1ba857d394df7f791dd1e730359ed86f9d9a9874027e56976`
- **R** `84` presentation rows select the full commerce column list, dedupe ids and normalize the link status — R: full commerce select list/deduped IDs and unknown purchase status normalization; dropping a column or leaking pending status is detectable. SHA `efc6a824bac3bd9a75d5e91600266f1c2215e7cdf6ec39d2b99a88a0dc37b4c6`
- **R** `135` presentation rows short-circuit on an empty id list and surface the caller's error code — R: empty IDs perform no query, while nonempty query error preserves caller-specific code; both explicit controls remain. SHA `6558d9ad0029a4c3578948af65de23e7c2a9e8fbd0b0cb11f4d8f1f430eac74a`

## tests/scan-product-presentation.test.ts

- **R** `70` product header renders name, brand, category label and commerce — R: exact scan header projection and German commerce values bridge identity/category and commerce owner; masked route checks only scanned name/brand, not full header. SHA `42be5c043e90b99a5b46b6572c10dcd8b723d815ce302e0fd6a3de07b3f03e75`
- **R** `84` product header hides the purchase link when the link is not available — R: unavailable link is hidden while known price remains; blindly dropping all commerce or exposing unavailable URL fails. SHA `cc99383ed3a10782d3ddaa7d574681bd15e226bc1f9c727130e87230404d96f7`
- **R** `91` product header drops a price without a currency instead of assuming EUR — R: missing currency fails closed rather than assumingEUR; availableEUR fixture cannot prove this null gate. SHA `ab4076d7f5e7a956b67b135937e40cef888fa5b81381c801ade3f98e4a0e25f8`
- **R** `95` presented verdict joins brand and purchase url onto alternatives — R: alternative keyed row enriches brand/purchase URL while verdict-core price/title pass through unchanged; joins by array order or replaces core price would fail. SHA `d9436fb804262594c7a7d22cadd22270bc5c42ad6ac5470e7f29b648cb35c390`
- **R** `114` presented verdict leaves alternatives without a catalog row quiet, not broken — R: no alternative row -> null brand and URL, rather than wrong scanned row fallback or throw; keyed happy join insufficient. SHA `c2621c88191639649c686355e931466247893227374bebec6e590f6743a7df87`
- **R** `121` presented verdict passes the not_needed payload through unchanged — R: not_needed payload passes through unchanged; in_catalog enrichment must not create alternatives/reshape independent not-needed contract. SHA `12909378c7abb4b6804fff943ff0dc1b0d0d554bfe8a03981d741287ab0cae0f`

## tests/scan-profile-context.test.ts

- **R** `62` loadScanEvaluationContext: refined source takes precedence and preserves every evaluated category decision — R: refined literal source/revision and hash plus real generated decision/routine preservation. Shared compute fixture is not an independent engine-correctness oracle; source selection/publication still independent. SHA `597f7f2c6fb89d5e47400d9276c222f6ddf28553ec2f69e12d7a7878f9b4d71d`
- **R** `75` loadScanEvaluationContext: initial fallback without refined head preserves initial category decisions — R primary keeper: initial-only actual adapter output preserves decisions/source; now also retains original initial hair projection. SHA `f60ada051bc4f323bd88940ebcca5b5a6e40b46402c08e3b4f522e3b2ab6cb61`
- **C** `84` loadScanEvaluationContext: genuinely absent refined source falls back to compatible initial — C11: both callbacks set refined=null; validNeed returns on !need before inspecting current_refined_need_version_id. Only remaining fixture difference is that dead pointer; identical initial source/engine calls. Move exact hair assertion to existing initial keeper. SHA `20af9d97b387a8ab231e9e243aa0549494d11b40fc5a2831edbf2f5793b18bc4`
- **R** `92` loadScanEvaluationContext: no plan and no completed source is null — R: absent completed profile exits before source assembly and performs only read RPC; explicit no-publish oracle retains isolation of missing context. SHA `89e31794f247f835bc708aba48d5ee4f5b0118d4b0ed574930d5f7fd25b98e25`
- **R** `100` loadScanEvaluationContext: plan without need versions or completed source is null — R: completed profile + plan but no owned need/lead is a later rejection than absentprofile; must not fabricate source from a bare profile. SHA `f58f850832a069197357acb6ba115af6662e2c28ed87838ea7ec5a5907699be7`
- **R** `111` loadScanEvaluationContext: failed source reads and invalid hashes are retry, never missing profile — R: DB read error and hash mismatch reject unavailable rather than returning null/missing profile; retain actual hash/RPC error distinctions. SHA `ab62a2a6ad9770b7192996037167215c91258eaa299fe066a42a5ffe69d57eef`

## tests/scan-resolve-anti-leak.test.ts

- **R** `284` anti-leak: a masked response contains none of the withheld alternatives' identity strings anywhere in the JSON tree — R primary actual route keeper: authenticated productId path -> real presentation/quarantine/masking/JSON wrapper with injected external reads. Preserves adversarial string exclusions/scanned identity and now full recursive key/labels/supportive alternative assertions. SHA `59352288d570fdc3e3ad4bb4039088c6ac53986ac1992ba25dd7b16d15791aea`
- **C** `317` anti-leak: no alternative entry carries an identity/resolvable key at any depth — C7: exact same route fixture/deps/request/flag as primary string keeper; transfer all alternatives2/forbidden recursive keys/exact allowed set assertions onto its parsed existing body. SHA `6ef3bbd23071b6c02b754e2c97ad0de2e83f2d6d646c883e58affaf6e3fc4c30`
- **C** `346` anti-leak: comparison row labels come only from the fixture's generic criterion labels, never product names — C8: exact same route invocation as primary keeper; transfer existing generic-label projection assertion, no extra response or handler call. SHA `98e1ad6cd83d90e832624d447f131146b94a405c2ed668ed8b240936858250aa`
- **R** `358` anti-leak: an alternative's raw EAN/GTIN-shaped identifier never reaches the masked response — R: identifier HTTP branch consumes request EAN via validation/lookup/attempt telemetry rather than productId path; preserve raw request identifier exclusion. SHA `7d5e74a4cddf835565ba234cf96479ef3ee41b27c67b17c89aa0c6a03a81d2f7`
- **R** `367` anti-leak: masking survives an alternative whose productId collides with a substring used elsewhere (no accidental UUID leak) — R: alternative/scanned product identity collision is retained conservatively; it changes identifiers consumed by presentation/quarantine reads before serialization. No input-complete independent keeper proved for that collision. SHA `442125fd1851a1b6e0ceeb74a2066f88b227439604bc855550c3c4dd6c503071`
- **R** `385` anti-leak: dm-identified unknown exposes only the product-row subset — R: unknown retailer enrichment exposes only six identified fields and no URL/INCI/descriptive secrets. Distinct not-found response branch, not masked known-product projection. SHA `3b53cb58fed9d200341d6dc3354fbea94fc71b70e559dfd1d1e6eb1f21612e6a`

## tests/scan-role-selection.test.ts

- **R** `86` an evaluation status without a verdict scans as unknown — R: status known passes four verdicts; unknown/pending/unsupported normalizeunknown; missing status handling can overclaim fit. SHA `5bf9c2fb867ad21cdba228b26144d771ea79bfd177cd9e55a0b2ff81d779536a`
- **R** `96` no evaluated role selects nothing — R: empty entries ->null avoids fabricatedwinner/null dereference; nonempty cases insufficient. SHA `ddfb2e96cc84acb10a19cc5bc90dbf448a3c16bbdf9e175265d8c9cae14f819d`
- **R** `100` a single evaluated role is the winner regardless of its verdict — R: single mismatch winner remains actual entry; single cardinality is supported public selector input, not same as rankingtwo. SHA `c10c091b56158ebf68005a85817e5717dfa3072787c037e3bac17e03beb1e87e`
- **R** `105` ideal beats supportive — R: ideal outranks supportive despite later input order; swapping rank entries fails. SHA `8be8ba027bf91de46a01f354dac1564e05f46847cf456ee1b52f707bdc883280`
- **R** `111` supportive beats unknown — R: supportive outranks knownunknown; adjacent rank ordering distinct. SHA `c8faf3cbcc76112af370d4ab18e540c0c5a41bafa0e0f0fe33733178f9b703f8`
- **R** `117` unknown beats mismatch so a mixed role result never overclaims a rejection — R: unknown outranks mismatch to avoid unjustifiedrejection; changing unknown rank fails. SHA `9c871dee5b0273ca66f92e12f946c731c5a461651ef736cfdbbf23e05647426a`
- **R** `123` all roles mismatching stays a mismatch on the first role — R: two mismatches preserve first and resultingmismatch verdict; tie and statusinteraction retained. SHA `b4e4f32604005a13d07b2a8cd6d2ffe77a45fc29b029bae3712be08b0698fece`
- **R** `131` an equal verdict is broken by the higher target coverage — R: higher measured matches breaks equalverdict; ignoring coverage fails. SHA `d25a57135b731a6578c789382a41de6e651c45e184e0ca13a83c1a7a8d60567f`
- **R** `137` a missing coverage loses against measured coverage on an equal verdict — R: null coverage loses to measuredpositive; treating absence as high/full coverage fails. SHA `96b18751d32cb07549974380a4d0000be09aa82a233dceb2455abdc7907bdd31`
- **R** `143` an equal verdict and coverage is broken by fewer caution criteria — R: equalrank/coverage picks fewer cautions; dropping cautioncount fails. SHA `7fb827de41e6b4b197283ae613675463ddfdd1176b0097bf7cbb1754acca1b6d`
- **R** `155` a full tie keeps the given role order — R: full tie preserves either suppliedorder on two existing calls; fixedrole bias or unstable sorting fails. SHA `73425d000dd6ec4b4ddfd9df0b1b8f67773a80758a9372a934bef1853606222a`
- **R** `168` selecting does not reorder the caller's entries — R: caller array remains unchanged despite bettersecond; in-place sorting would fail. Winner tests alone do not observe mutation. SHA `9239a94ff69849840d614a04039657361be5f3379c91efcf3d19c72ffe66a0c8`

## tests/scan-submit-dm-event-log.test.ts

- **R** `19` writes only the privacy-safe submit lookup measurement — R: actualwriter exact table and safe outcome/time fields, including explicitcreatedAt; substitutingclient mock output cannot implement this mapping itself. SHA `18e2cdcb6888dfdc7531840c5c9bc7ebdcb71404ca7c03bbd8e86eea806c07ad`
- **R** `50` is fail-open and rate-limits a degraded submit telemetry warning — R: resolved insert error does notreject, warns without rawprovider detail and emits once perwindow; privacy/throttle behavior realowner executes. No claim of rejectedpromise/syncthrow coverage. SHA `71609adff50108a62c7519808d14fef9f6118d94213465c77907342525201250`

## tests/scan-trigger-cards-ui.test.tsx

- **R** `80` ScanProactiveTriggerCard: renders a card for every proactive trigger id with its own copy — R: actual card element produces one region/CTA per supportedid with nonempty accessible name; bounded shape/a11y contract, not independent proof of exact per-idcopy quality. SHA `91017fcce87bbafe33b8cfe85ec0f5bfd39a011a4f3907dde26fde0feb0addb6`
- **R** `99` ScanProactiveTriggerCard: kategorien_luecke links into /routine instead of opening the sheet — R: categorygap uses routinehref and nobutton/noopen; cannot be subsumed by remaining imperativeCTA cases. SHA `3eda7d10d7e8843b39b05508c62ea4e6b2276ed2ededfa0782e2dcf80352bf2e`
- **R** `111` ScanProactiveTriggerCard: passt_gut_moment/frust_serie/wiederkehrer open the sheet via a button — R: three supported prompt buttons invoke suppliedcallback exactlyonce and expose noa; actualcomponent event wiring runs. SHA `9bdbe2b0e36d897f5c965503f4f6d9247e94775daec0b8f8cf45a1bf92427ce9`
- **R** `125` ScanCategoryRepeatCard: renders its own card, names the repeated category, and opens the sheet on tap — R: repeatedcategory literalShampoo and ownmarker/button callback; distinct component/personalizedlabel. SHA `a0d1b02fef5d3f58d35b629be6de9dd8cc37b6ce7470b9977e8a5234caf47c3a`

## tests/scan-trigger-session-marker.test.ts

- **C** `26` recordScanSession: the first call on fresh storage is session 1 — C9: exact initial recordScanSession(storage,1000) call already exists in session3 keeper. Transfer returned1 and persistentrecord truthy observations immediately afterfirstcall. SHA `2997300c1974d8ab1ec53ea467cfb4991182f8d558a8dcd4a4c4aeb44c931b08`
- **C** `32` recordScanSession: a call more than 30 minutes later is session 2 — C10: exactsecondcall at1000+31minutes already exists in session3 keeper. Transfer return2 assertion in place withoutanothercall. SHA `cf445376510670cf0d8125fe3bd9491f59e4c4b2e5051eab4f9ce3ebd59a63c8`
- **R** `38` recordScanSession: a call within 30 minutes stays the SAME session (no increment) — R:29minute and+5second remount remain same session; catches threshold/update-lastSeen handling notcovered31min gaps. SHA `abbbb7251d3a0905f0ec28a6720b50d2be028e9136eb641b757f82a2503fa768`
- **R** `46` recordScanSession: the count keeps climbing across further 30-minute gaps — R primary keeper: threeexisting timestampcalls now assert1/storedrecord/2/3, retaining laterincrement proof. SHA `49b99c03857937e65b793e2c9cf8d8fcf0ad719e7a44029194c21014fd5f62a7`
- **R** `53` recordScanSession: null storage (SSR, private mode) is always session 1, never crashes — R: nullstorage directSSR gate safe1 differs from thrown accessor catch. SHA `b6a338d005aabb57d85eb35e71c488d8f8eecf2efccd7f5f9cdd1c17cf0294a6`
- **R** `57` recordScanSession: a storage that throws is treated as session 1, never crashes — R: throwing storage returns1 throughcatch; unsafegetItem/setItem propagation fails. SHA `0b61d47b80adba175a64dee7d1463bddbf6ebfc0f3811a695795cc96ff68e44d`
- **R** `69` recordScanSession: corrupt/garbage JSON in storage is treated as no prior record — R: invalidJSON parsecatch restarts1; freshmissingstorage does notexercise corruptedserializedrecord. SHA `599551b85b86f4bd1954a946fba35e1380eaeb8720dc671e1c90c3a0254a7869`
- **R** `77` readScanFatigueBudget: nothing persisted yet answers null — R: absentfatigue value ->null throughrealgetItem validation; other tests coverinvalidstring andnoadapter rather thanfreshstorage. SHA `77a4e52e2e0d4e3d6cd9889f18c35b695d74facce0e94f2d7cc4c8829c5eae4e`
- **R** `82` writeScanFatigueBudget + readScanFatigueBudget: round-trips a persisted trigger id — R: frust_serie exactenum value persists/rawkey matches; actualwhitelist membership is productprotocol, retain independently of categorygaproundtrip. SHA `b71d5d860bb22ead119c46e7b91c4fa8e48c2e43fbe27a309f983210bed9852d`
- **R** `89` readScanFatigueBudget: null storage (SSR) or garbage content is always a safe null — R: nullstorage andinvalidenum content safe null; prevents readingarbitrary values as triggerIDs. SHA `d0a47930232fb15552298db7eeec1d4c96f25272c5d75947143b70b513861eef`
- **R** `96` readScanFatigueBudget/writeScanFatigueBudget: a storage that throws never crashes — R: thrown fatigue read andwrite do notcrash; both guardedoperations retain externalstorage failure boundary. SHA `e5a7766807a2582780dcef5eceb585ca82efda62864b8c40a7b3d72179afd91a`
- **R** `109` F1: the fatigue budget survives being read back by a fresh storage read (simulates a remount) — R: kategorien_luecke membership is independently consumed by runtime trigger-ID whitelist. It is not remount execution, but realwrite/read enumacceptance differs from retainedfrust_serie; no claimed duplicate solely by mockstorage. SHA `0736d4cb55851f781103472a41506f38c1975f16fdf2754397fafa070168dffc`

## tests/scan-verdict-access.test.ts

- **R** `71` isMaskedScanVerdict: only a response carrying freeRevealAvailable is masked — R: own marker presence bothtrue/false distinguishes masked from premium/notneeded. Booleanvalue-only guard regression fails. SHA `e6c6fb5538db3d087daae46774465664c04337597d3b2c30522ed66662c51584`
- **R** `78` scanTierSignal: an in_catalog verdict is the only evidence of a tier — R: onlyincatalog proves tier; unknownproduct/pending/notneeded cannotinferpremium. Distinct wirekinds retained. SHA `9a5e1616ed3c763c160b51cd01c22e94bd5f2c6107dabecd4a1ef48e3c233579`
- **R** `102` nextScanTierSignal: a proven tier survives a later verdict that carries no evidence — R: unknownnext preserves currenttier and realnewtier overrides; prevents accidentalunlocks orstale purchase state. SHA `e31af54b186fb530a30b7bd08f7af63437475e0a39848a8dab5e28493867c4ae`
- **R** `111` scanRevealCta: the reveal is offered only while the credit is genuinely unspent — R: reveal requiresunusedcredit andno409override; both spentboolean andserverobservedspent cases retained. SHA `2ffb539d403b7755467fa51da6ec8b4b32e9fdfc31929ef1f0a69c17a75cceba`

## tests/scanner-analytics-context.test.ts

- **R** `20` durable original source wins after touch consumed or replaced; only safe acquisition fields leave server — R: durable row wins overmissing/replacedtouch and stripsprivateclickid; lateracquisitioncannot overwriteoriginal. SHA `d6822b1d77bbf71eab2ef634460791bbd8a2254390ae691f863bfd3831698f2b`
- **R** `36` new scanner context uses signed matching touch, never a different journey or failed lookup fallback — R: signedmatching session accepts touch, differentjourney/dbfailure/non-scanner excludes; independentauthority guards. SHA `e6fb4e0a6be9070de89ca3b623c9d53ea5fd6e7fd1bd9d006d8cdfc6819d9376`
- **R** `49` safe source does not reveal raw dynamic paths, querystrings or unsupported values — R: dynamic path/objectcampaign withheld, strings trimmed, trustedinternal/testkind/session values survive; privacyliteral constraints. SHA `b9d1e2ba51508115adcf0adb71ffb9eaaf05cc8a3f49deb81716d9444aeb8859`
- **R** `69` scanner metadata readiness distinguishes a database failure from a confirmed empty acquisition — R: confirmedemptyacquisition remainsready whileDBfailure notready; trackerretryneeds distinction. SHA `02caee42656d2f746aed62bf0a2d5f62c542a004a47a17f8e3228426ab364c16`

## tests/scanner-offer-analytics.test.ts

- **R** `21` scanner offer content events are PostHog-only — R: eventdestination routing denies Meta/Customerio for twooffer contentevents; serialization testsbypassrouter. SHA `1201037baba5a5907b88d973692fc757e96af59b86adfea98ed279bad3ae4a9d`
- **R** `30` scanner offer content interactions retain the offer envelope and omit an absent section — R: twoactualPostHog eventcases carry event-specific fields andcommonofferIDs; undefinedsection removed, presentsection retained. Missingproperty andwrongname regressions detected. SHA `0fa45f80a31818599d0c4c30c5ba66811cbb5a5833e024dbef4f6634840bf669`

## tests/scanner-quiz-view.test.ts

- **R** `8` scanner quiz view emits once with event-time timestamp only for scan_v1 — R: settledperpackage snapshot usesfirst step/resume/event-time andfullsafecontext exactlyonce; subsequentcall cannotretime/replace it. SHA `0d42e963b33abc053a163c34585368af362c7ac0d904f4b077d4971792db5f05`
- **R** `54` an ordinary displayed quiz never emits even if a late lookup identifies scan_v1 — R: ordinarydisplayedquiz mustnotemit fromlatescannercontext; stalecontext alone insufficient. SHA `77c399d23eaa018e5036b5604a92538077df1afdf0979887203795f41324ec98`
- **R** `64` a no-longer-current scanner mount is not backdated after context resolves — R: inactive mount beforecontextresolve suppresses emission; realisCurrentcallback observed. SHA `67e5b88ab15c19437f86e66d1405dfff211d54ff4f52816a9ceca142c0470e45`
- **R** `87` a failed context lookup retries with the original mount snapshot — R: nullcontext retried preserving originalstep/id/time; freshretry snapshot or noretry fails. SHA `72e0e7e729896e18ab6c0cded49f2ded9a01954041647e9942a3062c4c5eda0e`
- **R** `118` each rendered mount gets one distinct scanner view — R: twoseparate trackerinstances emittwodistinctids while eachsettlesonce; singleton/globalsettledstate fails. SHA `24e4f23619d0631445f77b50a5c8b5d1f310eedf958fc24a537f93ae1b07ebeb`
- **R** `146` scanner quiz views are PostHog-only and map their bounded snapshot — R: real destination mapping boundedquizsnapshot plusPostHog-only route; trackerstub doesnotcoverwire naming/destination. SHA `27c4d2826c7a7c277c8c579ce5c4258711a614f3a74bea0e377111a9a64706da`
- **R** `203` incomplete scanner metadata retries before capture and persistent failure emits no view — R: metadatafalse retries bounded3; recovery2 emitsonewithinternalflag andpersistentfailure emitsnone; nullcontextcase doesnotcoverpartialauthoritative metadata. SHA `b99c61eec197561f6fe4c631f5fafb2ff32dbd464d4eeaebe3a99a4c085923c3`

## tests/scanner-result-artifact-email.test.ts

- **R** `14` builds the dedicated scanner transactional payload without organic focus or caller package — R: actualpayload dedicatedconfigurednumerictemplate, trimmedtarget/encodedlead resultURL andonlytwomessagedata keys; genericartifactbuilder is separateformat. SHA `220eb22d3ad97c17207d299c1949e15d8938dec5d1cd30b1cacfab2d9fc2faa8`
- **R** `36` requires an explicit scanner message id instead of falling back to the organic template — R: omittedmessageid throws explicitdedicatedenvkey, neverorganicfallback; configuredhappycase insufficient. SHA `c3081d6663d2ed8dc3883ee21ba611c44e232614b1378d657f19d131f7b38e88`

## tests/scanner-trial-offer.test.tsx

- **R** `38` scanner presentation uses the controlled selection and only the compact tariff layout — R: actualcompactscannerUI selectedyear/monthcallback plusmonthlycomparison,savings,introprice,paymentnotice andnoherocopy. Defaultoffer distinctrenderbranch. SHA `a5d47fe2e6a364ee9f7dc853941c1d41cf07251d35e526d3c815e1491743b44c`
- **R** `66` scanner presentation without introductory annual price anchors on the renewal equivalent — R: equalfirst/renewalprice switches copyandannualequivalent/savings; introductoryfixture cannotcoverbranch. SHA `6a835fb2b352d8ea8654c0a5e667012b8c46253d31d250922a5838e5b3b85510`
- **R** `81` scanner presentation propagates pending state and selected dynamic monthly terms — R: pending disablescallback andrendersmonthterms bothdirectcomponent andrealTrialOffer scannerbranch; callbackno-opanddelegationdistinct. SHA `740a55e68dd52aea2842a65d17bb86d84f9fbdbfa95a603dfef006c5bf38e3c1`
- **R** `110` scanner trial continue is the pricing CTA and carries the selected interval — R: exactpricingCTA analytics attributes plusselectedmonth arelivepubliceventprotocol; pricingtextpendingtests do notassert these attributes. SHA `b809c8c8bd36e1bd75733a90c714c4436ed09fd10b8e32dc95c65a68ecb410d9`

