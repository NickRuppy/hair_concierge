# Oil flags, protection claims and application facts — evidence and operational proposal

Date: 2026-10-01. Scope: bounded research supporting the approved property vocabulary in `docs/research/oil-inci/v1.0/01_property-set-v0.md` and OE8/OE10–OE13 in `plans/oil-inci/phase1-decision-coverage.md`. This is a proposed method, not a frozen lexicon, classification standard, product assessment, fit policy or calibration result.

## Recommended direction

Use a versioned exact-ingredient dictionary for five independent presence flags; preserve the approved heat-claim exception and UV ingredient-plus-claim gate; derive supported roles only from exact-product directions. Store repeatable, coherent application scenarios rather than independent bags of doses, sites and times. No formula-based use inference is recommended for this version.

Evidence supports distinguishing chemical identity, botanical preparation and ingredient function. It does **not** establish a universal concentration-free drying, irritation, growth, heat-protection or hair-UV-performance rule. The operational rules below are labeled as proposals where they go beyond already approved definitions.

## 1. Evidence authority and retrieval limits

The Commission explicitly describes CosIng as informative: inclusion is not approval, and the Regulation and its annexes determine restrictions. The ingredient glossary identifies label names and is not an authorization list. Use the current glossary for canonical names, CosIng for identity/function evidence, and dated Annex III/VI entries for the relevant regulatory identities and exclusions. [Commission CosIng notice](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en), [current glossary guidance](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database/cosing-glossary-ingredients_en).

The official glossary is now Decision 2025/1175. This pass accessed indexed official glossary/annex rows, Commission explanatory pages and SCCS PDFs. Several full EUR-Lex pages returned a browser-verification challenge, including the English consolidated 18 May 2026 text. Therefore candidate identity rows below are useful evidence, but this pass does **not** certify exhaustive current Annex III/VI extraction or all active CosIng records. A narrow seed lexicon can support an early cohort when every encountered relevant ingredient/form is resolved and its coverage limits are declared. Exhaustive annex extraction can follow before general automated coverage. Archive each admitted source row; do not quietly fill gaps from retailer ingredient dictionaries.

Archived Commission inventories are used below only for stable substance/form distinctions and historical identity/function evidence, never current legal permission. The distinction matters: a recently amended filter entry or botanical name can differ from its historical inventory row.

## 2. Matching and completeness contract

**Approved:** completed records contain all five booleans; true names the exact INCI match, false means no recognized match in the reviewed complete INCI. Missing exact identity, conflicting formula versions, truncated INCI or an unresolved ingredient token blocks a completed record. It must not create five false values.

**Proposed operational sequence:**

1. Freeze market, variant, package, captured date, full raw INCI and source image/text. Keep raw order and exact spelling.
2. Normalize case, Unicode and redundant whitespace. Use an explicit alias map for bilingual label wrappers; preserve chemically meaningful numbers, PEG/PPG qualifiers, slash compounds, plant parts, `OIL` versus `EXTRACT`/`WATER`, and `(nano)`.
3. Match whole canonical ingredients, not substrings or marketing text. CAS/EC identifiers support dictionary authoring; they do not override a contradictory preparation name. Botanical CAS identifiers can cover several preparations.
4. Each dictionary row retains canonical name, accepted exact aliases, flag memberships, form exclusions, identity source/entry, source date, revision and reviewer decision. Multiple flags can share a match.
5. Send novel or ambiguous relevant tokens to identity review. Freeze additions before applying them consistently across the research set; do not improvise per-product aliases during scoring.
6. Emit every boolean, matched raw token/rank and canonical identity. No match after complete review is false. Missing source review is incompleteness metadata, never a new property value.

Reject free substring rules such as `alcohol`, `sil`, `mint`, `rosemary`, `camphor` or `benzophenone`. They conflate fatty alcohols, silicas, extracts, derivatives and distinct UV absorbers.

## 3. Candidate ingredient lexicon

These are seed rows and boundary cases, not an exhaustive release dictionary. Ingredient names here identify presence; stated functions describe the ingredient class, not measured finished-product performance.

| Flag | Candidate exact names / explicitly bounded aliases | Identity/function evidence | Exclusions and operational boundary |
| --- | --- | --- | --- |
| `silicones` | `DIMETHICONE`; exact label alias `DIMETICONE` only after nomenclature review | Silicone polymer; historical inventory CAS 9006-65-9 / 63148-62-9; current SCCS explains why a polymer must not be conflated with discrete octamethyltrisiloxane. [2006 inventory](https://eur-lex.europa.eu/eli/dec/2006/257/oj/eng), [SCCS/1667/24, pp. 9–10](https://health.ec.europa.eu/document/download/db310eb8-f2ee-47a6-b47a-df52c692f97c_en?filename=sccs_o_289.pdf) | Do not infer nonvolatile fraction, deposition, removal, weight or build-up from the flag. Avoid CAS-only aliasing. |
| `silicones` | `CYCLOPENTASILOXANE` (D5), `CYCLOTETRASILOXANE` (D4) | Historical identity CAS 541-02-6 and 556-67-2; cyclic siloxanes with solvent/conditioning roles. [Commission inventory, p. 97](https://ec.europa.eu/health/archive/ph_risk/committees/sccp/documents/out123cm_en.pdf) | Still silicone presence, regardless of volatility. Historical naming evidence is not current use authorization. |
| `silicones` | `CAPRYLYL TRIMETHICONE`; individually reviewed dimethicone derivatives/copolymers; `POLYSILICONE-15` | Caprylyl Trimethicone is glossary entry 5411; Polysilicone-15 is a named UV-filter silicone, Annex VI/26. [2025 glossary](https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=OJ%3AL_202501175), [Annex VI identity rows](https://eur-lex.europa.eu/legal-content/DE/TXT/PDF/?from=EN&qid=1568704379668&uri=CELEX%3A32009R1223) | Expand derivatives by exact reviewed rows, not a suffix regex. `SILICA`, `HYDRATED SILICA`, `SILICA DIMETHYL SILYLATE` and `SILICON` must not become silicone-polymer matches merely by spelling. Surface-treated silica needs its own class decision. |
| `mineral_oil` | `PARAFFINUM LIQUIDUM`; `MINERAL OIL` as an explicitly mapped market-label alias | Liquid petroleum hydrocarbons; CAS 8012-95-1 / 8042-47-5 in the JRC identity table. [JRC cosmetics report](https://publications.jrc.ec.europa.eu/repository/bitstream/JRC126061/jrc126061_pr_cosmetics_final.pdf) | Recommend a narrow liquid-mineral-oil flag. `PETROLATUM`, `PARAFFIN`, `CERA MICROCRISTALLINA`, isoparaffins and hydrogenated polyisobutene are distinct identities; broader petroleum-derived coverage would need an explicit scope decision. Do not infer feedstock from `SQUALANE` or `C13-15 ALKANE`. |
| `drying_alcohol` | `ALCOHOL`; `ALCOHOL DENAT.`; exact SD Alcohol aliases (including SD Alcohol 23-A, 40, 40-B); `ISOPROPYL ALCOHOL` | Ethanol/denatured ethanol and isopropanol recognition; FDA explains the label aliases and the distinction from fatty alcohols. Current glossary entries 1290–1316 enumerate alcohol/denatured forms. [FDA alcohol labeling](https://www.fda.gov/cosmetics/cosmetics-labeling-claims/alcohol-free), [2025 glossary rows](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?qid=1788463242542&uri=OJ%3AL_202501175) | Proposed minimal solvent-alcohol list, not proof that the product dries hair. Exclude `CETYL ALCOHOL`, `STEARYL ALCOHOL`, `CETEARYL ALCOHOL`, `BEHENYL ALCOHOL`; no generic alcohol substring. Also do not treat `BENZYL ALCOHOL`, phenoxyethanol, glycerin or glycols as this flag. Review other short-chain alcohols individually before expansion. |
| `fragrance` | `PARFUM`, `AROMA`; reviewed label aliases `FRAGRANCE` / `PERFUME`; exact individually declared fragrance-allergen names, including `BENZYL ALCOHOL`, `LIMONENE`, `LINALOOL`, `MENTHOL`, `CAMPHOR` | Expand toward the current Annex III fragrance-label identity table and explicit group labels; do not claim exhaustive coverage from the old “26 allergens” shorthand. [Commission allergen guidance](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-products-specific-topics/fragrance-allergens-labelling_en), [2023/1545](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32023R1545) | This is recognized fragrance/allergen **presence**, not proof of intentional perfuming. Non-fragrance roles do not erase the match; record that caveat. No “free from” or tolerance conclusion from false. |

**Fragrance caveat:** SCCS specifically describes benzyl alcohol exposure from preservative use, including fragrance-free-labeled products. Therefore `BENZYL ALCOHOL` may set `fragrance=true` under the approved broad presence definition while `drying_alcohol=false`; the note must explain that formulation intent is unestablished. Do not translate the boolean to “parfümiert” without qualification. [SCCS/1459/11, pp. 153–154](https://health.ec.europa.eu/document/download/392a791e-d831-4bb0-a449-7031bffcd6a4_en).

The expanded EU fragrance-label rules have transitional packaging in circulation through 2028. A complete label still does not disclose every trace constituent. The dictionary must recognize expanded names now, but false remains “no recognized declared match,” not analytically zero fragrance/allergen. [Commission transition guidance](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-products-specific-topics/fragrance-allergens-labelling_en).

### Botanical watch-out seed rows

Use `scalp_active_botanicals` only as the agreed exposure/watch-out grouping. Presence does not establish scalp directions, hair growth, antimicrobial efficacy, sensitization of the user or any tolerance verdict. The field includes isolated menthol/camphor regardless of natural or synthetic origin; do not infer botanical sourcing from its historical name.

| Exact candidate identity | Exact-form evidence / ID | Match boundary |
| --- | --- | --- |
| `MENTHOL` | Annex III/338; CAS 89-78-1, 1490-04-6, 2216-51-5, 15356-60-2 covers listed stereochemical forms. [2023/1545](https://eur-lex.europa.eu/legal-content/EN/TXT/?qid=1710167825337&uri=CELEX%3A32023R1545) | No automatic `MENTHYL LACTATE` or other cooling-agent expansion. |
| `CAMPHOR` | Annex III/331; CAS 76-22-2, 21368-68-3, 464-49-3, 464-48-2. [2023/1545](https://eur-lex.europa.eu/eli/reg/2023/1545/oj/ces) | `CAMPHOR BENZALKONIUM METHOSULFATE` and other camphor derivatives are separate identities; not matches. |
| `MENTHA PIPERITA OIL` / reviewed parenthetical `MENTHA PIPERITA (PEPPERMINT) OIL` | Annex III/361; CAS 8006-90-4 / 84082-70-2. Current glossary entry 16219. [Annex rows](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1545), [2025 glossary](https://eur-lex.europa.eu/legal-content/LT/TXT/PDF/?uri=OJ%3AL_202501175) | Leaf extracts/waters are separate entries, not aliases for oil. |
| `MENTHA VIRIDIS LEAF OIL`; separately reviewed `MENTHA SPICATA` oil forms | Annex III/362; CAS 8008-79-5 / 84696-51-5. Current glossary entries 16226, 16228, 16236 distinguish oil forms. [Annex rows](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1545), [glossary](https://eur-lex.europa.eu/legal-content/LT/TXT/PDF/?uri=OJ%3AL_202501175) | Preserve oil versus extract; do not alias every mint species. `MENTHA ARVENSIS OIL` is a separate expansion candidate requiring frozen exact identity review. |
| `EUCALYPTUS GLOBULUS LEAF OIL`, `EUCALYPTUS GLOBULUS LEAF/TWIG OIL`, declared group name `EUCALYPTUS GLOBULUS OIL` | Annex III/355; CAS 97926-40-4 / 8000-48-4. [2023/1545 group-name row](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32023R1545) | Group name is a documented label form, not license to include all Eucalyptus extracts/species. |
| `ROSMARINUS OFFICINALIS OIL`; current leaf-oil spelling to verify before dictionary freeze | Historical Commission inventory distinguishes volatile oil CAS 8000-25-7 from extract CAS 84604-14-8. [Inventory, pp. 353–354](https://ec.europa.eu/health/archive/ph_risk/committees/sccp/documents/out123cm_en.pdf) | `ROSMARINUS OFFICINALIS LEAF EXTRACT`, leaf powder and rosmarinic acid do not establish essential oil. Modern `SALVIA ROSMARINUS` or parenthetical label aliases need exact official identity mapping; do not auto-add taxonomic synonyms without preparation matching. |
| `MELALEUCA ALTERNIFOLIA LEAF OIL`; separately reviewed flower/leaf/stem-oil form | SCCS/1681/25 identifies tea-tree oil CAS 68647-73-4 / EC 285-377-1; glossary entry 16113 distinguishes flower/leaf/stem oil. [SCCS final opinion](https://health.ec.europa.eu/publications/sccs-scientific-opinion-tea-tree-oil-casec-no-68647-73-4-285-377-1_en), [glossary](https://eur-lex.europa.eu/legal-content/LT/TXT/PDF/?uri=OJ%3AL_202501175) | Not leaf extract, hydrosol or any ingredient containing `MELALEUCA`. Parenthetical `(TEA TREE)` label alias requires preservation of the same leaf-oil identity. |

SCCS evidence supports exposure awareness for fragrant oils; it does not validate the above field as a clinical risk score. The 2025 tea-tree opinion concerns specific defended products and conditions; it cannot be repurposed as a blanket safety approval for leave-on scalp oils. No growth conclusion is drawn. [SCCS tea-tree opinion](https://health.ec.europa.eu/publications/sccs-scientific-opinion-tea-tree-oil-casec-no-68647-73-4-285-377-1_en).

## 4. Heat and UV claims

**Already approved:** heat is true for an accepted explicit manufacturer/pack claim about the exact product. No ingredient requirement, finished-product test-publication requirement, temperature output or ingredient-based claim cap is added. UV is true only for recognized exact UV-filter INCI **and** an accepted explicit manufacturer hair-UV-protection claim. Both remain booleans.

**Proposed source admissibility:** accept exact package wording, the manufacturer's exact market/variant product page or official instructions/technical sheet tied to that identity. Capture the sentence, neighboring qualifier, URL, date and exact product identity. A retailer's own prose, category tags, search snippets, influencer report, generic brand ingredient article or another SKU cannot establish the claim. A retailer-hosted legible photo of the exact manufacturer's pack may establish pack wording when package identity/version is verified: image host and claim author are separate facts. Conflicting pack/site versions require identity/claim reconciliation; do not select the most favorable claim. Record accepted directions/claim conditions without spreading them to other scenarios.

EU claim criteria distinguish ingredient properties from finished-product properties and require substantiation for extrapolation. This supports cautious attribution, but the manufacturer's claim remains claim evidence, not an independent efficacy trial. [Regulation 655/2013, Annex 2–4](https://eur-lex.europa.eu/legal-content/en/ALL/?uri=CELEX%3A32013R0655).

| Complete reviewed evidence | Accepted heat claim | Recognized UV-filter match | Accepted hair UV claim | Heat | UV |
| --- | --- | --- | --- | --- | --- |
| Yes | Yes | No | No | true | false |
| Yes | No | No | Yes | false | false |
| Yes | No | Yes | No | false | false |
| Yes | No | Yes | Yes | false | true |
| Yes | Yes | Yes | Yes | true | true |
| Missing exact formula/identity | Any | Unresolved | Any | Record incomplete; do not finalize | Record incomplete; do not finalize |

For UV this covers all four filter/claim combinations; neither present is false. A reviewed claim search with no admissible positive claim yields false and a reason. An unperformed claim review cannot masquerade as completed absence. False says the positive-evidence gate was unmet, not that experiments demonstrated zero protection.

### Candidate UV recognition rows and exclusions

Recommend a frozen Annex VI based identity list, retaining exact entry/form and effective-date evidence. This is a deliberately conservative **operational recognition convention**. Annex VI is not a list of clinically proven hair-fibre protection ingredients; authorization/function and hair efficacy are different questions.

| Exact INCI | Identity anchor | Status for proposed dictionary |
| --- | --- | --- |
| `ETHYLHEXYL METHOXYCINNAMATE` | Annex VI/12; CAS 5466-77-3 | Candidate; preserve distinction from arbitrary methoxycinnamates. [Official identity row](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32009R1223) |
| `BUTYL METHOXYDIBENZOYLMETHANE` | Annex VI/8; CAS 70356-09-1 | Candidate; Avobenzone is a documented chemical synonym, not a substitute for verified label identity. [Official identity row](https://eur-lex.europa.eu/legal-content/EN/TXT/?initialSessionID=258-5812774-7402627&ld=ASXXSCTITDirect&uri=CELEX%3A32009R1223) |
| `BENZOPHENONE-4`, `BENZOPHENONE-5` | Annex VI/22; CAS 4065-45-6 / 6628-37-1 | Separate exact acid/salt rows; not the entire Benzophenone family. [Official identity rows](https://eur-lex.europa.eu/legal-content/DE/TXT/PDF/?from=EN&qid=1568704379668&uri=CELEX%3A32009R1223) |
| `POLYSILICONE-15` | Annex VI/26; CAS 207574-74-1 | Candidate; independent silicone presence also true. [Official identity row](https://eur-lex.europa.eu/legal-content/DE/TXT/PDF/?from=EN&qid=1568704379668&uri=CELEX%3A32009R1223) |
| `DIETHYLAMINO HYDROXYBENZOYL HEXYL BENZOATE` | Annex VI/28; CAS 302776-68-7 | Current amending act confirms the identity and adds impurity provisions with transition dates; keep revision/effective-date metadata. [2026/909](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32026R0909) |

The first five identity rows above are validated as exact historical Annex VI filter identities; the last row also has a checked 2026 amending act. They are usable seed function-recognition evidence, **not** assertions that every historical legal-use condition remains current. Extend to other exact filters after identity/function verification. This limited list cannot alone establish an automatic filter-negative result for an arbitrary INCI; review any potentially relevant unmatched token before completing that result.

Form exclusions and edge cases for the operational standard:

- An arbitrary `BENZOPHENONE-*`, UV-absorber function, formula photostabilizer, antioxidant, plant oil, tocopherol or color-protective polymer is not automatically an accepted filter. CosIng's function label alone does not replace the frozen recognition row.
- Keep `(nano)` separate. A non-nano entry cannot authorize its nano form by normalization. Pigment/CI shorthand needs verified identity/form mapping; `CI 77891` alone does not settle filter form or product function.
- Homosalate illustrates the distinction between recognition and permission: Annex VI/3 identifies a UV filter while the amended use conditions concern face products. It remains a recognized filter; do not turn it into a non-filter or change the approved UV AND rule because of a use restriction. Legal-use observations may be retained separately as source caveats, without adding a compliance gate to this research engine. [2022/2195, Annex VI/3](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32022R2195).
- Concentrations, coating, particle distribution, impurities and some permitted-use conditions are not recoverable from INCI. Preserve those limits; this engine cannot certify regulatory compliance. Do not invent a numerical claim ceiling from label rank.

### Hypothetical wording tests (not assessed products)

| Manufacturer text | Decision |
| --- | --- |
| “Schützt das Haar vor Hitzeschäden beim Styling.” | Accepted heat claim; true without adding an ingredient AND. |
| “Vor dem Föhnen anwenden.” | Use-stage evidence only; heat false without explicit protection claim. |
| “Schützt das Haar vor UV-Strahlen.” | Accepted UV claim; UV true only with recognized filter match. |
| “Mit UV-Filter.” | Ingredient/formula statement alone; no explicit hair-protection claim. |
| “Schützt die Haarfarbe vor UV-bedingtem Verblassen.” | Recommend acceptance as explicit hair UV-protection claim, with scope retained as color fading. Do not broaden to scalp or full-spectrum protection. Parent to settle this wording convention. |
| “Farbschutz”, “Sunshine Oil”, “antioxidativer Schutz”, “schützt vor Umwelteinflüssen” | Insufficient for hair UV claim. |
| “UV-Schutz für die Formel” or “schützt die Verpackung vor Licht” | Product stability/packaging, not hair protection. |
| “Mit unserem UV-Spray schützt die Routine das Haar …” | No standalone oil claim; do not borrow another product's protection. |

## 5. Supported-use decision tree

**Proposal:** formula inference is inadmissible for role emission. A carrier oil can plausibly be used several ways, but INCI does not establish intended site, amount, contact time or rinsing. Allowing inference would quietly invent directions and create scalp/overnight permissions. Record hypotheses outside assessed roles if research requires them. This favors reproducibility at the cost of leaving some commercially underspecified products with no established use.

For each coherent exact-product instruction:

1. Does it explicitly authorize scalp contact? If yes, emit `scalp_application` with that scenario's rinse/timing restrictions. Do not automatically emit a fibre role.
2. Does it explicitly authorize hair-fibre/lengths/ends application **before a subsequent shampoo/wash**? If yes, emit `pre_wash_fibre_treatment`. Dry starting hair alone does not mean dry finish.
3. Does it authorize leave-on fibre conditioning/application in a leave-in context? If yes, emit `leave_on_fibre_conditioning`. A vague hair-application sentence without a rinse/leave-in context remains unresolved.
4. Does it authorize application to dry, styled hair/as a finishing or touch-up step, retained on the fibre? If yes, emit `dry_finish`. Recommend also emitting `leave_on_fibre_conditioning` only when a conditioning purpose is explicit; do not double-label every finish by ontology inference.
5. When a sentence establishes several sites or stages, preserve the exact alternatives and conditions. If scope is ambiguous, leave the ambiguous fact unestablished; do not distribute a dose or permission across all alternatives.

Role labels are a unique set derived from scenario rows; scenarios may repeat a role. Empty roles require completed direction review finding no established role. An inaccessible/unreviewed direction packet is incomplete. Scalp-only remains a valid research-side result and cannot be coerced into existing production fibre-role requirements.

### Coherent scenario record

Proposed fields: scenario ID, supported role, exact source excerpt/reference, market/variant/package, site, hair stage, published amount and actual unit, contact time, leave-on/rinse/shampoo context, frequency when explicitly supplied, overnight permission when explicit, mixing/shaking instruction, restrictions and unresolved facts. Retain supplied ranges/qualifiers. Missing dose is “not stated,” never a generic number of drops; no drops-to-pumps/mL conversion, no “overnight safe” default and no formula-derived contact time. A role can be established while nonessential dose/timing details are absent; don't invent facts to make it look complete.

| Hypothetical instruction | Coherent result |
| --- | --- |
| “Vor der Haarwäsche in die Längen geben, 20 Minuten einwirken lassen, auswaschen.” | Pre-wash fibre; lengths; 20 minutes; wash required. Amount/hair wetness unestablished. |
| “3 Tropfen auf die Kopfhaut geben und nach 10 Minuten shampoonieren.” | Scalp only; 3 drops; 10 minutes; shampoo required. No fibre treatment or overnight permission. |
| “Abends 2 Tropfen in die Spitzen geben und über Nacht einwirken lassen.” | Overnight ends scenario; do not infer its next-morning wash requirement. Resolve leave-on/pre-wash role from surrounding explicit directions, not the word overnight alone. |
| “Nach dem Styling eine kleine Menge in den trockenen Spitzen verteilen.” | Dry finish; dry ends; qualitative quantity exactly as stated. No invented numerical dose. |
| “Auf feuchtem oder trockenem Haar anwenden; nicht ausspülen.” | Leave-on fibre context; stages damp/dry. No automatic finishing/touch-up claim unless that stage is explicit. |
| Separate scalp wash-out and ends overnight paragraphs | Two source-bound scenarios; never scalp overnight by cross-product of fields. |

## 6. Acceptance cases before operational freeze

These are specified future tests, **not executed tests or calibration labels**:

1. Complete inert/nonmatching INCI → all five keys present and false; incomplete INCI → record blocked, not five false.
2. Cetyl/Cetearyl Alcohol → drying false; Alcohol Denat./recognized SD alias → true; Benzyl Alcohol → fragrance true with intent caveat, drying false.
3. Exact rosemary oil → botanical true; rosemary extract/rosmarinic acid → no rosemary-essential-oil match; unresolved oil alias → identity review.
4. Menthol/approved mint or eucalyptus oil → botanical and applicable fragrance flags independently; synthetic menthol does not lose the match.
5. Camphor derivative does not match Camphor; silica does not match silicone; whole reviewed silicone polymer does.
6. Every UV filter/claim combination; heat with accepted claim but no ingredient “protector”; ingredient-only UV false; incomplete formula blocked independently.
7. Retailer prose rejected; verified manufacturer-pack photo retained with host/author provenance; conflicting exact variants blocked from evidence mixing.
8. Generic color/antioxidant/sun prose rejected; explicit UV-related color-fading wording evaluated under the settled convention.
9. Scalp-only pre-wash instruction produces no fibre role; dry pre-wash produces no dry finish; overnight site/time cannot transfer between scenarios.
10. Two scenario rows with one role remain two rows; supported-role set contains one unique role. Missing doses remain missing and package sizes do not share inferred pump/drop volume.

## 7. Decisions and remaining work for the parent

- Recommend **exact directions only**, no formula-derived supported uses. This settles an open consequential choice and needs parent/user acceptance through the owning workflow.
- Recommend narrow liquid-mineral-oil semantics; broaden to petrolatum/waxes only by explicit decision. The approved name alone does not settle that boundary.
- Preserve the already approved fragrance/allergen presence meaning; include the non-fragrance-function caveat. No new fragrance-intent dimension or renewed vocabulary approval is needed.
- Settle dry-finish/leave-on overlap and explicit UV-related hair-color-fading wording before labels are frozen.
- Freeze a seed dictionary covering the encountered early-cohort ingredients and exact forms. Validate unresolved encountered aliases before assessment; comprehensive fragrance/UV/silicone coverage may follow later. The seed tables are not sufficient for arbitrary-product automatic absence checks. Obtain missing exact official identity rows where modern spelling/form could not be retrieved here.
- Keep regulatory-use conditions as provenance caveats, not additional filter-recognition criteria. This method neither certifies legal concentration/product approval nor changes recognized filters into non-filters.
- No need to reopen the approved five booleans, remove botanicals, add toning, introduce SPF or require a heat ingredient AND. No product fit, eligibility, calibration, code, database or production changes are proposed here.

Verification performed: checked the current approved property/decision documents; checked the assigned worktree/branch and preserved concurrent research; inspected official primary sources and tested the proposed logic against the written edge-case matrix. No executable tests or product classifications were run. Only this research file was written.

### Seed validation status receipt

- Exact identity/name directly checked in a contemporary official row: Caprylyl Trimethicone; Alcohol/Alcohol Denat. and listed SD variants; Menthol; Camphor; Mentha Piperita Oil; Mentha Viridis Leaf Oil; the listed Eucalyptus Globulus oil/group names; Diethylamino Hydroxybenzoyl Hexyl Benzoate. These checks establish identity, not whole-product effect.
- Exact identity/function checked in historical official inventory/Annex: Dimethicone; Cyclopentasiloxane; Cyclotetrasiloxane; Paraffinum Liquidum; Rosmarinus Officinalis Oil; Ethylhexyl Methoxycinnamate; Butyl Methoxydibenzoylmethane; Benzophenone-4/-5; Polysilicone-15. Historical dates remain visible in the cited rows; contemporary Dimethicone/SCCS and Paraffinum/JRC evidence provide additional identity support.
- Official contemporary narrative directly supports class/label mapping: ethanol/Alcohol, Alcohol Denat., named SD forms and fatty-alcohol exclusion (FDA); Parfum/Aroma and fragrance-allergen interpretation (Commission/SCCS); Melaleuca Alternifolia Leaf Oil / Melaleuca Alternifolia (Tea Tree) Leaf Oil (Commission mandate and SCCS report). [Commission tea-tree INCI mandate](https://health.ec.europa.eu/document/download/dd87b843-6d35-4c6c-b49b-3d82d4a98a4f_en?filename=sccs2022_q_030.pdf), [SCCS exact INCI wording](https://health.ec.europa.eu/document/download/827f8a57-c6f2-4d6d-9bbd-2ef12384ffbf_en?filename=sccs_o_303.pdf).
- Candidate aliases/forms **not yet admitted solely by this note**: modern rosemary leaf-oil/Salvia Rosmarinus variants; all unenumerated silicone derivatives; unrestricted SD wildcards; botanical species/preparation generalizations; extra short-chain alcohols; nano/non-nano equivalences; retailer spelling corrections. Resolve when encountered; never silently classify an unresolved form as absent.

