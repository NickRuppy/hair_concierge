# Remaining barcode gaps: proposed resolution rules

Status: approved for implementation on August 31. Nick confirmed the six canonical owner choices, identity-first enrichment, conservative anti-dandruff guidance, food/body-oil inclusion and the exact guarded reversal path. This approval covers review-ready code and research artifacts only; production data writes, commit/push/publication, recommendation activation and deployment remain separate gates.

## Outcome and source context

Make every remaining existing-catalog barcode gap actionable without treating barcode identity, product suitability and category ownership as the same question. Preserve exact-package evidence and the single-owner invariant. Reuse existing brand/product IDs, identifiers, dispositions and guarded executor; add no status columns or identity service.

Baseline: [committed enrichment receipt](2026-08-28-existing-gtin-enrichment-receipt.md) and [exact 64-row audit](../data/scanner-catalog-coverage/2026-08-26/existing-catalog-gtin-final-audit-2026-08-28.json). The earlier task history was cleanly rebased onto `origin/main` at `b09a43e9a8849382401a8804ff63425736c4333e`; the rebased implementation baseline is `2e562d3bc4436e9f09e97bbfccc9a0f321a41a4e`. Historical receipt fingerprints remain immutable.

Live read-only refresh on August 28 at 09:32Z: 282 products retain MD5 `47d1b182838693c2e3b160439f83734e`; 259 active supported rows, 195 barcode-linked. At 09:33:39Z the full readiness oracle is unchanged: 183 result-ready, 35 unlinked otherwise-ready, 29 unlinked readiness-blocked. Oracle fingerprint `73235a7ec16851c28046b6d4369d6605b6d0051b1f58e61e88704650689af1db`.

The 64 are **catalog rows**, not 64 distinct physical packages. Report raw row coverage and physical-package coverage separately; no revised package denominator is asserted until reconciliation is complete. Retiring or hiding a row is not a successful barcode enrichment. Nick's August 31 direction is coverage-forward: retain every evidenced pack size, and retain genuinely different formulations as separate analyzed catalog products rather than discarding them.

## What is actually missing

These primary investigation groups partition all 64 rows; later findings may add secondary blockers without changing historical artifacts.

| Group                          | Rows | Actual difficulty                                                                                                                 | Resolution                                                                                             |
| ------------------------------ | ---: | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Direct-source retrieval        |   15 | Exact package/code not obtained in the prior bounded pass                                                                         | Candidate codes surfaced for nearly all; reconcile exact formulations and continue remaining variants  |
| Pack/formulation ambiguity     |    5 | Size, regional identity or ingredient-version mismatch                                                                            | Resolve exact variant; no guessing or bulk association of every code                                   |
| Unresolved physical duplicates |   12 | Six packages each have two plausible category records                                                                             | Explicit per-package barcode owner, without automatic merge                                            |
| Existing ownership decisions   |    2 | Cantu leave-in owner was already decided; legacy Balea shampoo is already covered by a different row                              | Reuse decisions; Cantu still needs package/code refresh; never add the code to the losing row          |
| Open-submission overlap        |    1 | Balea Natural Beauty Locken code is also in a researching submission                                                              | Park this candidate and continue unrelated research; preserve the collision guard                      |
| Protocol-role gap only         |    8 | Anti-dandruff shampoos have `shampoo_dandruff`, while the strict oracle also expects `shampoo_everyday`                           | Separate identifier research from role/protocol completion; do not fabricate generic directions        |
| Authority plus protocol gaps   |    3 | Unknown result and missing/incomplete applicable protocol                                                                         | Source-backed category rework in a separate lane                                                       |
| Existing dispositions          |   18 | Eight awaiting analysis, one ambiguous identity and nine retired (Cantu duplicate, K18 service mist, seven active food/body oils) | Reopen the seven active oils for hair-use analysis; retain the Cantu exclusion and hold K18 separately |

### Direct-source retrieval: 15

OGX Bond Protein Repair Conditioner; Garnier Wahre Schätze Argan-Mandelcreme Spülung; Guhl Bond+ Reparatur Spülung; Garnier Wahre Schätze Aktivkohle mask; Isana 3in1 Milchprotein & Mandel; Syoss Intense Curls mask; Gliss Aqua Revive mask; Hask Argan Oil Deep Conditioner sachet; Syoss Lamination Intense Glaze; Weleda Hydra Shine Gloss Drops; Shiseido Fino hair oil; Maria Nila True Soft Argan Oil; OGX Argan weightless oil; OGX Bond Protein Repair oil; OGX Keratin Oil shampoo. Exact IDs remain in the linked audit.

Fresh concrete recoveries, not new evidence-policy exceptions. The August 31 continuation found an exact candidate for nearly every product in this group; the [durable research ledger](../data/scanner-catalog-coverage/2026-08-26/existing-catalog-gtin-research-update-2026-08-31.json) records whether it can attach to the existing analysis or requires a separate formulation record:

- `1bfa5b02-26d9-457b-a5e6-445cc2284490`: [dm OGX rinse-out conditioner, 385 ml](https://www.dm.de/p/d/3068101/ogx-conditioner-bond-protein-repair), GTIN **3574661818467**.
- `99de5b38-3e80-4360-889c-2505f46a7243`: [Garnier Argan-Mandelcreme conditioner](https://www.garnier.de/haarpflege/haarpflege-marken/wahre-schaetze/argan-mandelcreme/reichhaltige-creme-spuelung), current 200-ml GTIN **3600542462594**. The 250-ml code **3600542462761** is retained as a possible older/regional formulation, not silently attached.
- `9f8da740-87b6-45e0-ab86-d77d63f2e22b`: [Guhl Bond+ Spülung, 200 ml](https://www.guhl.com/produkt/bond-reparatur/), GTIN **4072600701218**.
- `17c50884-3c17-479a-848a-10447464e086`: [dm Garnier Aktivkohle mask, 340 ml](https://www.dm.de/p/d/1679241/wahre-schaetze-haarkur-1-minute-aktivkohle-fettige-kopfhaut), GTIN **3600542510271**.
- `47795618-40e7-4ef6-8034-0fd8eb747575`: [Rossmann Isana 3in1, 250 ml](https://www.rossmann.de/de/pflege-und-duft-isana-isana-haarmaske-3in1-mandelmilch-milchprotein-und-mandel/p/4305615627441), GTIN **4305615627441**.
- `4f6dc4e4-d163-405d-9c68-3b2467090078`: [dm Syoss Intense Curls mask, 400 ml](https://www.dm.de/p/d/3099668/syoss-haarmaske-intense-curls), GTIN **4015100866100**.
- `7c057f58-3e9b-4347-b4c1-f04cc4213f94`: [HASK Argan Oil Deep Conditioner sachet, 50 ml](https://www.beautyplaza.com/de-de/p/argan-oil-repairing-deep-conditioner/10734/), GTIN **0071164333068**.
- `cce6346c-8c92-4a17-b39b-cc7f300e84de`: [dm Syoss Lamination Intense Glaze, 200 ml](https://www.dm.de/p/d/3119223/syoss-haarkur-lamination-intense-glaze), GTIN **4015100867213**. Regional/new-formula codes **9000101760095** and **5410091778088** remain separate until formulation reconciliation.
- `07120c73-0171-4a2a-9d07-facd9ce90d8c`: [Weleda Hydra Shine Gloss Drops, 30 ml](https://www.weleda.at/produkt/hydra-shine-gloss-drops-haar-oel-alpen-lein-g05483), GTIN **4001638590839**.
- `7b5ff358-1b3b-411d-9220-5e6d30543235`: [Maria Nila True Soft Argan Oil, 100 ml](https://marianila.com/products/true-soft-argan-oil-100-ml), GTIN **7391681036376**.
- `aa349c07-1add-44d4-9161-d99190182e5c`: OGX Argan Weightless, 118 ml, EU GTIN **3574661563350**; older US **0022796916204** needs formulation reconciliation.
- `c320750f-6a1e-420d-8594-409f04e05319`: OGX Bond Protein Repair Oil Mist, 50 ml, EU GTIN **3574661818481**; US **0052800681958** needs formulation reconciliation.
- `bef4f219-2c1f-4e02-8e3a-93056b95465a`: [OGX Keratin Oil shampoo](https://www.dm.de/ogx-shampoo-strenght-und-lenght-keratin-oil-p3574661798448.html), current-DE GTIN **3574661798448**. Nick's September 1 pragmatic formula-parity decision allows this current German package to use the existing analysis. Keep old/international GTIN **0022796977519** held because its package evidence is weaker.
- `663acf09-7090-40d8-9411-71154b9d60f3`: Fino has two distinct 70-ml products: [Premium Touch Rich](https://onlineshop.finetoday.com/products/fino-06), JAN **4550516493590**, and Airy Smooth, JAN **4550516483836**. They must not share one ingredient analysis.
- `7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9`: Gliss Aqua Revive mask older German GTIN **4015100813555**; newer/regional candidates **4015100813272**, **9000101726053** and **8410436457873** require exact formulation mapping.

All 29 candidate codes checked in the August 31 read-only snapshot passed check-digit validation, had no canonical owner, and had no overlap with the currently unresolved submission states. This is a time-sensitive research result, not a frozen manifest or production approval. Exact package/formulation reconciliation and a fresh full preflight still precede execution.

### Pack/formulation ambiguity: retain rather than discard

- Gliss Aqua Revive conditioner `02113cc7…`: regional 200/360-ml ambiguity. Candidate conditioner GTINs **5410091768041** and **9000101658736** require formulation mapping; spray **5201143753876** is a different format and must not attach to this row.
- Redken Anti-Snap `2b7db7e3…`: the retained code has 240/250-ml conflicting source descriptions. Do not pick one by majority or round the volume.
- Curlsmith Multitasking `2bafeb7e…`: verify one exact base package first; 59/946-ml additional packages need formula parity before sharing the same classification.
- Balea Intensivmaske `d5d67009…`: Nick's September 1 pragmatic regional-parity decision supersedes the earlier formulation hold. Attach both directly evidenced 300-ml package codes, DE **4066447982817** and AT **4066447237443**, to the same existing product analysis.
- Nuxe Huile Prodigieuse `5767f7a6…`: the catalog names a product family; choose an evidenced exact size/variant, not an arbitrary code from a multi-variant page.

Cantu leave-in `e3c4b607…` has an existing owner decision, but today's [dm 453-g page](https://www.dm.de/p/d/1685686/cantu-leave-in-haarkur-repair-creme) explicitly lists **810006945430**, whereas the held research code was **810006943405**. Neither is attached. Preserve both as distinct candidates and resolve package/formulation correspondence before selecting or combining them. Owner clarity does not prove code or formula parity.

Nick's September 1 execution rule is intentionally more pragmatic for this coverage phase: **different size/region/package codes may share one existing product analysis even when regional formula parity is not provable; treat them as the same formulation until the catalog supports regional analyses.** Explicitly different named variants, such as Fino Rich versus Airy Smooth, remain separate products. We prefer extra verified packages over suppressing a real package. A barcode still resolves to exactly one canonical product owner.

### Six genuine ownership decisions

| Physical product         | Existing category rows                        | Retained candidate code | Recommendation                                                                                        |
| ------------------------ | --------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Guhl Panthenol 2in1      | conditioner `11d42d9d…`; mask `8ef172f7…`     | 4072600703403           | **Conditioner owner**; preserve the mask use as usage guidance                                        |
| Hair Food Aloe           | leave-in `0307c903…`; mask `52264c47…`        | 3600542511049           | **Mask owner**; the exact German package is sold as a 3-in-1 hair mask                                |
| Hair Food Macadamia      | conditioner `4c3e1a63…`; leave-in `a72d630d…` | 3600542511612           | **Leave-in owner** for the pragmatic scanner result; it is supportive across all thicknesses, while the conditioner row currently mismatches all three |
| Balea Aqua Hyaluron 3in1 | leave-in `c6e80f39…`; mask `55727898…`        | 4066447668315           | **Mask owner**; the exact package is sold as a 3-in-1 hair mask                                       |
| Midnight Serum           | leave-in `6b01025d…`; oil `21a94166…`         | 3600524135805           | **Oil owner**; it has the complete dry-finish and leave-on protocols                                  |
| Pantene 7in1             | leave-in `f8f3b51d…`; oil `5827a3b9…`         | 8700216178402           | **Oil owner**; the exact package is a hair-oil spray and the oil row has the current source/protocols |

Rule: use an existing reviewed owner decision first. Otherwise compare the marketed product type, exact use instructions, approved category authority/protocols and current references. No automatic hierarchy, oldest-ID tie-break or retailer-navigation shortcut. Choosing an owner changes which category scanner evaluation uses. Alternate use modes belong in protocols, not competing barcode owners. Nick approved the one-owner approach and instructed the team to continue; the six selections above are the controlling scanner-owner decisions for this phase. A future catalog-consolidation pass may model multi-category identity more cleanly without duplicating GTIN ownership.

Cantu's conditioner row `7539ab79…` is already Nick-reviewed `retired_from_personal_plan / duplicate_identity` (August 12), explicitly favoring the leave-in. Reuse that decision for `e3c4b607…` after the code/formula issue above clears. Balea Tiefenreinigung's legacy shampoo row `0f71ff9d…` must remain barcode-less: the approved deep-cleansing owner `375ee7a0…` already resolves its code. No second assignment is needed.

### Queue overlap is parked, but the collision guard remains

Nick does not want to spend this phase processing user submissions. Leave Balea Natural Beauty Locken `f212a8ff…` and its researching submission untouched. The apply guard must still check unresolved submissions: if any candidate overlaps one, hold only that candidate rather than override uniqueness or break the user's association. Submission processing is not a prerequisite for unrelated clean candidates.

### Anti-dandruff default: derive the required role from the canonical bucket

All eight anti-dandruff shampoos (DERMAXPRO, H&S Sensitive, Salthouse, Sebamed, Pantene, Guhl, Schauma, Balea Med) already have the correct live `shampoo_dandruff` protocol. A dandruff-only product does not also need a synthetic `shampoo_everyday` protocol. Require `shampoo_dandruff` for `schuppen`, `shampoo_everyday` for non-`schuppen`, and both only when a product genuinely carries both canonical buckets.

The default mechanics are deliberately label-directed rather than a universal active-treatment claim:

1. Haare und Kopfhaut anfeuchten.
2. Shampoo gezielt auf Kopfhaut und Ansatz verteilen und sanft einmassieren.
3. Nur so lange einwirken lassen und so häufig verwenden, wie es das konkrete Produktetikett vorgibt.
4. Gründlich ausspülen.

Persist `wet_hair`, `scalp_roots`, `label_directed` contact time and `rinse_out`, copying each product's verified source/cadence where available. Do not hard-code “3–5 minutes” or one weekly cadence across different actives: [NHS guidance](https://www.nhs.uk/medicines/ketoconazole/how-and-when-to-use-ketoconazole/) gives 3–5 minutes specifically for ketoconazole, while [Mayo Clinic](https://www.mayoclinic.org/diseases-conditions/dandruff/diagnosis-treatment/drc-20353854) and the [American Academy of Dermatology](https://www.aad.org/public/diseases/a-z/seborrheic-dermatitis-treatment) direct users to the product/clinician instructions and show that cadence varies by hair pattern and condition. Add a conservative boundary: stop if irritation occurs; persistent or worsening scalp inflammation belongs with a pharmacist or dermatologist. This is guidance completion, not proof of medical efficacy.

### What the three authority cases mean

These products can receive researched GTINs, but scanner recognition alone would not yet support a reliable personalized explanation:

- Balea Brilliant Blond leave-in `ea88a333…`: legacy specs exist, but `plan_roles`, `care_direction`, `repair_support_level`, `functional_benefits` and its product protocol are missing.
- Jean&Len Rosemary/Ginger mask `e5cfad78…`: `suitable_thicknesses`, `repair_support_level`, `functional_benefits` and its product protocol are missing.
- Garnier Sleek & Stay oil `c574ee6f…`: it supports pre-heat use, but `provides_heat_protection` is still unknown and only the pre-heat protocol exists; its current coarse-only eligibility also needs evidence review.

Resolution: research and populate only the exact source-backed fields and protocols. Do not infer a positive match merely because a barcode exists.

### Food and body oils return to scope

Nick explicitly rejected the prior exclusion. Reopen these seven active products for exact finished-product/hair-use analysis: Allgäuer Traubenkernöl, benecos Aprikosenkernöl, benecos Mandelöl, BioGourmet Distelöl, dmBio Kokosöl, dmBio Olivenöl and KoRo MCT Öl. Their previous `retired_from_personal_plan / non_hair_product` or `wrong_category` dispositions must not be treated as approved current policy.

Inclusion in the scanner/database does not mean inventing equal benefit claims. Exact composition controls the guidance:

- Pure coconut oil can receive a conservative pre-wash fibre role; a controlled study found reduced protein loss for coconut oil but not the sunflower/mineral comparators ([PubMed](https://pubmed.ncbi.nlm.nih.gov/12715094/)).
- Apricot, almond, grapeseed, safflower, olive and MCT oils can be researched as optional hair-fibre lubrication/pre-wash oils, but evidence is weaker and oil penetration differs materially by composition ([2024 penetration study](https://pubmed.ncbi.nlm.nih.gov/38922913/)). Do not claim hair growth or scalp treatment.
- Default away from scalp application unless exact evidence supports it; oily hair products can aggravate hairline acne in susceptible users ([AAD](https://www.aad.org/public/diseases/acne/causes/hair-products)).

Research candidates already surfaced: Allgäuer 100 ml **4260389030401**, benecos Aprikose 100 ml **4260198097541**, benecos Mandel 100 ml **4260198097572**, BioGourmet Distel 250 ml **4039057414863**, KoRo MCT 500 ml **4260718296232**, dmBio Kokosöl 300 ml **4058172504969**, dmBio Kokosöl 620 ml **4066447602685**, and dmBio Olivenöl extra 750 ml **4066447918687**. The distinct unfiltered dmBio olive 500-ml variant **4066447918700** remains held for separate formulation reconciliation. Same-formula sizes may share a product; formula differences require separate analyzed rows.

The remaining disposition cases are handled as follows:

- **8 awaiting exact analysis:** Nivea Volumen & Kraft, Balea 2in1 Urea, benecos Macadamia, benecos Wunderbaumsamen, MoriVeda Moringa (directions); Dr. Scheller Jojoba, nedura Schwarzkümmel, Primavera Calendula (finished-product facts). Continue exact research.
- **1 ambiguous identity:** OGX Argan Oil. Resolve the finished variant before assigning a code.
- **1 retained exclusion:** Cantu conditioner remains the losing duplicate owner.
- **K18 professional-service mist:** keep as a separate professional-service scope decision; it is not one of the food/body-oil reversals.
- **Balea Pflegeöl Natural Beauty:** inactive/discontinued; retain historically only if discontinued-package scanner resolution becomes an explicit cohort.

Do not manufacture protocols or medical claims just to remove a blocker. A food/body label alone is no longer grounds for exclusion; exact ingredients, directions and conservative hair-use evidence decide readiness.

## Chosen direction, approved August 31

Recommend **identity-first research and identifier enrichment, followed by source-backed result readiness**. This allows protocol/authority-gap rows and the reopened oils into barcode research without pretending that recognition alone is a complete personalized result. Only the Cantu losing duplicate remains categorically excluded; K18 and discontinued Balea stay separately held.

Alternative considered: keep the earlier strict result-ready prerequisite for all barcode work. It reduces reporting ambiguity but unnecessarily prevents independent identity work on those 11 rows. Nick approved preserving the strict result-readiness metric while allowing independently verified identity enrichment before full recommendation readiness.

Revised rules:

1. **One GTIN, one canonical product owner globally.** A product may own multiple verified GTINs. Same-formula sizes/regions may share one analyzed product; different formulations become separate products with separate ingredient analysis. Preserve raw code, validate GS1 length/check digit and normalize equivalent spellings. Never generate a GTIN from a checksum or retailer SKU/URL.
2. **One strong direct code-to-package source can suffice.** Accept an official brand or reputable retailer's explicit barcode field, exact variant-bound JSON-LD/JSON/API, or reliable identifier lookup plus corroborated exact identity under the runbook hierarchy. URL digits, search snippets alone, marketplace title and an AI guess are discovery clues, not final proof. User photos/OCR need product-page/reliable-identifier corroboration under the runbook; do not invent a new photo-only approval exception.
3. **Classify failed retrieval honestly.** Distinguish blocked page/request, accessible page lacking barcode, variant conflict, and actual no exact match. Retry canonical PDP, then structured first-party source, then another reputable source. Retain source URL, package tuple, extraction field and checked time. Source unavailable is not product discontinued. After a bounded pass, record the exact missing evidence; do not repeat the same failed request indefinitely or call a one-page failure exhaustive research.
4. **Package and formulation are separate checks.** Record size/unit, format and region for every code. Prove extra sizes independently; missing size on the catalog row is not permission to assume parity. Conflicting formulations remain held until tied to the catalog analysis or separately re-researched. GS1 distinguishes declared net-content changes and certain declared formulation changes; a code is not a timeless ingredient fingerprint. [GS1 reference](https://ref.gs1.org/standards/gtin-management/1.1.0/), sections 2.2–2.3.
5. **Reuse decisions, never silently choose categories.** Canonical brands help resolve spelling but the live registry still contains legacy distinctions such as Fructis/Garnier and L’Oréal/L'Oréal Paris. Use complete package evidence and approved owner decisions; do not create or merge brand rows in this work.
6. **Park submissions without bypassing them.** Check all scanned and researched GTINs, not only the first. An unresolved-submission overlap holds that candidate; unrelated candidates continue. Do not mutate submission state/user links in this phase.
7. **Report three distinct facts without new DB fields:** identifier evidence/owner ready; barcode stored/resolvable (dispositions can still prevent resolution); full scan-result ready. Do not change scanner quarantine or manufacture a positive personalized result. Adding an identifier can change an undisposed product from unknown to a known result, which may still be incomplete; verify that existing outcome before the first identity-only cohort.
8. **Every apply remains exact and fresh.** Read-only research → pinned manifest + unchanged product snapshot → global active/inactive ownership/open-submission preflight → reviewed clean head and explicit batch approval → guarded transaction → exact readback and both lookup/result checks. No automatic apply from research status. Old applied manifests/migrations stay immutable.

## Scope, target map and ordered tasks

This is primarily a backend/operator data workflow, not a UI redesign. Identifier-only cohorts introduce no new screen or copy, so their planning evidence is the real resolve-result shape rather than a UI mockup. Protocol, authority and oil-eligibility cohorts can change which recommendation a user sees; before those cohorts enter implementation, capture the existing scanner/Personal Plan result surface with realistic German content, annotate the intended data-driven difference and walk through entry, result, incomplete-result and recovery states with Nick.

1. **Finish the per-package research ledger.** Record every evidenced GTIN, exact size/region/formulation, sources and whether it attaches to an existing analysis or requires a new product/analysis. Continue the remaining coconut-oil and variant searches. Completion: every candidate has an explicit evidence or hold state.
2. **Resolve canonical owners and readiness repairs.** The six owner recommendations are confirmed. Research the three authority cases. Prepare source-backed `shampoo_everyday` protocol payloads for the eight anti-dandruff products and hair-use payloads for the seven reopened oils. A focused test now proves that the existing explicit `personal-plan-stage5-protocol-apply-v1` manifest path can add `shampoo_everyday` to a `schuppen` product without changing the canonical derived-role oracle. Completion still requires exact evidence and accepted preflight for all eight intended rows; no guessed field, medical claim or competing owner is permitted.
3. **Prepare reviewed cohorts, not one mixed mega-batch.** Separate: (a) identifiers for existing exact formulations, (b) new formulation/product records plus ingredient analysis, (c) protocol/authority repairs, and (d) disposition reversals for the exact seven oils. Each cohort gets an exact manifest/fingerprint, unchanged-product snapshot and current ownership/submission preflight. The parked submission stays out.
4. **Apply only each separately approved cohort.** Reuse the guarded identifier executor for identifiers and verified product/protocol paths where they support the exact payload. A narrow guarded reversal executor/RPC is now implemented for the exact seven oils, with an immutable product/reason/source-fingerprint allowlist, service-role-only permission, dry-run/preflight, preserved prior evidence, transactional receipts, exact replay and rollback tests; it never issues ad-hoc client-side deletion. Removing a disposition is itself the user-visible search/readiness switch, and the deferred curated-publication gate requires complete Oil facts plus exact V1/V2 protocols. Therefore the order is fixed: result-surface review → approved Oil facts/protocols → reversal preflight → separate exact reversal approval/apply. Its manifest remains `prepared_for_review`, and neither migration nor reversal has been applied.

Before a production handoff, each cohort section must name its exact preflight/apply/verify commands and expected counts/fingerprints. E10 uses `npm run products:intake:scanner-identifiers:preflight -- --manifest=data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-e10-v1.json --reviewed-head=<sha>` and the existing guarded apply/verify commands only after its additive migration, clean reviewed head, refreshed ownership/submission reads and separate exact batch approval. The reversal cohort uses `npm run products:intake:stage5-product-disposition-reversal -- --file data/catalog-enrichment/personal-plan-stage5-v1/S5R-01-oil-reentry.json` for dry-run/preflight and adds `--apply --confirm --confirm-project pqdkhefxsxkyeqelqegq --reviewer nick --reviewed-head <sha> --expected-fingerprint <sha256>` only after the schema migration, complete approved Oil facts/protocols, result-surface sign-off, separate exact approval and enabled kill switch. Protocol data remains unprepared pending exact source research and result-surface review.

### Implementation checkpoint

- The exact seven-oil reversal manifest is prepared but deliberately unapproved and non-executable.
- The SQL RPC checks the immutable seven IDs, their prior reason codes/evidence and the exact `S5-21-product-search-dispositions` fingerprint, then records one batch plus seven item receipts without discarding the original reason/sources. Exact replay is read-only; any partial or drifted state aborts the transaction.
- A fresh August 31 read found all seven still lack `product_oil_specs` and exact protocols. Both TypeScript preflight and SQL now report the curated-publication blocker before deletion; the prepared reversal is intentionally not apply-ready until the recommendation-data lane is complete.
- Focused unit and PGlite tests cover approval/fingerprint/head/actual-project/kill-switch gates, publication readiness, product and disposition drift, preserved evidence, rollback, receipt counts and replay. A mutation check confirmed that the explicit everyday-shampoo test fails if that role is filtered from the apply path.
- Verified GTIN research now contains the current dmBio coconut and olive packages above. These codes are research evidence only until a fresh global owner/open-submission preflight freezes a separately reviewed identifier cohort.
- E10 is applied and verified: 12 existing products / 12 GTINs, fingerprint `e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3`, reviewed head `551b7a52b56a9f061eeafcb331084b7893b59ffe`. E11 is also applied and verified for the K18 mist: one existing product / one GTIN, fingerprint `f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec`, reviewed head `d4e96171534ab0f9db6d3d5598f916a923aebd94`. The E11 flow used `npm run products:intake:scanner-identifiers:preflight -- --manifest=data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-e11-v1.json --reviewed-head=d4e96171534ab0f9db6d3d5598f916a923aebd94`, the existing kill-switched apply command with exact project/fingerprint/reviewer pins, and the corresponding verify command with the same manifest/head. Thirteen variant/formulation candidates and all reopened-oil candidates remain outside these batches.
- Recommendation-changing protocol, authority and oil-use payloads remain behind the result-surface evidence and journey-review gate.

New-product expansion beyond these evidenced variants, brand cleanup, category redesign, publication, scanner activation and deployment remain out of scope. Applying identifier, protocol, authority and disposition cohorts remains a production-data action requiring exact-batch approval; plan approval alone is not that approval. Identifier-only work is operator/backend data work. Protocol, authority and oil-eligibility changes can alter visible scanner/Personal Plan recommendations, so they require reviewable result-surface evidence and a designed-user-journey sign-off before implementation.

## Verification

- Planning checks: live inventory/readiness unchanged; disposition reasons read directly; all eight dandruff protocol-role lists checked; direct fields for two recovered candidates and Cantu/Balea examples reopened; five inspected codes checked against global owners and all unresolved submissions. No product-data mutations in this pass.
- Before implementation: confirm branch/base; use current authoritative root behavior for runtime checks because this task's planning branch is older. No claim of fresh-main whole-branch verification.
- Tests: exact immutable pins/counts, equivalent raw/canonical variants, inactive-owner collision, second researched-code overlap, wrong snapshot, wrong fingerprint, disabled kill switch and replay. Add report-contract fixtures proving a protocol-only gap may be identity-ready but not result-ready, and a disposition never becomes scan-ready merely through an identifier.
- Hard identity-only release gate: assert the actual resolve result shape for each relevant authority-gap pattern. Required facts missing must retain the existing incomplete/unknown outcome; a legitimate known mismatch must remain a mismatch rather than forcing a made-up unknown result. Assert product identity/category and absence of fabricated complete guidance. Keep these research-only rows out of pinned executable manifests until those checks pass and the amendment is approved.
- Manual/integration: an ordinary known product resolves to the chosen owner/category; a protocol-incomplete identity-only product has exactly the existing supported result/fallback (no falsely complete result); disposed products remain quarantined; duplicate alternate categories are unchanged. If that cannot be demonstrated, hold identity-only apply and present the required runtime change as a separate decision.
- Production: fresh metadata/disposition/ownership/submission checks immediately before each exact apply; afterward verify every code, batch/item receipts, product MD5 and both barcode/result counts. Never count retired or duplicate rows as new physical coverage.

## Designed operator journey and handoff

Operator starts from the existing catalog and researches every physical package. If the formulation is the same, an additional GTIN attaches to the existing analyzed product; if the formulation differs, the operator creates a separate product and ingredient analysis. Each GTIN has one canonical owner. Anti-dandruff and oil guidance is completed only from exact sources and conservative evidence. Parked submissions block only colliding candidates. Nick confirms all six duplicate-owner recommendations, the identity-before-readiness amendment, the conservative oil framing and the guarded disposition-reversal path, then reviews the affected result-surface evidence and journey. Each frozen production cohort receives a separate final approval. Fresh preflight may stop any stale/colliding item without overriding the guard. Readback reports recognized packages and personalized-result readiness separately.

Rule-set and backend operator-journey sign-off: **confirmed August 31**. Recommendation-changing result-surface evidence and journey review are still pending for the protocol, authority and oil-use payload cohorts. Review output is advisory, read-only and terminal; no recursive reviewers. Transient reviewer output stays in `/tmp`. No commit, push, PR, merge, activation or production data write is authorized by this approval.

## Counterpart findings

Claude Opus 4.8/high completed a fresh read-only terminal review of the August 31 revision: **approve with revisions**. Codex locally confirmed its two architectural findings: the disposition RPC only inserts/upserts and Stage-5 derives only `shampoo_dandruff` for the dandruff bucket. Accepted revisions: all six owner choices return to Nick; oil reopening requires a new guarded reversal path rather than hand-written deletion; the explicit `shampoo_everyday` write path must be proven; each cohort needs concrete commands; recommendation-data cohorts receive result-surface/journey review. The identity executor, collision guards, readiness separation and all baseline counts were independently found coherent. Transient report: `/var/folders/zq/tmsmyfv96wqf0jmfz3gpdfq80000gn/T/claude-plan-review-2026-08-28-remaining-barcode-resolution-rules-86313.md`.

Implementation has added review-only schema/tooling, a prepared exact reversal manifest and focused tests. No migration, manifest, protocol or product-data cohort has been applied to production.
