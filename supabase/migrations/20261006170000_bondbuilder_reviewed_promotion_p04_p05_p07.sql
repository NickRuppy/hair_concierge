-- Finite reviewed P04/P05/P06/P07 publication. Generated from frozen reviewed
-- artifacts by scripts/product-intake/bondbuilder/generate-reviewed-promotion-sql.mjs.
-- No reusable apply API or trigger bypass. Full readbacks include timestamps,
-- commerce, images, identity and legacy selectors; any drift requires new review.
BEGIN;
DO $promotion$
#variable_conflict use_variable
DECLARE
  item jsonb;
  artifact jsonb;
  preimage jsonb;
  postimage jsonb;
  saved_postimage jsonb;
  evidence_values jsonb;
  evidence_item record;
  product_id uuid;
  research_key text;
  post_hash text;
  prior public.catalog_enrichment_applied_items%ROWTYPE;
  batch constant text := 'bondbuilder-reviewed-promotion-2026-10-06';
BEGIN
  -- Fresh databases have no historical targets. Skip before policy/preimage guards.
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id IN (
    'e5fd7ff9-f7d7-44d5-a600-f44bdec939a8', '9e5da870-1ab8-40f3-a74c-7088cbb31b2f',
    '04a83f16-e610-4883-b44d-038d3a343787', '2c809d0d-fbce-435a-bbde-aa4270aaf48d')) THEN RETURN; END IF;

  -- Same dependency order as catalogue activation. Table locks additionally
  -- cover absent child rows, so concurrent inserts cannot escape the readback CAS.
  LOCK TABLE public.products, public.product_bondbuilder_specs,
    public.product_image_assets, public.product_identifiers,
    public.product_application_protocols, public.personal_plan_catalog_fact_evidence,
    public.catalog_enrichment_applied_items IN SHARE ROW EXCLUSIVE MODE;

  FOR item IN SELECT value FROM jsonb_array_elements($reviewed$
[
  {
    "artifact": {
      "researchKey": "P04",
      "productId": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
      "profile": {
        "fit": {
          "fine": {
            "value": null,
            "rationale": "P04: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "coarse": {
            "value": null,
            "rationale": "P04: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "normal": {
            "value": null,
            "rationale": "P04: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          }
        },
        "holds": {
          "fit": [
            {
              "code": "diameter_fit_unknown",
              "field": "fit",
              "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
              "source_ids": []
            }
          ],
          "boundary": [],
          "identity": [],
          "protocol": [],
          "claim_trust": []
        },
        "method": {
          "method_id": "bondbuilder-inci",
          "output_sha256": "7caa77e38bfbdd26dcce4592a1c2df35aaf331a438d72a0b81374b501979a87e",
          "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
          "run_reference": "replay-2026-10-03-v0.5-r3",
          "method_version": "bondbuilder-inci-v0.5",
          "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
          "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
          "artifact_reference": "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/P04.json",
          "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
          "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
        },
        "review": {
          "checked_date": "2026-10-06",
          "reviewed_date": "2026-10-06",
          "profile_sha256": "7caa77e38bfbdd26dcce4592a1c2df35aaf331a438d72a0b81374b501979a87e",
          "decision_references": [
            "recommendation-promotion-2026-10-06:reviewed-protocol-overlay"
          ]
        },
        "formula": {
          "status": "complete",
          "markers": [
            {
              "family": "acid_calcium_management",
              "literal": "citric acid",
              "source_ids": [
                "R01"
              ]
            },
            {
              "family": "acid_calcium_management",
              "literal": "arginine",
              "source_ids": [
                "R01"
              ]
            },
            {
              "family": "acid_calcium_management",
              "literal": "betaine",
              "source_ids": [
                "R01"
              ]
            }
          ],
          "raw_inci": "AQUA / WATER • CETEARYL ALCOHOL • CITRIC ACID • BEHENTRIMONIUM CHLORIDE • ARGININE • CETYL ESTERS • BETAINE • GLYCERIN • HYDROXYPROPYL GUAR • HYDROXYCITRONELLAL • PHENOXYETHANOL • STEARETH-100 • PEG-150/DECYL ALCOHOL/SMDI COPOLYMER • PPG-1 TRIDECETH-6 • AMINOPROPYL DIMETHICONE • POLYQUATERNIUM-37 • CHLORHEXIDINE DIGLUCONATE • LIMONENE • LINALOOL • PINENE • ISOPROPYL ALCOHOL • ISODODECANE • PROPYLENE GLYCOL • PROPYLENE GLYCOL DICAPRYLATE/DICAPRATE • CARVONE • GERANYL ACETATE • ACRYLATES/STEARYL METHACRYLATE COPOLYMER • SORBITAN OLEATE • BIS(C13-15 ALKOXY) PG-AMODIMETHICONE • BUTYROSPERMUM PARKII BUTTER / SHEA BUTTER • POTASSIUM HYDROXIDE • TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES • CITRUS LIMON PEEL OIL • EDTA • HEXYL CINNAMAL • PARFUM / FRAGRANCE",
          "conflicts": [],
          "raw_sha256": "482b3e1c0a5317613e0202b8156fdc00058e90d1366c83232fd3c286fc341c36",
          "source_ids": [
            "R01"
          ],
          "normalized_sha256": "e5e9b5e7c3d8882f12622bda11a67ace0ef1aeb37b9660bf881231966815ae00",
          "candidate_families": [
            "acid_calcium_management"
          ],
          "normalization_version": "bondbuilder-inci-normalization-v1",
          "normalized_ingredients": [
            "aqua / water",
            "cetearyl alcohol",
            "citric acid",
            "behentrimonium chloride",
            "arginine",
            "cetyl esters",
            "betaine",
            "glycerin",
            "hydroxypropyl guar",
            "hydroxycitronellal",
            "phenoxyethanol",
            "steareth-100",
            "peg-150/decyl alcohol/smdi copolymer",
            "ppg-1 trideceth-6",
            "aminopropyl dimethicone",
            "polyquaternium-37",
            "chlorhexidine digluconate",
            "limonene",
            "linalool",
            "pinene",
            "isopropyl alcohol",
            "isododecane",
            "propylene glycol",
            "propylene glycol dicaprylate/dicaprate",
            "carvone",
            "geranyl acetate",
            "acrylates/stearyl methacrylate copolymer",
            "sorbitan oleate",
            "bis(c13-15 alkoxy) pg-amodimethicone",
            "butyrospermum parkii butter / shea butter",
            "potassium hydroxide",
            "tetramethyl acetyloctahydronaphthalenes",
            "citrus limon peel oil",
            "edta",
            "hexyl cinnamal",
            "parfum / fragrance"
          ],
          "candidate_to_final_trace": [
            "Stage A candidates: acid_calcium_management.",
            "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
            "Final boundary: in_scope; family: acid_calcium_management; tier/basis: medium/owner_calibration."
          ]
        },
        "sources": [
          {
            "id": "E01",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
            "limitations": [
              "citric-acid technology",
              "publisher abstract and affiliations; full methods not audited",
              "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
            ],
            "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
            "checked_date": "2026-09-30",
            "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
          },
          {
            "id": "E02",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
            "limitations": [
              "gluconamide/gluconate model chemistry",
              "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
              "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
            ],
            "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
            "checked_date": "2026-09-30",
            "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
          },
          {
            "id": "E03",
            "url": "https://cris.unibo.it/handle/11585/796978",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
            "limitations": [
              "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
              "author-repository abstract inspected; full manuscript not audited",
              "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
            ],
            "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
          },
          {
            "id": "E04",
            "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University of Minho; funding/COI not independently audited here.",
            "limitations": [
              "generic keratin-peptide binding",
              "indexed publisher/PubMed abstract inspected; direct publisher 403",
              "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
            ],
            "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
            "checked_date": "2026-09-30",
            "commercial_context": "University of Minho; funding/COI not independently audited here."
          },
          {
            "id": "P01:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "P02:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "E06",
            "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
            "type": "supplier_primary_technical_poster",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland supplier-owned material; not independent retail testing.",
            "limitations": [
              "supplier paired-marker technology, not OGX/Aveda bottles",
              "indexed primary poster text; direct PDF timeout, graphs not inspected",
              "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
            ],
            "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
            "checked_date": "2026-09-30",
            "commercial_context": "Ashland supplier-owned material; not independent retail testing."
          },
          {
            "id": "E07",
            "url": "https://patents.google.com/patent/US11491092B2/en",
            "type": "inventor_patent",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "patent",
            "affiliation": "Inventor/patent-holder evidence, not independent validation.",
            "limitations": [
              "bis(2-ethylhexyl) maleate technology examples",
              "description/examples inspected",
              "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
            ],
            "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
            "checked_date": "2026-09-30",
            "commercial_context": "Inventor/patent-holder evidence, not independent validation."
          },
          {
            "id": "R01",
            "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R02",
            "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R03",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "UK manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R04",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R05",
            "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R06",
            "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R07",
            "url": "https://epres.com/products/bond-repair-treatment",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R08",
            "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R09",
            "url": "https://www.douglas.de/de/p/5011495045",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R10",
            "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "45ml treatment-style INCI, not a 250ml verification.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R11",
            "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R12",
            "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R13",
            "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R14",
            "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
            "type": "DE-language retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R15",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
            "type": "DE manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N01",
            "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase target 250ml; local retailer source version",
              "full ingredient and application text inspected",
              "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
            ],
            "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N02",
            "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase 250ml corroboration",
              "full ingredient and protocol text inspected by source researcher",
              "Retailer corroboration is not a clinical test or supplied-pack verification."
            ],
            "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N03",
            "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
              "researcher full listing; root indexed full ingredient text; root direct open failed",
              "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
            ],
            "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N04",
            "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
            "type": "same_identifier_EU_retailer_corroboration",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml EAN3574661818474, Norway; not a DE pack",
              "researcher full listing and ingredient text",
              "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
            ],
            "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N05",
            "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
            "type": "manufacturer_protocol",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "epres intended spray bottle/refill system",
              "full official description, FAQs and ingredient text inspected",
              "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
            ],
            "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "P01:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "P02:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "N07",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary_abstract_amendment",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
            "limitations": [
              "citric-acid technology, not any named retail treatment",
              "publisher abstract inspected; full text inaccessible",
              "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
            ],
            "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
            "checked_date": "2026-09-30",
            "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
          },
          {
            "id": "N08",
            "url": "https://linktr.ee/abbeyyung",
            "type": "creator_own_source",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "AbbeyYung promotional context",
              "own page inspected",
              "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
            ],
            "observation": "Own page lists an epres discount code and links to own channels.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N09",
            "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Abbey bond-repair routine includes epres/K18",
              "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
              "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
            ],
            "observation": "Creator/title/routine inclusion leads identified.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N10",
            "url": "https://olaplex.de/pages/hair-care-ambassadors",
            "type": "brand_relationship_disclosure",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
              "official text inspected",
              "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
            ],
            "observation": "Both named as ambassadors.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N11",
            "url": "https://olaplex.de/pages/dejangarz",
            "type": "brand_hosted_creator_endorsement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "No3PLUS in Dejan's favourites",
              "official text inspected",
              "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
            ],
            "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N12",
            "url": "https://whimsysoul.com/epres-bond-repair-review/",
            "type": "original_first_person_longer_use_review",
            "scope": "practice",
            "access": "full_text",
            "author": "Kara",
            "authority": "creator",
            "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
            "limitations": [
              "Kara's epres starter-kit hair experience; article dated2026-04-12",
              "original article text inspected",
              "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
            ],
            "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
          },
          {
            "id": "F01",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "product description, directions and INCI inspected 2026-10-01",
              "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
            ],
            "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "F02",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "product description, directions and INCI inspected 2026-10-01",
              "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
            ],
            "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-REDKEN-AU",
            "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "AU product directions, not DE pack",
              "product directions inspected 2026-10-01",
              "Cross-market complement; no concentration equality or binding DE cadence."
            ],
            "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-DE",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE manufacturer complement with format/formula applicability limits",
              "FAQ and directions inspected 2026-10-01",
              "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
            ],
            "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-US",
            "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
            "type": "brand_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "Kérastase brand education manager",
            "limitations": [
              "Commercially affiliated US professional usage advice",
              "named brand education manager advice inspected 2026-09-30",
              "Not independent efficacy testing or a binding DE pack schedule."
            ],
            "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
            "checked_date": "2026-09-30",
            "commercial_context": "Kérastase brand education manager"
          },
          {
            "id": "A-JUUT",
            "url": "https://juut.com/blog/damaged-hair-repair/",
            "type": "commercial_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "JUUT / Aveda",
            "limitations": [
              "Aveda product practice",
              "named stylist experiences inspected 2026-09-30",
              "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
            ],
            "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
            "checked_date": "2026-09-30",
            "commercial_context": "JUUT / Aveda"
          },
          {
            "id": "A-REDKEN-CREATOR",
            "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Redken treatment listing only",
              "product listing inspected; detailed verdict uninspected",
              "No positive long-term or efficacy conclusion may be extracted."
            ],
            "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "A-ELVITAL-EDITORIAL",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue editorial guidance",
              "editorial applicability inspected 2026-09-30",
              "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
            ],
            "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-ELVITAL-WEEKLY",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue weekly advice",
              "editorial applicability inspected 2026-09-30",
              "Exact product-version applicability is unresolved; do not impose weekly use."
            ],
            "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "S01",
            "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith EU",
            "limitations": [
              "Actual pack not supplied; manufacturer warns that formula lists can change.",
              "Product title salve does not itself establish an applied cream texture.",
              "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S02",
            "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith DE",
            "limitations": [
              "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
              "Original scope: DE 237 ml listing and translated formula/directions",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S03",
            "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
            "type": "brand_owner_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": "dm / Balea",
            "limitations": [
              "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
              "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
            ],
            "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S04",
            "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Garnier DE / L'Oréal",
            "limitations": [
              "Rich formula is a description, not enough to certify cream texture.",
              "No actual pack.",
              "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S05",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
              "Concentration label is a branded complex claim, not ingredient dose.",
              "No study protocol, comparator or data inspected.",
              "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S06",
            "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
            "type": "manufacturer_editorial",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": "Sharley Butcher",
            "authority": "manufacturer",
            "affiliation": "Curlsmith / Sharley Butcher",
            "limitations": [
              "Not an inspected peer-reviewed study.",
              "Select current local product directions, retaining this differing editorial separately.",
              "Original scope: manufacturer editorial and historical study disclosure",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
            ],
            "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S07",
            "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
            "type": "supplier_document",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland, hosted by distributor ChemPoint",
            "limitations": [
              "This is not Curlsmith's formulation, supplier verification or product dose.",
              "Stability testing is not an efficacy trial.",
              "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
            ],
            "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S08",
            "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
            "type": "supplier_statement",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland",
            "limitations": [
              "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
              "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
              "Original scope: supplier press release 2024-02-22, technology scope",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
            ],
            "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S09",
            "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
            "type": "original_creator_statement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": "Gena Marie",
            "authority": "creator",
            "affiliation": "Gena Marie",
            "limitations": [
              "Historical formula/market not bound to current EU version.",
              "Article inspected; linked video not independently watched.",
              "Not an Abbey Yung endorsement.",
              "Original scope: original written sponsored creator comparison, 2021-01-03",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
            ],
            "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
            "checked_date": "2026-10-02",
            "commercial_context": "sponsored post; affiliate links"
          },
          {
            "id": "S10",
            "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
              "Original scope: original anecdotal discussion, historical unspecified pack",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown; do not infer independence"
          },
          {
            "id": "S11",
            "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
              "Original scope: historical anecdote with alternating treatment system",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown"
          },
          {
            "id": "S12",
            "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
            "type": "manufacturer_professional_document",
            "scope": "system",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Different test scopes retained, not combined as serum-alone results.",
              "No original methods, full data or current formula equivalence inspected.",
              "Original scope: historical professional service leaflet",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
            ],
            "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S13",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "manufacturer_application_amendment",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
              "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
              "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
              "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
              "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
            ],
            "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
            "checked_date": "2026-10-02",
            "commercial_context": "maker sells the product"
          },
          {
            "id": "C03-P04-1",
            "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "type": "producer_direction_complement_de",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Paris DE",
            "limitations": [
              "Direct page open initially returned a page listing but follow-up page retrieval failed; producer directions were inspected in the search-engine excerpt, excluding customer reviews.",
              "The inspected excerpt does not establish the 200 ml pack size, physical texture, dose volume or cadence.",
              "Generic FAQ discussion of other pre-shampoos lasting 5–20 minutes is not treated as this product's instruction.",
              "Source market: DE. Bound to producer-source-complement-2026-10-03/C03-P04-1; application directions only."
            ],
            "observation": "Producer directions identify Bond Repair Plus Keratin-Festigendes Pre-Shampoo and place it before washing. Apply a generous amount to damp hair across the scalp through the ends. Retain for five minutes, then rinse thoroughly with clear water until residues are removed. Continue with Bond Repair Plus shampoo, conditioner and leave-in serum. The FAQ explicitly includes scalp, lengths and ends as application areas.",
            "checked_date": "2026-10-03",
            "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
          }
        ],
        "version": "bondbuilder-research-profile-v1",
        "evidence": {
          "detail": "The citric-acid abstract reports calcium reduction and mechanical/thermal outcomes in chemically treated fibres but gives no inspected dose, pH, vehicle, full protocol or statistical details. It is not a bottle-specific trial. Current 22% complex wording and older 12% copy are not ingredient concentrations or compatible directions.",
          "summary": "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
          "cautions": [
            "No native-bond restoration, product superiority or active dose is established by the family label.",
            "Full experimental methods not inspected.",
            "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
          ],
          "practical": {
            "limitations": [
              "No inspected original applicable practice verdict supports a benefit claim. Missing or inaccessible opinions are neutral."
            ],
            "counter_source_ids": [],
            "supporting_source_ids": []
          },
          "scientific": {
            "limitations": [
              "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
              "Full experimental methods not inspected.",
              "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
            ],
            "counter_source_ids": [],
            "supporting_source_ids": [
              "N07"
            ]
          },
          "applicability": [
            {
              "scope": "technology",
              "bridge": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
              "source_ids": [
                "N07"
              ],
              "limitations": [
                "citric-acid technology, not any named retail treatment",
                "publisher abstract inspected; full text inaccessible",
                "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
              ]
            },
            {
              "scope": "product",
              "bridge": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
              "source_ids": [
                "R01"
              ],
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ]
            },
            {
              "scope": "product",
              "bridge": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
              "source_ids": [
                "R08"
              ],
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ]
            },
            {
              "scope": "product",
              "bridge": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
              "source_ids": [
                "A-ELVITAL-EDITORIAL"
              ],
              "limitations": [
                "Ambiguous Rescue editorial guidance",
                "editorial applicability inspected 2026-09-30",
                "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
              ]
            },
            {
              "scope": "product",
              "bridge": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
              "source_ids": [
                "A-ELVITAL-WEEKLY"
              ],
              "limitations": [
                "Ambiguous Rescue weekly advice",
                "editorial applicability inspected 2026-09-30",
                "Exact product-version applicability is unresolved; do not impose weekly use."
              ]
            }
          ],
          "supported_outcome": "Targeted acid-family reinforcement is plausible at technology level; exact Plus isolated-product effect remains unverified.",
          "manufacturer_positioning": [
            "R01: Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
            "R08: 200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict."
          ]
        },
        "identity": {
          "gtin": null,
          "size": "200 ml",
          "brand": "L’Oréal Paris",
          "market": "DE",
          "status": "resolved",
          "product_id": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
          "product_name": "Elvital Bond Repair Plus Keratin-Festigendes Pre-Shampoo",
          "research_key": "P04",
          "source_version": "2026-09-30:R01"
        },
        "assessment": {
          "reasoning": {
            "trust_basis": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "R01"
              ],
              "assumptions": [],
              "limitations": []
            },
            "intended_role": {
              "rationale": "The exact named current product is a targeted pre-shampoo treatment.",
              "confidence": "moderate",
              "source_ids": [
                "R01"
              ],
              "assumptions": [],
              "limitations": []
            },
            "fit_assessment": {
              "rationale": "No source-supported diameter-specific suitability values are present. Damage, curl pattern, porosity and format do not establish diameter fit.",
              "confidence": "low",
              "source_ids": [],
              "assumptions": [],
              "limitations": [
                "All three diameter values remain null; this is not a finding of unsuitability."
              ]
            },
            "product_format": {
              "rationale": "P04: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "assumptions": [],
              "limitations": []
            },
            "treatment_mode": {
              "rationale": "Producer application amendment establishes rinse.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "assumptions": [],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected."
              ]
            },
            "boundary_status": {
              "rationale": "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
              "confidence": "moderate",
              "source_ids": [
                "R01",
                "R08"
              ],
              "assumptions": [],
              "limitations": [
                "Full experimental methods not inspected.",
                "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
              ]
            },
            "application_mode": {
              "rationale": "Exact current product identity is a Pre-Shampoo; capture refers to its directions.",
              "confidence": "moderate",
              "source_ids": [
                "R01"
              ],
              "assumptions": [],
              "limitations": []
            },
            "evidence_profile": {
              "rationale": "The citric-acid abstract reports calcium reduction and mechanical/thermal outcomes in chemically treated fibres but gives no inspected dose, pH, vehicle, full protocol or statistical details. It is not a bottle-specific trial. Current 22% complex wording and older 12% copy are not ingredient concentrations or compatible directions.",
              "confidence": "moderate",
              "source_ids": [
                "N07",
                "R01",
                "R08",
                "A-ELVITAL-EDITORIAL",
                "A-ELVITAL-WEEKLY"
              ],
              "assumptions": [],
              "limitations": [
                "Duplicate captures of one study are not independent trials."
              ]
            },
            "application_facts": {
              "rationale": "Producer application amendment supplies direction sources; 6 application fact wrappers remain unknown.",
              "confidence": "moderate",
              "source_ids": [
                "R01",
                "C03-P04-1"
              ],
              "assumptions": [],
              "limitations": [
                "Remaining application unknowns are retained; no fact was inferred."
              ]
            },
            "claim_trust_level": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "R01"
              ],
              "assumptions": [],
              "limitations": [
                "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
              ]
            },
            "supported_outcome": {
              "rationale": "Targeted acid-family reinforcement is plausible at technology level; exact Plus isolated-product effect remains unverified.",
              "confidence": "moderate",
              "source_ids": [
                "N07",
                "R01",
                "R08"
              ],
              "assumptions": [],
              "limitations": [
                "Full experimental methods not inspected.",
                "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
              ]
            },
            "technology_family": {
              "rationale": "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
              "confidence": "moderate",
              "source_ids": [
                "R01"
              ],
              "assumptions": [],
              "limitations": [
                "Marker presence does not establish concentration, supplier, delivery or molecular effect."
              ]
            }
          },
          "trust_basis": "owner_calibration",
          "boundary_status": "in_scope",
          "limiting_factors": [
            "Full experimental methods not inspected.",
            "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
          ],
          "policy_reference": "owner-review-2026-09-30:P04",
          "claim_trust_level": "medium",
          "technology_family": "acid_calcium_management",
          "classification_confidence": "moderate"
        },
        "application": {
          "rinse": {
            "value": {
              "treatment_mode": "rinse_out",
              "standalone_treatment_rinse": true
            },
            "rationale": "Rinse the treatment thoroughly before shampoo.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected."
            ],
            "unknown_reason": null
          },
          "amount": {
            "value": {
              "kind": "qualitative",
              "instruction": "Apply a generous amount."
            },
            "rationale": "Producer specifies a generous amount.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected."
            ],
            "unknown_reason": null
          },
          "timing": {
            "value": {
              "kind": "exact_seconds",
              "purpose": "contact",
              "seconds": 300
            },
            "rationale": "Retain five minutes before rinsing.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected."
            ],
            "unknown_reason": null
          },
          "cadence": {
            "value": null,
            "rationale": "The exact current Plus cadence is not reproduced. Older editorial twice-weekly then weekly and other weekly advice have unresolved version applicability.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "The exact current Plus cadence is not reproduced. Older editorial twice-weekly then weekly and other weekly advice have unresolved version applicability."
          },
          "dilution": {
            "value": null,
            "rationale": "P04: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "partners": {
            "value": [
              {
                "name": "Bond Repair Plus Shampoo",
                "source_ids": [
                  "C03-P04-1"
                ],
                "requirement": "recommended",
                "exclusivity_established": false
              },
              {
                "name": "Bond Repair Plus Spülung",
                "source_ids": [
                  "C03-P04-1"
                ],
                "requirement": "recommended",
                "exclusivity_established": false
              },
              {
                "name": "Bond Repair Plus Leave-In Serum",
                "source_ids": [
                  "C03-P04-1"
                ],
                "requirement": "recommended",
                "exclusivity_established": false
              }
            ],
            "rationale": "The producer recommends the Plus shampoo, conditioner and leave-in serum.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected.",
              "No brand exclusivity or required purchase is established."
            ],
            "unknown_reason": null
          },
          "sequence": {
            "value": [
              {
                "note": "Apply generously to damp hair across scalp through tips.",
                "action": "apply_treatment",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P04-1"
                ]
              },
              {
                "note": "Retain for the stated interval.",
                "action": "wait",
                "timing": {
                  "kind": "exact_seconds",
                  "purpose": "contact",
                  "seconds": 300
                },
                "optional": false,
                "source_ids": [
                  "C03-P04-1"
                ]
              },
              {
                "note": "Rinse the treatment before shampoo.",
                "action": "rinse",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P04-1"
                ]
              },
              {
                "note": "Continue with the producer-named shampoo.",
                "action": "shampoo",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P04-1"
                ]
              },
              {
                "note": "Use Bond Repair Plus conditioner; the producer also recommends its leave-in serum afterward.",
                "action": "apply_conditioner",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P04-1"
                ]
              }
            ],
            "rationale": "Apply, wait five minutes, rinse thoroughly, then use the Plus shampoo and aftercare.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected.",
              "The schema has no serum-specific action; leave-in serum is preserved in partners and step note."
            ],
            "unknown_reason": null
          },
          "placement": {
            "value": "pre_shampoo",
            "rationale": "Exact current product identity is a Pre-Shampoo; capture refers to its directions.",
            "confidence": "moderate",
            "source_ids": [
              "R01"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "hair_state": {
            "value": "damp",
            "rationale": "Current Plus directions specify damp hair.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected."
            ],
            "unknown_reason": null
          },
          "conditioner": {
            "value": {
              "after": "recommended",
              "before": "not_stated",
              "guidance_reference": null,
              "minimum_wait_seconds": null
            },
            "rationale": "Complete the routine with conditioner after shampoo.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected."
            ],
            "unknown_reason": null
          },
          "longer_wear": {
            "value": null,
            "rationale": "P04: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "distribution": {
            "value": null,
            "rationale": "P04: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "source_market": "DE",
          "applied_format": {
            "value": null,
            "rationale": "P04: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "treatment_role": {
            "value": "pre_shampoo_treatment",
            "rationale": "The exact named current product is a targeted pre-shampoo treatment.",
            "confidence": "moderate",
            "source_ids": [
              "R01"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "source_variants": [
            {
              "market": "DE",
              "selected": true,
              "source_ids": [
                "R01"
              ],
              "differences": "Selected current Plus source; 22% complex is attributed wording, not ingredient concentration."
            },
            {
              "market": "DE",
              "selected": false,
              "source_ids": [
                "R08"
              ],
              "differences": "Retailer INCI corroboration; older 12% copy conflicts with current Plus wording."
            },
            {
              "market": "DE",
              "selected": false,
              "source_ids": [
                "A-ELVITAL-EDITORIAL"
              ],
              "differences": "Older/ambiguous dry-hair 5–10-minute directions, twice weekly initially then weekly; not selected for current Plus."
            },
            {
              "market": "DE",
              "selected": false,
              "source_ids": [
                "A-ELVITAL-WEEKLY"
              ],
              "differences": "Weekly editorial guidance has unresolved version applicability and is not imposed."
            },
            {
              "market": "DE",
              "selected": true,
              "source_ids": [
                "C03-P04-1"
              ],
              "differences": "Current DE Plus producer excerpt selected for directions only; generic pre-shampoo FAQ times and older editorial cadence are not selected."
            }
          ],
          "state_modifiers": {
            "value": null,
            "rationale": "P04: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P04: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "application_area": {
            "value": "root_to_tip",
            "rationale": "Directions cover scalp through tips.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P04-1"
            ],
            "limitations": [
              "Producer search excerpt only; direct follow-up page retrieval failed.",
              "Exact 200 ml physical pack uninspected.",
              "Schema root_to_tip captures longitudinal coverage; explicit scalp wording remains in the rationale."
            ],
            "unknown_reason": null
          },
          "applicability_note": "Current DE Plus producer excerpt adds damp-hair five-minute rinse-before-shampoo instructions; exact 200 ml label, physical texture and cadence remain unresolved.",
          "direction_source_ids": [
            "R01",
            "C03-P04-1"
          ],
          "market_applicability": "exact_market"
        },
        "explanations_de": {
          "deeper": "Gezieltes Pre-Shampoo mit Zitronensäure und ergänzenden Inhaltsstoffen. Die Forschung betrifft die Technologie; die Wirkung dieser konkreten Quellenversion ist damit nicht isoliert bewiesen. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
          "concise": "Gezieltes Pre-Shampoo mit Zitronensäure und ergänzenden Inhaltsstoffen. Die Forschung betrifft die Technologie; die Wirkung dieser konkreten Quellenversion ist damit nicht isoliert bewiesen."
        },
        "technology_reference": {
          "status": "matched",
          "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
          "product_id": null,
          "source_ids": [
            "R01"
          ],
          "research_key": "P04",
          "formula_sha256": "e5e9b5e7c3d8882f12622bda11a67ace0ef1aeb37b9660bf881231966815ae00",
          "shared_markers": [
            "citric acid"
          ],
          "source_version": "2026-09-30:R01"
        }
      },
      "spec": {
        "application_mode": "pre_shampoo",
        "treatment_mode": "rinse_out",
        "usage_protocol": "verified_product_protocol"
      },
      "protocolV1": {
        "schemaVersion": 1,
        "guidanceKey": "v2-exact-bondbuilder_verified_product-e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
        "protocolVersion": 2,
        "locale": "de",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8"
        },
        "role": "bond_repair",
        "applicationFamily": "pre_shampoo_single_treatment",
        "compatibleDayTypes": [
          "bond_repair_day"
        ],
        "exactGuidanceRequired": true,
        "sequence": {
          "anchor": "pre_wash",
          "before": [],
          "after": [],
          "conflictsWith": []
        },
        "requirements": {
          "requiredCatalogFacts": [],
          "requiredProtocolFacts": [],
          "requiredProfileFacts": []
        },
        "protocolFacts": {
          "applicationArea": "all_hair",
          "rinse": "rinse_out",
          "contactTimeSeconds": 300,
          "contactTime": {
            "kind": "seconds",
            "seconds": 300
          },
          "applicationState": "damp_hair",
          "treatmentRinse": "rinse_out",
          "conditionerSequence": {
            "before": "not_stated",
            "after": "recommended",
            "minimumWaitSeconds": null
          },
          "shampooAfterTreatment": "rinse_then_shampoo",
          "conditionerRelationship": "not_applicable",
          "reapplication": "none",
          "amount": {
            "kind": "qualitative",
            "copyDe": "Eine großzügige Menge verwenden."
          },
          "workflowId": "bondbuilder_verified_product",
          "cautions": []
        },
        "steps": [
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyTemplateDe": "Eine großzügige Menge verwenden. Auf das feuchte Haar geben und vom Ansatz bis zu den Spitzen verteilen."
          },
          {
            "stepKey": "wait",
            "action": "wait",
            "copyTemplateDe": "5 Minuten einwirken lassen."
          },
          {
            "stepKey": "rinse-treatment",
            "action": "rinse",
            "copyTemplateDe": "Die Behandlung gründlich ausspülen."
          },
          {
            "stepKey": "shampoo-after",
            "action": "section",
            "copyTemplateDe": "Anschließend wie gewohnt mit Shampoo waschen und pflegen."
          },
          {
            "stepKey": "conditioner-after",
            "action": "section",
            "copyTemplateDe": "Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen."
          }
        ],
        "evidence": [
          {
            "sourceUrl": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "sourceType": "manufacturer",
            "checkedAt": "2026-09-30"
          },
          {
            "sourceUrl": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-03"
          }
        ]
      },
      "protocolV2": {
        "schemaVersion": 2,
        "contractKind": "product_pointer",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8"
        },
        "sourceRole": "specialized_bond_treatment",
        "role": "bond_repair",
        "applicationFamily": "pre_shampoo_single_treatment",
        "facts": {
          "applicationState": "damp_hair",
          "applicationArea": "root_to_tip_hair",
          "rinse": "rinse_out",
          "contactTime": {
            "kind": "seconds",
            "seconds": 300
          },
          "amount": {
            "kind": "source_instruction",
            "copyDe": "Eine großzügige Menge verwenden."
          },
          "heat": null,
          "conditionerSequence": {
            "before": "not_stated",
            "after": "recommended",
            "minimumWaitSeconds": null
          },
          "shampooAfterTreatment": "rinse_then_shampoo",
          "conditionerPolicy": "not_applicable"
        },
        "workflowId": "bondbuilder_verified_product",
        "requiredCompanionProductId": null,
        "runtimeBlockerCode": null,
        "exactSteps": [
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyDe": "Eine großzügige Menge verwenden. Auf das feuchte Haar geben und vom Ansatz bis zu den Spitzen verteilen."
          },
          {
            "stepKey": "wait",
            "action": "wait",
            "copyDe": "5 Minuten einwirken lassen."
          },
          {
            "stepKey": "rinse-treatment",
            "action": "rinse",
            "copyDe": "Die Behandlung gründlich ausspülen."
          },
          {
            "stepKey": "shampoo-after",
            "action": "section",
            "copyDe": "Anschließend wie gewohnt mit Shampoo waschen und pflegen."
          },
          {
            "stepKey": "conditioner-after",
            "action": "section",
            "copyDe": "Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen."
          }
        ],
        "cautionCodes": [],
        "evidence": [
          {
            "sourceUrl": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "sourceType": "manufacturer",
            "checkedAt": "2026-09-30"
          },
          {
            "sourceUrl": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-03"
          }
        ]
      },
      "cadence": null,
      "eligibleThicknesses": [
        "fine",
        "normal",
        "coarse"
      ],
      "source": {
        "source_url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
        "source_text": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed."
      },
      "removedProtocolHolds": [
        "application.applied_format",
        "application.state_modifiers",
        "application.distribution",
        "application.longer_wear",
        "application.dilution",
        "application.cadence"
      ]
    },
    "preimage": {
      "spec": {
        "created_at": "2026-10-04T08:37:19.548173+00:00",
        "product_id": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
        "updated_at": "2026-10-04T08:37:19.548173+00:00",
        "trust_basis": "owner_calibration",
        "category_key": "bondbuilder",
        "product_format": null,
        "treatment_mode": "rinse_out",
        "usage_protocol": null,
        "application_mode": "pre_shampoo",
        "bond_repair_axis": null,
        "research_profile": {
          "fit": {
            "fine": {
              "value": null,
              "rationale": "P04: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "coarse": {
              "value": null,
              "rationale": "P04: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "normal": {
              "value": null,
              "rationale": "P04: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            }
          },
          "holds": {
            "fit": [
              {
                "code": "diameter_fit_unknown",
                "field": "fit",
                "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
                "source_ids": []
              }
            ],
            "boundary": [],
            "identity": [],
            "protocol": [
              {
                "code": "source_fact_unknown",
                "field": "application.applied_format",
                "reason": "P04: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.state_modifiers",
                "reason": "P04: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.distribution",
                "reason": "P04: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.longer_wear",
                "reason": "P04: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.dilution",
                "reason": "P04: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.cadence",
                "reason": "The exact current Plus cadence is not reproduced. Older editorial twice-weekly then weekly and other weekly advice have unresolved version applicability.",
                "source_ids": []
              }
            ],
            "claim_trust": []
          },
          "method": {
            "method_id": "bondbuilder-inci",
            "output_sha256": "c15f5a46272ddbfc8e4bddf88cdf6279740e16173365382658258786748d131d",
            "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
            "run_reference": "replay-2026-10-03-v0.5-r3",
            "method_version": "bondbuilder-inci-v0.5",
            "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
            "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
            "artifact_reference": "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/lane-b/assembled/P04.json",
            "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
            "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
          },
          "review": {
            "checked_date": "2026-10-03",
            "reviewed_date": null,
            "profile_sha256": "c15f5a46272ddbfc8e4bddf88cdf6279740e16173365382658258786748d131d",
            "decision_references": []
          },
          "formula": {
            "status": "complete",
            "markers": [
              {
                "family": "acid_calcium_management",
                "literal": "citric acid",
                "source_ids": [
                  "R01"
                ]
              },
              {
                "family": "acid_calcium_management",
                "literal": "arginine",
                "source_ids": [
                  "R01"
                ]
              },
              {
                "family": "acid_calcium_management",
                "literal": "betaine",
                "source_ids": [
                  "R01"
                ]
              }
            ],
            "raw_inci": "AQUA / WATER • CETEARYL ALCOHOL • CITRIC ACID • BEHENTRIMONIUM CHLORIDE • ARGININE • CETYL ESTERS • BETAINE • GLYCERIN • HYDROXYPROPYL GUAR • HYDROXYCITRONELLAL • PHENOXYETHANOL • STEARETH-100 • PEG-150/DECYL ALCOHOL/SMDI COPOLYMER • PPG-1 TRIDECETH-6 • AMINOPROPYL DIMETHICONE • POLYQUATERNIUM-37 • CHLORHEXIDINE DIGLUCONATE • LIMONENE • LINALOOL • PINENE • ISOPROPYL ALCOHOL • ISODODECANE • PROPYLENE GLYCOL • PROPYLENE GLYCOL DICAPRYLATE/DICAPRATE • CARVONE • GERANYL ACETATE • ACRYLATES/STEARYL METHACRYLATE COPOLYMER • SORBITAN OLEATE • BIS(C13-15 ALKOXY) PG-AMODIMETHICONE • BUTYROSPERMUM PARKII BUTTER / SHEA BUTTER • POTASSIUM HYDROXIDE • TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES • CITRUS LIMON PEEL OIL • EDTA • HEXYL CINNAMAL • PARFUM / FRAGRANCE",
            "conflicts": [],
            "raw_sha256": "482b3e1c0a5317613e0202b8156fdc00058e90d1366c83232fd3c286fc341c36",
            "source_ids": [
              "R01"
            ],
            "normalized_sha256": "e5e9b5e7c3d8882f12622bda11a67ace0ef1aeb37b9660bf881231966815ae00",
            "candidate_families": [
              "acid_calcium_management"
            ],
            "normalization_version": "bondbuilder-inci-normalization-v1",
            "normalized_ingredients": [
              "aqua / water",
              "cetearyl alcohol",
              "citric acid",
              "behentrimonium chloride",
              "arginine",
              "cetyl esters",
              "betaine",
              "glycerin",
              "hydroxypropyl guar",
              "hydroxycitronellal",
              "phenoxyethanol",
              "steareth-100",
              "peg-150/decyl alcohol/smdi copolymer",
              "ppg-1 trideceth-6",
              "aminopropyl dimethicone",
              "polyquaternium-37",
              "chlorhexidine digluconate",
              "limonene",
              "linalool",
              "pinene",
              "isopropyl alcohol",
              "isododecane",
              "propylene glycol",
              "propylene glycol dicaprylate/dicaprate",
              "carvone",
              "geranyl acetate",
              "acrylates/stearyl methacrylate copolymer",
              "sorbitan oleate",
              "bis(c13-15 alkoxy) pg-amodimethicone",
              "butyrospermum parkii butter / shea butter",
              "potassium hydroxide",
              "tetramethyl acetyloctahydronaphthalenes",
              "citrus limon peel oil",
              "edta",
              "hexyl cinnamal",
              "parfum / fragrance"
            ],
            "candidate_to_final_trace": [
              "Stage A candidates: acid_calcium_management.",
              "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
              "Final boundary: in_scope; family: acid_calcium_management; tier/basis: medium/owner_calibration."
            ]
          },
          "sources": [
            {
              "id": "E01",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
              "limitations": [
                "citric-acid technology",
                "publisher abstract and affiliations; full methods not audited",
                "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
              ],
              "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
              "checked_date": "2026-09-30",
              "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
            },
            {
              "id": "E02",
              "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
              "limitations": [
                "gluconamide/gluconate model chemistry",
                "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
              ],
              "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
              "checked_date": "2026-09-30",
              "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
            },
            {
              "id": "E03",
              "url": "https://cris.unibo.it/handle/11585/796978",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
              "limitations": [
                "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
                "author-repository abstract inspected; full manuscript not audited",
                "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
              ],
              "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
            },
            {
              "id": "E04",
              "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University of Minho; funding/COI not independently audited here.",
              "limitations": [
                "generic keratin-peptide binding",
                "indexed publisher/PubMed abstract inspected; direct publisher 403",
                "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
              ],
              "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
              "checked_date": "2026-09-30",
              "commercial_context": "University of Minho; funding/COI not independently audited here."
            },
            {
              "id": "P01:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "P02:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "E06",
              "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
              "type": "supplier_primary_technical_poster",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland supplier-owned material; not independent retail testing.",
              "limitations": [
                "supplier paired-marker technology, not OGX/Aveda bottles",
                "indexed primary poster text; direct PDF timeout, graphs not inspected",
                "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
              ],
              "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
              "checked_date": "2026-09-30",
              "commercial_context": "Ashland supplier-owned material; not independent retail testing."
            },
            {
              "id": "E07",
              "url": "https://patents.google.com/patent/US11491092B2/en",
              "type": "inventor_patent",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "patent",
              "affiliation": "Inventor/patent-holder evidence, not independent validation.",
              "limitations": [
                "bis(2-ethylhexyl) maleate technology examples",
                "description/examples inspected",
                "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
              ],
              "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
              "checked_date": "2026-09-30",
              "commercial_context": "Inventor/patent-holder evidence, not independent validation."
            },
            {
              "id": "R01",
              "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R02",
              "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R03",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "UK manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R04",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R05",
              "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R06",
              "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R07",
              "url": "https://epres.com/products/bond-repair-treatment",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R08",
              "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R09",
              "url": "https://www.douglas.de/de/p/5011495045",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R10",
              "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "45ml treatment-style INCI, not a 250ml verification.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R11",
              "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R12",
              "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R13",
              "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R14",
              "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
              "type": "DE-language retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R15",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
              "type": "DE manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N01",
              "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase target 250ml; local retailer source version",
                "full ingredient and application text inspected",
                "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
              ],
              "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N02",
              "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase 250ml corroboration",
                "full ingredient and protocol text inspected by source researcher",
                "Retailer corroboration is not a clinical test or supplied-pack verification."
              ],
              "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N03",
              "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
                "researcher full listing; root indexed full ingredient text; root direct open failed",
                "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
              ],
              "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N04",
              "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
              "type": "same_identifier_EU_retailer_corroboration",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml EAN3574661818474, Norway; not a DE pack",
                "researcher full listing and ingredient text",
                "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
              ],
              "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N05",
              "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
              "type": "manufacturer_protocol",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "epres intended spray bottle/refill system",
                "full official description, FAQs and ingredient text inspected",
                "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
              ],
              "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "P01:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "P02:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "N07",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary_abstract_amendment",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
              "limitations": [
                "citric-acid technology, not any named retail treatment",
                "publisher abstract inspected; full text inaccessible",
                "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
              ],
              "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
              "checked_date": "2026-09-30",
              "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
            },
            {
              "id": "N08",
              "url": "https://linktr.ee/abbeyyung",
              "type": "creator_own_source",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "AbbeyYung promotional context",
                "own page inspected",
                "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
              ],
              "observation": "Own page lists an epres discount code and links to own channels.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N09",
              "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Abbey bond-repair routine includes epres/K18",
                "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
                "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
              ],
              "observation": "Creator/title/routine inclusion leads identified.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N10",
              "url": "https://olaplex.de/pages/hair-care-ambassadors",
              "type": "brand_relationship_disclosure",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
                "official text inspected",
                "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
              ],
              "observation": "Both named as ambassadors.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N11",
              "url": "https://olaplex.de/pages/dejangarz",
              "type": "brand_hosted_creator_endorsement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "No3PLUS in Dejan's favourites",
                "official text inspected",
                "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
              ],
              "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N12",
              "url": "https://whimsysoul.com/epres-bond-repair-review/",
              "type": "original_first_person_longer_use_review",
              "scope": "practice",
              "access": "full_text",
              "author": "Kara",
              "authority": "creator",
              "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
              "limitations": [
                "Kara's epres starter-kit hair experience; article dated2026-04-12",
                "original article text inspected",
                "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
              ],
              "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
            },
            {
              "id": "F01",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
                "product description, directions and INCI inspected 2026-10-01",
                "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
              ],
              "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "F02",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
                "product description, directions and INCI inspected 2026-10-01",
                "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
              ],
              "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-REDKEN-AU",
              "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "AU product directions, not DE pack",
                "product directions inspected 2026-10-01",
                "Cross-market complement; no concentration equality or binding DE cadence."
              ],
              "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-DE",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE manufacturer complement with format/formula applicability limits",
                "FAQ and directions inspected 2026-10-01",
                "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
              ],
              "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-US",
              "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
              "type": "brand_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "Kérastase brand education manager",
              "limitations": [
                "Commercially affiliated US professional usage advice",
                "named brand education manager advice inspected 2026-09-30",
                "Not independent efficacy testing or a binding DE pack schedule."
              ],
              "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
              "checked_date": "2026-09-30",
              "commercial_context": "Kérastase brand education manager"
            },
            {
              "id": "A-JUUT",
              "url": "https://juut.com/blog/damaged-hair-repair/",
              "type": "commercial_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "JUUT / Aveda",
              "limitations": [
                "Aveda product practice",
                "named stylist experiences inspected 2026-09-30",
                "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
              ],
              "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
              "checked_date": "2026-09-30",
              "commercial_context": "JUUT / Aveda"
            },
            {
              "id": "A-REDKEN-CREATOR",
              "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Redken treatment listing only",
                "product listing inspected; detailed verdict uninspected",
                "No positive long-term or efficacy conclusion may be extracted."
              ],
              "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "A-ELVITAL-EDITORIAL",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue editorial guidance",
                "editorial applicability inspected 2026-09-30",
                "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
              ],
              "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-ELVITAL-WEEKLY",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue weekly advice",
                "editorial applicability inspected 2026-09-30",
                "Exact product-version applicability is unresolved; do not impose weekly use."
              ],
              "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "S01",
              "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith EU",
              "limitations": [
                "Actual pack not supplied; manufacturer warns that formula lists can change.",
                "Product title salve does not itself establish an applied cream texture.",
                "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S02",
              "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith DE",
              "limitations": [
                "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
                "Original scope: DE 237 ml listing and translated formula/directions",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S03",
              "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
              "type": "brand_owner_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": "dm / Balea",
              "limitations": [
                "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
                "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
              ],
              "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S04",
              "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Garnier DE / L'Oréal",
              "limitations": [
                "Rich formula is a description, not enough to certify cream texture.",
                "No actual pack.",
                "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S05",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
                "Concentration label is a branded complex claim, not ingredient dose.",
                "No study protocol, comparator or data inspected.",
                "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S06",
              "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
              "type": "manufacturer_editorial",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": "Sharley Butcher",
              "authority": "manufacturer",
              "affiliation": "Curlsmith / Sharley Butcher",
              "limitations": [
                "Not an inspected peer-reviewed study.",
                "Select current local product directions, retaining this differing editorial separately.",
                "Original scope: manufacturer editorial and historical study disclosure",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
              ],
              "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S07",
              "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
              "type": "supplier_document",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland, hosted by distributor ChemPoint",
              "limitations": [
                "This is not Curlsmith's formulation, supplier verification or product dose.",
                "Stability testing is not an efficacy trial.",
                "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
              ],
              "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S08",
              "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
              "type": "supplier_statement",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland",
              "limitations": [
                "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
                "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
                "Original scope: supplier press release 2024-02-22, technology scope",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
              ],
              "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S09",
              "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
              "type": "original_creator_statement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": "Gena Marie",
              "authority": "creator",
              "affiliation": "Gena Marie",
              "limitations": [
                "Historical formula/market not bound to current EU version.",
                "Article inspected; linked video not independently watched.",
                "Not an Abbey Yung endorsement.",
                "Original scope: original written sponsored creator comparison, 2021-01-03",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
              ],
              "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
              "checked_date": "2026-10-02",
              "commercial_context": "sponsored post; affiliate links"
            },
            {
              "id": "S10",
              "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
                "Original scope: original anecdotal discussion, historical unspecified pack",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown; do not infer independence"
            },
            {
              "id": "S11",
              "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
                "Original scope: historical anecdote with alternating treatment system",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown"
            },
            {
              "id": "S12",
              "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
              "type": "manufacturer_professional_document",
              "scope": "system",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Different test scopes retained, not combined as serum-alone results.",
                "No original methods, full data or current formula equivalence inspected.",
                "Original scope: historical professional service leaflet",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
              ],
              "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S13",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "manufacturer_application_amendment",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
                "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
                "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
                "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
                "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
              ],
              "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
              "checked_date": "2026-10-02",
              "commercial_context": "maker sells the product"
            },
            {
              "id": "C03-P04-1",
              "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
              "type": "producer_direction_complement_de",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Paris DE",
              "limitations": [
                "Direct page open initially returned a page listing but follow-up page retrieval failed; producer directions were inspected in the search-engine excerpt, excluding customer reviews.",
                "The inspected excerpt does not establish the 200 ml pack size, physical texture, dose volume or cadence.",
                "Generic FAQ discussion of other pre-shampoos lasting 5–20 minutes is not treated as this product's instruction.",
                "Source market: DE. Bound to producer-source-complement-2026-10-03/C03-P04-1; application directions only."
              ],
              "observation": "Producer directions identify Bond Repair Plus Keratin-Festigendes Pre-Shampoo and place it before washing. Apply a generous amount to damp hair across the scalp through the ends. Retain for five minutes, then rinse thoroughly with clear water until residues are removed. Continue with Bond Repair Plus shampoo, conditioner and leave-in serum. The FAQ explicitly includes scalp, lengths and ends as application areas.",
              "checked_date": "2026-10-03",
              "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
            }
          ],
          "version": "bondbuilder-research-profile-v1",
          "evidence": {
            "detail": "The citric-acid abstract reports calcium reduction and mechanical/thermal outcomes in chemically treated fibres but gives no inspected dose, pH, vehicle, full protocol or statistical details. It is not a bottle-specific trial. Current 22% complex wording and older 12% copy are not ingredient concentrations or compatible directions.",
            "summary": "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
            "cautions": [
              "No native-bond restoration, product superiority or active dose is established by the family label.",
              "Full experimental methods not inspected.",
              "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
            ],
            "practical": {
              "limitations": [
                "No inspected original applicable practice verdict supports a benefit claim. Missing or inaccessible opinions are neutral."
              ],
              "counter_source_ids": [],
              "supporting_source_ids": []
            },
            "scientific": {
              "limitations": [
                "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
                "Full experimental methods not inspected.",
                "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
              ],
              "counter_source_ids": [],
              "supporting_source_ids": [
                "N07"
              ]
            },
            "applicability": [
              {
                "scope": "technology",
                "bridge": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
                "source_ids": [
                  "N07"
                ],
                "limitations": [
                  "citric-acid technology, not any named retail treatment",
                  "publisher abstract inspected; full text inaccessible",
                  "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
                ]
              },
              {
                "scope": "product",
                "bridge": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
                "source_ids": [
                  "R01"
                ],
                "limitations": [
                  "exact source-listed product/market only",
                  "web text inspected"
                ]
              },
              {
                "scope": "product",
                "bridge": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
                "source_ids": [
                  "R08"
                ],
                "limitations": [
                  "exact source-listed product/market only",
                  "web text inspected"
                ]
              },
              {
                "scope": "product",
                "bridge": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
                "source_ids": [
                  "A-ELVITAL-EDITORIAL"
                ],
                "limitations": [
                  "Ambiguous Rescue editorial guidance",
                  "editorial applicability inspected 2026-09-30",
                  "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
                ]
              },
              {
                "scope": "product",
                "bridge": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
                "source_ids": [
                  "A-ELVITAL-WEEKLY"
                ],
                "limitations": [
                  "Ambiguous Rescue weekly advice",
                  "editorial applicability inspected 2026-09-30",
                  "Exact product-version applicability is unresolved; do not impose weekly use."
                ]
              }
            ],
            "supported_outcome": "Targeted acid-family reinforcement is plausible at technology level; exact Plus isolated-product effect remains unverified.",
            "manufacturer_positioning": [
              "R01: Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
              "R08: 200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict."
            ]
          },
          "identity": {
            "gtin": null,
            "size": "200 ml",
            "brand": "L’Oréal Paris",
            "market": "DE",
            "status": "resolved",
            "product_id": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
            "product_name": "Elvital Bond Repair Plus Keratin-Festigendes Pre-Shampoo",
            "research_key": "P04",
            "source_version": "2026-09-30:R01"
          },
          "assessment": {
            "reasoning": {
              "trust_basis": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "R01"
                ],
                "assumptions": [],
                "limitations": []
              },
              "intended_role": {
                "rationale": "The exact named current product is a targeted pre-shampoo treatment.",
                "confidence": "moderate",
                "source_ids": [
                  "R01"
                ],
                "assumptions": [],
                "limitations": []
              },
              "fit_assessment": {
                "rationale": "No source-supported diameter-specific suitability values are present. Damage, curl pattern, porosity and format do not establish diameter fit.",
                "confidence": "low",
                "source_ids": [],
                "assumptions": [],
                "limitations": [
                  "All three diameter values remain null; this is not a finding of unsuitability."
                ]
              },
              "product_format": {
                "rationale": "P04: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
                "confidence": "low",
                "source_ids": [],
                "assumptions": [],
                "limitations": []
              },
              "treatment_mode": {
                "rationale": "Producer application amendment establishes rinse.",
                "confidence": "moderate",
                "source_ids": [
                  "C03-P04-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Producer search excerpt only; direct follow-up page retrieval failed.",
                  "Exact 200 ml physical pack uninspected."
                ]
              },
              "boundary_status": {
                "rationale": "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
                "confidence": "moderate",
                "source_ids": [
                  "R01",
                  "R08"
                ],
                "assumptions": [],
                "limitations": [
                  "Full experimental methods not inspected.",
                  "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
                ]
              },
              "application_mode": {
                "rationale": "Exact current product identity is a Pre-Shampoo; capture refers to its directions.",
                "confidence": "moderate",
                "source_ids": [
                  "R01"
                ],
                "assumptions": [],
                "limitations": []
              },
              "evidence_profile": {
                "rationale": "The citric-acid abstract reports calcium reduction and mechanical/thermal outcomes in chemically treated fibres but gives no inspected dose, pH, vehicle, full protocol or statistical details. It is not a bottle-specific trial. Current 22% complex wording and older 12% copy are not ingredient concentrations or compatible directions.",
                "confidence": "moderate",
                "source_ids": [
                  "N07",
                  "R01",
                  "R08",
                  "A-ELVITAL-EDITORIAL",
                  "A-ELVITAL-WEEKLY"
                ],
                "assumptions": [],
                "limitations": [
                  "Duplicate captures of one study are not independent trials."
                ]
              },
              "application_facts": {
                "rationale": "Producer application amendment supplies direction sources; 6 application fact wrappers remain unknown.",
                "confidence": "moderate",
                "source_ids": [
                  "R01",
                  "C03-P04-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Remaining application unknowns are retained; no fact was inferred."
                ]
              },
              "claim_trust_level": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "R01"
                ],
                "assumptions": [],
                "limitations": [
                  "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
                ]
              },
              "supported_outcome": {
                "rationale": "Targeted acid-family reinforcement is plausible at technology level; exact Plus isolated-product effect remains unverified.",
                "confidence": "moderate",
                "source_ids": [
                  "N07",
                  "R01",
                  "R08"
                ],
                "assumptions": [],
                "limitations": [
                  "Full experimental methods not inspected.",
                  "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
                ]
              },
              "technology_family": {
                "rationale": "Current targeted Bond Repair Plus pre-shampoo identity, Citric Acid with Arginine/Betaine, and exact selected owner binding support acid-family membership; literal acid alone would be insufficient.",
                "confidence": "moderate",
                "source_ids": [
                  "R01"
                ],
                "assumptions": [],
                "limitations": [
                  "Marker presence does not establish concentration, supplier, delivery or molecular effect."
                ]
              }
            },
            "trust_basis": "owner_calibration",
            "boundary_status": "in_scope",
            "limiting_factors": [
              "Full experimental methods not inspected.",
              "Current Plus producer instructions are abbreviated; older Rescue editorial variants are not substitutes."
            ],
            "policy_reference": "owner-review-2026-09-30:P04",
            "claim_trust_level": "medium",
            "technology_family": "acid_calcium_management",
            "classification_confidence": "moderate"
          },
          "application": {
            "rinse": {
              "value": {
                "treatment_mode": "rinse_out",
                "standalone_treatment_rinse": true
              },
              "rationale": "Rinse the treatment thoroughly before shampoo.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected."
              ],
              "unknown_reason": null
            },
            "amount": {
              "value": {
                "kind": "qualitative",
                "instruction": "Apply a generous amount."
              },
              "rationale": "Producer specifies a generous amount.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected."
              ],
              "unknown_reason": null
            },
            "timing": {
              "value": {
                "kind": "exact_seconds",
                "purpose": "contact",
                "seconds": 300
              },
              "rationale": "Retain five minutes before rinsing.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected."
              ],
              "unknown_reason": null
            },
            "cadence": {
              "value": null,
              "rationale": "The exact current Plus cadence is not reproduced. Older editorial twice-weekly then weekly and other weekly advice have unresolved version applicability.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "The exact current Plus cadence is not reproduced. Older editorial twice-weekly then weekly and other weekly advice have unresolved version applicability."
            },
            "dilution": {
              "value": null,
              "rationale": "P04: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "partners": {
              "value": [
                {
                  "name": "Bond Repair Plus Shampoo",
                  "source_ids": [
                    "C03-P04-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                },
                {
                  "name": "Bond Repair Plus Spülung",
                  "source_ids": [
                    "C03-P04-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                },
                {
                  "name": "Bond Repair Plus Leave-In Serum",
                  "source_ids": [
                    "C03-P04-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                }
              ],
              "rationale": "The producer recommends the Plus shampoo, conditioner and leave-in serum.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected.",
                "No brand exclusivity or required purchase is established."
              ],
              "unknown_reason": null
            },
            "sequence": {
              "value": [
                {
                  "note": "Apply generously to damp hair across scalp through tips.",
                  "action": "apply_treatment",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P04-1"
                  ]
                },
                {
                  "note": "Retain for the stated interval.",
                  "action": "wait",
                  "timing": {
                    "kind": "exact_seconds",
                    "purpose": "contact",
                    "seconds": 300
                  },
                  "optional": false,
                  "source_ids": [
                    "C03-P04-1"
                  ]
                },
                {
                  "note": "Rinse the treatment before shampoo.",
                  "action": "rinse",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P04-1"
                  ]
                },
                {
                  "note": "Continue with the producer-named shampoo.",
                  "action": "shampoo",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P04-1"
                  ]
                },
                {
                  "note": "Use Bond Repair Plus conditioner; the producer also recommends its leave-in serum afterward.",
                  "action": "apply_conditioner",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P04-1"
                  ]
                }
              ],
              "rationale": "Apply, wait five minutes, rinse thoroughly, then use the Plus shampoo and aftercare.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected.",
                "The schema has no serum-specific action; leave-in serum is preserved in partners and step note."
              ],
              "unknown_reason": null
            },
            "placement": {
              "value": "pre_shampoo",
              "rationale": "Exact current product identity is a Pre-Shampoo; capture refers to its directions.",
              "confidence": "moderate",
              "source_ids": [
                "R01"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "hair_state": {
              "value": "damp",
              "rationale": "Current Plus directions specify damp hair.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected."
              ],
              "unknown_reason": null
            },
            "conditioner": {
              "value": {
                "after": "recommended",
                "before": "not_stated",
                "guidance_reference": null,
                "minimum_wait_seconds": null
              },
              "rationale": "Complete the routine with conditioner after shampoo.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected."
              ],
              "unknown_reason": null
            },
            "longer_wear": {
              "value": null,
              "rationale": "P04: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "distribution": {
              "value": null,
              "rationale": "P04: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "source_market": "DE",
            "applied_format": {
              "value": null,
              "rationale": "P04: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "treatment_role": {
              "value": "pre_shampoo_treatment",
              "rationale": "The exact named current product is a targeted pre-shampoo treatment.",
              "confidence": "moderate",
              "source_ids": [
                "R01"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "source_variants": [
              {
                "market": "DE",
                "selected": true,
                "source_ids": [
                  "R01"
                ],
                "differences": "Selected current Plus source; 22% complex is attributed wording, not ingredient concentration."
              },
              {
                "market": "DE",
                "selected": false,
                "source_ids": [
                  "R08"
                ],
                "differences": "Retailer INCI corroboration; older 12% copy conflicts with current Plus wording."
              },
              {
                "market": "DE",
                "selected": false,
                "source_ids": [
                  "A-ELVITAL-EDITORIAL"
                ],
                "differences": "Older/ambiguous dry-hair 5–10-minute directions, twice weekly initially then weekly; not selected for current Plus."
              },
              {
                "market": "DE",
                "selected": false,
                "source_ids": [
                  "A-ELVITAL-WEEKLY"
                ],
                "differences": "Weekly editorial guidance has unresolved version applicability and is not imposed."
              },
              {
                "market": "DE",
                "selected": true,
                "source_ids": [
                  "C03-P04-1"
                ],
                "differences": "Current DE Plus producer excerpt selected for directions only; generic pre-shampoo FAQ times and older editorial cadence are not selected."
              }
            ],
            "state_modifiers": {
              "value": null,
              "rationale": "P04: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P04: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "application_area": {
              "value": "root_to_tip",
              "rationale": "Directions cover scalp through tips.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P04-1"
              ],
              "limitations": [
                "Producer search excerpt only; direct follow-up page retrieval failed.",
                "Exact 200 ml physical pack uninspected.",
                "Schema root_to_tip captures longitudinal coverage; explicit scalp wording remains in the rationale."
              ],
              "unknown_reason": null
            },
            "applicability_note": "Current DE Plus producer excerpt adds damp-hair five-minute rinse-before-shampoo instructions; exact 200 ml label, physical texture and cadence remain unresolved.",
            "direction_source_ids": [
              "R01",
              "C03-P04-1"
            ],
            "market_applicability": "exact_market"
          },
          "explanations_de": {
            "deeper": "Gezieltes Pre-Shampoo mit Zitronensäure und ergänzenden Inhaltsstoffen. Die Forschung betrifft die Technologie; die Wirkung dieser konkreten Quellenversion ist damit nicht isoliert bewiesen. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
            "concise": "Gezieltes Pre-Shampoo mit Zitronensäure und ergänzenden Inhaltsstoffen. Die Forschung betrifft die Technologie; die Wirkung dieser konkreten Quellenversion ist damit nicht isoliert bewiesen."
          },
          "technology_reference": {
            "status": "matched",
            "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
            "product_id": null,
            "source_ids": [
              "R01"
            ],
            "research_key": "P04",
            "formula_sha256": "e5e9b5e7c3d8882f12622bda11a67ace0ef1aeb37b9660bf881231966815ae00",
            "shared_markers": [
              "citric acid"
            ],
            "source_version": "2026-09-30:R01"
          }
        },
        "claim_trust_level": "medium",
        "technology_family": "acid_calcium_management",
        "bond_repair_intensity": null
      },
      "asset": {
        "id": "2337c9f6-5023-4753-8eab-39361ad11769",
        "notes": "Reviewed internal Bondbuilder staging asset",
        "created_at": "2026-10-04T08:37:19.548173+00:00",
        "product_id": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
        "public_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p04/l-oreal-paris-elvital-bond-repair-plus-keratin-festigendes-pre-shampoo-e9142599a202.webp",
        "updated_at": "2026-10-04T08:37:19.548173+00:00",
        "source_type": "brand",
        "asset_sha256": "e9142599a202375375a6f6974275c30aa2879ad5c65bd8cb32149f2264e5e236",
        "published_at": "2026-10-04T08:37:19.548173+00:00",
        "storage_path": "product-intake/2026-10-03/internal-bondbuilder-p04/l-oreal-paris-elvital-bond-repair-plus-keratin-festigendes-pre-shampoo-e9142599a202.webp",
        "user_approved": true,
        "storage_bucket": "product-images",
        "source_page_url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
        "source_image_url": "https://www.loreal-paris.de/-/media/project/loreal/brand-sites/oap/emea/dach/products/elvital/haarpflege/bond-repair/rescue-pre-shampoo/20260716-013d9dc1133c6387390ddf4581ef31beb77450ef.png",
        "manifest_batch_id": "bondbuilder-internal-admission-v1:e2da2a31-de86-4375-884e-9aa9f3cc47e0",
        "processing_method": "local",
        "quality_confidence": "high"
      },
      "product": {
        "id": "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
        "name": "L'Oréal Paris Elvital Bond Repair Plus Keratin-Festigendes Pre-Shampoo",
        "tags": [],
        "brand": "L'Oréal Paris",
        "origin": "curated",
        "brand_id": "385e04d6-2494-4e90-abd1-b59daf2c0c08",
        "category": null,
        "currency": "EUR",
        "tom_take": null,
        "embedding": null,
        "image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p04/l-oreal-paris-elvital-bond-repair-plus-keratin-festigendes-pre-shampoo-e9142599a202.webp",
        "is_active": true,
        "price_eur": 8.95,
        "created_at": "2026-10-04T08:37:19.548173+00:00",
        "sort_order": 0,
        "updated_at": "2026-10-05T17:58:43.413504+00:00",
        "description": null,
        "category_key": "bondbuilder",
        "affiliate_link": "https://www.mueller.de/p/elvital-pre-shampoo-bond-repair-2868614/",
        "product_line_id": "432f0dc7-2fbc-4208-b0ff-78876c248fd9",
        "lifecycle_status": "active",
        "net_content_unit": "ml",
        "price_checked_at": "2026-10-03T13:37:52+00:00",
        "net_content_value": 200,
        "short_description": null,
        "suitable_concerns": [],
        "thumbnail_image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/e9142599a202375375a6f6974275c30aa2879ad5c65bd8cb32149f2264e5e236.webp",
        "purchase_link_status": "available",
        "suitable_thicknesses": [],
        "is_chaarlie_recommended": false,
        "purchase_link_checked_at": "2026-10-03T13:37:52+00:00"
      },
      "protocols": [],
      "identifiers": [
        {
          "type": "gtin",
          "value": "3600524074517",
          "source": "Muller DE; exact pack binding retained in commercial research"
        },
        {
          "type": "retailer_url",
          "value": "https://www.mueller.de/p/elvital-pre-shampoo-bond-repair-2868614/",
          "source": "Muller DE"
        }
      ]
    },
    "preimage_sha256": "a45adca1f1a953f497f62f5d22badb36954570bf7dd1e11fc40baec2b8b698cf",
    "artifact_sha256": "74ba022a98e3298f420f5ee4b2e94055976e503bc9309718782dad7e2c1c0fb3"
  },
  {
    "artifact": {
      "researchKey": "P05",
      "productId": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
      "profile": {
        "fit": {
          "fine": {
            "value": null,
            "rationale": "P05: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "coarse": {
            "value": null,
            "rationale": "P05: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "normal": {
            "value": null,
            "rationale": "P05: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          }
        },
        "holds": {
          "fit": [
            {
              "code": "diameter_fit_unknown",
              "field": "fit",
              "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
              "source_ids": []
            }
          ],
          "boundary": [],
          "identity": [],
          "protocol": [],
          "claim_trust": []
        },
        "method": {
          "method_id": "bondbuilder-inci",
          "output_sha256": "665fcceafeaa8c6719c90e88fce38511ef8fffff5dc040f044d8e26bc3291ee5",
          "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
          "run_reference": "replay-2026-10-03-v0.5-r3",
          "method_version": "bondbuilder-inci-v0.5",
          "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
          "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
          "artifact_reference": "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/P05.json",
          "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
          "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
        },
        "review": {
          "checked_date": "2026-10-06",
          "reviewed_date": "2026-10-06",
          "profile_sha256": "665fcceafeaa8c6719c90e88fce38511ef8fffff5dc040f044d8e26bc3291ee5",
          "decision_references": [
            "recommendation-promotion-2026-10-06:reviewed-protocol-overlay"
          ]
        },
        "formula": {
          "status": "complete",
          "markers": [
            {
              "family": "acid_calcium_management",
              "literal": "citric acid",
              "source_ids": [
                "R09"
              ]
            },
            {
              "family": "acid_calcium_management",
              "literal": "sodium citrate",
              "source_ids": [
                "R09"
              ]
            }
          ],
          "raw_inci": "AQUA / WATER, CETEARYL ALCOHOL, GLYCERIN, BEHENTRIMONIUM CHLORIDE, STEARYL ALCOHOL, CITRIC ACID, CETYL ESTERS, SODIUM CITRATE, ISOPROPYL ALCOHOL, PARFUM / FRAGRANCE, PHENOXYETHANOL, POLYQUATERNIUM-10, POLYSORBATE 20, HYDROXYPROPYL GUAR, LIMONENE, LINALOOL",
          "conflicts": [
            {
              "reason": "Owner selected the exact Douglas DE 190 ml sixteen-ingredient source-version on 2026-09-30; displaced manufacturer list retained without merging.",
              "raw_inci": "AQUA / WATER • BEHENTRIMONIUM CHLORIDE • CETEARYL ALCOHOL • SODIUM CITRATE • CITRIC ACID • POLYQUATERNIUM-37 • OCTYLDODECANOL • POTATO STARCH MODIFIED • ISOPROPYL ALCOHOL • POLYSORBATE 20 • PROPYLENE GLYCOL DICAPRYLATE/DICAPRATE • PARFUM / FRAGRANCE • PANTHENOL • STEARAMIDOPROPYL DIMETHYLAMINE • CAPRYLYL GLYCOL • SALICYLIC ACID • PPG-1 TRIDECETH-6 • GLYCERYL STEARATE • LIMONENE • SORBITAN OLEATE • LINALOOL • CITRONELLOL (F.I.L. Y70018233/1).",
              "resolved": true,
              "source_ids": [
                "R02"
              ]
            }
          ],
          "raw_sha256": "1b7dde77c6067231ce009b330c2474d7f677edd08688471092589e94fd390c0b",
          "source_ids": [
            "R09"
          ],
          "normalized_sha256": "4a18ed3c6c724f3a79124871d2be9a576e5037ece1a8e90ad6cb5dbdf86c66cf",
          "candidate_families": [
            "acid_calcium_management"
          ],
          "normalization_version": "bondbuilder-inci-normalization-v1",
          "normalized_ingredients": [
            "aqua / water",
            "cetearyl alcohol",
            "glycerin",
            "behentrimonium chloride",
            "stearyl alcohol",
            "citric acid",
            "cetyl esters",
            "sodium citrate",
            "isopropyl alcohol",
            "parfum / fragrance",
            "phenoxyethanol",
            "polyquaternium-10",
            "polysorbate 20",
            "hydroxypropyl guar",
            "limonene",
            "linalool"
          ],
          "candidate_to_final_trace": [
            "Stage A candidates: acid_calcium_management.",
            "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
            "Final boundary: in_scope; family: acid_calcium_management; tier/basis: medium/owner_calibration."
          ]
        },
        "sources": [
          {
            "id": "E01",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
            "limitations": [
              "citric-acid technology",
              "publisher abstract and affiliations; full methods not audited",
              "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
            ],
            "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
            "checked_date": "2026-09-30",
            "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
          },
          {
            "id": "E02",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
            "limitations": [
              "gluconamide/gluconate model chemistry",
              "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
              "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
            ],
            "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
            "checked_date": "2026-09-30",
            "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
          },
          {
            "id": "E03",
            "url": "https://cris.unibo.it/handle/11585/796978",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
            "limitations": [
              "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
              "author-repository abstract inspected; full manuscript not audited",
              "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
            ],
            "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
          },
          {
            "id": "E04",
            "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University of Minho; funding/COI not independently audited here.",
            "limitations": [
              "generic keratin-peptide binding",
              "indexed publisher/PubMed abstract inspected; direct publisher 403",
              "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
            ],
            "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
            "checked_date": "2026-09-30",
            "commercial_context": "University of Minho; funding/COI not independently audited here."
          },
          {
            "id": "P01:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "P02:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "E06",
            "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
            "type": "supplier_primary_technical_poster",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland supplier-owned material; not independent retail testing.",
            "limitations": [
              "supplier paired-marker technology, not OGX/Aveda bottles",
              "indexed primary poster text; direct PDF timeout, graphs not inspected",
              "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
            ],
            "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
            "checked_date": "2026-09-30",
            "commercial_context": "Ashland supplier-owned material; not independent retail testing."
          },
          {
            "id": "E07",
            "url": "https://patents.google.com/patent/US11491092B2/en",
            "type": "inventor_patent",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "patent",
            "affiliation": "Inventor/patent-holder evidence, not independent validation.",
            "limitations": [
              "bis(2-ethylhexyl) maleate technology examples",
              "description/examples inspected",
              "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
            ],
            "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
            "checked_date": "2026-09-30",
            "commercial_context": "Inventor/patent-holder evidence, not independent validation."
          },
          {
            "id": "R01",
            "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R02",
            "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R03",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "UK manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R04",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R05",
            "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R06",
            "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R07",
            "url": "https://epres.com/products/bond-repair-treatment",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R08",
            "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R09",
            "url": "https://www.douglas.de/de/p/5011495045",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R10",
            "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "45ml treatment-style INCI, not a 250ml verification.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R11",
            "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R12",
            "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R13",
            "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R14",
            "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
            "type": "DE-language retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R15",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
            "type": "DE manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N01",
            "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase target 250ml; local retailer source version",
              "full ingredient and application text inspected",
              "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
            ],
            "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N02",
            "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase 250ml corroboration",
              "full ingredient and protocol text inspected by source researcher",
              "Retailer corroboration is not a clinical test or supplied-pack verification."
            ],
            "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N03",
            "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
              "researcher full listing; root indexed full ingredient text; root direct open failed",
              "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
            ],
            "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N04",
            "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
            "type": "same_identifier_EU_retailer_corroboration",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml EAN3574661818474, Norway; not a DE pack",
              "researcher full listing and ingredient text",
              "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
            ],
            "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N05",
            "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
            "type": "manufacturer_protocol",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "epres intended spray bottle/refill system",
              "full official description, FAQs and ingredient text inspected",
              "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
            ],
            "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "P01:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "P02:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "N07",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary_abstract_amendment",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
            "limitations": [
              "citric-acid technology, not any named retail treatment",
              "publisher abstract inspected; full text inaccessible",
              "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
            ],
            "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
            "checked_date": "2026-09-30",
            "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
          },
          {
            "id": "N08",
            "url": "https://linktr.ee/abbeyyung",
            "type": "creator_own_source",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "AbbeyYung promotional context",
              "own page inspected",
              "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
            ],
            "observation": "Own page lists an epres discount code and links to own channels.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N09",
            "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Abbey bond-repair routine includes epres/K18",
              "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
              "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
            ],
            "observation": "Creator/title/routine inclusion leads identified.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N10",
            "url": "https://olaplex.de/pages/hair-care-ambassadors",
            "type": "brand_relationship_disclosure",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
              "official text inspected",
              "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
            ],
            "observation": "Both named as ambassadors.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N11",
            "url": "https://olaplex.de/pages/dejangarz",
            "type": "brand_hosted_creator_endorsement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "No3PLUS in Dejan's favourites",
              "official text inspected",
              "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
            ],
            "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N12",
            "url": "https://whimsysoul.com/epres-bond-repair-review/",
            "type": "original_first_person_longer_use_review",
            "scope": "practice",
            "access": "full_text",
            "author": "Kara",
            "authority": "creator",
            "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
            "limitations": [
              "Kara's epres starter-kit hair experience; article dated2026-04-12",
              "original article text inspected",
              "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
            ],
            "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
          },
          {
            "id": "F01",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "product description, directions and INCI inspected 2026-10-01",
              "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
            ],
            "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "F02",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "product description, directions and INCI inspected 2026-10-01",
              "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
            ],
            "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-REDKEN-AU",
            "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "AU product directions, not DE pack",
              "product directions inspected 2026-10-01",
              "Cross-market complement; no concentration equality or binding DE cadence."
            ],
            "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-DE",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE manufacturer complement with format/formula applicability limits",
              "FAQ and directions inspected 2026-10-01",
              "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
            ],
            "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-US",
            "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
            "type": "brand_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "Kérastase brand education manager",
            "limitations": [
              "Commercially affiliated US professional usage advice",
              "named brand education manager advice inspected 2026-09-30",
              "Not independent efficacy testing or a binding DE pack schedule."
            ],
            "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
            "checked_date": "2026-09-30",
            "commercial_context": "Kérastase brand education manager"
          },
          {
            "id": "A-JUUT",
            "url": "https://juut.com/blog/damaged-hair-repair/",
            "type": "commercial_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "JUUT / Aveda",
            "limitations": [
              "Aveda product practice",
              "named stylist experiences inspected 2026-09-30",
              "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
            ],
            "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
            "checked_date": "2026-09-30",
            "commercial_context": "JUUT / Aveda"
          },
          {
            "id": "A-REDKEN-CREATOR",
            "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Redken treatment listing only",
              "product listing inspected; detailed verdict uninspected",
              "No positive long-term or efficacy conclusion may be extracted."
            ],
            "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "A-ELVITAL-EDITORIAL",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue editorial guidance",
              "editorial applicability inspected 2026-09-30",
              "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
            ],
            "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-ELVITAL-WEEKLY",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue weekly advice",
              "editorial applicability inspected 2026-09-30",
              "Exact product-version applicability is unresolved; do not impose weekly use."
            ],
            "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "S01",
            "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith EU",
            "limitations": [
              "Actual pack not supplied; manufacturer warns that formula lists can change.",
              "Product title salve does not itself establish an applied cream texture.",
              "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S02",
            "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith DE",
            "limitations": [
              "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
              "Original scope: DE 237 ml listing and translated formula/directions",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S03",
            "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
            "type": "brand_owner_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": "dm / Balea",
            "limitations": [
              "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
              "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
            ],
            "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S04",
            "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Garnier DE / L'Oréal",
            "limitations": [
              "Rich formula is a description, not enough to certify cream texture.",
              "No actual pack.",
              "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S05",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
              "Concentration label is a branded complex claim, not ingredient dose.",
              "No study protocol, comparator or data inspected.",
              "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S06",
            "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
            "type": "manufacturer_editorial",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": "Sharley Butcher",
            "authority": "manufacturer",
            "affiliation": "Curlsmith / Sharley Butcher",
            "limitations": [
              "Not an inspected peer-reviewed study.",
              "Select current local product directions, retaining this differing editorial separately.",
              "Original scope: manufacturer editorial and historical study disclosure",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
            ],
            "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S07",
            "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
            "type": "supplier_document",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland, hosted by distributor ChemPoint",
            "limitations": [
              "This is not Curlsmith's formulation, supplier verification or product dose.",
              "Stability testing is not an efficacy trial.",
              "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
            ],
            "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S08",
            "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
            "type": "supplier_statement",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland",
            "limitations": [
              "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
              "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
              "Original scope: supplier press release 2024-02-22, technology scope",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
            ],
            "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S09",
            "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
            "type": "original_creator_statement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": "Gena Marie",
            "authority": "creator",
            "affiliation": "Gena Marie",
            "limitations": [
              "Historical formula/market not bound to current EU version.",
              "Article inspected; linked video not independently watched.",
              "Not an Abbey Yung endorsement.",
              "Original scope: original written sponsored creator comparison, 2021-01-03",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
            ],
            "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
            "checked_date": "2026-10-02",
            "commercial_context": "sponsored post; affiliate links"
          },
          {
            "id": "S10",
            "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
              "Original scope: original anecdotal discussion, historical unspecified pack",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown; do not infer independence"
          },
          {
            "id": "S11",
            "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
              "Original scope: historical anecdote with alternating treatment system",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown"
          },
          {
            "id": "S12",
            "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
            "type": "manufacturer_professional_document",
            "scope": "system",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Different test scopes retained, not combined as serum-alone results.",
              "No original methods, full data or current formula equivalence inspected.",
              "Original scope: historical professional service leaflet",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
            ],
            "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S13",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "manufacturer_application_amendment",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
              "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
              "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
              "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
              "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
            ],
            "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
            "checked_date": "2026-10-02",
            "commercial_context": "maker sells the product"
          },
          {
            "id": "C03-P05-1",
            "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
            "type": "producer_direction_complement_de",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Redken Germany",
            "limitations": [
              "Protocol source only; no formula version selected or replaced.",
              "190 ml pack size is not exposed in inspected page text.",
              "No specific hair region, distribution method, quantity, texture or cadence is given in the inspected instructions.",
              "Source market: DE. Bound to producer-source-complement-2026-10-03/C03-P05-1; application directions only."
            ],
            "observation": "Producer positions Acidic Bonding Concentrate Intensive Treatment as a pretreatment before the line's shampoo and conditioner. Apply to damp hair; retain for 5–10 minutes and rinse. Continue with Redken Acidic Bonding Concentrate Shampoo and Conditioner.",
            "checked_date": "2026-10-03",
            "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
          }
        ],
        "version": "bondbuilder-research-profile-v1",
        "evidence": {
          "detail": "The exact Douglas 190 ml target is owner-selected; displaced R02 manufacturer formula is retained resolved and not merged. Citric-acid abstract findings remain technology-level. AU cadence is a cross-market complement; an inaccessible creator listing provides no verdict.",
          "summary": "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
          "cautions": [
            "No native-bond restoration, product superiority or active dose is established by the family label.",
            "Resolved formula selection is not resolution of missing application detail.",
            "No isolated selected-product effect size or concentration is established."
          ],
          "practical": {
            "limitations": [
              "No inspected original applicable practice verdict supports a benefit claim. Missing or inaccessible opinions are neutral."
            ],
            "counter_source_ids": [],
            "supporting_source_ids": []
          },
          "scientific": {
            "limitations": [
              "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
              "Resolved formula selection is not resolution of missing application detail.",
              "No isolated selected-product effect size or concentration is established."
            ],
            "counter_source_ids": [],
            "supporting_source_ids": [
              "N07"
            ]
          },
          "applicability": [
            {
              "scope": "technology",
              "bridge": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
              "source_ids": [
                "N07"
              ],
              "limitations": [
                "citric-acid technology, not any named retail treatment",
                "publisher abstract inspected; full text inaccessible",
                "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
              ]
            },
            {
              "scope": "product",
              "bridge": "Full materially different Redken INCI, directions; not merged with manufacturer.",
              "source_ids": [
                "R09"
              ],
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ]
            },
            {
              "scope": "product",
              "bridge": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
              "source_ids": [
                "A-REDKEN-AU"
              ],
              "limitations": [
                "AU product directions, not DE pack",
                "product directions inspected 2026-10-01",
                "Cross-market complement; no concentration equality or binding DE cadence."
              ]
            },
            {
              "scope": "product",
              "bridge": "Full manufacturer INCI and formula code; conflict with R09 retained.",
              "source_ids": [
                "R02"
              ],
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ]
            }
          ],
          "supported_outcome": "Acid-family reinforcement plausibility with limited exact-product evidence for selected Douglas formula.",
          "manufacturer_positioning": [
            "R09: Full materially different Redken INCI, directions; not merged with manufacturer.",
            "A-REDKEN-AU: AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions."
          ]
        },
        "identity": {
          "gtin": null,
          "size": "190 ml",
          "brand": "Redken",
          "market": "DE",
          "status": "resolved",
          "product_id": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
          "product_name": "Redken Acidic Bonding Concentrate Intensive Treatment",
          "research_key": "P05",
          "source_version": "2026-09-30:R09"
        },
        "assessment": {
          "reasoning": {
            "trust_basis": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "R09"
              ],
              "assumptions": [],
              "limitations": []
            },
            "intended_role": {
              "rationale": "Producer application amendment establishes treatment_role.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "assumptions": [],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ]
            },
            "fit_assessment": {
              "rationale": "No source-supported diameter-specific suitability values are present. Damage, curl pattern, porosity and format do not establish diameter fit.",
              "confidence": "low",
              "source_ids": [],
              "assumptions": [],
              "limitations": [
                "All three diameter values remain null; this is not a finding of unsuitability."
              ]
            },
            "product_format": {
              "rationale": "P05: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "assumptions": [],
              "limitations": []
            },
            "treatment_mode": {
              "rationale": "Producer application amendment establishes rinse.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "assumptions": [],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ]
            },
            "boundary_status": {
              "rationale": "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
              "confidence": "moderate",
              "source_ids": [
                "R09",
                "A-REDKEN-AU"
              ],
              "assumptions": [],
              "limitations": [
                "Resolved formula selection is not resolution of missing application detail.",
                "No isolated selected-product effect size or concentration is established."
              ]
            },
            "application_mode": {
              "rationale": "Producer application amendment establishes placement.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "assumptions": [],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ]
            },
            "evidence_profile": {
              "rationale": "The exact Douglas 190 ml target is owner-selected; displaced R02 manufacturer formula is retained resolved and not merged. Citric-acid abstract findings remain technology-level. AU cadence is a cross-market complement; an inaccessible creator listing provides no verdict.",
              "confidence": "moderate",
              "source_ids": [
                "N07",
                "R09",
                "A-REDKEN-AU",
                "R02"
              ],
              "assumptions": [],
              "limitations": [
                "Duplicate captures of one study are not independent trials."
              ]
            },
            "application_facts": {
              "rationale": "Producer application amendment supplies direction sources; 7 application fact wrappers remain unknown.",
              "confidence": "moderate",
              "source_ids": [
                "R09",
                "C03-P05-1"
              ],
              "assumptions": [],
              "limitations": [
                "Remaining application unknowns are retained; no fact was inferred."
              ]
            },
            "claim_trust_level": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "R09"
              ],
              "assumptions": [],
              "limitations": [
                "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
              ]
            },
            "supported_outcome": {
              "rationale": "Acid-family reinforcement plausibility with limited exact-product evidence for selected Douglas formula.",
              "confidence": "moderate",
              "source_ids": [
                "N07",
                "R09",
                "A-REDKEN-AU"
              ],
              "assumptions": [],
              "limitations": [
                "Resolved formula selection is not resolution of missing application detail.",
                "No isolated selected-product effect size or concentration is established."
              ]
            },
            "technology_family": {
              "rationale": "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
              "confidence": "moderate",
              "source_ids": [
                "R09"
              ],
              "assumptions": [],
              "limitations": [
                "Marker presence does not establish concentration, supplier, delivery or molecular effect."
              ]
            }
          },
          "trust_basis": "owner_calibration",
          "boundary_status": "in_scope",
          "limiting_factors": [
            "Resolved formula selection is not resolution of missing application detail.",
            "No isolated selected-product effect size or concentration is established."
          ],
          "policy_reference": "owner-review-2026-09-30:P05",
          "claim_trust_level": "medium",
          "technology_family": "acid_calcium_management",
          "classification_confidence": "moderate"
        },
        "application": {
          "rinse": {
            "value": {
              "treatment_mode": "rinse_out",
              "standalone_treatment_rinse": true
            },
            "rationale": "Producer specifies treatment rinsing before continuing with shampoo.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page."
            ],
            "unknown_reason": null
          },
          "amount": {
            "value": null,
            "rationale": "P05: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "timing": {
            "value": {
              "kind": "range_seconds",
              "purpose": "contact",
              "maximum_seconds": 600,
              "minimum_seconds": 300
            },
            "rationale": "Retain for five to ten minutes, then rinse.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page."
            ],
            "unknown_reason": null
          },
          "cadence": {
            "value": null,
            "rationale": "No exact DE cadence is reproduced. AU 2–3 uses weekly remains a cross-market complement, not a binding DE schedule.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "No exact DE cadence is reproduced. AU 2–3 uses weekly remains a cross-market complement, not a binding DE schedule."
          },
          "dilution": {
            "value": null,
            "rationale": "P05: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "partners": {
            "value": [
              {
                "name": "Redken Acidic Bonding Concentrate Shampoo",
                "source_ids": [
                  "C03-P05-1"
                ],
                "requirement": "recommended",
                "exclusivity_established": false
              },
              {
                "name": "Redken Acidic Bonding Concentrate Conditioner",
                "source_ids": [
                  "C03-P05-1"
                ],
                "requirement": "recommended",
                "exclusivity_established": false
              }
            ],
            "rationale": "Producer names the line's shampoo and conditioner.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page.",
              "No exclusive dependency or molecular efficacy conclusion inferred."
            ],
            "unknown_reason": null
          },
          "sequence": {
            "value": [
              {
                "note": "Apply the Intensive Treatment to damp hair.",
                "action": "apply_treatment",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P05-1"
                ]
              },
              {
                "note": "Retain for the stated interval.",
                "action": "wait",
                "timing": {
                  "kind": "range_seconds",
                  "purpose": "contact",
                  "maximum_seconds": 600,
                  "minimum_seconds": 300
                },
                "optional": false,
                "source_ids": [
                  "C03-P05-1"
                ]
              },
              {
                "note": "Rinse the treatment before shampoo.",
                "action": "rinse",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P05-1"
                ]
              },
              {
                "note": "Continue with the producer-named shampoo.",
                "action": "shampoo",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P05-1"
                ]
              },
              {
                "note": "Then use the producer-named conditioner.",
                "action": "apply_conditioner",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P05-1"
                ]
              }
            ],
            "rationale": "Damp-hair treatment precedes a five-to-ten-minute interval, rinse, shampoo and conditioner.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page."
            ],
            "unknown_reason": null
          },
          "placement": {
            "value": "pre_shampoo",
            "rationale": "Producer describes a pretreatment before shampoo and conditioner.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page."
            ],
            "unknown_reason": null
          },
          "hair_state": {
            "value": "damp",
            "rationale": "Producer directs application to damp hair.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page."
            ],
            "unknown_reason": null
          },
          "conditioner": {
            "value": {
              "after": "recommended",
              "before": "not_stated",
              "guidance_reference": null,
              "minimum_wait_seconds": null
            },
            "rationale": "After treatment rinsing and shampoo, continue with conditioner.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page."
            ],
            "unknown_reason": null
          },
          "longer_wear": {
            "value": null,
            "rationale": "P05: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "distribution": {
            "value": null,
            "rationale": "P05: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "source_market": "DE",
          "applied_format": {
            "value": null,
            "rationale": "P05: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "treatment_role": {
            "value": "pre_shampoo_treatment",
            "rationale": "The named Intensive Treatment has an explicit specialized pre-shampoo pretreatment role.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page."
            ],
            "unknown_reason": null
          },
          "source_variants": [
            {
              "market": "DE",
              "selected": true,
              "source_ids": [
                "R09"
              ],
              "differences": "Selected 190 ml sixteen-ingredient retailer formula; the displaced manufacturer formula is not merged."
            },
            {
              "market": "DE",
              "selected": false,
              "source_ids": [
                "R02"
              ],
              "differences": "Different manufacturer INCI retained as resolved displaced history under the exact owner selection."
            },
            {
              "market": "AU",
              "selected": false,
              "source_ids": [
                "A-REDKEN-AU"
              ],
              "differences": "Two to three uses weekly; roots/wet/lather wording differs from selected Douglas directions. No concentration equality or binding DE cadence."
            },
            {
              "market": "DE",
              "selected": true,
              "source_ids": [
                "C03-P05-1"
              ],
              "differences": "Same named DE Intensive Treatment protocol selected as a bounded producer complement. Neither its formula block nor an unverified 190 ml pack replaces the selected R09 identity."
            }
          ],
          "state_modifiers": {
            "value": null,
            "rationale": "P05: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P05: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "application_area": {
            "value": "hair",
            "rationale": "Producer says to apply to hair without a narrower anatomical area.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P05-1"
            ],
            "limitations": [
              "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
              "190 ml size and exact selected formula-version instructions are not independently bound by this page.",
              "Hair is the broad schema value; no scalp, root or ends restriction inferred."
            ],
            "unknown_reason": null
          },
          "applicability_note": "DE manufacturer protocol complements the selected retailer source: specialized pre-shampoo treatment, damp hair, 5–10 minutes then rinse and shampoo/conditioner. Exact formula/pack equality is not asserted.",
          "direction_source_ids": [
            "R09",
            "C03-P05-1"
          ],
          "market_applicability": "exact_market"
        },
        "explanations_de": {
          "deeper": "Gezielte Säure-Behandlung der ausgewählten Douglas-Version mit 190 ml. Die abweichende Herstellerliste bleibt getrennt; die mittlere Einstufung gilt nur für die genau gebundene Quellenversion. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
          "concise": "Gezielte Säure-Behandlung der ausgewählten Douglas-Version mit 190 ml. Die abweichende Herstellerliste bleibt getrennt; die mittlere Einstufung gilt nur für die genau gebundene Quellenversion."
        },
        "technology_reference": {
          "status": "matched",
          "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
          "product_id": null,
          "source_ids": [
            "R01"
          ],
          "research_key": "P04",
          "formula_sha256": "e5e9b5e7c3d8882f12622bda11a67ace0ef1aeb37b9660bf881231966815ae00",
          "shared_markers": [
            "citric acid"
          ],
          "source_version": "2026-09-30:R01"
        }
      },
      "spec": {
        "application_mode": "pre_shampoo",
        "treatment_mode": "rinse_out",
        "usage_protocol": "verified_product_protocol"
      },
      "protocolV1": {
        "schemaVersion": 1,
        "guidanceKey": "v2-exact-bondbuilder_verified_product-9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
        "protocolVersion": 2,
        "locale": "de",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f"
        },
        "role": "bond_repair",
        "applicationFamily": "pre_shampoo_single_treatment",
        "compatibleDayTypes": [
          "bond_repair_day"
        ],
        "exactGuidanceRequired": true,
        "sequence": {
          "anchor": "pre_wash",
          "before": [],
          "after": [],
          "conflictsWith": []
        },
        "requirements": {
          "requiredCatalogFacts": [],
          "requiredProtocolFacts": [],
          "requiredProfileFacts": []
        },
        "protocolFacts": {
          "applicationArea": "all_hair",
          "rinse": "rinse_out",
          "contactTimeSeconds": null,
          "contactTime": {
            "kind": "range_seconds",
            "minimumSeconds": 300,
            "maximumSeconds": 600
          },
          "applicationState": "damp_hair",
          "treatmentRinse": "rinse_out",
          "conditionerSequence": {
            "before": "not_stated",
            "after": "recommended",
            "minimumWaitSeconds": null
          },
          "shampooAfterTreatment": "rinse_then_shampoo",
          "conditionerRelationship": "not_applicable",
          "reapplication": "none",
          "amount": null,
          "workflowId": "bondbuilder_verified_product",
          "cautions": []
        },
        "steps": [
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyTemplateDe": "Auf das feuchte Haar geben und im Haar verteilen."
          },
          {
            "stepKey": "wait",
            "action": "wait",
            "copyTemplateDe": "5 Minuten bis 10 Minuten einwirken lassen."
          },
          {
            "stepKey": "rinse-treatment",
            "action": "rinse",
            "copyTemplateDe": "Die Behandlung gründlich ausspülen."
          },
          {
            "stepKey": "shampoo-after",
            "action": "section",
            "copyTemplateDe": "Anschließend wie gewohnt mit Shampoo waschen und pflegen."
          },
          {
            "stepKey": "conditioner-after",
            "action": "section",
            "copyTemplateDe": "Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen."
          }
        ],
        "evidence": [
          {
            "sourceUrl": "https://www.douglas.de/de/p/5011495045",
            "sourceType": "retailer",
            "checkedAt": "2026-09-30"
          },
          {
            "sourceUrl": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-03"
          }
        ]
      },
      "protocolV2": {
        "schemaVersion": 2,
        "contractKind": "product_pointer",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f"
        },
        "sourceRole": "specialized_bond_treatment",
        "role": "bond_repair",
        "applicationFamily": "pre_shampoo_single_treatment",
        "facts": {
          "applicationState": "damp_hair",
          "applicationArea": "root_to_tip_hair",
          "rinse": "rinse_out",
          "contactTime": {
            "kind": "range_seconds",
            "minimumSeconds": 300,
            "maximumSeconds": 600
          },
          "amount": null,
          "heat": null,
          "conditionerSequence": {
            "before": "not_stated",
            "after": "recommended",
            "minimumWaitSeconds": null
          },
          "shampooAfterTreatment": "rinse_then_shampoo",
          "conditionerPolicy": "not_applicable"
        },
        "workflowId": "bondbuilder_verified_product",
        "requiredCompanionProductId": null,
        "runtimeBlockerCode": null,
        "exactSteps": [
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyDe": "Auf das feuchte Haar geben und im Haar verteilen."
          },
          {
            "stepKey": "wait",
            "action": "wait",
            "copyDe": "5 Minuten bis 10 Minuten einwirken lassen."
          },
          {
            "stepKey": "rinse-treatment",
            "action": "rinse",
            "copyDe": "Die Behandlung gründlich ausspülen."
          },
          {
            "stepKey": "shampoo-after",
            "action": "section",
            "copyDe": "Anschließend wie gewohnt mit Shampoo waschen und pflegen."
          },
          {
            "stepKey": "conditioner-after",
            "action": "section",
            "copyDe": "Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen."
          }
        ],
        "cautionCodes": [],
        "evidence": [
          {
            "sourceUrl": "https://www.douglas.de/de/p/5011495045",
            "sourceType": "retailer",
            "checkedAt": "2026-09-30"
          },
          {
            "sourceUrl": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-03"
          }
        ]
      },
      "cadence": null,
      "eligibleThicknesses": [
        "fine",
        "normal",
        "coarse"
      ],
      "source": {
        "source_url": "https://www.douglas.de/de/p/5011495045",
        "source_text": "Full materially different Redken INCI, directions; not merged with manufacturer."
      },
      "removedProtocolHolds": [
        "application.applied_format",
        "application.state_modifiers",
        "application.distribution",
        "application.longer_wear",
        "application.amount",
        "application.dilution",
        "application.cadence"
      ]
    },
    "preimage": {
      "spec": {
        "created_at": "2026-10-04T08:37:55.358559+00:00",
        "product_id": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
        "updated_at": "2026-10-04T08:37:55.358559+00:00",
        "trust_basis": "owner_calibration",
        "category_key": "bondbuilder",
        "product_format": null,
        "treatment_mode": "rinse_out",
        "usage_protocol": null,
        "application_mode": "pre_shampoo",
        "bond_repair_axis": null,
        "research_profile": {
          "fit": {
            "fine": {
              "value": null,
              "rationale": "P05: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "coarse": {
              "value": null,
              "rationale": "P05: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "normal": {
              "value": null,
              "rationale": "P05: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            }
          },
          "holds": {
            "fit": [
              {
                "code": "diameter_fit_unknown",
                "field": "fit",
                "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
                "source_ids": []
              }
            ],
            "boundary": [],
            "identity": [],
            "protocol": [
              {
                "code": "source_fact_unknown",
                "field": "application.applied_format",
                "reason": "P05: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.state_modifiers",
                "reason": "P05: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.distribution",
                "reason": "P05: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.longer_wear",
                "reason": "P05: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.amount",
                "reason": "P05: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.dilution",
                "reason": "P05: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.cadence",
                "reason": "No exact DE cadence is reproduced. AU 2–3 uses weekly remains a cross-market complement, not a binding DE schedule.",
                "source_ids": []
              }
            ],
            "claim_trust": []
          },
          "method": {
            "method_id": "bondbuilder-inci",
            "output_sha256": "ebf4d9b69ebc9b3e003ac247abff4169f67ba67912f4d6a7ad7821c3969e1ed7",
            "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
            "run_reference": "replay-2026-10-03-v0.5-r3",
            "method_version": "bondbuilder-inci-v0.5",
            "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
            "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
            "artifact_reference": "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/lane-b/assembled/P05.json",
            "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
            "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
          },
          "review": {
            "checked_date": "2026-10-03",
            "reviewed_date": null,
            "profile_sha256": "ebf4d9b69ebc9b3e003ac247abff4169f67ba67912f4d6a7ad7821c3969e1ed7",
            "decision_references": []
          },
          "formula": {
            "status": "complete",
            "markers": [
              {
                "family": "acid_calcium_management",
                "literal": "citric acid",
                "source_ids": [
                  "R09"
                ]
              },
              {
                "family": "acid_calcium_management",
                "literal": "sodium citrate",
                "source_ids": [
                  "R09"
                ]
              }
            ],
            "raw_inci": "AQUA / WATER, CETEARYL ALCOHOL, GLYCERIN, BEHENTRIMONIUM CHLORIDE, STEARYL ALCOHOL, CITRIC ACID, CETYL ESTERS, SODIUM CITRATE, ISOPROPYL ALCOHOL, PARFUM / FRAGRANCE, PHENOXYETHANOL, POLYQUATERNIUM-10, POLYSORBATE 20, HYDROXYPROPYL GUAR, LIMONENE, LINALOOL",
            "conflicts": [
              {
                "reason": "Owner selected the exact Douglas DE 190 ml sixteen-ingredient source-version on 2026-09-30; displaced manufacturer list retained without merging.",
                "raw_inci": "AQUA / WATER • BEHENTRIMONIUM CHLORIDE • CETEARYL ALCOHOL • SODIUM CITRATE • CITRIC ACID • POLYQUATERNIUM-37 • OCTYLDODECANOL • POTATO STARCH MODIFIED • ISOPROPYL ALCOHOL • POLYSORBATE 20 • PROPYLENE GLYCOL DICAPRYLATE/DICAPRATE • PARFUM / FRAGRANCE • PANTHENOL • STEARAMIDOPROPYL DIMETHYLAMINE • CAPRYLYL GLYCOL • SALICYLIC ACID • PPG-1 TRIDECETH-6 • GLYCERYL STEARATE • LIMONENE • SORBITAN OLEATE • LINALOOL • CITRONELLOL (F.I.L. Y70018233/1).",
                "resolved": true,
                "source_ids": [
                  "R02"
                ]
              }
            ],
            "raw_sha256": "1b7dde77c6067231ce009b330c2474d7f677edd08688471092589e94fd390c0b",
            "source_ids": [
              "R09"
            ],
            "normalized_sha256": "4a18ed3c6c724f3a79124871d2be9a576e5037ece1a8e90ad6cb5dbdf86c66cf",
            "candidate_families": [
              "acid_calcium_management"
            ],
            "normalization_version": "bondbuilder-inci-normalization-v1",
            "normalized_ingredients": [
              "aqua / water",
              "cetearyl alcohol",
              "glycerin",
              "behentrimonium chloride",
              "stearyl alcohol",
              "citric acid",
              "cetyl esters",
              "sodium citrate",
              "isopropyl alcohol",
              "parfum / fragrance",
              "phenoxyethanol",
              "polyquaternium-10",
              "polysorbate 20",
              "hydroxypropyl guar",
              "limonene",
              "linalool"
            ],
            "candidate_to_final_trace": [
              "Stage A candidates: acid_calcium_management.",
              "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
              "Final boundary: in_scope; family: acid_calcium_management; tier/basis: medium/owner_calibration."
            ]
          },
          "sources": [
            {
              "id": "E01",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
              "limitations": [
                "citric-acid technology",
                "publisher abstract and affiliations; full methods not audited",
                "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
              ],
              "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
              "checked_date": "2026-09-30",
              "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
            },
            {
              "id": "E02",
              "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
              "limitations": [
                "gluconamide/gluconate model chemistry",
                "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
              ],
              "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
              "checked_date": "2026-09-30",
              "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
            },
            {
              "id": "E03",
              "url": "https://cris.unibo.it/handle/11585/796978",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
              "limitations": [
                "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
                "author-repository abstract inspected; full manuscript not audited",
                "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
              ],
              "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
            },
            {
              "id": "E04",
              "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University of Minho; funding/COI not independently audited here.",
              "limitations": [
                "generic keratin-peptide binding",
                "indexed publisher/PubMed abstract inspected; direct publisher 403",
                "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
              ],
              "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
              "checked_date": "2026-09-30",
              "commercial_context": "University of Minho; funding/COI not independently audited here."
            },
            {
              "id": "P01:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "P02:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "E06",
              "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
              "type": "supplier_primary_technical_poster",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland supplier-owned material; not independent retail testing.",
              "limitations": [
                "supplier paired-marker technology, not OGX/Aveda bottles",
                "indexed primary poster text; direct PDF timeout, graphs not inspected",
                "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
              ],
              "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
              "checked_date": "2026-09-30",
              "commercial_context": "Ashland supplier-owned material; not independent retail testing."
            },
            {
              "id": "E07",
              "url": "https://patents.google.com/patent/US11491092B2/en",
              "type": "inventor_patent",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "patent",
              "affiliation": "Inventor/patent-holder evidence, not independent validation.",
              "limitations": [
                "bis(2-ethylhexyl) maleate technology examples",
                "description/examples inspected",
                "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
              ],
              "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
              "checked_date": "2026-09-30",
              "commercial_context": "Inventor/patent-holder evidence, not independent validation."
            },
            {
              "id": "R01",
              "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R02",
              "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R03",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "UK manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R04",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R05",
              "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R06",
              "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R07",
              "url": "https://epres.com/products/bond-repair-treatment",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R08",
              "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R09",
              "url": "https://www.douglas.de/de/p/5011495045",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R10",
              "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "45ml treatment-style INCI, not a 250ml verification.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R11",
              "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R12",
              "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R13",
              "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R14",
              "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
              "type": "DE-language retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R15",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
              "type": "DE manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N01",
              "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase target 250ml; local retailer source version",
                "full ingredient and application text inspected",
                "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
              ],
              "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N02",
              "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase 250ml corroboration",
                "full ingredient and protocol text inspected by source researcher",
                "Retailer corroboration is not a clinical test or supplied-pack verification."
              ],
              "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N03",
              "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
                "researcher full listing; root indexed full ingredient text; root direct open failed",
                "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
              ],
              "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N04",
              "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
              "type": "same_identifier_EU_retailer_corroboration",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml EAN3574661818474, Norway; not a DE pack",
                "researcher full listing and ingredient text",
                "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
              ],
              "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N05",
              "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
              "type": "manufacturer_protocol",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "epres intended spray bottle/refill system",
                "full official description, FAQs and ingredient text inspected",
                "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
              ],
              "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "P01:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "P02:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "N07",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary_abstract_amendment",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
              "limitations": [
                "citric-acid technology, not any named retail treatment",
                "publisher abstract inspected; full text inaccessible",
                "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
              ],
              "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
              "checked_date": "2026-09-30",
              "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
            },
            {
              "id": "N08",
              "url": "https://linktr.ee/abbeyyung",
              "type": "creator_own_source",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "AbbeyYung promotional context",
                "own page inspected",
                "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
              ],
              "observation": "Own page lists an epres discount code and links to own channels.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N09",
              "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Abbey bond-repair routine includes epres/K18",
                "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
                "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
              ],
              "observation": "Creator/title/routine inclusion leads identified.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N10",
              "url": "https://olaplex.de/pages/hair-care-ambassadors",
              "type": "brand_relationship_disclosure",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
                "official text inspected",
                "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
              ],
              "observation": "Both named as ambassadors.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N11",
              "url": "https://olaplex.de/pages/dejangarz",
              "type": "brand_hosted_creator_endorsement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "No3PLUS in Dejan's favourites",
                "official text inspected",
                "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
              ],
              "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N12",
              "url": "https://whimsysoul.com/epres-bond-repair-review/",
              "type": "original_first_person_longer_use_review",
              "scope": "practice",
              "access": "full_text",
              "author": "Kara",
              "authority": "creator",
              "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
              "limitations": [
                "Kara's epres starter-kit hair experience; article dated2026-04-12",
                "original article text inspected",
                "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
              ],
              "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
            },
            {
              "id": "F01",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
                "product description, directions and INCI inspected 2026-10-01",
                "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
              ],
              "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "F02",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
                "product description, directions and INCI inspected 2026-10-01",
                "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
              ],
              "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-REDKEN-AU",
              "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "AU product directions, not DE pack",
                "product directions inspected 2026-10-01",
                "Cross-market complement; no concentration equality or binding DE cadence."
              ],
              "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-DE",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE manufacturer complement with format/formula applicability limits",
                "FAQ and directions inspected 2026-10-01",
                "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
              ],
              "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-US",
              "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
              "type": "brand_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "Kérastase brand education manager",
              "limitations": [
                "Commercially affiliated US professional usage advice",
                "named brand education manager advice inspected 2026-09-30",
                "Not independent efficacy testing or a binding DE pack schedule."
              ],
              "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
              "checked_date": "2026-09-30",
              "commercial_context": "Kérastase brand education manager"
            },
            {
              "id": "A-JUUT",
              "url": "https://juut.com/blog/damaged-hair-repair/",
              "type": "commercial_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "JUUT / Aveda",
              "limitations": [
                "Aveda product practice",
                "named stylist experiences inspected 2026-09-30",
                "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
              ],
              "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
              "checked_date": "2026-09-30",
              "commercial_context": "JUUT / Aveda"
            },
            {
              "id": "A-REDKEN-CREATOR",
              "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Redken treatment listing only",
                "product listing inspected; detailed verdict uninspected",
                "No positive long-term or efficacy conclusion may be extracted."
              ],
              "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "A-ELVITAL-EDITORIAL",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue editorial guidance",
                "editorial applicability inspected 2026-09-30",
                "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
              ],
              "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-ELVITAL-WEEKLY",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue weekly advice",
                "editorial applicability inspected 2026-09-30",
                "Exact product-version applicability is unresolved; do not impose weekly use."
              ],
              "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "S01",
              "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith EU",
              "limitations": [
                "Actual pack not supplied; manufacturer warns that formula lists can change.",
                "Product title salve does not itself establish an applied cream texture.",
                "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S02",
              "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith DE",
              "limitations": [
                "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
                "Original scope: DE 237 ml listing and translated formula/directions",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S03",
              "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
              "type": "brand_owner_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": "dm / Balea",
              "limitations": [
                "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
                "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
              ],
              "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S04",
              "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Garnier DE / L'Oréal",
              "limitations": [
                "Rich formula is a description, not enough to certify cream texture.",
                "No actual pack.",
                "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S05",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
                "Concentration label is a branded complex claim, not ingredient dose.",
                "No study protocol, comparator or data inspected.",
                "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S06",
              "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
              "type": "manufacturer_editorial",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": "Sharley Butcher",
              "authority": "manufacturer",
              "affiliation": "Curlsmith / Sharley Butcher",
              "limitations": [
                "Not an inspected peer-reviewed study.",
                "Select current local product directions, retaining this differing editorial separately.",
                "Original scope: manufacturer editorial and historical study disclosure",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
              ],
              "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S07",
              "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
              "type": "supplier_document",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland, hosted by distributor ChemPoint",
              "limitations": [
                "This is not Curlsmith's formulation, supplier verification or product dose.",
                "Stability testing is not an efficacy trial.",
                "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
              ],
              "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S08",
              "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
              "type": "supplier_statement",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland",
              "limitations": [
                "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
                "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
                "Original scope: supplier press release 2024-02-22, technology scope",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
              ],
              "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S09",
              "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
              "type": "original_creator_statement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": "Gena Marie",
              "authority": "creator",
              "affiliation": "Gena Marie",
              "limitations": [
                "Historical formula/market not bound to current EU version.",
                "Article inspected; linked video not independently watched.",
                "Not an Abbey Yung endorsement.",
                "Original scope: original written sponsored creator comparison, 2021-01-03",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
              ],
              "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
              "checked_date": "2026-10-02",
              "commercial_context": "sponsored post; affiliate links"
            },
            {
              "id": "S10",
              "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
                "Original scope: original anecdotal discussion, historical unspecified pack",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown; do not infer independence"
            },
            {
              "id": "S11",
              "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
                "Original scope: historical anecdote with alternating treatment system",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown"
            },
            {
              "id": "S12",
              "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
              "type": "manufacturer_professional_document",
              "scope": "system",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Different test scopes retained, not combined as serum-alone results.",
                "No original methods, full data or current formula equivalence inspected.",
                "Original scope: historical professional service leaflet",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
              ],
              "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S13",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "manufacturer_application_amendment",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
                "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
                "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
                "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
                "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
              ],
              "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
              "checked_date": "2026-10-02",
              "commercial_context": "maker sells the product"
            },
            {
              "id": "C03-P05-1",
              "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
              "type": "producer_direction_complement_de",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Redken Germany",
              "limitations": [
                "Protocol source only; no formula version selected or replaced.",
                "190 ml pack size is not exposed in inspected page text.",
                "No specific hair region, distribution method, quantity, texture or cadence is given in the inspected instructions.",
                "Source market: DE. Bound to producer-source-complement-2026-10-03/C03-P05-1; application directions only."
              ],
              "observation": "Producer positions Acidic Bonding Concentrate Intensive Treatment as a pretreatment before the line's shampoo and conditioner. Apply to damp hair; retain for 5–10 minutes and rinse. Continue with Redken Acidic Bonding Concentrate Shampoo and Conditioner.",
              "checked_date": "2026-10-03",
              "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
            }
          ],
          "version": "bondbuilder-research-profile-v1",
          "evidence": {
            "detail": "The exact Douglas 190 ml target is owner-selected; displaced R02 manufacturer formula is retained resolved and not merged. Citric-acid abstract findings remain technology-level. AU cadence is a cross-market complement; an inaccessible creator listing provides no verdict.",
            "summary": "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
            "cautions": [
              "No native-bond restoration, product superiority or active dose is established by the family label.",
              "Resolved formula selection is not resolution of missing application detail.",
              "No isolated selected-product effect size or concentration is established."
            ],
            "practical": {
              "limitations": [
                "No inspected original applicable practice verdict supports a benefit claim. Missing or inaccessible opinions are neutral."
              ],
              "counter_source_ids": [],
              "supporting_source_ids": []
            },
            "scientific": {
              "limitations": [
                "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
                "Resolved formula selection is not resolution of missing application detail.",
                "No isolated selected-product effect size or concentration is established."
              ],
              "counter_source_ids": [],
              "supporting_source_ids": [
                "N07"
              ]
            },
            "applicability": [
              {
                "scope": "technology",
                "bridge": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
                "source_ids": [
                  "N07"
                ],
                "limitations": [
                  "citric-acid technology, not any named retail treatment",
                  "publisher abstract inspected; full text inaccessible",
                  "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
                ]
              },
              {
                "scope": "product",
                "bridge": "Full materially different Redken INCI, directions; not merged with manufacturer.",
                "source_ids": [
                  "R09"
                ],
                "limitations": [
                  "exact source-listed product/market only",
                  "web text inspected"
                ]
              },
              {
                "scope": "product",
                "bridge": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
                "source_ids": [
                  "A-REDKEN-AU"
                ],
                "limitations": [
                  "AU product directions, not DE pack",
                  "product directions inspected 2026-10-01",
                  "Cross-market complement; no concentration equality or binding DE cadence."
                ]
              },
              {
                "scope": "product",
                "bridge": "Full manufacturer INCI and formula code; conflict with R09 retained.",
                "source_ids": [
                  "R02"
                ],
                "limitations": [
                  "exact source-listed product/market only",
                  "web text inspected"
                ]
              }
            ],
            "supported_outcome": "Acid-family reinforcement plausibility with limited exact-product evidence for selected Douglas formula.",
            "manufacturer_positioning": [
              "R09: Full materially different Redken INCI, directions; not merged with manufacturer.",
              "A-REDKEN-AU: AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions."
            ]
          },
          "identity": {
            "gtin": null,
            "size": "190 ml",
            "brand": "Redken",
            "market": "DE",
            "status": "resolved",
            "product_id": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
            "product_name": "Redken Acidic Bonding Concentrate Intensive Treatment",
            "research_key": "P05",
            "source_version": "2026-09-30:R09"
          },
          "assessment": {
            "reasoning": {
              "trust_basis": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "R09"
                ],
                "assumptions": [],
                "limitations": []
              },
              "intended_role": {
                "rationale": "Producer application amendment establishes treatment_role.",
                "confidence": "moderate",
                "source_ids": [
                  "C03-P05-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                  "190 ml size and exact selected formula-version instructions are not independently bound by this page."
                ]
              },
              "fit_assessment": {
                "rationale": "No source-supported diameter-specific suitability values are present. Damage, curl pattern, porosity and format do not establish diameter fit.",
                "confidence": "low",
                "source_ids": [],
                "assumptions": [],
                "limitations": [
                  "All three diameter values remain null; this is not a finding of unsuitability."
                ]
              },
              "product_format": {
                "rationale": "P05: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
                "confidence": "low",
                "source_ids": [],
                "assumptions": [],
                "limitations": []
              },
              "treatment_mode": {
                "rationale": "Producer application amendment establishes rinse.",
                "confidence": "moderate",
                "source_ids": [
                  "C03-P05-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                  "190 ml size and exact selected formula-version instructions are not independently bound by this page."
                ]
              },
              "boundary_status": {
                "rationale": "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
                "confidence": "moderate",
                "source_ids": [
                  "R09",
                  "A-REDKEN-AU"
                ],
                "assumptions": [],
                "limitations": [
                  "Resolved formula selection is not resolution of missing application detail.",
                  "No isolated selected-product effect size or concentration is established."
                ]
              },
              "application_mode": {
                "rationale": "Producer application amendment establishes placement.",
                "confidence": "moderate",
                "source_ids": [
                  "C03-P05-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                  "190 ml size and exact selected formula-version instructions are not independently bound by this page."
                ]
              },
              "evidence_profile": {
                "rationale": "The exact Douglas 190 ml target is owner-selected; displaced R02 manufacturer formula is retained resolved and not merged. Citric-acid abstract findings remain technology-level. AU cadence is a cross-market complement; an inaccessible creator listing provides no verdict.",
                "confidence": "moderate",
                "source_ids": [
                  "N07",
                  "R09",
                  "A-REDKEN-AU",
                  "R02"
                ],
                "assumptions": [],
                "limitations": [
                  "Duplicate captures of one study are not independent trials."
                ]
              },
              "application_facts": {
                "rationale": "Producer application amendment supplies direction sources; 7 application fact wrappers remain unknown.",
                "confidence": "moderate",
                "source_ids": [
                  "R09",
                  "C03-P05-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Remaining application unknowns are retained; no fact was inferred."
                ]
              },
              "claim_trust_level": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "R09"
                ],
                "assumptions": [],
                "limitations": [
                  "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
                ]
              },
              "supported_outcome": {
                "rationale": "Acid-family reinforcement plausibility with limited exact-product evidence for selected Douglas formula.",
                "confidence": "moderate",
                "source_ids": [
                  "N07",
                  "R09",
                  "A-REDKEN-AU"
                ],
                "assumptions": [],
                "limitations": [
                  "Resolved formula selection is not resolution of missing application detail.",
                  "No isolated selected-product effect size or concentration is established."
                ]
              },
              "technology_family": {
                "rationale": "Citric Acid/Sodium Citrate and targeted Acidic Bonding treatment identity are consistent with the category for the exact owner-selected 16-ingredient version.",
                "confidence": "moderate",
                "source_ids": [
                  "R09"
                ],
                "assumptions": [],
                "limitations": [
                  "Marker presence does not establish concentration, supplier, delivery or molecular effect."
                ]
              }
            },
            "trust_basis": "owner_calibration",
            "boundary_status": "in_scope",
            "limiting_factors": [
              "Resolved formula selection is not resolution of missing application detail.",
              "No isolated selected-product effect size or concentration is established."
            ],
            "policy_reference": "owner-review-2026-09-30:P05",
            "claim_trust_level": "medium",
            "technology_family": "acid_calcium_management",
            "classification_confidence": "moderate"
          },
          "application": {
            "rinse": {
              "value": {
                "treatment_mode": "rinse_out",
                "standalone_treatment_rinse": true
              },
              "rationale": "Producer specifies treatment rinsing before continuing with shampoo.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ],
              "unknown_reason": null
            },
            "amount": {
              "value": null,
              "rationale": "P05: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "timing": {
              "value": {
                "kind": "range_seconds",
                "purpose": "contact",
                "maximum_seconds": 600,
                "minimum_seconds": 300
              },
              "rationale": "Retain for five to ten minutes, then rinse.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ],
              "unknown_reason": null
            },
            "cadence": {
              "value": null,
              "rationale": "No exact DE cadence is reproduced. AU 2–3 uses weekly remains a cross-market complement, not a binding DE schedule.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "No exact DE cadence is reproduced. AU 2–3 uses weekly remains a cross-market complement, not a binding DE schedule."
            },
            "dilution": {
              "value": null,
              "rationale": "P05: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "partners": {
              "value": [
                {
                  "name": "Redken Acidic Bonding Concentrate Shampoo",
                  "source_ids": [
                    "C03-P05-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                },
                {
                  "name": "Redken Acidic Bonding Concentrate Conditioner",
                  "source_ids": [
                    "C03-P05-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                }
              ],
              "rationale": "Producer names the line's shampoo and conditioner.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page.",
                "No exclusive dependency or molecular efficacy conclusion inferred."
              ],
              "unknown_reason": null
            },
            "sequence": {
              "value": [
                {
                  "note": "Apply the Intensive Treatment to damp hair.",
                  "action": "apply_treatment",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P05-1"
                  ]
                },
                {
                  "note": "Retain for the stated interval.",
                  "action": "wait",
                  "timing": {
                    "kind": "range_seconds",
                    "purpose": "contact",
                    "maximum_seconds": 600,
                    "minimum_seconds": 300
                  },
                  "optional": false,
                  "source_ids": [
                    "C03-P05-1"
                  ]
                },
                {
                  "note": "Rinse the treatment before shampoo.",
                  "action": "rinse",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P05-1"
                  ]
                },
                {
                  "note": "Continue with the producer-named shampoo.",
                  "action": "shampoo",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P05-1"
                  ]
                },
                {
                  "note": "Then use the producer-named conditioner.",
                  "action": "apply_conditioner",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P05-1"
                  ]
                }
              ],
              "rationale": "Damp-hair treatment precedes a five-to-ten-minute interval, rinse, shampoo and conditioner.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ],
              "unknown_reason": null
            },
            "placement": {
              "value": "pre_shampoo",
              "rationale": "Producer describes a pretreatment before shampoo and conditioner.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ],
              "unknown_reason": null
            },
            "hair_state": {
              "value": "damp",
              "rationale": "Producer directs application to damp hair.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ],
              "unknown_reason": null
            },
            "conditioner": {
              "value": {
                "after": "recommended",
                "before": "not_stated",
                "guidance_reference": null,
                "minimum_wait_seconds": null
              },
              "rationale": "After treatment rinsing and shampoo, continue with conditioner.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ],
              "unknown_reason": null
            },
            "longer_wear": {
              "value": null,
              "rationale": "P05: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "distribution": {
              "value": null,
              "rationale": "P05: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: the frozen applicable producer observations do not establish distribution. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "source_market": "DE",
            "applied_format": {
              "value": null,
              "rationale": "P05: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: the frozen applicable producer observations do not establish applied_format. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "treatment_role": {
              "value": "pre_shampoo_treatment",
              "rationale": "The named Intensive Treatment has an explicit specialized pre-shampoo pretreatment role.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page."
              ],
              "unknown_reason": null
            },
            "source_variants": [
              {
                "market": "DE",
                "selected": true,
                "source_ids": [
                  "R09"
                ],
                "differences": "Selected 190 ml sixteen-ingredient retailer formula; the displaced manufacturer formula is not merged."
              },
              {
                "market": "DE",
                "selected": false,
                "source_ids": [
                  "R02"
                ],
                "differences": "Different manufacturer INCI retained as resolved displaced history under the exact owner selection."
              },
              {
                "market": "AU",
                "selected": false,
                "source_ids": [
                  "A-REDKEN-AU"
                ],
                "differences": "Two to three uses weekly; roots/wet/lather wording differs from selected Douglas directions. No concentration equality or binding DE cadence."
              },
              {
                "market": "DE",
                "selected": true,
                "source_ids": [
                  "C03-P05-1"
                ],
                "differences": "Same named DE Intensive Treatment protocol selected as a bounded producer complement. Neither its formula block nor an unverified 190 ml pack replaces the selected R09 identity."
              }
            ],
            "state_modifiers": {
              "value": null,
              "rationale": "P05: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P05: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "application_area": {
              "value": "hair",
              "rationale": "Producer says to apply to hair without a narrower anatomical area.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P05-1"
              ],
              "limitations": [
                "Protocol-only complement to R09; manufacturer formula is not selected or merged.",
                "190 ml size and exact selected formula-version instructions are not independently bound by this page.",
                "Hair is the broad schema value; no scalp, root or ends restriction inferred."
              ],
              "unknown_reason": null
            },
            "applicability_note": "DE manufacturer protocol complements the selected retailer source: specialized pre-shampoo treatment, damp hair, 5–10 minutes then rinse and shampoo/conditioner. Exact formula/pack equality is not asserted.",
            "direction_source_ids": [
              "R09",
              "C03-P05-1"
            ],
            "market_applicability": "exact_market"
          },
          "explanations_de": {
            "deeper": "Gezielte Säure-Behandlung der ausgewählten Douglas-Version mit 190 ml. Die abweichende Herstellerliste bleibt getrennt; die mittlere Einstufung gilt nur für die genau gebundene Quellenversion. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
            "concise": "Gezielte Säure-Behandlung der ausgewählten Douglas-Version mit 190 ml. Die abweichende Herstellerliste bleibt getrennt; die mittlere Einstufung gilt nur für die genau gebundene Quellenversion."
          },
          "technology_reference": {
            "status": "matched",
            "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
            "product_id": null,
            "source_ids": [
              "R01"
            ],
            "research_key": "P04",
            "formula_sha256": "e5e9b5e7c3d8882f12622bda11a67ace0ef1aeb37b9660bf881231966815ae00",
            "shared_markers": [
              "citric acid"
            ],
            "source_version": "2026-09-30:R01"
          }
        },
        "claim_trust_level": "medium",
        "technology_family": "acid_calcium_management",
        "bond_repair_intensity": null
      },
      "asset": {
        "id": "89cd2e27-acab-45dc-9454-3307028a40f6",
        "notes": "Reviewed internal Bondbuilder staging asset",
        "created_at": "2026-10-04T08:37:55.358559+00:00",
        "product_id": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
        "public_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p05/redken-acidic-bonding-concentrate-intensive-treatment-d8a44dfcad20.webp",
        "updated_at": "2026-10-04T08:37:55.358559+00:00",
        "source_type": "retailer",
        "asset_sha256": "d8a44dfcad20f2710fd1f43ead736ea30b34985b813813c2e3066ce93799bc07",
        "published_at": "2026-10-04T08:37:55.358559+00:00",
        "storage_path": "product-intake/2026-10-03/internal-bondbuilder-p05/redken-acidic-bonding-concentrate-intensive-treatment-d8a44dfcad20.webp",
        "user_approved": true,
        "storage_bucket": "product-images",
        "source_page_url": "https://www.hagel-shop.de/redken-acidic-bonding-concentrate-treatment-190ml-12122168.html",
        "source_image_url": "https://www.hagel-shop.de/media/catalog/product/1/2/12122168.jpg",
        "manifest_batch_id": "bondbuilder-internal-admission-v1:f7f88081-f37e-4a68-930e-8248e1ab60ff",
        "processing_method": "local",
        "quality_confidence": "high"
      },
      "product": {
        "id": "9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
        "name": "Redken Acidic Bonding Concentrate Intensive Treatment",
        "tags": [],
        "brand": "Redken",
        "origin": "curated",
        "brand_id": "09c0b862-500b-4776-bc96-15c9a56145c5",
        "category": null,
        "currency": "EUR",
        "tom_take": null,
        "embedding": null,
        "image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p05/redken-acidic-bonding-concentrate-intensive-treatment-d8a44dfcad20.webp",
        "is_active": true,
        "price_eur": 25.5,
        "created_at": "2026-10-04T08:37:55.358559+00:00",
        "sort_order": 0,
        "updated_at": "2026-10-05T17:58:43.413504+00:00",
        "description": null,
        "category_key": "bondbuilder",
        "affiliate_link": "https://www.hagel-shop.de/redken-acidic-bonding-concentrate-treatment-190ml-12122168.html",
        "product_line_id": "7eab83d2-4353-4084-9c4b-d84b52305055",
        "lifecycle_status": "active",
        "net_content_unit": "ml",
        "price_checked_at": "2026-10-03T13:30:30+00:00",
        "net_content_value": 190,
        "short_description": null,
        "suitable_concerns": [],
        "thumbnail_image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/d8a44dfcad20f2710fd1f43ead736ea30b34985b813813c2e3066ce93799bc07.webp",
        "purchase_link_status": "available",
        "suitable_thicknesses": [],
        "is_chaarlie_recommended": false,
        "purchase_link_checked_at": "2026-10-03T13:30:30+00:00"
      },
      "protocols": [],
      "identifiers": [
        {
          "type": "gtin",
          "value": "3474637248666",
          "source": "HAGEL Online Shop DE; exact pack binding retained in commercial research"
        },
        {
          "type": "retailer_url",
          "value": "https://www.hagel-shop.de/redken-acidic-bonding-concentrate-treatment-190ml-12122168.html",
          "source": "HAGEL Online Shop DE"
        }
      ]
    },
    "preimage_sha256": "6adb3cbaec0cfa4aa51c2d073516dad09fdadb8ea7054f206a1f1813ed671238",
    "artifact_sha256": "4ff3fae17f7f1b0136813933e9e38bfa7303fca4941ea0782a421dd5de4c68d5"
  },
  {
    "artifact": {
      "researchKey": "P07",
      "productId": "04a83f16-e610-4883-b44d-038d3a343787",
      "profile": {
        "fit": {
          "fine": {
            "value": null,
            "rationale": "P07: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P07: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "coarse": {
            "value": null,
            "rationale": "P07: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P07: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "normal": {
            "value": null,
            "rationale": "P07: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P07: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          }
        },
        "holds": {
          "fit": [
            {
              "code": "diameter_fit_unknown",
              "field": "fit",
              "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
              "source_ids": [
                "F01"
              ]
            }
          ],
          "boundary": [],
          "identity": [],
          "protocol": [],
          "claim_trust": []
        },
        "method": {
          "method_id": "bondbuilder-inci",
          "output_sha256": "293275baa809e81344ba17652202aec67585f850561a7726b6c9bb0ceabc6ca0",
          "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
          "run_reference": "replay-2026-10-03-v0.5-r3",
          "method_version": "bondbuilder-inci-v0.5",
          "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
          "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
          "artifact_reference": "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/P07.json",
          "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
          "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
        },
        "review": {
          "checked_date": "2026-10-06",
          "reviewed_date": "2026-10-06",
          "profile_sha256": "293275baa809e81344ba17652202aec67585f850561a7726b6c9bb0ceabc6ca0",
          "decision_references": [
            "recommendation-promotion-2026-10-06:reviewed-protocol-overlay"
          ]
        },
        "formula": {
          "status": "complete",
          "markers": [
            {
              "family": "gluconamide_gluconate",
              "literal": "hydroxypropylgluconamide",
              "source_ids": [
                "R04"
              ]
            },
            {
              "family": "gluconamide_gluconate",
              "literal": "hydroxypropylammonium gluconate",
              "source_ids": [
                "R04"
              ]
            }
          ],
          "raw_inci": "Water Aqua Eau, Butylene Glycol, Glycerin, Caprylic/capric Triglyceride, Cetearyl Alcohol, Polyglyceryl-10 Pentaoleate, Hydroxypropylgluconamide, Persea Gratissima (avocado) Oil, Camellia Oleifera Seed Oil, Plukenetia Volubilis Seed Oil, Helianthus Annuus (sunflower) Seed Oil, Tocopherol, Squalane, Ethylhexylglycerin, Behentrimonium Chloride, Hydroxypropylammonium Gluconate, Guar Hydroxypropyltrimonium Chloride, Polyacrylamidopropyltrimonium Chloride, Octyldodecyl Citrate Crosspolymer, Behenyl Alcohol, Lactic Acid, Tartaric Acid, Fragrance (parfum), Linalool, Limonene, Citronellol, Hydroxycitronellal, Benzyl Alcohol, Benzyl Benzoate, Benzyl Salicylate, Potassium Sorbate, Sodium Benzoate <ILN53057>",
          "conflicts": [],
          "raw_sha256": "3f6d3873570520d1ebaa558db7991cec7b05171a333737e6c5a471953455b0ab",
          "source_ids": [
            "R04"
          ],
          "normalized_sha256": "13715e76da3df36492e021fe9068510b02afb71873d2ce7ea0b2adafbd9527e1",
          "candidate_families": [
            "gluconamide_gluconate"
          ],
          "normalization_version": "bondbuilder-inci-normalization-v1",
          "normalized_ingredients": [
            "water aqua eau",
            "butylene glycol",
            "glycerin",
            "caprylic/capric triglyceride",
            "cetearyl alcohol",
            "polyglyceryl-10 pentaoleate",
            "hydroxypropylgluconamide",
            "persea gratissima (avocado) oil",
            "camellia oleifera seed oil",
            "plukenetia volubilis seed oil",
            "helianthus annuus (sunflower) seed oil",
            "tocopherol",
            "squalane",
            "ethylhexylglycerin",
            "behentrimonium chloride",
            "hydroxypropylammonium gluconate",
            "guar hydroxypropyltrimonium chloride",
            "polyacrylamidopropyltrimonium chloride",
            "octyldodecyl citrate crosspolymer",
            "behenyl alcohol",
            "lactic acid",
            "tartaric acid",
            "fragrance (parfum)",
            "linalool",
            "limonene",
            "citronellol",
            "hydroxycitronellal",
            "benzyl alcohol",
            "benzyl benzoate",
            "benzyl salicylate",
            "potassium sorbate",
            "sodium benzoate"
          ],
          "candidate_to_final_trace": [
            "Stage A candidates: gluconamide_gluconate.",
            "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
            "Final boundary: in_scope; family: gluconamide_gluconate; tier/basis: low/owner_calibration."
          ]
        },
        "sources": [
          {
            "id": "E01",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
            "limitations": [
              "citric-acid technology",
              "publisher abstract and affiliations; full methods not audited",
              "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
            ],
            "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
            "checked_date": "2026-09-30",
            "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
          },
          {
            "id": "E02",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
            "limitations": [
              "gluconamide/gluconate model chemistry",
              "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
              "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
            ],
            "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
            "checked_date": "2026-09-30",
            "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
          },
          {
            "id": "E03",
            "url": "https://cris.unibo.it/handle/11585/796978",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
            "limitations": [
              "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
              "author-repository abstract inspected; full manuscript not audited",
              "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
            ],
            "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
          },
          {
            "id": "E04",
            "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University of Minho; funding/COI not independently audited here.",
            "limitations": [
              "generic keratin-peptide binding",
              "indexed publisher/PubMed abstract inspected; direct publisher 403",
              "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
            ],
            "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
            "checked_date": "2026-09-30",
            "commercial_context": "University of Minho; funding/COI not independently audited here."
          },
          {
            "id": "P01:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "P02:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "E06",
            "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
            "type": "supplier_primary_technical_poster",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland supplier-owned material; not independent retail testing.",
            "limitations": [
              "supplier paired-marker technology, not OGX/Aveda bottles",
              "indexed primary poster text; direct PDF timeout, graphs not inspected",
              "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
            ],
            "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
            "checked_date": "2026-09-30",
            "commercial_context": "Ashland supplier-owned material; not independent retail testing."
          },
          {
            "id": "E07",
            "url": "https://patents.google.com/patent/US11491092B2/en",
            "type": "inventor_patent",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "patent",
            "affiliation": "Inventor/patent-holder evidence, not independent validation.",
            "limitations": [
              "bis(2-ethylhexyl) maleate technology examples",
              "description/examples inspected",
              "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
            ],
            "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
            "checked_date": "2026-09-30",
            "commercial_context": "Inventor/patent-holder evidence, not independent validation."
          },
          {
            "id": "R01",
            "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R02",
            "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R03",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "UK manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R04",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R05",
            "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R06",
            "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R07",
            "url": "https://epres.com/products/bond-repair-treatment",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R08",
            "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R09",
            "url": "https://www.douglas.de/de/p/5011495045",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R10",
            "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "45ml treatment-style INCI, not a 250ml verification.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R11",
            "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R12",
            "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R13",
            "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R14",
            "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
            "type": "DE-language retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R15",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
            "type": "DE manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N01",
            "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase target 250ml; local retailer source version",
              "full ingredient and application text inspected",
              "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
            ],
            "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N02",
            "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase 250ml corroboration",
              "full ingredient and protocol text inspected by source researcher",
              "Retailer corroboration is not a clinical test or supplied-pack verification."
            ],
            "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N03",
            "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
              "researcher full listing; root indexed full ingredient text; root direct open failed",
              "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
            ],
            "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N04",
            "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
            "type": "same_identifier_EU_retailer_corroboration",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml EAN3574661818474, Norway; not a DE pack",
              "researcher full listing and ingredient text",
              "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
            ],
            "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N05",
            "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
            "type": "manufacturer_protocol",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "epres intended spray bottle/refill system",
              "full official description, FAQs and ingredient text inspected",
              "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
            ],
            "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "P01:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "P02:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "N07",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary_abstract_amendment",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
            "limitations": [
              "citric-acid technology, not any named retail treatment",
              "publisher abstract inspected; full text inaccessible",
              "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
            ],
            "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
            "checked_date": "2026-09-30",
            "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
          },
          {
            "id": "N08",
            "url": "https://linktr.ee/abbeyyung",
            "type": "creator_own_source",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "AbbeyYung promotional context",
              "own page inspected",
              "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
            ],
            "observation": "Own page lists an epres discount code and links to own channels.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N09",
            "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Abbey bond-repair routine includes epres/K18",
              "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
              "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
            ],
            "observation": "Creator/title/routine inclusion leads identified.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N10",
            "url": "https://olaplex.de/pages/hair-care-ambassadors",
            "type": "brand_relationship_disclosure",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
              "official text inspected",
              "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
            ],
            "observation": "Both named as ambassadors.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N11",
            "url": "https://olaplex.de/pages/dejangarz",
            "type": "brand_hosted_creator_endorsement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "No3PLUS in Dejan's favourites",
              "official text inspected",
              "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
            ],
            "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N12",
            "url": "https://whimsysoul.com/epres-bond-repair-review/",
            "type": "original_first_person_longer_use_review",
            "scope": "practice",
            "access": "full_text",
            "author": "Kara",
            "authority": "creator",
            "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
            "limitations": [
              "Kara's epres starter-kit hair experience; article dated2026-04-12",
              "original article text inspected",
              "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
            ],
            "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
          },
          {
            "id": "F01",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "product description, directions and INCI inspected 2026-10-01",
              "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
            ],
            "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "F02",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "product description, directions and INCI inspected 2026-10-01",
              "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
            ],
            "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-REDKEN-AU",
            "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "AU product directions, not DE pack",
              "product directions inspected 2026-10-01",
              "Cross-market complement; no concentration equality or binding DE cadence."
            ],
            "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-DE",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE manufacturer complement with format/formula applicability limits",
              "FAQ and directions inspected 2026-10-01",
              "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
            ],
            "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-US",
            "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
            "type": "brand_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "Kérastase brand education manager",
            "limitations": [
              "Commercially affiliated US professional usage advice",
              "named brand education manager advice inspected 2026-09-30",
              "Not independent efficacy testing or a binding DE pack schedule."
            ],
            "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
            "checked_date": "2026-09-30",
            "commercial_context": "Kérastase brand education manager"
          },
          {
            "id": "A-JUUT",
            "url": "https://juut.com/blog/damaged-hair-repair/",
            "type": "commercial_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "JUUT / Aveda",
            "limitations": [
              "Aveda product practice",
              "named stylist experiences inspected 2026-09-30",
              "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
            ],
            "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
            "checked_date": "2026-09-30",
            "commercial_context": "JUUT / Aveda"
          },
          {
            "id": "A-REDKEN-CREATOR",
            "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Redken treatment listing only",
              "product listing inspected; detailed verdict uninspected",
              "No positive long-term or efficacy conclusion may be extracted."
            ],
            "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "A-ELVITAL-EDITORIAL",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue editorial guidance",
              "editorial applicability inspected 2026-09-30",
              "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
            ],
            "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-ELVITAL-WEEKLY",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue weekly advice",
              "editorial applicability inspected 2026-09-30",
              "Exact product-version applicability is unresolved; do not impose weekly use."
            ],
            "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "S01",
            "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith EU",
            "limitations": [
              "Actual pack not supplied; manufacturer warns that formula lists can change.",
              "Product title salve does not itself establish an applied cream texture.",
              "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S02",
            "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith DE",
            "limitations": [
              "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
              "Original scope: DE 237 ml listing and translated formula/directions",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S03",
            "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
            "type": "brand_owner_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": "dm / Balea",
            "limitations": [
              "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
              "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
            ],
            "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S04",
            "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Garnier DE / L'Oréal",
            "limitations": [
              "Rich formula is a description, not enough to certify cream texture.",
              "No actual pack.",
              "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S05",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
              "Concentration label is a branded complex claim, not ingredient dose.",
              "No study protocol, comparator or data inspected.",
              "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S06",
            "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
            "type": "manufacturer_editorial",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": "Sharley Butcher",
            "authority": "manufacturer",
            "affiliation": "Curlsmith / Sharley Butcher",
            "limitations": [
              "Not an inspected peer-reviewed study.",
              "Select current local product directions, retaining this differing editorial separately.",
              "Original scope: manufacturer editorial and historical study disclosure",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
            ],
            "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S07",
            "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
            "type": "supplier_document",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland, hosted by distributor ChemPoint",
            "limitations": [
              "This is not Curlsmith's formulation, supplier verification or product dose.",
              "Stability testing is not an efficacy trial.",
              "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
            ],
            "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S08",
            "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
            "type": "supplier_statement",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland",
            "limitations": [
              "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
              "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
              "Original scope: supplier press release 2024-02-22, technology scope",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
            ],
            "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S09",
            "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
            "type": "original_creator_statement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": "Gena Marie",
            "authority": "creator",
            "affiliation": "Gena Marie",
            "limitations": [
              "Historical formula/market not bound to current EU version.",
              "Article inspected; linked video not independently watched.",
              "Not an Abbey Yung endorsement.",
              "Original scope: original written sponsored creator comparison, 2021-01-03",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
            ],
            "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
            "checked_date": "2026-10-02",
            "commercial_context": "sponsored post; affiliate links"
          },
          {
            "id": "S10",
            "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
              "Original scope: original anecdotal discussion, historical unspecified pack",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown; do not infer independence"
          },
          {
            "id": "S11",
            "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
              "Original scope: historical anecdote with alternating treatment system",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown"
          },
          {
            "id": "S12",
            "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
            "type": "manufacturer_professional_document",
            "scope": "system",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Different test scopes retained, not combined as serum-alone results.",
              "No original methods, full data or current formula equivalence inspected.",
              "Original scope: historical professional service leaflet",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
            ],
            "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S13",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "manufacturer_application_amendment",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
              "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
              "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
              "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
              "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
            ],
            "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
            "checked_date": "2026-10-02",
            "commercial_context": "maker sells the product"
          },
          {
            "id": "C03-P07-1",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "producer_direction_complement_de",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Aveda DE",
            "limitations": [
              "Producer damage bands overlap at moderate; no exclusive cutoff or independent damage assessment is inferred.",
              "No quantified amount or distinct sectioning/distribution technique given.",
              "No actual pack label inspected.",
              "Source market: DE. Bound to producer-source-complement-2026-10-03/C03-P07-1; application directions only."
            ],
            "observation": "The 150 ml pre-shampoo treatment is explicitly described as a gel-cream. Apply to dry hair across roots through tips before shampooing. Retain 5–10 minutes, rinse, then use Botanical Repair Strengthening Shampoo and Conditioner. For mild-to-moderate damage, use weekly; for moderate-to-severe damage, use each wash day.",
            "checked_date": "2026-10-03",
            "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
          }
        ],
        "version": "bondbuilder-research-profile-v1",
        "evidence": {
          "detail": "Model chemistry and supplier testing do not establish exact Aveda dose, delivery or molecular restoration. JUUT describes after-two-week care/styling experiences with Aveda affiliation; sensory/manageability endpoints are not measured structure. Curly-hair/no-conditioner comparator does not establish all-diameter suitability or omission of conditioner in ordinary use.",
          "summary": "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
          "cautions": [
            "No native-bond restoration, product superiority or active dose is established by the family label.",
            "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
            "Timing and precise conditional cadence are not reproduced."
          ],
          "practical": {
            "limitations": [
              "Commercial relationships and uncontrolled routines limit causal interpretation; sensory outcomes do not prove molecular repair."
            ],
            "counter_source_ids": [],
            "supporting_source_ids": [
              "A-JUUT"
            ]
          },
          "scientific": {
            "limitations": [
              "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
              "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
              "Timing and precise conditional cadence are not reproduced."
            ],
            "counter_source_ids": [
              "E02"
            ],
            "supporting_source_ids": [
              "E02",
              "E06"
            ]
          },
          "applicability": [
            {
              "scope": "technology",
              "bridge": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
              "source_ids": [
                "E02"
              ],
              "limitations": [
                "gluconamide/gluconate model chemistry",
                "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
              ]
            },
            {
              "scope": "technology",
              "bridge": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
              "source_ids": [
                "E06"
              ],
              "limitations": [
                "supplier paired-marker technology, not OGX/Aveda bottles",
                "indexed primary poster text; direct PDF timeout, graphs not inspected",
                "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
              ]
            },
            {
              "scope": "practice",
              "bridge": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
              "source_ids": [
                "A-JUUT"
              ],
              "limitations": [
                "Aveda product practice",
                "named stylist experiences inspected 2026-09-30",
                "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
              ]
            },
            {
              "scope": "product",
              "bridge": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
              "source_ids": [
                "R04"
              ],
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ]
            },
            {
              "scope": "product",
              "bridge": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "source_ids": [
                "F01"
              ],
              "limitations": [
                "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
                "product description, directions and INCI inspected 2026-10-01",
                "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
              ]
            }
          ],
          "supported_outcome": "Technology plausibility and commercially connected sensory practice; exact Aveda structural outcomes remain uncertain.",
          "manufacturer_positioning": [
            "R04: 150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
            "F01: DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning"
          ]
        },
        "identity": {
          "gtin": null,
          "size": "150 ml",
          "brand": "Aveda",
          "market": "DE",
          "status": "resolved",
          "product_id": "04a83f16-e610-4883-b44d-038d3a343787",
          "product_name": "Aveda Botanical Repair Bond-Building Pre-Shampoo Treatment",
          "research_key": "P07",
          "source_version": "2026-09-30:R04"
        },
        "assessment": {
          "reasoning": {
            "trust_basis": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "R04"
              ],
              "assumptions": [],
              "limitations": []
            },
            "intended_role": {
              "rationale": "Targeted named pre-shampoo role is explicit.",
              "confidence": "high",
              "source_ids": [
                "R04",
                "F01"
              ],
              "assumptions": [],
              "limitations": []
            },
            "fit_assessment": {
              "rationale": "F01 says diameter positioning was researched but omits actual values; no fine/normal/coarse flag can be extracted.",
              "confidence": "low",
              "source_ids": [
                "F01"
              ],
              "assumptions": [],
              "limitations": [
                "All three diameter values remain null; this is not a finding of unsuitability."
              ]
            },
            "product_format": {
              "rationale": "Gel-cream is explicitly recorded in the source observation.",
              "confidence": "high",
              "source_ids": [
                "F01"
              ],
              "assumptions": [],
              "limitations": []
            },
            "treatment_mode": {
              "rationale": "Producer application amendment establishes rinse.",
              "confidence": "high",
              "source_ids": [
                "C03-P07-1"
              ],
              "assumptions": [],
              "limitations": []
            },
            "boundary_status": {
              "rationale": "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
              "confidence": "moderate",
              "source_ids": [
                "R04",
                "F01"
              ],
              "assumptions": [],
              "limitations": [
                "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
                "Timing and precise conditional cadence are not reproduced."
              ]
            },
            "application_mode": {
              "rationale": "Both observations identify the pre-shampoo treatment.",
              "confidence": "high",
              "source_ids": [
                "R04",
                "F01"
              ],
              "assumptions": [],
              "limitations": []
            },
            "evidence_profile": {
              "rationale": "Model chemistry and supplier testing do not establish exact Aveda dose, delivery or molecular restoration. JUUT describes after-two-week care/styling experiences with Aveda affiliation; sensory/manageability endpoints are not measured structure. Curly-hair/no-conditioner comparator does not establish all-diameter suitability or omission of conditioner in ordinary use.",
              "confidence": "moderate",
              "source_ids": [
                "E02",
                "E06",
                "A-JUUT",
                "R04",
                "F01"
              ],
              "assumptions": [],
              "limitations": [
                "Duplicate captures of one study are not independent trials."
              ]
            },
            "application_facts": {
              "rationale": "Producer application amendment supplies direction sources; 4 application fact wrappers remain unknown.",
              "confidence": "moderate",
              "source_ids": [
                "F01",
                "R04",
                "C03-P07-1"
              ],
              "assumptions": [],
              "limitations": [
                "Remaining application unknowns are retained; no fact was inferred."
              ]
            },
            "claim_trust_level": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "R04"
              ],
              "assumptions": [],
              "limitations": [
                "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
              ]
            },
            "supported_outcome": {
              "rationale": "Technology plausibility and commercially connected sensory practice; exact Aveda structural outcomes remain uncertain.",
              "confidence": "moderate",
              "source_ids": [
                "E02",
                "E06",
                "R04",
                "F01"
              ],
              "assumptions": [],
              "limitations": [
                "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
                "Timing and precise conditional cadence are not reproduced."
              ]
            },
            "technology_family": {
              "rationale": "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
              "confidence": "moderate",
              "source_ids": [
                "R04"
              ],
              "assumptions": [],
              "limitations": [
                "Marker presence does not establish concentration, supplier, delivery or molecular effect."
              ]
            }
          },
          "trust_basis": "owner_calibration",
          "boundary_status": "in_scope",
          "limiting_factors": [
            "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
            "Timing and precise conditional cadence are not reproduced."
          ],
          "policy_reference": "owner-review-2026-09-30:P07",
          "claim_trust_level": "low",
          "technology_family": "gluconamide_gluconate",
          "classification_confidence": "moderate"
        },
        "application": {
          "rinse": {
            "value": {
              "treatment_mode": "rinse_out",
              "standalone_treatment_rinse": true
            },
            "rationale": "Rinse the treatment before shampoo.",
            "confidence": "high",
            "source_ids": [
              "C03-P07-1"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "amount": {
            "value": null,
            "rationale": "P07: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P07: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "timing": {
            "value": {
              "kind": "range_seconds",
              "purpose": "contact",
              "maximum_seconds": 600,
              "minimum_seconds": 300
            },
            "rationale": "Retain five to ten minutes before rinsing.",
            "confidence": "high",
            "source_ids": [
              "C03-P07-1"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "cadence": {
            "value": {
              "status": "source_stated_conditional",
              "initial": null,
              "branches": [
                {
                  "timing": null,
                  "initial": null,
                  "condition": "Mild to moderate damage",
                  "source_ids": [
                    "C03-P07-1"
                  ],
                  "maintenance": {
                    "kind": "times_per_week",
                    "maximum": 1,
                    "minimum": 1
                  }
                },
                {
                  "timing": null,
                  "initial": null,
                  "condition": "Moderate to severe damage",
                  "source_ids": [
                    "C03-P07-1"
                  ],
                  "maintenance": {
                    "kind": "every_n_washes",
                    "maximum": 1,
                    "minimum": 1
                  }
                }
              ],
              "maintenance": null
            },
            "rationale": "Producer gives weekly and every-wash branches for its two damage bands.",
            "confidence": "high",
            "source_ids": [
              "C03-P07-1"
            ],
            "limitations": [
              "Bands overlap at moderate damage; no cutoff, automatic branch priority or damage assessment is invented."
            ],
            "unknown_reason": null
          },
          "dilution": {
            "value": null,
            "rationale": "P07: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P07: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "partners": {
            "value": [
              {
                "name": "Botanical Repair Strengthening Shampoo",
                "source_ids": [
                  "C03-P07-1"
                ],
                "requirement": "recommended",
                "exclusivity_established": false
              },
              {
                "name": "Botanical Repair Strengthening Conditioner",
                "source_ids": [
                  "C03-P07-1"
                ],
                "requirement": "recommended",
                "exclusivity_established": false
              }
            ],
            "rationale": "Producer names Botanical Repair shampoo and conditioner after treatment.",
            "confidence": "high",
            "source_ids": [
              "C03-P07-1"
            ],
            "limitations": [
              "No exclusive brand dependence established."
            ],
            "unknown_reason": null
          },
          "sequence": {
            "value": [
              {
                "note": "Apply to dry hair across roots through tips.",
                "action": "apply_treatment",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P07-1"
                ]
              },
              {
                "note": "Retain for the stated interval.",
                "action": "wait",
                "timing": {
                  "kind": "range_seconds",
                  "purpose": "contact",
                  "maximum_seconds": 600,
                  "minimum_seconds": 300
                },
                "optional": false,
                "source_ids": [
                  "C03-P07-1"
                ]
              },
              {
                "note": "Rinse the treatment before shampoo.",
                "action": "rinse",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P07-1"
                ]
              },
              {
                "note": "Continue with the producer-named shampoo.",
                "action": "shampoo",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P07-1"
                ]
              },
              {
                "note": "Then use the producer-named conditioner.",
                "action": "apply_conditioner",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "C03-P07-1"
                ]
              }
            ],
            "rationale": "Apply on dry hair, retain five to ten minutes, rinse, then shampoo and condition.",
            "confidence": "high",
            "source_ids": [
              "C03-P07-1"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "placement": {
            "value": "pre_shampoo",
            "rationale": "Both observations identify the pre-shampoo treatment.",
            "confidence": "high",
            "source_ids": [
              "R04",
              "F01"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "hair_state": {
            "value": "dry",
            "rationale": "Dry pre-shampoo protocol is expressly described.",
            "confidence": "high",
            "source_ids": [
              "R04"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "conditioner": {
            "value": {
              "after": "recommended",
              "before": "not_stated",
              "guidance_reference": null,
              "minimum_wait_seconds": null
            },
            "rationale": "Use conditioner following the subsequent shampoo.",
            "confidence": "high",
            "source_ids": [
              "C03-P07-1"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "longer_wear": {
            "value": null,
            "rationale": "P07: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P07: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "distribution": {
            "value": "Apply from roots to tips.",
            "rationale": "Retains the captured anatomical distribution without inventing a combing method.",
            "confidence": "high",
            "source_ids": [
              "F01"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "source_market": "DE",
          "applied_format": {
            "value": "gel_cream",
            "rationale": "Gel-cream is explicitly recorded in the source observation.",
            "confidence": "high",
            "source_ids": [
              "F01"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "treatment_role": {
            "value": "pre_shampoo_treatment",
            "rationale": "Targeted named pre-shampoo role is explicit.",
            "confidence": "high",
            "source_ids": [
              "R04",
              "F01"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "source_variants": [
            {
              "market": "DE",
              "selected": true,
              "source_ids": [
                "F01",
                "R04"
              ],
              "differences": "Selected dry pre-shampoo and gel-cream/root-to-tip capture; exact timing, dose and conditional-frequency values are not retained."
            },
            {
              "market": "DE",
              "selected": true,
              "source_ids": [
                "C03-P07-1"
              ],
              "differences": "Current DE 150 ml directions selected; conditional damage bands retain their overlap without an invented branch priority."
            }
          ],
          "state_modifiers": {
            "value": null,
            "rationale": "P07: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P07: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "application_area": {
            "value": "root_to_tip",
            "rationale": "Root-to-tip application is explicit.",
            "confidence": "high",
            "source_ids": [
              "F01"
            ],
            "limitations": [],
            "unknown_reason": null
          },
          "applicability_note": "DE gel-cream/dry/root-to-tip facts remain. New capture supplies 5–10 minutes, a standalone treatment rinse, named aftercare and overlapping conditional cadence.",
          "direction_source_ids": [
            "F01",
            "R04",
            "C03-P07-1"
          ],
          "market_applicability": "exact_market"
        },
        "explanations_de": {
          "deeper": "Gezieltes Pre-Shampoo mit dem Gluconamid/Gluconat-Paar. Erfahrungsberichte sind kommerziell verbunden und betreffen vor allem Haargefühl und Handhabung, nicht gemessene strukturelle Reparatur. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
          "concise": "Gezieltes Pre-Shampoo mit dem Gluconamid/Gluconat-Paar. Erfahrungsberichte sind kommerziell verbunden und betreffen vor allem Haargefühl und Handhabung, nicht gemessene strukturelle Reparatur."
        },
        "technology_reference": {
          "status": "matched",
          "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
          "product_id": null,
          "source_ids": [
            "N03"
          ],
          "research_key": "P06",
          "formula_sha256": "d115187c9084ab3b81bbf13e7a0809d1427f5ce8cb8afd70f3fcca768a9689b0",
          "shared_markers": [
            "hydroxypropylgluconamide",
            "hydroxypropylammonium gluconate"
          ],
          "source_version": "2026-09-30:N03"
        }
      },
      "spec": {
        "application_mode": "pre_shampoo",
        "treatment_mode": "rinse_out",
        "usage_protocol": "verified_product_protocol"
      },
      "protocolV1": {
        "schemaVersion": 1,
        "guidanceKey": "v2-exact-bondbuilder_verified_product-04a83f16-e610-4883-b44d-038d3a343787",
        "protocolVersion": 2,
        "locale": "de",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "04a83f16-e610-4883-b44d-038d3a343787"
        },
        "role": "bond_repair",
        "applicationFamily": "pre_shampoo_single_treatment",
        "compatibleDayTypes": [
          "bond_repair_day"
        ],
        "exactGuidanceRequired": true,
        "sequence": {
          "anchor": "pre_wash",
          "before": [],
          "after": [],
          "conflictsWith": []
        },
        "requirements": {
          "requiredCatalogFacts": [],
          "requiredProtocolFacts": [],
          "requiredProfileFacts": []
        },
        "protocolFacts": {
          "applicationArea": "all_hair",
          "rinse": "rinse_out",
          "contactTimeSeconds": null,
          "contactTime": {
            "kind": "range_seconds",
            "minimumSeconds": 300,
            "maximumSeconds": 600
          },
          "applicationState": "dry_hair",
          "treatmentRinse": "rinse_out",
          "conditionerSequence": {
            "before": "not_stated",
            "after": "recommended",
            "minimumWaitSeconds": null
          },
          "shampooAfterTreatment": "rinse_then_shampoo",
          "conditionerRelationship": "not_applicable",
          "reapplication": "none",
          "amount": null,
          "workflowId": "bondbuilder_verified_product",
          "cautions": []
        },
        "steps": [
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyTemplateDe": "Auf das trockene Haar geben und vom Ansatz bis zu den Spitzen verteilen."
          },
          {
            "stepKey": "distribute",
            "action": "section",
            "copyTemplateDe": "Vom Ansatz bis in die Spitzen verteilen."
          },
          {
            "stepKey": "wait",
            "action": "wait",
            "copyTemplateDe": "5 Minuten bis 10 Minuten einwirken lassen."
          },
          {
            "stepKey": "rinse-treatment",
            "action": "rinse",
            "copyTemplateDe": "Die Behandlung gründlich ausspülen."
          },
          {
            "stepKey": "shampoo-after",
            "action": "section",
            "copyTemplateDe": "Anschließend wie gewohnt mit Shampoo waschen und pflegen."
          },
          {
            "stepKey": "conditioner-after",
            "action": "section",
            "copyTemplateDe": "Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen."
          }
        ],
        "evidence": [
          {
            "sourceUrl": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-09-30"
          },
          {
            "sourceUrl": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-01"
          },
          {
            "sourceUrl": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-03"
          }
        ]
      },
      "protocolV2": {
        "schemaVersion": 2,
        "contractKind": "product_pointer",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "04a83f16-e610-4883-b44d-038d3a343787"
        },
        "sourceRole": "specialized_bond_treatment",
        "role": "bond_repair",
        "applicationFamily": "pre_shampoo_single_treatment",
        "facts": {
          "applicationState": "dry_hair",
          "applicationArea": "root_to_tip_hair",
          "rinse": "rinse_out",
          "contactTime": {
            "kind": "range_seconds",
            "minimumSeconds": 300,
            "maximumSeconds": 600
          },
          "amount": null,
          "heat": null,
          "conditionerSequence": {
            "before": "not_stated",
            "after": "recommended",
            "minimumWaitSeconds": null
          },
          "shampooAfterTreatment": "rinse_then_shampoo",
          "conditionerPolicy": "not_applicable"
        },
        "workflowId": "bondbuilder_verified_product",
        "requiredCompanionProductId": null,
        "runtimeBlockerCode": null,
        "exactSteps": [
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyDe": "Auf das trockene Haar geben und vom Ansatz bis zu den Spitzen verteilen."
          },
          {
            "stepKey": "distribute",
            "action": "section",
            "copyDe": "Vom Ansatz bis in die Spitzen verteilen."
          },
          {
            "stepKey": "wait",
            "action": "wait",
            "copyDe": "5 Minuten bis 10 Minuten einwirken lassen."
          },
          {
            "stepKey": "rinse-treatment",
            "action": "rinse",
            "copyDe": "Die Behandlung gründlich ausspülen."
          },
          {
            "stepKey": "shampoo-after",
            "action": "section",
            "copyDe": "Anschließend wie gewohnt mit Shampoo waschen und pflegen."
          },
          {
            "stepKey": "conditioner-after",
            "action": "section",
            "copyDe": "Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen."
          }
        ],
        "cautionCodes": [],
        "evidence": [
          {
            "sourceUrl": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-09-30"
          },
          {
            "sourceUrl": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-01"
          },
          {
            "sourceUrl": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "sourceType": "manufacturer",
            "checkedAt": "2026-10-03"
          }
        ]
      },
      "cadence": null,
      "eligibleThicknesses": [
        "fine",
        "normal",
        "coarse"
      ],
      "source": {
        "source_url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
        "source_text": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning"
      },
      "removedProtocolHolds": [
        "application.state_modifiers",
        "application.longer_wear",
        "application.amount",
        "application.dilution"
      ]
    },
    "preimage": {
      "spec": {
        "created_at": "2026-10-04T08:37:57.258826+00:00",
        "product_id": "04a83f16-e610-4883-b44d-038d3a343787",
        "updated_at": "2026-10-04T08:37:57.258826+00:00",
        "trust_basis": "owner_calibration",
        "category_key": "bondbuilder",
        "product_format": null,
        "treatment_mode": "rinse_out",
        "usage_protocol": null,
        "application_mode": "pre_shampoo",
        "bond_repair_axis": null,
        "research_profile": {
          "fit": {
            "fine": {
              "value": null,
              "rationale": "P07: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P07: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "coarse": {
              "value": null,
              "rationale": "P07: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P07: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "normal": {
              "value": null,
              "rationale": "P07: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P07: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            }
          },
          "holds": {
            "fit": [
              {
                "code": "diameter_fit_unknown",
                "field": "fit",
                "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
                "source_ids": [
                  "F01"
                ]
              }
            ],
            "boundary": [],
            "identity": [],
            "protocol": [
              {
                "code": "source_fact_unknown",
                "field": "application.state_modifiers",
                "reason": "P07: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.longer_wear",
                "reason": "P07: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.amount",
                "reason": "P07: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "source_fact_unknown",
                "field": "application.dilution",
                "reason": "P07: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              }
            ],
            "claim_trust": []
          },
          "method": {
            "method_id": "bondbuilder-inci",
            "output_sha256": "cc116729db05f6a5ced5368ce32ab3295b1d8293bc39169cd8c2c8a7c565d3e4",
            "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
            "run_reference": "replay-2026-10-03-v0.5-r3",
            "method_version": "bondbuilder-inci-v0.5",
            "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
            "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
            "artifact_reference": "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/lane-b/assembled/P07.json",
            "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
            "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
          },
          "review": {
            "checked_date": "2026-10-03",
            "reviewed_date": null,
            "profile_sha256": "cc116729db05f6a5ced5368ce32ab3295b1d8293bc39169cd8c2c8a7c565d3e4",
            "decision_references": []
          },
          "formula": {
            "status": "complete",
            "markers": [
              {
                "family": "gluconamide_gluconate",
                "literal": "hydroxypropylgluconamide",
                "source_ids": [
                  "R04"
                ]
              },
              {
                "family": "gluconamide_gluconate",
                "literal": "hydroxypropylammonium gluconate",
                "source_ids": [
                  "R04"
                ]
              }
            ],
            "raw_inci": "Water Aqua Eau, Butylene Glycol, Glycerin, Caprylic/capric Triglyceride, Cetearyl Alcohol, Polyglyceryl-10 Pentaoleate, Hydroxypropylgluconamide, Persea Gratissima (avocado) Oil, Camellia Oleifera Seed Oil, Plukenetia Volubilis Seed Oil, Helianthus Annuus (sunflower) Seed Oil, Tocopherol, Squalane, Ethylhexylglycerin, Behentrimonium Chloride, Hydroxypropylammonium Gluconate, Guar Hydroxypropyltrimonium Chloride, Polyacrylamidopropyltrimonium Chloride, Octyldodecyl Citrate Crosspolymer, Behenyl Alcohol, Lactic Acid, Tartaric Acid, Fragrance (parfum), Linalool, Limonene, Citronellol, Hydroxycitronellal, Benzyl Alcohol, Benzyl Benzoate, Benzyl Salicylate, Potassium Sorbate, Sodium Benzoate <ILN53057>",
            "conflicts": [],
            "raw_sha256": "3f6d3873570520d1ebaa558db7991cec7b05171a333737e6c5a471953455b0ab",
            "source_ids": [
              "R04"
            ],
            "normalized_sha256": "13715e76da3df36492e021fe9068510b02afb71873d2ce7ea0b2adafbd9527e1",
            "candidate_families": [
              "gluconamide_gluconate"
            ],
            "normalization_version": "bondbuilder-inci-normalization-v1",
            "normalized_ingredients": [
              "water aqua eau",
              "butylene glycol",
              "glycerin",
              "caprylic/capric triglyceride",
              "cetearyl alcohol",
              "polyglyceryl-10 pentaoleate",
              "hydroxypropylgluconamide",
              "persea gratissima (avocado) oil",
              "camellia oleifera seed oil",
              "plukenetia volubilis seed oil",
              "helianthus annuus (sunflower) seed oil",
              "tocopherol",
              "squalane",
              "ethylhexylglycerin",
              "behentrimonium chloride",
              "hydroxypropylammonium gluconate",
              "guar hydroxypropyltrimonium chloride",
              "polyacrylamidopropyltrimonium chloride",
              "octyldodecyl citrate crosspolymer",
              "behenyl alcohol",
              "lactic acid",
              "tartaric acid",
              "fragrance (parfum)",
              "linalool",
              "limonene",
              "citronellol",
              "hydroxycitronellal",
              "benzyl alcohol",
              "benzyl benzoate",
              "benzyl salicylate",
              "potassium sorbate",
              "sodium benzoate"
            ],
            "candidate_to_final_trace": [
              "Stage A candidates: gluconamide_gluconate.",
              "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
              "Final boundary: in_scope; family: gluconamide_gluconate; tier/basis: low/owner_calibration."
            ]
          },
          "sources": [
            {
              "id": "E01",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
              "limitations": [
                "citric-acid technology",
                "publisher abstract and affiliations; full methods not audited",
                "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
              ],
              "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
              "checked_date": "2026-09-30",
              "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
            },
            {
              "id": "E02",
              "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
              "limitations": [
                "gluconamide/gluconate model chemistry",
                "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
              ],
              "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
              "checked_date": "2026-09-30",
              "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
            },
            {
              "id": "E03",
              "url": "https://cris.unibo.it/handle/11585/796978",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
              "limitations": [
                "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
                "author-repository abstract inspected; full manuscript not audited",
                "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
              ],
              "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
            },
            {
              "id": "E04",
              "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University of Minho; funding/COI not independently audited here.",
              "limitations": [
                "generic keratin-peptide binding",
                "indexed publisher/PubMed abstract inspected; direct publisher 403",
                "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
              ],
              "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
              "checked_date": "2026-09-30",
              "commercial_context": "University of Minho; funding/COI not independently audited here."
            },
            {
              "id": "P01:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "P02:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "E06",
              "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
              "type": "supplier_primary_technical_poster",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland supplier-owned material; not independent retail testing.",
              "limitations": [
                "supplier paired-marker technology, not OGX/Aveda bottles",
                "indexed primary poster text; direct PDF timeout, graphs not inspected",
                "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
              ],
              "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
              "checked_date": "2026-09-30",
              "commercial_context": "Ashland supplier-owned material; not independent retail testing."
            },
            {
              "id": "E07",
              "url": "https://patents.google.com/patent/US11491092B2/en",
              "type": "inventor_patent",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "patent",
              "affiliation": "Inventor/patent-holder evidence, not independent validation.",
              "limitations": [
                "bis(2-ethylhexyl) maleate technology examples",
                "description/examples inspected",
                "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
              ],
              "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
              "checked_date": "2026-09-30",
              "commercial_context": "Inventor/patent-holder evidence, not independent validation."
            },
            {
              "id": "R01",
              "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R02",
              "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R03",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "UK manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R04",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R05",
              "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R06",
              "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R07",
              "url": "https://epres.com/products/bond-repair-treatment",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R08",
              "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R09",
              "url": "https://www.douglas.de/de/p/5011495045",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R10",
              "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "45ml treatment-style INCI, not a 250ml verification.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R11",
              "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R12",
              "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R13",
              "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R14",
              "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
              "type": "DE-language retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R15",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
              "type": "DE manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N01",
              "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase target 250ml; local retailer source version",
                "full ingredient and application text inspected",
                "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
              ],
              "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N02",
              "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase 250ml corroboration",
                "full ingredient and protocol text inspected by source researcher",
                "Retailer corroboration is not a clinical test or supplied-pack verification."
              ],
              "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N03",
              "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
                "researcher full listing; root indexed full ingredient text; root direct open failed",
                "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
              ],
              "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N04",
              "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
              "type": "same_identifier_EU_retailer_corroboration",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml EAN3574661818474, Norway; not a DE pack",
                "researcher full listing and ingredient text",
                "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
              ],
              "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N05",
              "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
              "type": "manufacturer_protocol",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "epres intended spray bottle/refill system",
                "full official description, FAQs and ingredient text inspected",
                "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
              ],
              "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "P01:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "P02:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "N07",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary_abstract_amendment",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
              "limitations": [
                "citric-acid technology, not any named retail treatment",
                "publisher abstract inspected; full text inaccessible",
                "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
              ],
              "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
              "checked_date": "2026-09-30",
              "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
            },
            {
              "id": "N08",
              "url": "https://linktr.ee/abbeyyung",
              "type": "creator_own_source",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "AbbeyYung promotional context",
                "own page inspected",
                "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
              ],
              "observation": "Own page lists an epres discount code and links to own channels.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N09",
              "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Abbey bond-repair routine includes epres/K18",
                "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
                "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
              ],
              "observation": "Creator/title/routine inclusion leads identified.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N10",
              "url": "https://olaplex.de/pages/hair-care-ambassadors",
              "type": "brand_relationship_disclosure",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
                "official text inspected",
                "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
              ],
              "observation": "Both named as ambassadors.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N11",
              "url": "https://olaplex.de/pages/dejangarz",
              "type": "brand_hosted_creator_endorsement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "No3PLUS in Dejan's favourites",
                "official text inspected",
                "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
              ],
              "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N12",
              "url": "https://whimsysoul.com/epres-bond-repair-review/",
              "type": "original_first_person_longer_use_review",
              "scope": "practice",
              "access": "full_text",
              "author": "Kara",
              "authority": "creator",
              "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
              "limitations": [
                "Kara's epres starter-kit hair experience; article dated2026-04-12",
                "original article text inspected",
                "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
              ],
              "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
            },
            {
              "id": "F01",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
                "product description, directions and INCI inspected 2026-10-01",
                "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
              ],
              "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "F02",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
                "product description, directions and INCI inspected 2026-10-01",
                "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
              ],
              "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-REDKEN-AU",
              "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "AU product directions, not DE pack",
                "product directions inspected 2026-10-01",
                "Cross-market complement; no concentration equality or binding DE cadence."
              ],
              "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-DE",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE manufacturer complement with format/formula applicability limits",
                "FAQ and directions inspected 2026-10-01",
                "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
              ],
              "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-US",
              "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
              "type": "brand_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "Kérastase brand education manager",
              "limitations": [
                "Commercially affiliated US professional usage advice",
                "named brand education manager advice inspected 2026-09-30",
                "Not independent efficacy testing or a binding DE pack schedule."
              ],
              "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
              "checked_date": "2026-09-30",
              "commercial_context": "Kérastase brand education manager"
            },
            {
              "id": "A-JUUT",
              "url": "https://juut.com/blog/damaged-hair-repair/",
              "type": "commercial_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "JUUT / Aveda",
              "limitations": [
                "Aveda product practice",
                "named stylist experiences inspected 2026-09-30",
                "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
              ],
              "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
              "checked_date": "2026-09-30",
              "commercial_context": "JUUT / Aveda"
            },
            {
              "id": "A-REDKEN-CREATOR",
              "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Redken treatment listing only",
                "product listing inspected; detailed verdict uninspected",
                "No positive long-term or efficacy conclusion may be extracted."
              ],
              "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "A-ELVITAL-EDITORIAL",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue editorial guidance",
                "editorial applicability inspected 2026-09-30",
                "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
              ],
              "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-ELVITAL-WEEKLY",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue weekly advice",
                "editorial applicability inspected 2026-09-30",
                "Exact product-version applicability is unresolved; do not impose weekly use."
              ],
              "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "S01",
              "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith EU",
              "limitations": [
                "Actual pack not supplied; manufacturer warns that formula lists can change.",
                "Product title salve does not itself establish an applied cream texture.",
                "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S02",
              "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith DE",
              "limitations": [
                "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
                "Original scope: DE 237 ml listing and translated formula/directions",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S03",
              "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
              "type": "brand_owner_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": "dm / Balea",
              "limitations": [
                "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
                "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
              ],
              "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S04",
              "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Garnier DE / L'Oréal",
              "limitations": [
                "Rich formula is a description, not enough to certify cream texture.",
                "No actual pack.",
                "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S05",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
                "Concentration label is a branded complex claim, not ingredient dose.",
                "No study protocol, comparator or data inspected.",
                "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S06",
              "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
              "type": "manufacturer_editorial",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": "Sharley Butcher",
              "authority": "manufacturer",
              "affiliation": "Curlsmith / Sharley Butcher",
              "limitations": [
                "Not an inspected peer-reviewed study.",
                "Select current local product directions, retaining this differing editorial separately.",
                "Original scope: manufacturer editorial and historical study disclosure",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
              ],
              "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S07",
              "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
              "type": "supplier_document",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland, hosted by distributor ChemPoint",
              "limitations": [
                "This is not Curlsmith's formulation, supplier verification or product dose.",
                "Stability testing is not an efficacy trial.",
                "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
              ],
              "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S08",
              "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
              "type": "supplier_statement",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland",
              "limitations": [
                "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
                "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
                "Original scope: supplier press release 2024-02-22, technology scope",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
              ],
              "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S09",
              "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
              "type": "original_creator_statement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": "Gena Marie",
              "authority": "creator",
              "affiliation": "Gena Marie",
              "limitations": [
                "Historical formula/market not bound to current EU version.",
                "Article inspected; linked video not independently watched.",
                "Not an Abbey Yung endorsement.",
                "Original scope: original written sponsored creator comparison, 2021-01-03",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
              ],
              "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
              "checked_date": "2026-10-02",
              "commercial_context": "sponsored post; affiliate links"
            },
            {
              "id": "S10",
              "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
                "Original scope: original anecdotal discussion, historical unspecified pack",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown; do not infer independence"
            },
            {
              "id": "S11",
              "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
                "Original scope: historical anecdote with alternating treatment system",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown"
            },
            {
              "id": "S12",
              "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
              "type": "manufacturer_professional_document",
              "scope": "system",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Different test scopes retained, not combined as serum-alone results.",
                "No original methods, full data or current formula equivalence inspected.",
                "Original scope: historical professional service leaflet",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
              ],
              "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S13",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "manufacturer_application_amendment",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
                "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
                "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
                "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
                "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
              ],
              "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
              "checked_date": "2026-10-02",
              "commercial_context": "maker sells the product"
            },
            {
              "id": "C03-P07-1",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "producer_direction_complement_de",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Aveda DE",
              "limitations": [
                "Producer damage bands overlap at moderate; no exclusive cutoff or independent damage assessment is inferred.",
                "No quantified amount or distinct sectioning/distribution technique given.",
                "No actual pack label inspected.",
                "Source market: DE. Bound to producer-source-complement-2026-10-03/C03-P07-1; application directions only."
              ],
              "observation": "The 150 ml pre-shampoo treatment is explicitly described as a gel-cream. Apply to dry hair across roots through tips before shampooing. Retain 5–10 minutes, rinse, then use Botanical Repair Strengthening Shampoo and Conditioner. For mild-to-moderate damage, use weekly; for moderate-to-severe damage, use each wash day.",
              "checked_date": "2026-10-03",
              "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
            }
          ],
          "version": "bondbuilder-research-profile-v1",
          "evidence": {
            "detail": "Model chemistry and supplier testing do not establish exact Aveda dose, delivery or molecular restoration. JUUT describes after-two-week care/styling experiences with Aveda affiliation; sensory/manageability endpoints are not measured structure. Curly-hair/no-conditioner comparator does not establish all-diameter suitability or omission of conditioner in ordinary use.",
            "summary": "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
            "cautions": [
              "No native-bond restoration, product superiority or active dose is established by the family label.",
              "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
              "Timing and precise conditional cadence are not reproduced."
            ],
            "practical": {
              "limitations": [
                "Commercial relationships and uncontrolled routines limit causal interpretation; sensory outcomes do not prove molecular repair."
              ],
              "counter_source_ids": [],
              "supporting_source_ids": [
                "A-JUUT"
              ]
            },
            "scientific": {
              "limitations": [
                "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
                "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
                "Timing and precise conditional cadence are not reproduced."
              ],
              "counter_source_ids": [
                "E02"
              ],
              "supporting_source_ids": [
                "E02",
                "E06"
              ]
            },
            "applicability": [
              {
                "scope": "technology",
                "bridge": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
                "source_ids": [
                  "E02"
                ],
                "limitations": [
                  "gluconamide/gluconate model chemistry",
                  "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                  "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
                ]
              },
              {
                "scope": "technology",
                "bridge": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
                "source_ids": [
                  "E06"
                ],
                "limitations": [
                  "supplier paired-marker technology, not OGX/Aveda bottles",
                  "indexed primary poster text; direct PDF timeout, graphs not inspected",
                  "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
                ]
              },
              {
                "scope": "practice",
                "bridge": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
                "source_ids": [
                  "A-JUUT"
                ],
                "limitations": [
                  "Aveda product practice",
                  "named stylist experiences inspected 2026-09-30",
                  "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
                ]
              },
              {
                "scope": "product",
                "bridge": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
                "source_ids": [
                  "R04"
                ],
                "limitations": [
                  "exact source-listed product/market only",
                  "web text inspected"
                ]
              },
              {
                "scope": "product",
                "bridge": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
                "source_ids": [
                  "F01"
                ],
                "limitations": [
                  "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
                  "product description, directions and INCI inspected 2026-10-01",
                  "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
                ]
              }
            ],
            "supported_outcome": "Technology plausibility and commercially connected sensory practice; exact Aveda structural outcomes remain uncertain.",
            "manufacturer_positioning": [
              "R04: 150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
              "F01: DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning"
            ]
          },
          "identity": {
            "gtin": null,
            "size": "150 ml",
            "brand": "Aveda",
            "market": "DE",
            "status": "resolved",
            "product_id": "04a83f16-e610-4883-b44d-038d3a343787",
            "product_name": "Aveda Botanical Repair Bond-Building Pre-Shampoo Treatment",
            "research_key": "P07",
            "source_version": "2026-09-30:R04"
          },
          "assessment": {
            "reasoning": {
              "trust_basis": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "R04"
                ],
                "assumptions": [],
                "limitations": []
              },
              "intended_role": {
                "rationale": "Targeted named pre-shampoo role is explicit.",
                "confidence": "high",
                "source_ids": [
                  "R04",
                  "F01"
                ],
                "assumptions": [],
                "limitations": []
              },
              "fit_assessment": {
                "rationale": "F01 says diameter positioning was researched but omits actual values; no fine/normal/coarse flag can be extracted.",
                "confidence": "low",
                "source_ids": [
                  "F01"
                ],
                "assumptions": [],
                "limitations": [
                  "All three diameter values remain null; this is not a finding of unsuitability."
                ]
              },
              "product_format": {
                "rationale": "Gel-cream is explicitly recorded in the source observation.",
                "confidence": "high",
                "source_ids": [
                  "F01"
                ],
                "assumptions": [],
                "limitations": []
              },
              "treatment_mode": {
                "rationale": "Producer application amendment establishes rinse.",
                "confidence": "high",
                "source_ids": [
                  "C03-P07-1"
                ],
                "assumptions": [],
                "limitations": []
              },
              "boundary_status": {
                "rationale": "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
                "confidence": "moderate",
                "source_ids": [
                  "R04",
                  "F01"
                ],
                "assumptions": [],
                "limitations": [
                  "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
                  "Timing and precise conditional cadence are not reproduced."
                ]
              },
              "application_mode": {
                "rationale": "Both observations identify the pre-shampoo treatment.",
                "confidence": "high",
                "source_ids": [
                  "R04",
                  "F01"
                ],
                "assumptions": [],
                "limitations": []
              },
              "evidence_profile": {
                "rationale": "Model chemistry and supplier testing do not establish exact Aveda dose, delivery or molecular restoration. JUUT describes after-two-week care/styling experiences with Aveda affiliation; sensory/manageability endpoints are not measured structure. Curly-hair/no-conditioner comparator does not establish all-diameter suitability or omission of conditioner in ordinary use.",
                "confidence": "moderate",
                "source_ids": [
                  "E02",
                  "E06",
                  "A-JUUT",
                  "R04",
                  "F01"
                ],
                "assumptions": [],
                "limitations": [
                  "Duplicate captures of one study are not independent trials."
                ]
              },
              "application_facts": {
                "rationale": "Producer application amendment supplies direction sources; 4 application fact wrappers remain unknown.",
                "confidence": "moderate",
                "source_ids": [
                  "F01",
                  "R04",
                  "C03-P07-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Remaining application unknowns are retained; no fact was inferred."
                ]
              },
              "claim_trust_level": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "R04"
                ],
                "assumptions": [],
                "limitations": [
                  "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
                ]
              },
              "supported_outcome": {
                "rationale": "Technology plausibility and commercially connected sensory practice; exact Aveda structural outcomes remain uncertain.",
                "confidence": "moderate",
                "source_ids": [
                  "E02",
                  "E06",
                  "R04",
                  "F01"
                ],
                "assumptions": [],
                "limitations": [
                  "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
                  "Timing and precise conditional cadence are not reproduced."
                ]
              },
              "technology_family": {
                "rationale": "Paired literal markers and specialized dry pre-shampoo treatment establish the family; unrelated acids do not provide an acid-family match.",
                "confidence": "moderate",
                "source_ids": [
                  "R04"
                ],
                "assumptions": [],
                "limitations": [
                  "Marker presence does not establish concentration, supplier, delivery or molecular effect."
                ]
              }
            },
            "trust_basis": "owner_calibration",
            "boundary_status": "in_scope",
            "limiting_factors": [
              "Source names diameter positioning but omits its actual values; all three diameter facts remain unknown.",
              "Timing and precise conditional cadence are not reproduced."
            ],
            "policy_reference": "owner-review-2026-09-30:P07",
            "claim_trust_level": "low",
            "technology_family": "gluconamide_gluconate",
            "classification_confidence": "moderate"
          },
          "application": {
            "rinse": {
              "value": {
                "treatment_mode": "rinse_out",
                "standalone_treatment_rinse": true
              },
              "rationale": "Rinse the treatment before shampoo.",
              "confidence": "high",
              "source_ids": [
                "C03-P07-1"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "amount": {
              "value": null,
              "rationale": "P07: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P07: the frozen applicable producer observations do not establish amount. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "timing": {
              "value": {
                "kind": "range_seconds",
                "purpose": "contact",
                "maximum_seconds": 600,
                "minimum_seconds": 300
              },
              "rationale": "Retain five to ten minutes before rinsing.",
              "confidence": "high",
              "source_ids": [
                "C03-P07-1"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "cadence": {
              "value": {
                "status": "source_stated_conditional",
                "initial": null,
                "branches": [
                  {
                    "timing": null,
                    "initial": null,
                    "condition": "Mild to moderate damage",
                    "source_ids": [
                      "C03-P07-1"
                    ],
                    "maintenance": {
                      "kind": "times_per_week",
                      "maximum": 1,
                      "minimum": 1
                    }
                  },
                  {
                    "timing": null,
                    "initial": null,
                    "condition": "Moderate to severe damage",
                    "source_ids": [
                      "C03-P07-1"
                    ],
                    "maintenance": {
                      "kind": "every_n_washes",
                      "maximum": 1,
                      "minimum": 1
                    }
                  }
                ],
                "maintenance": null
              },
              "rationale": "Producer gives weekly and every-wash branches for its two damage bands.",
              "confidence": "high",
              "source_ids": [
                "C03-P07-1"
              ],
              "limitations": [
                "Bands overlap at moderate damage; no cutoff, automatic branch priority or damage assessment is invented."
              ],
              "unknown_reason": null
            },
            "dilution": {
              "value": null,
              "rationale": "P07: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P07: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "partners": {
              "value": [
                {
                  "name": "Botanical Repair Strengthening Shampoo",
                  "source_ids": [
                    "C03-P07-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                },
                {
                  "name": "Botanical Repair Strengthening Conditioner",
                  "source_ids": [
                    "C03-P07-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                }
              ],
              "rationale": "Producer names Botanical Repair shampoo and conditioner after treatment.",
              "confidence": "high",
              "source_ids": [
                "C03-P07-1"
              ],
              "limitations": [
                "No exclusive brand dependence established."
              ],
              "unknown_reason": null
            },
            "sequence": {
              "value": [
                {
                  "note": "Apply to dry hair across roots through tips.",
                  "action": "apply_treatment",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P07-1"
                  ]
                },
                {
                  "note": "Retain for the stated interval.",
                  "action": "wait",
                  "timing": {
                    "kind": "range_seconds",
                    "purpose": "contact",
                    "maximum_seconds": 600,
                    "minimum_seconds": 300
                  },
                  "optional": false,
                  "source_ids": [
                    "C03-P07-1"
                  ]
                },
                {
                  "note": "Rinse the treatment before shampoo.",
                  "action": "rinse",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P07-1"
                  ]
                },
                {
                  "note": "Continue with the producer-named shampoo.",
                  "action": "shampoo",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P07-1"
                  ]
                },
                {
                  "note": "Then use the producer-named conditioner.",
                  "action": "apply_conditioner",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P07-1"
                  ]
                }
              ],
              "rationale": "Apply on dry hair, retain five to ten minutes, rinse, then shampoo and condition.",
              "confidence": "high",
              "source_ids": [
                "C03-P07-1"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "placement": {
              "value": "pre_shampoo",
              "rationale": "Both observations identify the pre-shampoo treatment.",
              "confidence": "high",
              "source_ids": [
                "R04",
                "F01"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "hair_state": {
              "value": "dry",
              "rationale": "Dry pre-shampoo protocol is expressly described.",
              "confidence": "high",
              "source_ids": [
                "R04"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "conditioner": {
              "value": {
                "after": "recommended",
                "before": "not_stated",
                "guidance_reference": null,
                "minimum_wait_seconds": null
              },
              "rationale": "Use conditioner following the subsequent shampoo.",
              "confidence": "high",
              "source_ids": [
                "C03-P07-1"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "longer_wear": {
              "value": null,
              "rationale": "P07: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P07: the frozen applicable producer observations do not establish longer_wear. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "distribution": {
              "value": "Apply from roots to tips.",
              "rationale": "Retains the captured anatomical distribution without inventing a combing method.",
              "confidence": "high",
              "source_ids": [
                "F01"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "source_market": "DE",
            "applied_format": {
              "value": "gel_cream",
              "rationale": "Gel-cream is explicitly recorded in the source observation.",
              "confidence": "high",
              "source_ids": [
                "F01"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "treatment_role": {
              "value": "pre_shampoo_treatment",
              "rationale": "Targeted named pre-shampoo role is explicit.",
              "confidence": "high",
              "source_ids": [
                "R04",
                "F01"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "source_variants": [
              {
                "market": "DE",
                "selected": true,
                "source_ids": [
                  "F01",
                  "R04"
                ],
                "differences": "Selected dry pre-shampoo and gel-cream/root-to-tip capture; exact timing, dose and conditional-frequency values are not retained."
              },
              {
                "market": "DE",
                "selected": true,
                "source_ids": [
                  "C03-P07-1"
                ],
                "differences": "Current DE 150 ml directions selected; conditional damage bands retain their overlap without an invented branch priority."
              }
            ],
            "state_modifiers": {
              "value": null,
              "rationale": "P07: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P07: the frozen applicable producer observations do not establish state_modifiers. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "application_area": {
              "value": "root_to_tip",
              "rationale": "Root-to-tip application is explicit.",
              "confidence": "high",
              "source_ids": [
                "F01"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "applicability_note": "DE gel-cream/dry/root-to-tip facts remain. New capture supplies 5–10 minutes, a standalone treatment rinse, named aftercare and overlapping conditional cadence.",
            "direction_source_ids": [
              "F01",
              "R04",
              "C03-P07-1"
            ],
            "market_applicability": "exact_market"
          },
          "explanations_de": {
            "deeper": "Gezieltes Pre-Shampoo mit dem Gluconamid/Gluconat-Paar. Erfahrungsberichte sind kommerziell verbunden und betreffen vor allem Haargefühl und Handhabung, nicht gemessene strukturelle Reparatur. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
            "concise": "Gezieltes Pre-Shampoo mit dem Gluconamid/Gluconat-Paar. Erfahrungsberichte sind kommerziell verbunden und betreffen vor allem Haargefühl und Handhabung, nicht gemessene strukturelle Reparatur."
          },
          "technology_reference": {
            "status": "matched",
            "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
            "product_id": null,
            "source_ids": [
              "N03"
            ],
            "research_key": "P06",
            "formula_sha256": "d115187c9084ab3b81bbf13e7a0809d1427f5ce8cb8afd70f3fcca768a9689b0",
            "shared_markers": [
              "hydroxypropylgluconamide",
              "hydroxypropylammonium gluconate"
            ],
            "source_version": "2026-09-30:N03"
          }
        },
        "claim_trust_level": "low",
        "technology_family": "gluconamide_gluconate",
        "bond_repair_intensity": null
      },
      "asset": {
        "id": "44d03386-4f05-47d9-9dba-636445c18f8f",
        "notes": "Reviewed internal Bondbuilder staging asset",
        "created_at": "2026-10-04T08:37:57.258826+00:00",
        "product_id": "04a83f16-e610-4883-b44d-038d3a343787",
        "public_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p07/aveda-botanical-repair-bond-building-pre-shampoo-treatment-de64e9c0b483.webp",
        "updated_at": "2026-10-04T08:37:57.258826+00:00",
        "source_type": "brand",
        "asset_sha256": "de64e9c0b483658e381f2179e50f19500045b22f217141920b87054d86b94053",
        "published_at": "2026-10-04T08:37:57.258826+00:00",
        "storage_path": "product-intake/2026-10-03/internal-bondbuilder-p07/aveda-botanical-repair-bond-building-pre-shampoo-treatment-de64e9c0b483.webp",
        "user_approved": true,
        "storage_bucket": "product-images",
        "source_page_url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
        "source_image_url": "https://sdcdn.io/av/AV_SKU_V6B501_EMEA_3000x3000_0.png",
        "manifest_batch_id": "bondbuilder-internal-admission-v1:de014c63-c192-40bb-9d1f-4a0daa647078",
        "processing_method": "local",
        "quality_confidence": "high"
      },
      "product": {
        "id": "04a83f16-e610-4883-b44d-038d3a343787",
        "name": "Aveda Botanical Repair Bond-Building Pre-Shampoo Treatment",
        "tags": [],
        "brand": "Aveda",
        "origin": "curated",
        "brand_id": "a77d6392-bb2f-48a7-9cb6-3b318654ebe5",
        "category": null,
        "currency": "EUR",
        "tom_take": null,
        "embedding": null,
        "image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p07/aveda-botanical-repair-bond-building-pre-shampoo-treatment-de64e9c0b483.webp",
        "is_active": true,
        "price_eur": 52,
        "created_at": "2026-10-04T08:37:57.258826+00:00",
        "sort_order": 0,
        "updated_at": "2026-10-05T17:58:43.413504+00:00",
        "description": null,
        "category_key": "bondbuilder",
        "affiliate_link": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment?size=150_ml",
        "product_line_id": "142967ec-4dbb-4419-881e-74ca94aeacfb",
        "lifecycle_status": "active",
        "net_content_unit": "ml",
        "price_checked_at": "2026-10-03T13:29:19+00:00",
        "net_content_value": 150,
        "short_description": null,
        "suitable_concerns": [],
        "thumbnail_image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/de64e9c0b483658e381f2179e50f19500045b22f217141920b87054d86b94053.webp",
        "purchase_link_status": "available",
        "suitable_thicknesses": [],
        "is_chaarlie_recommended": false,
        "purchase_link_checked_at": "2026-10-03T13:29:19+00:00"
      },
      "protocols": [],
      "identifiers": [
        {
          "type": "manufacturer_sku",
          "value": "V6B501",
          "source": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment?size=150_ml"
        },
        {
          "type": "retailer_url",
          "value": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment?size=150_ml",
          "source": "Aveda DE (manufacturer direct)"
        }
      ]
    },
    "preimage_sha256": "5aba7e0b463f3b8ed2eb8872f37c55d3e661593c75acaa0a2b31900373d058b5",
    "artifact_sha256": "f44a1830ff1192bf63733d398ec5e401dfc8da523c7147525aa136c8492e78bb"
  },
  {
    "artifact": {
      "researchKey": "P06",
      "productId": "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
      "profile": {
        "fit": {
          "fine": {
            "value": null,
            "rationale": "P06: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P06: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "coarse": {
            "value": null,
            "rationale": "P06: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P06: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          },
          "normal": {
            "value": null,
            "rationale": "P06: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P06: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
          }
        },
        "holds": {
          "fit": [
            {
              "code": "diameter_fit_unknown",
              "field": "fit",
              "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
              "source_ids": []
            }
          ],
          "boundary": [],
          "identity": [],
          "protocol": [],
          "claim_trust": []
        },
        "method": {
          "method_id": "bondbuilder-inci",
          "output_sha256": "b5c7e4fce85b4b2bceea64f4ecf7497627540ca8514be340cffab90c442f00b5",
          "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
          "run_reference": "replay-2026-10-03-v0.5-r3",
          "method_version": "bondbuilder-inci-v0.5",
          "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
          "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
          "artifact_reference": "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/ogx-amendment.json",
          "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
          "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
        },
        "review": {
          "checked_date": "2026-10-06",
          "reviewed_date": "2026-10-06",
          "profile_sha256": "b5c7e4fce85b4b2bceea64f4ecf7497627540ca8514be340cffab90c442f00b5",
          "decision_references": [
            "owner-reviewed-recommendation-2026-10-06",
            "de-bedtime-direction-overlay-2026-10-06"
          ]
        },
        "formula": {
          "status": "complete",
          "markers": [
            {
              "family": "gluconamide_gluconate",
              "literal": "hydroxypropylgluconamide",
              "source_ids": [
                "N03"
              ]
            },
            {
              "family": "gluconamide_gluconate",
              "literal": "hydroxypropylammonium gluconate",
              "source_ids": [
                "N03"
              ]
            },
            {
              "family": "acid_calcium_management",
              "literal": "arginine",
              "source_ids": [
                "N03"
              ]
            },
            {
              "family": "acid_calcium_management",
              "literal": "citric acid",
              "source_ids": [
                "N03"
              ]
            }
          ],
          "raw_inci": "Aqua, Glycerin, Parfum, Behentrimonium Chloride, Polysorbate 20, Triticum Vulgare Protein, Hydroxypropylgluconamide, Hydroxypropylammonium Gluconate, Hydrolyzed Keratin, Tocopheryl Acetat, Panthenol, Arginine, Triticum Vulgare Bran Extract, Triticum Vulgare Germ Extract, Triticum Vulgare Germ Öl, Camellia Oleifera Seed Öl, Guar Hydroxypropyltrimonium Chloride, Cetearyl Nonanoate, Linoleic Acid, Caprylyl Glycol, Caprylic, Capric Triglyceride, Hydroxyacetophenone, Tocopherol, Hydroxyethylcellulose, Polyquaternium-10, Polysorbate 60, 1, 2-Hexanediol, Isopropyl Alcohol, Citric Acid, Disodium Phosphate, Benzoic Acid, Sodium Phosphate, Potassium Sorbate, Phenoxyethanol, Tartaric Acid, Sodium Benzoate, Alpha-Isomethyl Ionone",
          "conflicts": [
            {
              "reason": "Displaced historical source retained; the reviewed selected source-version is not a claim of cross-market equality.",
              "raw_inci": "Aqua/Water/Eau, Glycerin, Parfum/Fragrance, Behentrimonium Chloride, Polysorbate 20, Triticum Vulgare Protein, Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate, Hydrolyzed Keratin, Tocopheryl Acetate, Panthenol, Arginine, Triticum Vulgare Bran Extract, Triticum Vulgare Germ Extract, Triticum Vulgare Germ Oil, Camelia Oleifera Seed Oil, Guar Hydroxypropyltrimonium Chloride, Cetearyl Nonanoate, Linoleic Acid, Caprylyl Glycol, Caprylic/Capric Triglyceride, Hydroxyacetophenone, Tocopherol, Hydroxyethylcellulose, Polyquaternium-10, Polysorbate 60, 1,2-Hexanediol, Isopropyl Alcohol, Citric Acid, Disodium Phosphate, Benzoic Acid, Sodium Phosphate, Potassium Sorbate, Phenoxyethanol, Tartaric Acid, Sodium Benzoate, Alpha-Isomethyl Ionone.",
              "resolved": true,
              "source_ids": [
                "R03"
              ]
            }
          ],
          "raw_sha256": "07cd0f0fe0a8764d9fb71c73c8857acf2bcf202006c198cde93637cf1b4b81e6",
          "source_ids": [
            "N03"
          ],
          "normalized_sha256": "d115187c9084ab3b81bbf13e7a0809d1427f5ce8cb8afd70f3fcca768a9689b0",
          "candidate_families": [
            "gluconamide_gluconate",
            "acid_calcium_management"
          ],
          "normalization_version": "bondbuilder-inci-normalization-v1",
          "normalized_ingredients": [
            "aqua",
            "glycerin",
            "parfum",
            "behentrimonium chloride",
            "polysorbate 20",
            "triticum vulgare protein",
            "hydroxypropylgluconamide",
            "hydroxypropylammonium gluconate",
            "hydrolyzed keratin",
            "tocopheryl acetate",
            "panthenol",
            "arginine",
            "triticum vulgare bran extract",
            "triticum vulgare germ extract",
            "triticum vulgare germ oil",
            "camellia oleifera seed oil",
            "guar hydroxypropyltrimonium chloride",
            "cetearyl nonanoate",
            "linoleic acid",
            "caprylyl glycol",
            "caprylic/capric triglyceride",
            "hydroxyacetophenone",
            "tocopherol",
            "hydroxyethylcellulose",
            "polyquaternium-10",
            "polysorbate 60",
            "1,2-hexanediol",
            "isopropyl alcohol",
            "citric acid",
            "disodium phosphate",
            "benzoic acid",
            "sodium phosphate",
            "potassium sorbate",
            "phenoxyethanol",
            "tartaric acid",
            "sodium benzoate",
            "alpha-isomethyl ionone"
          ],
          "candidate_to_final_trace": [
            "Stage A candidates: gluconamide_gluconate, acid_calcium_management.",
            "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
            "Final boundary: in_scope; family: gluconamide_gluconate; tier/basis: low/owner_calibration."
          ]
        },
        "sources": [
          {
            "id": "E01",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
            "limitations": [
              "citric-acid technology",
              "publisher abstract and affiliations; full methods not audited",
              "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
            ],
            "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
            "checked_date": "2026-09-30",
            "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
          },
          {
            "id": "E02",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
            "limitations": [
              "gluconamide/gluconate model chemistry",
              "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
              "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
            ],
            "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
            "checked_date": "2026-09-30",
            "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
          },
          {
            "id": "E03",
            "url": "https://cris.unibo.it/handle/11585/796978",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
            "limitations": [
              "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
              "author-repository abstract inspected; full manuscript not audited",
              "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
            ],
            "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
          },
          {
            "id": "E04",
            "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
            "type": "peer_reviewed_primary",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University of Minho; funding/COI not independently audited here.",
            "limitations": [
              "generic keratin-peptide binding",
              "indexed publisher/PubMed abstract inspected; direct publisher 403",
              "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
            ],
            "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
            "checked_date": "2026-09-30",
            "commercial_context": "University of Minho; funding/COI not independently audited here."
          },
          {
            "id": "P01:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "P02:E05",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
            "limitations": [
              "K18 mask and OLAPLEX No.0, ex-vivo",
              "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
              "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
            ],
            "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
          },
          {
            "id": "E06",
            "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
            "type": "supplier_primary_technical_poster",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland supplier-owned material; not independent retail testing.",
            "limitations": [
              "supplier paired-marker technology, not OGX/Aveda bottles",
              "indexed primary poster text; direct PDF timeout, graphs not inspected",
              "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
            ],
            "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
            "checked_date": "2026-09-30",
            "commercial_context": "Ashland supplier-owned material; not independent retail testing."
          },
          {
            "id": "E07",
            "url": "https://patents.google.com/patent/US11491092B2/en",
            "type": "inventor_patent",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "patent",
            "affiliation": "Inventor/patent-holder evidence, not independent validation.",
            "limitations": [
              "bis(2-ethylhexyl) maleate technology examples",
              "description/examples inspected",
              "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
            ],
            "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
            "checked_date": "2026-09-30",
            "commercial_context": "Inventor/patent-holder evidence, not independent validation."
          },
          {
            "id": "R01",
            "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R02",
            "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R03",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "UK manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R04",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "local manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R05",
            "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R06",
            "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R07",
            "url": "https://epres.com/products/bond-repair-treatment",
            "type": "global manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R08",
            "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R09",
            "url": "https://www.douglas.de/de/p/5011495045",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R10",
            "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
            "type": "DE retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "45ml treatment-style INCI, not a 250ml verification.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R11",
            "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R12",
            "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R13",
            "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
            "type": "DE brand/distributor",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "distributor",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R14",
            "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
            "type": "DE-language retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "R15",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
            "type": "DE manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "exact source-listed product/market only",
              "web text inspected"
            ],
            "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N01",
            "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase target 250ml; local retailer source version",
              "full ingredient and application text inspected",
              "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
            ],
            "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N02",
            "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "Kérastase 250ml corroboration",
              "full ingredient and protocol text inspected by source researcher",
              "Retailer corroboration is not a clinical test or supplied-pack verification."
            ],
            "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N03",
            "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
            "type": "DE_exact_product_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
              "researcher full listing; root indexed full ingredient text; root direct open failed",
              "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
            ],
            "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N04",
            "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
            "type": "same_identifier_EU_retailer_corroboration",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": null,
            "limitations": [
              "OGX50ml EAN3574661818474, Norway; not a DE pack",
              "researcher full listing and ingredient text",
              "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
            ],
            "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N05",
            "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
            "type": "manufacturer_protocol",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "epres intended spray bottle/refill system",
              "full official description, FAQs and ingredient text inspected",
              "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
            ],
            "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "P01:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "predecessor",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "P02:N06",
            "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
            "type": "peer_reviewed_primary_endpoint_amendment",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
            "limitations": [
              "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
              "full PDF audited by evidence researcher; root document inspected",
              "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
            ],
            "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
            "checked_date": "2026-09-30",
            "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
          },
          {
            "id": "N07",
            "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
            "type": "peer_reviewed_primary_abstract_amendment",
            "scope": "technology",
            "access": "abstract",
            "author": null,
            "authority": "peer_reviewed",
            "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
            "limitations": [
              "citric-acid technology, not any named retail treatment",
              "publisher abstract inspected; full text inaccessible",
              "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
            ],
            "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
            "checked_date": "2026-09-30",
            "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
          },
          {
            "id": "N08",
            "url": "https://linktr.ee/abbeyyung",
            "type": "creator_own_source",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "AbbeyYung promotional context",
              "own page inspected",
              "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
            ],
            "observation": "Own page lists an epres discount code and links to own channels.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N09",
            "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Abbey bond-repair routine includes epres/K18",
              "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
              "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
            ],
            "observation": "Creator/title/routine inclusion leads identified.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N10",
            "url": "https://olaplex.de/pages/hair-care-ambassadors",
            "type": "brand_relationship_disclosure",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
              "official text inspected",
              "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
            ],
            "observation": "Both named as ambassadors.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "N11",
            "url": "https://olaplex.de/pages/dejangarz",
            "type": "brand_hosted_creator_endorsement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "No3PLUS in Dejan's favourites",
              "official text inspected",
              "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
            ],
            "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "N12",
            "url": "https://whimsysoul.com/epres-bond-repair-review/",
            "type": "original_first_person_longer_use_review",
            "scope": "practice",
            "access": "full_text",
            "author": "Kara",
            "authority": "creator",
            "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
            "limitations": [
              "Kara's epres starter-kit hair experience; article dated2026-04-12",
              "original article text inspected",
              "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
            ],
            "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
            "checked_date": "2026-09-30",
            "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
          },
          {
            "id": "F01",
            "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "product description, directions and INCI inspected 2026-10-01",
              "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
            ],
            "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "F02",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "product description, directions and INCI inspected 2026-10-01",
              "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
            ],
            "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-REDKEN-AU",
            "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "AU product directions, not DE pack",
              "product directions inspected 2026-10-01",
              "Cross-market complement; no concentration equality or binding DE cadence."
            ],
            "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-DE",
            "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "DE manufacturer complement with format/formula applicability limits",
              "FAQ and directions inspected 2026-10-01",
              "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
            ],
            "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
            "checked_date": "2026-10-01",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-PREMIERE-US",
            "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
            "type": "brand_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "Kérastase brand education manager",
            "limitations": [
              "Commercially affiliated US professional usage advice",
              "named brand education manager advice inspected 2026-09-30",
              "Not independent efficacy testing or a binding DE pack schedule."
            ],
            "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
            "checked_date": "2026-09-30",
            "commercial_context": "Kérastase brand education manager"
          },
          {
            "id": "A-JUUT",
            "url": "https://juut.com/blog/damaged-hair-repair/",
            "type": "commercial_professional",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "professional",
            "affiliation": "JUUT / Aveda",
            "limitations": [
              "Aveda product practice",
              "named stylist experiences inspected 2026-09-30",
              "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
            ],
            "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
            "checked_date": "2026-09-30",
            "commercial_context": "JUUT / Aveda"
          },
          {
            "id": "A-REDKEN-CREATOR",
            "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
            "type": "creator_original_video_lead",
            "scope": "practice",
            "access": "uninspected",
            "author": null,
            "authority": "creator",
            "affiliation": null,
            "limitations": [
              "Redken treatment listing only",
              "product listing inspected; detailed verdict uninspected",
              "No positive long-term or efficacy conclusion may be extracted."
            ],
            "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
            "checked_date": "2026-09-30",
            "commercial_context": null
          },
          {
            "id": "A-ELVITAL-EDITORIAL",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue editorial guidance",
              "editorial applicability inspected 2026-09-30",
              "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
            ],
            "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "A-ELVITAL-WEEKLY",
            "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
            "type": "manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": null,
            "limitations": [
              "Ambiguous Rescue weekly advice",
              "editorial applicability inspected 2026-09-30",
              "Exact product-version applicability is unresolved; do not impose weekly use."
            ],
            "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
            "checked_date": "2026-09-30",
            "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
          },
          {
            "id": "S01",
            "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith EU",
            "limitations": [
              "Actual pack not supplied; manufacturer warns that formula lists can change.",
              "Product title salve does not itself establish an applied cream texture.",
              "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S02",
            "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Curlsmith DE",
            "limitations": [
              "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
              "Original scope: DE 237 ml listing and translated formula/directions",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S03",
            "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
            "type": "brand_owner_retailer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "retailer",
            "affiliation": "dm / Balea",
            "limitations": [
              "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
              "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
            ],
            "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S04",
            "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "Garnier DE / L'Oréal",
            "limitations": [
              "Rich formula is a description, not enough to certify cream texture.",
              "No actual pack.",
              "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S05",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "local_manufacturer",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
              "Concentration label is a branded complex claim, not ingredient dose.",
              "No study protocol, comparator or data inspected.",
              "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
            ],
            "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S06",
            "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
            "type": "manufacturer_editorial",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": "Sharley Butcher",
            "authority": "manufacturer",
            "affiliation": "Curlsmith / Sharley Butcher",
            "limitations": [
              "Not an inspected peer-reviewed study.",
              "Select current local product directions, retaining this differing editorial separately.",
              "Original scope: manufacturer editorial and historical study disclosure",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
            ],
            "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S07",
            "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
            "type": "supplier_document",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland, hosted by distributor ChemPoint",
            "limitations": [
              "This is not Curlsmith's formulation, supplier verification or product dose.",
              "Stability testing is not an efficacy trial.",
              "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
            ],
            "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S08",
            "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
            "type": "supplier_statement",
            "scope": "technology",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "supplier",
            "affiliation": "Ashland",
            "limitations": [
              "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
              "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
              "Original scope: supplier press release 2024-02-22, technology scope",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
            ],
            "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S09",
            "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
            "type": "original_creator_statement",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": "Gena Marie",
            "authority": "creator",
            "affiliation": "Gena Marie",
            "limitations": [
              "Historical formula/market not bound to current EU version.",
              "Article inspected; linked video not independently watched.",
              "Not an Abbey Yung endorsement.",
              "Original scope: original written sponsored creator comparison, 2021-01-03",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
            ],
            "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
            "checked_date": "2026-10-02",
            "commercial_context": "sponsored post; affiliate links"
          },
          {
            "id": "S10",
            "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
              "Original scope: original anecdotal discussion, historical unspecified pack",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown; do not infer independence"
          },
          {
            "id": "S11",
            "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
            "type": "user_anecdotes",
            "scope": "practice",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "other",
            "affiliation": "Reddit users",
            "limitations": [
              "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
              "Original scope: historical anecdote with alternating treatment system",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
            ],
            "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
            "checked_date": "2026-10-02",
            "commercial_context": "commercial interests unknown"
          },
          {
            "id": "S12",
            "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
            "type": "manufacturer_professional_document",
            "scope": "system",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "Different test scopes retained, not combined as serum-alone results.",
              "No original methods, full data or current formula equivalence inspected.",
              "Original scope: historical professional service leaflet",
              "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
            ],
            "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
            "checked_date": "2026-10-02",
            "commercial_context": "publisher sells the described product or ingredient"
          },
          {
            "id": "S13",
            "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
            "type": "manufacturer_application_amendment",
            "scope": "product",
            "access": "inspected_excerpt",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "L'Oréal Professionnel DE",
            "limitations": [
              "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
              "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
              "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
              "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
              "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
            ],
            "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
            "checked_date": "2026-10-02",
            "commercial_context": "maker sells the product"
          },
          {
            "id": "C03-P06-1",
            "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
            "type": "producer_direction_complement_uk",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "manufacturer",
            "affiliation": "OGX / Kenvue UK",
            "limitations": [
              "UK label-direction complement only. No official DE directions were located by the bounded searches; DE/EU pack equality is unresolved.",
              "Serum is the explicit producer format label; no viscosity, spray format or dose in ml inferred.",
              "Overnight is the stated use pattern, not a numeric minimum or maximum contact-time measurement.",
              "Source market: UK. Bound to producer-source-complement-2026-10-03/C03-P06-1; application directions only."
            ],
            "observation": "Official UK page identifies the 50 ml Sealing Serum. Before bed, spread a small amount between hands and distribute evenly through damp or dry hair, beginning at the ends and moving upward. Leave in overnight; rinsing is not required. Suggested use is 1–2 times weekly. The range routine says cleanse and condition first, then apply the Bond Protein Repair oil or serum.",
            "checked_date": "2026-10-03",
            "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
          },
          {
            "id": "D06-OGX-BOOZT",
            "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
            "type": "exact_de_retailer_directions_2026_10_06",
            "scope": "product",
            "access": "full_text",
            "author": null,
            "authority": "retailer",
            "affiliation": "Boozt, authorized OGX retailer",
            "limitations": [
              "Exact German-market 50 ml offer and EAN 3574661818474; physical pack not inspected.",
              "Application directions only; selected formula and trust remain unchanged.",
              "DE source gives no usage frequency. UK 1–2/week remains limited, not a DE instruction."
            ],
            "observation": "The DE offer identifies the OGX 50 ml Sealing Serum, EAN 3574661818474. Its directions describe bedtime use: take a small quantity into the palms, rub hands together, and spread through damp or dry hair from the tips upward. Keep the treatment in overnight without rinsing. The rest of the Bond Protein Repair range is suggested, not stated as a required companion or an extra wash. No DE frequency is specified.",
            "checked_date": "2026-10-06",
            "commercial_context": "Retailer product directions, not independent efficacy evidence."
          }
        ],
        "version": "bondbuilder-research-profile-v1",
        "evidence": {
          "detail": "E02 describes model chemistry with unresolved full hair-strengthening mechanism. E06 is partial supplier poster evidence with a described experiment unlike unknown retail dose/protocol. OGX five-wash claims are system/comparator claims, not an isolated-product experiment. No inspected original creator verdict supplied.",
          "summary": "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
          "cautions": [
            "No native-bond restoration, product superiority or active dose is established by the family label.",
            "DE list translation/punctuation repairs are exact-version only.",
            "UK directions do not certify a supplied DE pack.",
            "Supplier identity and dose cannot be inferred from the marker pair."
          ],
          "practical": {
            "limitations": [
              "No inspected original applicable practice verdict supports a benefit claim. Missing or inaccessible opinions are neutral."
            ],
            "counter_source_ids": [],
            "supporting_source_ids": []
          },
          "scientific": {
            "limitations": [
              "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
              "DE list translation/punctuation repairs are exact-version only.",
              "UK directions do not certify a supplied DE pack.",
              "Supplier identity and dose cannot be inferred from the marker pair."
            ],
            "counter_source_ids": [
              "E02"
            ],
            "supporting_source_ids": [
              "E02",
              "E06"
            ]
          },
          "applicability": [
            {
              "scope": "technology",
              "bridge": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
              "source_ids": [
                "E02"
              ],
              "limitations": [
                "gluconamide/gluconate model chemistry",
                "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
              ]
            },
            {
              "scope": "technology",
              "bridge": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
              "source_ids": [
                "E06"
              ],
              "limitations": [
                "supplier paired-marker technology, not OGX/Aveda bottles",
                "indexed primary poster text; direct PDF timeout, graphs not inspected",
                "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
              ]
            },
            {
              "scope": "product",
              "bridge": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
              "source_ids": [
                "N03"
              ],
              "limitations": [
                "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
                "researcher full listing; root indexed full ingredient text; root direct open failed",
                "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
              ]
            },
            {
              "scope": "product",
              "bridge": "Full INCI, overnight directions, five-wash system/comparator footnote.",
              "source_ids": [
                "R03"
              ],
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ]
            },
            {
              "scope": "product",
              "bridge": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "source_ids": [
                "F02"
              ],
              "limitations": [
                "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
                "product description, directions and INCI inspected 2026-10-01",
                "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
              ]
            },
            {
              "scope": "product",
              "bridge": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
              "source_ids": [
                "N04"
              ],
              "limitations": [
                "OGX50ml EAN3574661818474, Norway; not a DE pack",
                "researcher full listing and ingredient text",
                "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
              ]
            }
          ],
          "supported_outcome": "Paired-marker technology plausibility; neither exact OGX molecular repair nor product-alone five-wash system results established.",
          "manufacturer_positioning": [
            "N03: German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
            "R03: Full INCI, overnight directions, five-wash system/comparator footnote.",
            "F02: UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency"
          ]
        },
        "identity": {
          "gtin": null,
          "size": "50 ml",
          "brand": "OGX",
          "market": "DE/EU",
          "status": "resolved",
          "product_id": "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
          "product_name": "OGX Bond Protein Repair Sealing Serum",
          "research_key": "P06",
          "source_version": "2026-09-30:N03"
        },
        "assessment": {
          "reasoning": {
            "trust_basis": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "N03"
              ],
              "assumptions": [],
              "limitations": []
            },
            "intended_role": {
              "rationale": "The selected DE listing explicitly corroborates overnight leave-in directions.",
              "confidence": "high",
              "source_ids": [
                "N03"
              ],
              "assumptions": [],
              "limitations": []
            },
            "fit_assessment": {
              "rationale": "No source-supported diameter-specific suitability values are present. Damage, curl pattern, porosity and format do not establish diameter fit.",
              "confidence": "low",
              "source_ids": [],
              "assumptions": [],
              "limitations": [
                "All three diameter values remain null; this is not a finding of unsuitability."
              ]
            },
            "product_format": {
              "rationale": "The capture describes the applied 50 ml serum.",
              "confidence": "high",
              "source_ids": [
                "F02"
              ],
              "assumptions": [],
              "limitations": []
            },
            "treatment_mode": {
              "rationale": "The selected observation explicitly describes leave-in directions.",
              "confidence": "high",
              "source_ids": [
                "N03"
              ],
              "assumptions": [],
              "limitations": []
            },
            "boundary_status": {
              "rationale": "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
              "confidence": "moderate",
              "source_ids": [
                "N03",
                "R03",
                "F02"
              ],
              "assumptions": [],
              "limitations": [
                "DE list translation/punctuation repairs are exact-version only.",
                "UK directions do not certify a supplied DE pack.",
                "Supplier identity and dose cannot be inferred from the marker pair."
              ]
            },
            "application_mode": {
              "rationale": "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established.",
              "confidence": "low",
              "source_ids": [
                "C03-P06-1"
              ],
              "assumptions": [
                "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established."
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
              ]
            },
            "evidence_profile": {
              "rationale": "E02 describes model chemistry with unresolved full hair-strengthening mechanism. E06 is partial supplier poster evidence with a described experiment unlike unknown retail dose/protocol. OGX five-wash claims are system/comparator claims, not an isolated-product experiment. No inspected original creator verdict supplied.",
              "confidence": "moderate",
              "source_ids": [
                "E02",
                "E06",
                "N03",
                "R03",
                "F02",
                "N04"
              ],
              "assumptions": [],
              "limitations": [
                "Duplicate captures of one study are not independent trials."
              ]
            },
            "application_facts": {
              "rationale": "Producer application amendment supplies direction sources; 2 application fact wrappers remain unknown.",
              "confidence": "moderate",
              "source_ids": [
                "F02",
                "N03",
                "R03",
                "C03-P06-1"
              ],
              "assumptions": [],
              "limitations": [
                "Remaining application unknowns are retained; no fact was inferred."
              ]
            },
            "claim_trust_level": {
              "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
              "confidence": "high",
              "source_ids": [
                "N03"
              ],
              "assumptions": [],
              "limitations": [
                "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
              ]
            },
            "supported_outcome": {
              "rationale": "Paired-marker technology plausibility; neither exact OGX molecular repair nor product-alone five-wash system results established.",
              "confidence": "moderate",
              "source_ids": [
                "E02",
                "E06",
                "N03",
                "R03",
                "F02"
              ],
              "assumptions": [],
              "limitations": [
                "DE list translation/punctuation repairs are exact-version only.",
                "UK directions do not certify a supplied DE pack.",
                "Supplier identity and dose cannot be inferred from the marker pair."
              ]
            },
            "technology_family": {
              "rationale": "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
              "confidence": "moderate",
              "source_ids": [
                "N03"
              ],
              "assumptions": [],
              "limitations": [
                "Marker presence does not establish concentration, supplier, delivery or molecular effect."
              ]
            }
          },
          "trust_basis": "owner_calibration",
          "boundary_status": "in_scope",
          "limiting_factors": [
            "DE list translation/punctuation repairs are exact-version only.",
            "UK directions do not certify a supplied DE pack.",
            "Supplier identity and dose cannot be inferred from the marker pair."
          ],
          "policy_reference": "owner-review-2026-09-30:P06",
          "claim_trust_level": "low",
          "technology_family": "gluconamide_gluconate",
          "classification_confidence": "moderate"
        },
        "application": {
          "rinse": {
            "value": {
              "treatment_mode": "leave_in",
              "standalone_treatment_rinse": false
            },
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate rinse; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "amount": {
            "value": {
              "kind": "qualitative",
              "instruction": "Use a small amount."
            },
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate amount; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "timing": {
            "value": {
              "kind": "overnight",
              "purpose": "contact"
            },
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate timing; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "cadence": {
            "value": {
              "status": "source_stated",
              "initial": null,
              "branches": [],
              "maintenance": {
                "kind": "times_per_week",
                "maximum": 2,
                "minimum": 1
              }
            },
            "rationale": "UK suggested frequency is once or twice weekly.",
            "confidence": "moderate",
            "source_ids": [
              "C03-P06-1"
            ],
            "limitations": [
              "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
            ],
            "unknown_reason": null
          },
          "dilution": {
            "value": null,
            "rationale": "P06: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
            "confidence": "low",
            "source_ids": [],
            "limitations": [],
            "unknown_reason": "P06: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
          },
          "partners": {
            "value": [
              {
                "name": "OGX Bond Protein Repair range",
                "requirement": "recommended",
                "exclusivity_established": false,
                "source_ids": [
                  "D06-OGX-BOOZT"
                ]
              }
            ],
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "The retailer recommends the wider range without requiring a companion.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "sequence": {
            "value": [
              {
                "note": "Before bed, apply a small amount from the hands to damp or dry hair.",
                "action": "apply_treatment",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "D06-OGX-BOOZT"
                ]
              },
              {
                "note": "Spread evenly from ends upward.",
                "action": "distribute",
                "timing": null,
                "optional": false,
                "source_ids": [
                  "D06-OGX-BOOZT"
                ]
              },
              {
                "note": "Leave in overnight; no rinsing required.",
                "action": "wait",
                "timing": {
                  "kind": "overnight",
                  "purpose": "contact"
                },
                "optional": false,
                "source_ids": [
                  "D06-OGX-BOOZT"
                ]
              }
            ],
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "DE bedtime application, distribution, then overnight leave-in; no rinse or wash step.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "placement": {
            "value": null,
            "rationale": "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established.",
            "confidence": "low",
            "source_ids": [
              "C03-P06-1"
            ],
            "limitations": [
              "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
            ],
            "unknown_reason": "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established."
          },
          "hair_state": {
            "value": "either",
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate hair_state; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "conditioner": {
            "value": {
              "before": "not_stated",
              "after": "not_stated",
              "minimum_wait_seconds": null,
              "guidance_reference": null
            },
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "No conditioner-before/after requirement is stated in the selected bedtime directions.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "longer_wear": {
            "value": {
              "maximum_seconds": null,
              "overnight_allowed": true
            },
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate longer_wear; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "distribution": {
            "value": "Rub a small amount between the hands, then distribute evenly from ends upward.",
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate distribution; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "source_market": "DE/EU",
          "applied_format": {
            "value": "serum",
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate applied_format; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "treatment_role": {
            "value": "leave_in_treatment",
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate treatment_role; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "source_variants": [
            {
              "market": "DE storefront",
              "selected": false,
              "source_ids": [
                "N03"
              ],
              "differences": "Selected formula and corroborating overnight leave-in description; no pristine physical DE pack."
            },
            {
              "market": "UK",
              "selected": false,
              "source_ids": [
                "F02",
                "R03"
              ],
              "differences": "UK bedtime guidance; five-wash claims are system/comparator dependent. Frequency value and distribution text are missing from the capture."
            },
            {
              "market": "NO",
              "selected": false,
              "source_ids": [
                "N04"
              ],
              "differences": "Same source-listed identifier corroborates punctuation/translation repair only; no worldwide formula or direction equality."
            },
            {
              "market": "UK",
              "selected": false,
              "source_ids": [
                "C03-P06-1"
              ],
              "differences": "UK-only directions selected as a cross-market complement; no assertion that every direction belongs to the DE/EU pack."
            },
            {
              "market": "DE",
              "selected": true,
              "source_ids": [
                "D06-OGX-BOOZT"
              ],
              "differences": "Exact 50 ml DE retailer bedtime/overnight directions; no DE cadence. Existing UK frequency and range sequence are retained only, not mandatory DE directions."
            }
          ],
          "state_modifiers": {
            "value": [
              "at_bedtime"
            ],
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate state_modifiers; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "application_area": {
            "value": "ends_upward",
            "source_ids": [
              "D06-OGX-BOOZT"
            ],
            "confidence": "moderate",
            "rationale": "Exact DE retailer directions corroborate application_area; no washing position or finite overnight duration inferred.",
            "limitations": [
              "Exact DE retailer directions; physical pack not inspected. No scientific efficacy inference."
            ],
            "unknown_reason": null
          },
          "applicability_note": "Exact DE offer 50 ml / EAN 3574661818474 corroborates bedtime application on damp/dry hair and overnight leave-in. Selected formula/identity remain unchanged; no physical pack inspected. Wash placement remains unknown and UK-only frequency stays retained, not projected.",
          "direction_source_ids": [
            "D06-OGX-BOOZT"
          ],
          "market_applicability": "exact_market"
        },
        "explanations_de": {
          "deeper": "Gezieltes Leave-in-Serum mit dem Gluconamid/Gluconat-Paar. Die Hinweise betreffen vor allem die Technologie; eine konkrete molekulare Reparaturleistung dieser Flasche ist nicht belegt. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
          "concise": "Gezieltes Leave-in-Serum mit dem Gluconamid/Gluconat-Paar. Die Hinweise betreffen vor allem die Technologie; eine konkrete molekulare Reparaturleistung dieser Flasche ist nicht belegt."
        },
        "technology_reference": {
          "status": "matched",
          "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
          "product_id": null,
          "source_ids": [
            "N03"
          ],
          "research_key": "P06",
          "formula_sha256": "d115187c9084ab3b81bbf13e7a0809d1427f5ce8cb8afd70f3fcca768a9689b0",
          "shared_markers": [
            "hydroxypropylgluconamide",
            "hydroxypropylammonium gluconate"
          ],
          "source_version": "2026-09-30:N03"
        }
      },
      "spec": {
        "application_mode": "bedtime_leave_in",
        "treatment_mode": "leave_in",
        "usage_protocol": "verified_product_protocol"
      },
      "protocolV1": {
        "schemaVersion": 1,
        "guidanceKey": "v2-exact-bondbuilder_verified_product-2c809d0d-fbce-435a-bbde-aa4270aaf48d",
        "protocolVersion": 2,
        "locale": "de",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "2c809d0d-fbce-435a-bbde-aa4270aaf48d"
        },
        "role": "bond_repair",
        "applicationFamily": "overnight_leave_in_treatment",
        "compatibleDayTypes": [
          "bond_repair_day"
        ],
        "exactGuidanceRequired": true,
        "sequence": {
          "anchor": "timed_treatment",
          "before": [],
          "after": [],
          "conflictsWith": []
        },
        "requirements": {
          "requiredCatalogFacts": [],
          "requiredProtocolFacts": [],
          "requiredProfileFacts": []
        },
        "protocolFacts": {
          "applicationArea": "lengths_ends",
          "rinse": "leave_in",
          "contactTimeSeconds": null,
          "applicationState": "damp_or_dry_hair",
          "treatmentRinse": "leave_in",
          "overnightAllowed": true,
          "conditionerSequence": {
            "before": "not_stated",
            "after": "not_stated",
            "minimumWaitSeconds": null
          },
          "conditionerRelationship": "not_applicable",
          "reapplication": "none",
          "amount": {
            "kind": "qualitative",
            "copyDe": "Eine kleine Menge verwenden."
          },
          "workflowId": "bondbuilder_verified_product",
          "cautions": []
        },
        "steps": [
          {
            "stepKey": "hands",
            "action": "section",
            "copyTemplateDe": "Vor dem Schlafengehen eine kleine Menge zwischen den Händen verreiben."
          },
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyTemplateDe": "Vor dem Schlafengehen anwenden. Auf das feuchte oder trockene Haar geben und von den Spitzen nach oben verteilen."
          },
          {
            "stepKey": "distribute",
            "action": "section",
            "copyTemplateDe": "Gleichmäßig von den Spitzen nach oben verteilen."
          },
          {
            "stepKey": "overnight",
            "action": "wait",
            "copyTemplateDe": "Über Nacht im Haar lassen. Nicht ausspülen."
          }
        ],
        "evidence": [
          {
            "sourceUrl": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
            "sourceType": "retailer",
            "checkedAt": "2026-10-06"
          }
        ]
      },
      "protocolV2": {
        "schemaVersion": 2,
        "contractKind": "product_pointer",
        "scope": {
          "kind": "product",
          "category": "bondbuilder",
          "productId": "2c809d0d-fbce-435a-bbde-aa4270aaf48d"
        },
        "sourceRole": "specialized_bond_treatment",
        "role": "bond_repair",
        "applicationFamily": "overnight_leave_in_treatment",
        "facts": {
          "applicationState": "damp_or_dry_hair",
          "applicationArea": "hair_lengths_ends",
          "rinse": "leave_in",
          "contactTime": null,
          "amount": {
            "kind": "source_instruction",
            "copyDe": "Eine kleine Menge verwenden."
          },
          "heat": null,
          "overnightAllowed": true,
          "conditionerSequence": {
            "before": "not_stated",
            "after": "not_stated",
            "minimumWaitSeconds": null
          },
          "conditionerPolicy": "not_applicable"
        },
        "workflowId": "bondbuilder_verified_product",
        "requiredCompanionProductId": null,
        "runtimeBlockerCode": null,
        "exactSteps": [
          {
            "stepKey": "hands",
            "action": "section",
            "copyDe": "Vor dem Schlafengehen eine kleine Menge zwischen den Händen verreiben."
          },
          {
            "stepKey": "apply",
            "action": "apply_product",
            "copyDe": "Vor dem Schlafengehen anwenden. Auf das feuchte oder trockene Haar geben und von den Spitzen nach oben verteilen."
          },
          {
            "stepKey": "distribute",
            "action": "section",
            "copyDe": "Gleichmäßig von den Spitzen nach oben verteilen."
          },
          {
            "stepKey": "overnight",
            "action": "wait",
            "copyDe": "Über Nacht im Haar lassen. Nicht ausspülen."
          }
        ],
        "cautionCodes": [],
        "evidence": [
          {
            "sourceUrl": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
            "sourceType": "retailer",
            "checkedAt": "2026-10-06"
          }
        ]
      },
      "cadence": null,
      "eligibleThicknesses": [
        "fine",
        "normal",
        "coarse"
      ],
      "source": {
        "source_url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
        "source_text": "The DE offer identifies the OGX 50 ml Sealing Serum, EAN 3574661818474. Its directions describe bedtime use: take a small quantity into the palms, rub hands together, and spread through damp or dry hair from the tips upward. Keep the treatment in overnight without rinsing. The rest of the Bond Protein Repair range is suggested, not stated as a required companion or an extra wash. No DE frequency is specified."
      },
      "removedProtocolHolds": [
        "application.dilution",
        "application.market_applicability",
        "application.placement"
      ]
    },
    "preimage": {
      "spec": {
        "created_at": "2026-10-04T08:37:55.642259+00:00",
        "product_id": "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
        "updated_at": "2026-10-04T08:37:55.642259+00:00",
        "trust_basis": "owner_calibration",
        "category_key": "bondbuilder",
        "product_format": null,
        "treatment_mode": "leave_in",
        "usage_protocol": null,
        "application_mode": null,
        "bond_repair_axis": null,
        "research_profile": {
          "fit": {
            "fine": {
              "value": null,
              "rationale": "P06: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P06: no captured fine-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "coarse": {
              "value": null,
              "rationale": "P06: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P06: no captured coarse-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            },
            "normal": {
              "value": null,
              "rationale": "P06: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P06: no captured normal-diameter suitability value; manufacturer all-hair/damage language, curl pattern or ingredient texture cannot supply a diameter fit flag."
            }
          },
          "holds": {
            "fit": [
              {
                "code": "diameter_fit_unknown",
                "field": "fit",
                "reason": "Fine, normal and coarse suitability are independently unknown; no all-diameter default.",
                "source_ids": []
              }
            ],
            "boundary": [],
            "identity": [],
            "protocol": [
              {
                "code": "source_fact_unknown",
                "field": "application.dilution",
                "reason": "P06: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
                "source_ids": []
              },
              {
                "code": "cross_market_direction_limit",
                "field": "application.market_applicability",
                "reason": "UK bedtime/overnight directions are not a supplied DE pack verification.",
                "source_ids": [
                  "F02",
                  "N03"
                ]
              },
              {
                "code": "source_fact_unknown",
                "field": "application.placement",
                "reason": "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established.",
                "source_ids": [
                  "C03-P06-1"
                ]
              }
            ],
            "claim_trust": []
          },
          "method": {
            "method_id": "bondbuilder-inci",
            "output_sha256": "f0f7690b08d7485efa16cc7a10e89db155b9ac3aa41d6eb09299578935fa6a1f",
            "prompt_sha256": "3019d9d4aa97167af1821f21609beaa414ea58e5f653b1dc3cc4e666191b2ec7",
            "run_reference": "replay-2026-10-03-v0.5-r3",
            "method_version": "bondbuilder-inci-v0.5",
            "runbook_sha256": "5e54370eb907afbbbdce08115e497716fd2fe15c1b6d0bbff1f2e0e97194c0ff",
            "standard_sha256": "9fbbf63c2201732229741d2aa534a685ba999dd801f4ae5fbfe1ca4768b2b816",
            "artifact_reference": "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/lane-b/assembled/P06.json",
            "blind_guide_sha256": "4840b6d60efb00db856aa0de4f16cdb140ebcace7da561b5b6d567d2b1acdd41",
            "reference_registry_sha256": "db2bc09840296fb54f79928d4a6832ac402a6b18761fcdf9fe48e02ae1570924"
          },
          "review": {
            "checked_date": "2026-10-03",
            "reviewed_date": null,
            "profile_sha256": "f0f7690b08d7485efa16cc7a10e89db155b9ac3aa41d6eb09299578935fa6a1f",
            "decision_references": []
          },
          "formula": {
            "status": "complete",
            "markers": [
              {
                "family": "gluconamide_gluconate",
                "literal": "hydroxypropylgluconamide",
                "source_ids": [
                  "N03"
                ]
              },
              {
                "family": "gluconamide_gluconate",
                "literal": "hydroxypropylammonium gluconate",
                "source_ids": [
                  "N03"
                ]
              },
              {
                "family": "acid_calcium_management",
                "literal": "arginine",
                "source_ids": [
                  "N03"
                ]
              },
              {
                "family": "acid_calcium_management",
                "literal": "citric acid",
                "source_ids": [
                  "N03"
                ]
              }
            ],
            "raw_inci": "Aqua, Glycerin, Parfum, Behentrimonium Chloride, Polysorbate 20, Triticum Vulgare Protein, Hydroxypropylgluconamide, Hydroxypropylammonium Gluconate, Hydrolyzed Keratin, Tocopheryl Acetat, Panthenol, Arginine, Triticum Vulgare Bran Extract, Triticum Vulgare Germ Extract, Triticum Vulgare Germ Öl, Camellia Oleifera Seed Öl, Guar Hydroxypropyltrimonium Chloride, Cetearyl Nonanoate, Linoleic Acid, Caprylyl Glycol, Caprylic, Capric Triglyceride, Hydroxyacetophenone, Tocopherol, Hydroxyethylcellulose, Polyquaternium-10, Polysorbate 60, 1, 2-Hexanediol, Isopropyl Alcohol, Citric Acid, Disodium Phosphate, Benzoic Acid, Sodium Phosphate, Potassium Sorbate, Phenoxyethanol, Tartaric Acid, Sodium Benzoate, Alpha-Isomethyl Ionone",
            "conflicts": [
              {
                "reason": "Displaced historical source retained; the reviewed selected source-version is not a claim of cross-market equality.",
                "raw_inci": "Aqua/Water/Eau, Glycerin, Parfum/Fragrance, Behentrimonium Chloride, Polysorbate 20, Triticum Vulgare Protein, Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate, Hydrolyzed Keratin, Tocopheryl Acetate, Panthenol, Arginine, Triticum Vulgare Bran Extract, Triticum Vulgare Germ Extract, Triticum Vulgare Germ Oil, Camelia Oleifera Seed Oil, Guar Hydroxypropyltrimonium Chloride, Cetearyl Nonanoate, Linoleic Acid, Caprylyl Glycol, Caprylic/Capric Triglyceride, Hydroxyacetophenone, Tocopherol, Hydroxyethylcellulose, Polyquaternium-10, Polysorbate 60, 1,2-Hexanediol, Isopropyl Alcohol, Citric Acid, Disodium Phosphate, Benzoic Acid, Sodium Phosphate, Potassium Sorbate, Phenoxyethanol, Tartaric Acid, Sodium Benzoate, Alpha-Isomethyl Ionone.",
                "resolved": true,
                "source_ids": [
                  "R03"
                ]
              }
            ],
            "raw_sha256": "07cd0f0fe0a8764d9fb71c73c8857acf2bcf202006c198cde93637cf1b4b81e6",
            "source_ids": [
              "N03"
            ],
            "normalized_sha256": "d115187c9084ab3b81bbf13e7a0809d1427f5ce8cb8afd70f3fcca768a9689b0",
            "candidate_families": [
              "gluconamide_gluconate",
              "acid_calcium_management"
            ],
            "normalization_version": "bondbuilder-inci-normalization-v1",
            "normalized_ingredients": [
              "aqua",
              "glycerin",
              "parfum",
              "behentrimonium chloride",
              "polysorbate 20",
              "triticum vulgare protein",
              "hydroxypropylgluconamide",
              "hydroxypropylammonium gluconate",
              "hydrolyzed keratin",
              "tocopheryl acetate",
              "panthenol",
              "arginine",
              "triticum vulgare bran extract",
              "triticum vulgare germ extract",
              "triticum vulgare germ oil",
              "camellia oleifera seed oil",
              "guar hydroxypropyltrimonium chloride",
              "cetearyl nonanoate",
              "linoleic acid",
              "caprylyl glycol",
              "caprylic/capric triglyceride",
              "hydroxyacetophenone",
              "tocopherol",
              "hydroxyethylcellulose",
              "polyquaternium-10",
              "polysorbate 60",
              "1,2-hexanediol",
              "isopropyl alcohol",
              "citric acid",
              "disodium phosphate",
              "benzoic acid",
              "sodium phosphate",
              "potassium sorbate",
              "phenoxyethanol",
              "tartaric acid",
              "sodium benzoate",
              "alpha-isomethyl ionone"
            ],
            "candidate_to_final_trace": [
              "Stage A candidates: gluconamide_gluconate, acid_calcium_management.",
              "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
              "Final boundary: in_scope; family: gluconamide_gluconate; tier/basis: low/owner_calibration."
            ]
          },
          "sources": [
            {
              "id": "E01",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Authors L’Oréal Research & Innovation; declared no conflict in article.",
              "limitations": [
                "citric-acid technology",
                "publisher abstract and affiliations; full methods not audited",
                "Exact dose/formulation/full protocol unavailable in inspected abstract; no retail effect-size transfer."
              ],
              "observation": "Zhang et al. 2025 tested chemically treated hair using thermal, tensile/fatigue, diffraction and elemental methods. Abstract reports reinforcement and calcium reduction; multiple mechanisms are proposed. No named pilot bottle is demonstrated by this abstract.",
              "checked_date": "2026-09-30",
              "commercial_context": "Authors L’Oréal Research & Innovation; declared no conflict in article."
            },
            {
              "id": "E02",
              "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9542698/",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "Durham authors plus Ashland coauthor; supplier involvement disclosed.",
              "limitations": [
                "gluconamide/gluconate model chemistry",
                "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
              ],
              "observation": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
              "checked_date": "2026-09-30",
              "commercial_context": "Durham authors plus Ashland coauthor; supplier involvement disclosed."
            },
            {
              "id": "E03",
              "url": "https://cris.unibo.it/handle/11585/796978",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; funding/COI unavailable in inspected abstract.",
              "limitations": [
                "maleate/shikimic model and commercial-agent study, not current No.3PLUS",
                "author-repository abstract inspected; full manuscript not audited",
                "Dimethyl maleate model is not Bis-Aminopropyl Diglycol Dimaleate. Exact commercial identities/protocol applicability need full-text audit; not a blanket demonstration of no benefit."
              ],
              "observation": "Di Foggia et al. 2021 use IR/Raman and SEM on bleached hair. Abstract reports surface benefits and structural changes, but no cortex disulfide-content increase or direct sulfa-Michael crosslinking evidence; cuticle effect cannot be excluded.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; funding/COI unavailable in inspected abstract."
            },
            {
              "id": "E04",
              "url": "https://www.sciencedirect.com/science/article/pii/S0141813016319493",
              "type": "peer_reviewed_primary",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University of Minho; funding/COI not independently audited here.",
              "limitations": [
                "generic keratin-peptide binding",
                "indexed publisher/PubMed abstract inspected; direct publisher 403",
                "No exact sh-Oligopeptide-78 mask, damaged-fibre efficacy or reconstructed polypeptide backbone tested by this abstract."
              ],
              "observation": "Cruz et al. 2017 screened 1,235 keratin-derived decapeptides on glass arrays against extracted human-hair keratin. Binding differed with peptide composition.",
              "checked_date": "2026-09-30",
              "commercial_context": "University of Minho; funding/COI not independently audited here."
            },
            {
              "id": "P01:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "P02:E05",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests.",
              "limitations": [
                "K18 mask and OLAPLEX No.0, ex-vivo",
                "full institutional PDF; methods/results/funding inspected; no numerical chart inference",
                "Small ex-vivo study; no vehicle/active-isolation comparator; nonstandard dosage/handling. Does not test No.3PLUS. Authors' bond/core interpretations are not independent proof of native molecular reconstruction."
              ],
              "observation": "Martins et al. 2024 list K18's 21-ingredient formula and four-ingredient OLAPLEX No.0. Twice-bleached purchased Caucasian tresses: 10% product/hair mass, one-minute massage, four-minute reaction, brushing, 48-hour conditioning; three tresses per condition, mechanical testing on 25 fibres. Reported tensile improvement is clearly significant for No.0; K18's reported increase is not clearly significant in the inspected text. Multiple surface/structural measurements are reported.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI project with Amyris Bio Products Portugal support; declared no known competing interests."
            },
            {
              "id": "E06",
              "url": "https://www.ashland.com/file_source/Ashland/Documents/Poster%20FiberHance%20bm%2001312020.pdf",
              "type": "supplier_primary_technical_poster",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland supplier-owned material; not independent retail testing.",
              "limitations": [
                "supplier paired-marker technology, not OGX/Aveda bottles",
                "indexed primary poster text; direct PDF timeout, graphs not inspected",
                "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
              ],
              "observation": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
              "checked_date": "2026-09-30",
              "commercial_context": "Ashland supplier-owned material; not independent retail testing."
            },
            {
              "id": "E07",
              "url": "https://patents.google.com/patent/US11491092B2/en",
              "type": "inventor_patent",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "patent",
              "affiliation": "Inventor/patent-holder evidence, not independent validation.",
              "limitations": [
                "bis(2-ethylhexyl) maleate technology examples",
                "description/examples inspected",
                "Different companions from retail concentrate; qualitative observations/images, not inspected quantitative structural/tensile evidence. Patent claim ranges and grant are not proof of retail repair efficacy."
              ],
              "observation": "Examples compare maleate/conditioning formulations with untreated or bleach controls. Post-bleach example uses water, bis(2-ethylhexyl) maleate and behentrimonium chloride, with qualitative shine/softness/combability/frizz outcomes. Other examples include salon chemical mixtures.",
              "checked_date": "2026-09-30",
              "commercial_context": "Inventor/patent-holder evidence, not independent validation."
            },
            {
              "id": "R01",
              "url": "https://www.loreal-paris.de/elvital/bond-repair/rescue-pre-shampoo",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Plus INCI, directions, 22% complex wording; isolated-product test methods not exposed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R02",
              "url": "https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-intensive-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full manufacturer INCI and formula code; conflict with R09 retained.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R03",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "UK manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full INCI, overnight directions, five-wash system/comparator footnote.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R04",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "local manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "150ml local INCI ILN53057, dry pre-shampoo protocol and curly-hair/no-conditioner test comparator.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R05",
              "url": "https://olaplex.com/products/olaplex-n-3plus-complete-repair-treatment-100ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full global current formula and claims; differs from local captured variant. No detailed current test report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R06",
              "url": "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full current global formula, directions and attributed clinical/molecular claims; no detailed report inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R07",
              "url": "https://epres.com/products/bond-repair-treatment",
              "type": "global manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Four-ingredient concentrate, kit/use directions, attributed disulfide/continued-action claims; no quantitative test methods.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R08",
              "url": "https://www.dm.de/p/d/1679220/l-oreal-paris-elvital-pre-shampoo-bond-repair-anti-haarschaeden",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "200ml INCI agrees with Plus after typography cleanup; GTIN3600524074517 retailer lead, not pack-verified. Old 12% copy retained as conflict.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R09",
              "url": "https://www.douglas.de/de/p/5011495045",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Full materially different Redken INCI, directions; not merged with manufacturer.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R10",
              "url": "https://en.zalando.de/kerastase-concentre-decalcifiant-ultra-reparateur-system-0-keh31h01a-s11.html",
              "type": "DE retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "45ml treatment-style INCI, not a 250ml verification.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R11",
              "url": "https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "21-ingredient mask list, barcode lead858511001128, local instructions. Distributor identity not silently called manufacturer authority.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R12",
              "url": "https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Local current-listed INCI differs from global formula; directions are three-minute wet pre-shampoo.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R13",
              "url": "https://epres-hair.de/modal.aspx?WPParams=50C9D4C6C5D2E6BDA5A98395A992",
              "type": "DE brand/distributor",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "distributor",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "2x15ml refill concentrate; four ingredients corroborate global concentrate by spelling; no precise water volume.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R14",
              "url": "https://lyko.com/de/ogx/ogx-bond-repair-sealing-serum-50-ml",
              "type": "DE-language retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Listing inspected; exact supplied market/formula not resolved. Price not used for research.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "R15",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/3474637196684.html",
              "type": "DE manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "exact source-listed product/market only",
                "web text inspected"
              ],
              "observation": "Initial page retrieval succeeded; subsequent timeout. Travel-selected URL and reported layering/system footnotes retained; exact 250ml formula unresolved.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N01",
              "url": "https://www.basler-beauty.de/marken/kerastase/kerastase-premiere-concentre-decalcifiant-ultra-reparateur-250-ml.html",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase target 250ml; local retailer source version",
                "full ingredient and application text inspected",
                "Source-listed version, not physical pack; broad 99% restoration copy is not an inspected isolated-product experiment."
              ],
              "observation": "Exact 250ml target, complete 21-ingredient treatment list, FIL N70030006/1; wet lengths, massage, 5min, do not rinse, layer Première Bain shampoo, rinse then conditioner/mask.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N02",
              "url": "https://www.klier-hair-world.de/premiere-concentre-decalcifiant-ultra-reparateur-250-ml/111820",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "Kérastase 250ml corroboration",
                "full ingredient and protocol text inspected by source researcher",
                "Retailer corroboration is not a clinical test or supplied-pack verification."
              ],
              "observation": "Same treatment-style complete list and no-rinse-before-Première-shampoo layering sequence.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N03",
              "url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
              "type": "DE_exact_product_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
                "researcher full listing; root indexed full ingredient text; root direct open failed",
                "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
              ],
              "observation": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N04",
              "url": "https://www.med24.no/haarpleie/styling-produkter/haarolje-og-serum/ogx-bond-repair-sealing-serum-50-ml",
              "type": "same_identifier_EU_retailer_corroboration",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": null,
              "limitations": [
                "OGX50ml EAN3574661818474, Norway; not a DE pack",
                "researcher full listing and ingredient text",
                "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
              ],
              "observation": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N05",
              "url": "https://epres.com/products/bond-repair-concentrate-refill-pack",
              "type": "manufacturer_protocol",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "epres intended spray bottle/refill system",
                "full official description, FAQs and ingredient text inspected",
                "Use supplied bottle/fill instruction; not an inferred universal custom-bottle ratio or a retail efficacy test. Exact local kit/pack binding remains separate."
              ],
              "observation": "One vial into intended epres spray bottle, fill water and shake; each vial creates150ml finished treatment. Do not double concentrate. Dry unwashed hair, fully saturate, at least10min, cleanse/style as usual, 1–2times weekly; after mixing use within2months.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "P01:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "predecessor",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "P02:N06",
              "url": "https://ciencia.ucp.pt/ws/portalfiles/portal/108144292/108144176.pdf",
              "type": "peer_reviewed_primary_endpoint_amendment",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests.",
              "limitations": [
                "Martins2024 K18listed21ingredient mask and OLAPLEXNo0, notNo3/No3PLUS",
                "full PDF audited by evidence researcher; root document inspected",
                "No vehicle/conditioner control, small heavily bleached Caucasian-tress sample, nonstandard dosing; no personal/head-to-head efficacy ranking, native molecular reconstruction proof or No3PLUS transfer."
              ],
              "observation": "Single4min ex-vivo treatment, three bleached tresses per condition, 10% product/hair mass. Both products show surface/appearance changes. Only No0 tensile-strength increase is explicitly described as significant; K18 increase lacks that statement. No0 extensibility trend and several thermal endpoints are not statistically confirmed. K18 spectral changes are largely attributed to excipients, not established protein reconstruction.",
              "checked_date": "2026-09-30",
              "commercial_context": "University authors; ERDF/POCI, Amyris Bio Products Portugal and university support; declared no competing interests."
            },
            {
              "id": "N07",
              "url": "https://onlinelibrary.wiley.com/doi/10.1111/ics.13039",
              "type": "peer_reviewed_primary_abstract_amendment",
              "scope": "technology",
              "access": "abstract",
              "author": null,
              "authority": "peer_reviewed",
              "affiliation": "L’Oréal Research & Innovation authors; declared no conflict.",
              "limitations": [
                "citric-acid technology, not any named retail treatment",
                "publisher abstract inspected; full text inaccessible",
                "Dose,pH,vehicle,full treatment protocol,n and full statistical details not inspected. Do not transfer abstract percentages to bottles or treat unknown study conditions as a known match."
              ],
              "observation": "Zhang2025 reports improved mechanical/thermal properties and reduced calcium after citric-acid treatment of chemically treated fibers; endpoints include tensile modulus, fatigue cycles, DSC, XRD and calcium analyses. Dependence on pre-existing chemical damage is explicit.",
              "checked_date": "2026-09-30",
              "commercial_context": "L’Oréal Research & Innovation authors; declared no conflict."
            },
            {
              "id": "N08",
              "url": "https://linktr.ee/abbeyyung",
              "type": "creator_own_source",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "AbbeyYung promotional context",
                "own page inspected",
                "Promotional relationship visible; compensation not established by code alone. No audited first-person efficacy verdict or repeated-use claim on this page."
              ],
              "observation": "Own page lists an epres discount code and links to own channels.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N09",
              "url": "https://www.youtube.com/watch?v=QM8glR1ClyA",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Abbey bond-repair routine includes epres/K18",
                "indexed description only; original video/transcript inaccessible; normal browser retry unavailable",
                "No first-person product benefit, limitation, duration or verdict extracted. Secondary summaries are not substituted."
              ],
              "observation": "Creator/title/routine inclusion leads identified.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N10",
              "url": "https://olaplex.de/pages/hair-care-ambassadors",
              "type": "brand_relationship_disclosure",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "TomHannemann/@_the.beautiful.people and DejanGarz/@dejangarz",
                "official text inspected",
                "Brand relationship, not exact-product testing or repeated use. No readable original first-person pilot take found in bounded follow-up."
              ],
              "observation": "Both named as ambassadors.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "N11",
              "url": "https://olaplex.de/pages/dejangarz",
              "type": "brand_hosted_creator_endorsement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "No3PLUS in Dejan's favourites",
                "official text inspected",
                "Endorsement/selection, not independent test, first-person result or repeated-use proof. Generic legacy copy is not evidence for current product."
              ],
              "observation": "Brand-hosted favourites include current No3PLUS; DEJAN-15 promotion present.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "N12",
              "url": "https://whimsysoul.com/epres-bond-repair-review/",
              "type": "original_first_person_longer_use_review",
              "scope": "practice",
              "access": "full_text",
              "author": "Kara",
              "authority": "creator",
              "affiliation": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed.",
              "limitations": [
                "Kara's epres starter-kit hair experience; article dated2026-04-12",
                "original article text inspected",
                "Uncontrolled self-report, concurrent routine changes; predominantly sensory results. No molecular/structural efficacy inference or grade from this source alone. Ignore article's unsupported mechanism/origin/nail generalizations."
              ],
              "observation": "Reports months of weekly use on coloured hair, increased softness and easier home application. Notes potential weight if extended wear/not thoroughly washed. Reports treatment experience using other shampoos too; full product-line use also disclosed.",
              "checked_date": "2026-09-30",
              "commercial_context": "Lifestyle/beauty reviewer, not verified hair scientist; affiliate links explicitly disclosed."
            },
            {
              "id": "F01",
              "url": "https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
                "product description, directions and INCI inspected 2026-10-01",
                "No quantitative dose found. Manufacturer suitability is not an independent weightlessness finding."
              ],
              "observation": "DE pre-shampoo: gel-cream, root-to-tip application, conditional frequency and manufacturer diameter positioning",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "F02",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
                "product description, directions and INCI inspected 2026-10-01",
                "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
              ],
              "observation": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-REDKEN-AU",
              "url": "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "AU product directions, not DE pack",
                "product directions inspected 2026-10-01",
                "Cross-market complement; no concentration equality or binding DE cadence."
              ],
              "observation": "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-DE",
              "url": "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "DE manufacturer complement with format/formula applicability limits",
                "FAQ and directions inspected 2026-10-01",
                "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding."
              ],
              "observation": "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
              "checked_date": "2026-10-01",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-PREMIERE-US",
              "url": "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
              "type": "brand_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "Kérastase brand education manager",
              "limitations": [
                "Commercially affiliated US professional usage advice",
                "named brand education manager advice inspected 2026-09-30",
                "Not independent efficacy testing or a binding DE pack schedule."
              ],
              "observation": "A named US Kérastase education manager recommends weekly use. Commercially affiliated professional advice, not independent efficacy testing.",
              "checked_date": "2026-09-30",
              "commercial_context": "Kérastase brand education manager"
            },
            {
              "id": "A-JUUT",
              "url": "https://juut.com/blog/damaged-hair-repair/",
              "type": "commercial_professional",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "professional",
              "affiliation": "JUUT / Aveda",
              "limitations": [
                "Aveda product practice",
                "named stylist experiences inspected 2026-09-30",
                "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair."
              ],
              "observation": "JUUT reports styling / care experiences, including after two weeks. Aveda affiliation and sensory endpoints remain explicit; no measured structural repair is inferred.",
              "checked_date": "2026-09-30",
              "commercial_context": "JUUT / Aveda"
            },
            {
              "id": "A-REDKEN-CREATOR",
              "url": "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
              "type": "creator_original_video_lead",
              "scope": "practice",
              "access": "uninspected",
              "author": null,
              "authority": "creator",
              "affiliation": null,
              "limitations": [
                "Redken treatment listing only",
                "product listing inspected; detailed verdict uninspected",
                "No positive long-term or efficacy conclusion may be extracted."
              ],
              "observation": "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
              "checked_date": "2026-09-30",
              "commercial_context": null
            },
            {
              "id": "A-ELVITAL-EDITORIAL",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue editorial guidance",
                "editorial applicability inspected 2026-09-30",
                "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules."
              ],
              "observation": "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "A-ELVITAL-WEEKLY",
              "url": "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
              "type": "manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": null,
              "limitations": [
                "Ambiguous Rescue weekly advice",
                "editorial applicability inspected 2026-09-30",
                "Exact product-version applicability is unresolved; do not impose weekly use."
              ],
              "observation": "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
              "checked_date": "2026-09-30",
              "commercial_context": "Commercially affiliated source; not independent retail efficacy evidence."
            },
            {
              "id": "S01",
              "url": "https://eu.curlsmith.com/products/bond-curl-rehab-salve",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith EU",
              "limitations": [
                "Actual pack not supplied; manufacturer warns that formula lists can change.",
                "Product title salve does not itself establish an applied cream texture.",
                "Original scope: current EU Bond Curl Rehab Salve product page, 237 ml option",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Full English INCI transcribed into V01. Specific targeted pre-shampoo treatment claiming reinforcement of three bond types; no disclosed product concentration, pH or independent molecular endpoint. Wet hair without washing first. Apply generously root to tip, coat evenly and detangle. Low porosity: 15 minutes every 4-5 washes; medium: 20 minutes every 3-4 washes; high: 30 minutes every 2-3 washes. Rinse, shampoo and condition.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S02",
              "url": "https://de.curlsmith.com/products/bond-curl-rehab-salve?variant=39480276746389",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Curlsmith DE",
              "limitations": [
                "Translated ingredient spelling is not proof of batch equality; no supplied pack.",
                "Original scope: DE 237 ml listing and translated formula/directions",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "DE current ingredient sequence corroborates EU English sequence, including the gluconamide/gluconate pair and citric acid. DE instructions corroborate the three porosity/time/wash-interval branches and rinse before shampoo and conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S03",
              "url": "https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair",
              "type": "brand_owner_retailer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "retailer",
              "affiliation": "dm / Balea",
              "limitations": [
                "Listed GTIN is not a scanned pack; marketing name does not identify a distinct molecular ingredient.",
                "Original scope: DE Haarkur Keratin Repair 300 ml, article 1688653, listed GTIN 4070765002003",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: brand_owner_retailer."
              ],
              "observation": "Complete INCI transcribed into V02. Claims concern keratin/peptides and a Pro-Strength label for damaged hair. Spread gently through damp lengths and ends 1-2 times weekly, leave 2-3 minutes and rinse thoroughly. No explicit shampoo/conditioner ordering or physical texture in the inspected text.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S04",
              "url": "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "Garnier DE / L'Oréal",
              "limitations": [
                "Rich formula is a description, not enough to certify cream texture.",
                "No actual pack.",
                "Original scope: DE Pro-Keratin Filler Deep Repair Intensive Haarkur 200 ml, formula 1261267 / Z70029743/2",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Complete INCI transcribed into V03. Maker describes Pro-Keratin plus marula oil, conditioning, filling and strengthening hair; no specific calcium-management or citric-acid repair claim in this text. Before OR after shampoo on damp hair, massage through lengths/ends, leave 5 minutes, optional towel/shower-cap warmth, rinse thoroughly with lukewarm water. Cadence and numerical dose unstated.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S05",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "local_manufacturer",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Size and scanned pack unresolved; source-version identity, not exact bottle certification.",
                "Concentration label is a branded complex claim, not ingredient dose.",
                "No study protocol, comparator or data inspected.",
                "Original scope: DE Absolut Repair Molecular Rinse-Off Serum current product-page version; size/GTIN unstated in inspected text",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: local_manufacturer."
              ],
              "observation": "Current DE serum INCI captured. Maker claims a 2% peptide-bonder complex and five amino acids, molecular repair and serum-like texture; this does not establish sh-Oligopeptide-78 or an acid/calcium role. In place of a rinse-out mask, preferably after matching shampoo: detangle wet hair, divide in two, apply 2–3 pumps per section. Lengths/ends normally; root-to-tip for very damaged hair. Work through 1–2 minutes, no separate dwell, rinse thoroughly. Optional Metal DX mask; matching leave-in recommended. Two-years-damage headline is a shampoo+serum+leave-in instrumental system claim; another claim concerns 15 serum applications. Neither establishes one-use superiority.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S06",
              "url": "https://eu.curlsmith.com/blogs/product-guides/bond-curl-rehab-salve",
              "type": "manufacturer_editorial",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": "Sharley Butcher",
              "authority": "manufacturer",
              "affiliation": "Curlsmith / Sharley Butcher",
              "limitations": [
                "Not an inspected peer-reviewed study.",
                "Select current local product directions, retaining this differing editorial separately.",
                "Original scope: manufacturer editorial and historical study disclosure",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_editorial."
              ],
              "observation": "Mentions third-party data and an independent user study of 120 volunteers in January 2021; full study, comparator and formula equivalence unavailable. Editorial says minimum 15 minutes, 30 for medium/high porosity, differing from current product-page medium 20 minutes. It recommends the same conditional wash intervals and matching shampoo/conditioner.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S07",
              "url": "https://cms.chempoint.com/ChemPoint/media/ChemPointSiteMedia/PDF%20Docs/3-Minute-Hair-Strengthening-Rinse-off-Conditioner-Mask.PDF",
              "type": "supplier_document",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland, hosted by distributor ChemPoint",
              "limitations": [
                "This is not Curlsmith's formulation, supplier verification or product dose.",
                "Stability testing is not an efficacy trial.",
                "Original scope: supplier demonstration formula Z351-25B, dated 2017-11-27",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_document."
              ],
              "observation": "Names FiberHance BM solution as Hydroxypropylgluconamide (and) Hydroxypropylammonium Gluconate in a supplier example mask.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S08",
              "url": "https://investor.ashland.com/news-releases/news-release-details/ashland-honored-henkel-two-personal-care-supplier-awards",
              "type": "supplier_statement",
              "scope": "technology",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "supplier",
              "affiliation": "Ashland",
              "limitations": [
                "Commercial technology statement and award, not independent efficacy or proof of native-disulfide restoration.",
                "No transfer of supplier magnitudes or dose into a current Curlsmith result.",
                "Original scope: supplier press release 2024-02-22, technology scope",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: supplier_statement."
              ],
              "observation": "Describes glucose-derived FiberHance reinforcement through ionic/hydrogen interactions inside keratin and a Henkel supplier award.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S09",
              "url": "https://genamarie.co/2021/01/curlsmith-bond-curl-vs-olaplex-no-3-compared-giveaway/",
              "type": "original_creator_statement",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": "Gena Marie",
              "authority": "creator",
              "affiliation": "Gena Marie",
              "limitations": [
                "Historical formula/market not bound to current EU version.",
                "Article inspected; linked video not independently watched.",
                "Not an Abbey Yung endorsement.",
                "Original scope: original written sponsored creator comparison, 2021-01-03",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: original_creator_statement."
              ],
              "observation": "Author reports tighter curl definition and shrinkage plus shine after Bond Curl, using a routine comparison against OLAPLEX No.3. Sponsored post disclosed; practical single-person cosmetic observations do not measure molecular repair.",
              "checked_date": "2026-10-02",
              "commercial_context": "sponsored post; affiliate links"
            },
            {
              "id": "S10",
              "url": "https://www.reddit.com/r/curlyhair/comments/1eebo4c/curlsmith_bond_curl_rehab_salve_hair_reacts/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Formula/market, routine and hair diameter not verified; do not derive a hard protein-overload or fit rule.",
                "Original scope: original anecdotal discussion, historical unspecified pack",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "Original poster reports dry feel and difficult detangling after Bond Curl; another user reports no similar problem. Experiences and self-attribution to protein are not controlled causal evidence.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown; do not infer independence"
            },
            {
              "id": "S11",
              "url": "https://www.reddit.com/r/curlyhair/comments/1dkemma/curlsmith_bond_curl_rehab_salve/",
              "type": "user_anecdotes",
              "scope": "practice",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "other",
              "affiliation": "Reddit users",
              "limitations": [
                "Multi-product routine cannot isolate Curlsmith; pack/market/version unverified.",
                "Original scope: historical anecdote with alternating treatment system",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: user_anecdotes."
              ],
              "observation": "A commenter reports improved feel/curls while alternating Curlsmith and OLAPLEX; explicitly not complete erasure of bleach damage.",
              "checked_date": "2026-10-02",
              "commercial_context": "commercial interests unknown"
            },
            {
              "id": "S12",
              "url": "https://de.lorealpartnershop.com/on/demandware.static/-/Library-Sites-SharedLibrary-DE-AT/default/v77cf51bd2dcb790074b8ff32d44d6e0dc571be3a/ZIP_Download_Files/Digital_Toolkit/LP_Digital%20Toolkit/20230829_LP_Servicemen%C3%BC_ARM_A5_Druck.pdf?version=1,712,225,397,201",
              "type": "manufacturer_professional_document",
              "scope": "system",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "Different test scopes retained, not combined as serum-alone results.",
                "No original methods, full data or current formula equivalence inspected.",
                "Original scope: historical professional service leaflet",
                "Original access: relevant_full_text_inspected; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: manufacturer_professional_document."
              ],
              "observation": "Salon damage claim belongs to pre-treatment plus five shampoos; home-care statement is a two-week consumer test of shampoo+rinse-off serum+leave-in.",
              "checked_date": "2026-10-02",
              "commercial_context": "publisher sells the described product or ingredient"
            },
            {
              "id": "S13",
              "url": "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum",
              "type": "manufacturer_application_amendment",
              "scope": "product",
              "access": "inspected_excerpt",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "L'Oréal Professionnel DE",
              "limitations": [
                "No mask dose, dwell or mask-rinse instructions supplied here; do not invent them.",
                "Optional mask and recommended leave-in are not mandatory purchases or molecular-effect dependencies.",
                "The original capture also contains prior assessment wording, which was disregarded as producer evidence and reported as preparation contamination; original bytes remain frozen.",
                "Original scope: same current DE serum page version as S05; application paragraphs after rinse",
                "Original access: relevant_full_text_inspected_by_root; typed as inspected_excerpt because the capture describes relevant sections, not an audited whole document. Original authority: maker application amendment."
              ],
              "observation": "After working the serum through for 1-2 minutes, no separate dwell is required and the serum is rinsed thoroughly. Producer's pro tip places the optional intensive-care Metal DX mask after this treatment; matching Absolut Repair Molecular leave-in is recommended afterward for best results.",
              "checked_date": "2026-10-02",
              "commercial_context": "maker sells the product"
            },
            {
              "id": "C03-P06-1",
              "url": "https://www.ogxbeauty.co.uk/products/bond-protein-repair-sealing-serum",
              "type": "producer_direction_complement_uk",
              "scope": "product",
              "access": "full_text",
              "author": null,
              "authority": "manufacturer",
              "affiliation": "OGX / Kenvue UK",
              "limitations": [
                "UK label-direction complement only. No official DE directions were located by the bounded searches; DE/EU pack equality is unresolved.",
                "Serum is the explicit producer format label; no viscosity, spray format or dose in ml inferred.",
                "Overnight is the stated use pattern, not a numeric minimum or maximum contact-time measurement.",
                "Source market: UK. Bound to producer-source-complement-2026-10-03/C03-P06-1; application directions only."
              ],
              "observation": "Official UK page identifies the 50 ml Sealing Serum. Before bed, spread a small amount between hands and distribute evenly through damp or dry hair, beginning at the ends and moving upward. Leave in overnight; rinsing is not required. Suggested use is 1–2 times weekly. The range routine says cleanse and condition first, then apply the Bond Protein Repair oil or serum.",
              "checked_date": "2026-10-03",
              "commercial_context": "Brand or brand-distributor application guidance; commercial source, not independent efficacy evidence."
            }
          ],
          "version": "bondbuilder-research-profile-v1",
          "evidence": {
            "detail": "E02 describes model chemistry with unresolved full hair-strengthening mechanism. E06 is partial supplier poster evidence with a described experiment unlike unknown retail dose/protocol. OGX five-wash claims are system/comparator claims, not an isolated-product experiment. No inspected original creator verdict supplied.",
            "summary": "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
            "cautions": [
              "No native-bond restoration, product superiority or active dose is established by the family label.",
              "DE list translation/punctuation repairs are exact-version only.",
              "UK directions do not certify a supplied DE pack.",
              "Supplier identity and dose cannot be inferred from the marker pair."
            ],
            "practical": {
              "limitations": [
                "No inspected original applicable practice verdict supports a benefit claim. Missing or inaccessible opinions are neutral."
              ],
              "counter_source_ids": [],
              "supporting_source_ids": []
            },
            "scientific": {
              "limitations": [
                "Evidence scope and access are retained; manufacturer system claims and practice are not independent product efficacy trials.",
                "DE list translation/punctuation repairs are exact-version only.",
                "UK directions do not certify a supplied DE pack.",
                "Supplier identity and dose cannot be inferred from the marker pair."
              ],
              "counter_source_ids": [
                "E02"
              ],
              "supporting_source_ids": [
                "E02",
                "E06"
              ]
            },
            "applicability": [
              {
                "scope": "technology",
                "bridge": "Chambers et al. 2022 characterize crystals, salts and aggregation/gelation. They explicitly describe the full hair-strengthening mechanism as unknown.",
                "source_ids": [
                  "E02"
                ],
                "limitations": [
                  "gluconamide/gluconate model chemistry",
                  "indexed primary abstract/introduction; direct PMC browser check and ACS 403 blocked full audit",
                  "Not an exact OGX/Aveda trial or direct retail molecular efficacy demonstration."
                ]
              },
              {
                "scope": "technology",
                "bridge": "Poster describes cyclic tensile-fatigue testing with automated fibre loading (n=50), dimension measurement, bleached/untreated comparisons and formulation tests. A described spectroscopic experiment uses 1% active in water at pH4 for 30 minutes then rinse.",
                "source_ids": [
                  "E06"
                ],
                "limitations": [
                  "supplier paired-marker technology, not OGX/Aveda bottles",
                  "indexed primary poster text; direct PDF timeout, graphs not inspected",
                  "Indexed text is partial; no numerical graph interpretation. Retail supplier identity, concentration and protocol equivalence not known. Claimed mechanism remains proposed; obtain full poster before treating an inaccessible result as pivotal."
                ]
              },
              {
                "scope": "product",
                "bridge": "German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
                "source_ids": [
                  "N03"
                ],
                "limitations": [
                  "OGX50ml DE storefront, EAN3574661818474 as source-listed lead",
                  "researcher full listing; root indexed full ingredient text; root direct open failed",
                  "Keep raw transcription issues. No pristine physical DE label or catalog binding. Storefront/EAN lead is not proof of broad local availability."
                ]
              },
              {
                "scope": "product",
                "bridge": "Full INCI, overnight directions, five-wash system/comparator footnote.",
                "source_ids": [
                  "R03"
                ],
                "limitations": [
                  "exact source-listed product/market only",
                  "web text inspected"
                ]
              },
              {
                "scope": "product",
                "bridge": "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
                "source_ids": [
                  "F02"
                ],
                "limitations": [
                  "UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency",
                  "product description, directions and INCI inspected 2026-10-01",
                  "UK guidance; supplied DE pack remains unverified. No diameter-specific guidance found."
                ]
              },
              {
                "scope": "product",
                "bridge": "Same source-listed EAN and ingredient order; clean Caprylic/Capric Triglyceride, translated 1, 2-heksandiol. Corroborates the DE punctuation/translation repair without replacing its raw list.",
                "source_ids": [
                  "N04"
                ],
                "limitations": [
                  "OGX50ml EAN3574661818474, Norway; not a DE pack",
                  "researcher full listing and ingredient text",
                  "A dated identifier bridge, not worldwide formula equality. Raw lists remain separate."
                ]
              }
            ],
            "supported_outcome": "Paired-marker technology plausibility; neither exact OGX molecular repair nor product-alone five-wash system results established.",
            "manufacturer_positioning": [
              "N03: German listing supplies complete ordered formula with the paired markers, importer and same overnight leave-in directions. Raw list has translated tokens, split Caprylic, Capric Triglyceride and 1, 2-Hexanediol.",
              "R03: Full INCI, overnight directions, five-wash system/comparator footnote.",
              "F02: UK 50 ml serum: qualitative dose, distribution, bedtime placement and frequency"
            ]
          },
          "identity": {
            "gtin": null,
            "size": "50 ml",
            "brand": "OGX",
            "market": "DE/EU",
            "status": "resolved",
            "product_id": "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
            "product_name": "OGX Bond Protein Repair Sealing Serum",
            "research_key": "P06",
            "source_version": "2026-09-30:N03"
          },
          "assessment": {
            "reasoning": {
              "trust_basis": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "N03"
                ],
                "assumptions": [],
                "limitations": []
              },
              "intended_role": {
                "rationale": "The selected DE listing explicitly corroborates overnight leave-in directions.",
                "confidence": "high",
                "source_ids": [
                  "N03"
                ],
                "assumptions": [],
                "limitations": []
              },
              "fit_assessment": {
                "rationale": "No source-supported diameter-specific suitability values are present. Damage, curl pattern, porosity and format do not establish diameter fit.",
                "confidence": "low",
                "source_ids": [],
                "assumptions": [],
                "limitations": [
                  "All three diameter values remain null; this is not a finding of unsuitability."
                ]
              },
              "product_format": {
                "rationale": "The capture describes the applied 50 ml serum.",
                "confidence": "high",
                "source_ids": [
                  "F02"
                ],
                "assumptions": [],
                "limitations": []
              },
              "treatment_mode": {
                "rationale": "The selected observation explicitly describes leave-in directions.",
                "confidence": "high",
                "source_ids": [
                  "N03"
                ],
                "assumptions": [],
                "limitations": []
              },
              "boundary_status": {
                "rationale": "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
                "confidence": "moderate",
                "source_ids": [
                  "N03",
                  "R03",
                  "F02"
                ],
                "assumptions": [],
                "limitations": [
                  "DE list translation/punctuation repairs are exact-version only.",
                  "UK directions do not certify a supplied DE pack.",
                  "Supplier identity and dose cannot be inferred from the marker pair."
                ]
              },
              "application_mode": {
                "rationale": "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established.",
                "confidence": "low",
                "source_ids": [
                  "C03-P06-1"
                ],
                "assumptions": [
                  "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established."
                ],
                "limitations": [
                  "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
                ]
              },
              "evidence_profile": {
                "rationale": "E02 describes model chemistry with unresolved full hair-strengthening mechanism. E06 is partial supplier poster evidence with a described experiment unlike unknown retail dose/protocol. OGX five-wash claims are system/comparator claims, not an isolated-product experiment. No inspected original creator verdict supplied.",
                "confidence": "moderate",
                "source_ids": [
                  "E02",
                  "E06",
                  "N03",
                  "R03",
                  "F02",
                  "N04"
                ],
                "assumptions": [],
                "limitations": [
                  "Duplicate captures of one study are not independent trials."
                ]
              },
              "application_facts": {
                "rationale": "Producer application amendment supplies direction sources; 2 application fact wrappers remain unknown.",
                "confidence": "moderate",
                "source_ids": [
                  "F02",
                  "N03",
                  "R03",
                  "C03-P06-1"
                ],
                "assumptions": [],
                "limitations": [
                  "Remaining application unknowns are retained; no fact was inferred."
                ]
              },
              "claim_trust_level": {
                "rationale": "Exact frozen identity/source-version and selected formula-source URL match the owner binding. Preserve its existing tier; the owner-provided raw/list digest binding must also pass downstream mechanical verification. Owner policy is not scientific certainty.",
                "confidence": "high",
                "source_ids": [
                  "N03"
                ],
                "assumptions": [],
                "limitations": [
                  "Policy provenance is separately named in policy_reference; source IDs are inspected source records, not fabricated policy sources."
                ]
              },
              "supported_outcome": {
                "rationale": "Paired-marker technology plausibility; neither exact OGX molecular repair nor product-alone five-wash system results established.",
                "confidence": "moderate",
                "source_ids": [
                  "E02",
                  "E06",
                  "N03",
                  "R03",
                  "F02"
                ],
                "assumptions": [],
                "limitations": [
                  "DE list translation/punctuation repairs are exact-version only.",
                  "UK directions do not certify a supplied DE pack.",
                  "Supplier identity and dose cannot be inferred from the marker pair."
                ]
              },
              "technology_family": {
                "rationale": "Both exact gluconamide/gluconate markers plus targeted overnight repair-serum identity support membership. Citric Acid/Arginine alone do not establish a second acid-repair role.",
                "confidence": "moderate",
                "source_ids": [
                  "N03"
                ],
                "assumptions": [],
                "limitations": [
                  "Marker presence does not establish concentration, supplier, delivery or molecular effect."
                ]
              }
            },
            "trust_basis": "owner_calibration",
            "boundary_status": "in_scope",
            "limiting_factors": [
              "DE list translation/punctuation repairs are exact-version only.",
              "UK directions do not certify a supplied DE pack.",
              "Supplier identity and dose cannot be inferred from the marker pair."
            ],
            "policy_reference": "owner-review-2026-09-30:P06",
            "claim_trust_level": "low",
            "technology_family": "gluconamide_gluconate",
            "classification_confidence": "moderate"
          },
          "application": {
            "rinse": {
              "value": {
                "treatment_mode": "leave_in",
                "standalone_treatment_rinse": false
              },
              "rationale": "The selected observation explicitly describes leave-in directions.",
              "confidence": "high",
              "source_ids": [
                "N03"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "amount": {
              "value": {
                "kind": "qualitative",
                "instruction": "Use a small amount."
              },
              "rationale": "UK directions give a small amount without a numeric dose.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
              ],
              "unknown_reason": null
            },
            "timing": {
              "value": {
                "kind": "overnight",
                "purpose": "contact"
              },
              "rationale": "Overnight is captured without a numerical duration.",
              "confidence": "high",
              "source_ids": [
                "R03",
                "N03"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "cadence": {
              "value": {
                "status": "source_stated",
                "initial": null,
                "branches": [],
                "maintenance": {
                  "kind": "times_per_week",
                  "maximum": 2,
                  "minimum": 1
                }
              },
              "rationale": "UK suggested frequency is once or twice weekly.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
              ],
              "unknown_reason": null
            },
            "dilution": {
              "value": null,
              "rationale": "P06: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples.",
              "confidence": "low",
              "source_ids": [],
              "limitations": [],
              "unknown_reason": "P06: the frozen applicable producer observations do not establish dilution. No value was inferred from INCI, product title alone, another product or standard examples."
            },
            "partners": {
              "value": [
                {
                  "name": "OGX Bond Protein Repair Shampoo",
                  "source_ids": [
                    "C03-P06-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                },
                {
                  "name": "OGX Bond Protein Repair Conditioner",
                  "source_ids": [
                    "C03-P06-1"
                  ],
                  "requirement": "recommended",
                  "exclusivity_established": false
                }
              ],
              "rationale": "The UK producer recommends the line's cleanse/condition routine before oil or serum.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved.",
                "Recommendations do not establish product exclusivity or a required fresh wash."
              ],
              "unknown_reason": null
            },
            "sequence": {
              "value": [
                {
                  "note": "Before bed, apply a small amount from the hands to damp or dry hair.",
                  "action": "apply_treatment",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P06-1"
                  ]
                },
                {
                  "note": "Spread evenly from ends upward.",
                  "action": "distribute",
                  "timing": null,
                  "optional": false,
                  "source_ids": [
                    "C03-P06-1"
                  ]
                },
                {
                  "note": "Leave in overnight; no rinsing required.",
                  "action": "wait",
                  "timing": {
                    "kind": "overnight",
                    "purpose": "contact"
                  },
                  "optional": false,
                  "source_ids": [
                    "C03-P06-1"
                  ]
                }
              ],
              "rationale": "UK bedtime sequence applies and distributes serum, then leaves it overnight.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved.",
                "The separate range routine names preceding shampoo and conditioner but does not require a new wash for each use."
              ],
              "unknown_reason": null
            },
            "placement": {
              "value": null,
              "rationale": "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established.",
              "confidence": "low",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
              ],
              "unknown_reason": "UK producer permits bedtime use on damp or dry hair and also describes a range routine after cleansing/conditioning; a unique between-washes versus post-shampoo placement is not established."
            },
            "hair_state": {
              "value": "either",
              "rationale": "UK directions allow damp or dry hair.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved.",
                "Either means damp-or-dry here, not unspecified soaking-wet use."
              ],
              "unknown_reason": null
            },
            "conditioner": {
              "value": {
                "after": "not_stated",
                "before": "allowed",
                "guidance_reference": null,
                "minimum_wait_seconds": null
              },
              "rationale": "UK range routine includes cleansing and conditioning before serum.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved.",
                "Allowed before records that compatible ordering, not a required fresh wash before every bedtime application."
              ],
              "unknown_reason": null
            },
            "longer_wear": {
              "value": {
                "maximum_seconds": null,
                "overnight_allowed": true
              },
              "rationale": "Overnight use is explicit, but no maximum duration is given.",
              "confidence": "high",
              "source_ids": [
                "R03",
                "N03"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "distribution": {
              "value": "Rub a small amount between the hands, then distribute evenly from ends upward.",
              "rationale": "UK directions specify hand-spreading and even upward distribution.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
              ],
              "unknown_reason": null
            },
            "source_market": "UK with DE storefront corroboration",
            "applied_format": {
              "value": "serum",
              "rationale": "The capture describes the applied 50 ml serum.",
              "confidence": "high",
              "source_ids": [
                "F02"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "treatment_role": {
              "value": "leave_in_treatment",
              "rationale": "The selected DE listing explicitly corroborates overnight leave-in directions.",
              "confidence": "high",
              "source_ids": [
                "N03"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "source_variants": [
              {
                "market": "DE storefront",
                "selected": true,
                "source_ids": [
                  "N03"
                ],
                "differences": "Selected formula and corroborating overnight leave-in description; no pristine physical DE pack."
              },
              {
                "market": "UK",
                "selected": false,
                "source_ids": [
                  "F02",
                  "R03"
                ],
                "differences": "UK bedtime guidance; five-wash claims are system/comparator dependent. Frequency value and distribution text are missing from the capture."
              },
              {
                "market": "NO",
                "selected": false,
                "source_ids": [
                  "N04"
                ],
                "differences": "Same source-listed identifier corroborates punctuation/translation repair only; no worldwide formula or direction equality."
              },
              {
                "market": "UK",
                "selected": true,
                "source_ids": [
                  "C03-P06-1"
                ],
                "differences": "UK-only directions selected as a cross-market complement; no assertion that every direction belongs to the DE/EU pack."
              }
            ],
            "state_modifiers": {
              "value": [
                "at_bedtime"
              ],
              "rationale": "Bedtime placement is expressly captured.",
              "confidence": "high",
              "source_ids": [
                "F02"
              ],
              "limitations": [],
              "unknown_reason": null
            },
            "application_area": {
              "value": "ends_upward",
              "rationale": "Work upward starting at the ends.",
              "confidence": "moderate",
              "source_ids": [
                "C03-P06-1"
              ],
              "limitations": [
                "UK protocol complement only; exact DE/EU physical pack equivalence remains unresolved."
              ],
              "unknown_reason": null
            },
            "applicability_note": "UK-only producer complement: bedtime application on damp or dry hair, ends upward, small amount, overnight without rinse. Washing position cannot be reduced to one enum from bedtime and after-cleansing range guidance.",
            "direction_source_ids": [
              "F02",
              "N03",
              "R03",
              "C03-P06-1"
            ],
            "market_applicability": "cross_market_complement"
          },
          "explanations_de": {
            "deeper": "Gezieltes Leave-in-Serum mit dem Gluconamid/Gluconat-Paar. Die Hinweise betreffen vor allem die Technologie; eine konkrete molekulare Reparaturleistung dieser Flasche ist nicht belegt. Die Quellen unterscheiden Herstellerangaben, technische Forschung und praktische Erfahrungen. Eine Einstufung ist keine Messung der Wirksamkeit. Fehlende Anwendungs- und Haarstärkenangaben bleiben ausdrücklich unbekannt; es wird kein persönlicher Anwendungsplan daraus abgeleitet.",
            "concise": "Gezieltes Leave-in-Serum mit dem Gluconamid/Gluconat-Paar. Die Hinweise betreffen vor allem die Technologie; eine konkrete molekulare Reparaturleistung dieser Flasche ist nicht belegt."
          },
          "technology_reference": {
            "status": "matched",
            "limitation": "Exact frozen explanatory reference only. formula_sha256 is its ordered-normalized formula digest (serialization clarification), not raw_sha256. Shared chemistry does not transfer tier, efficacy, supplier, dose, protocol, fit or catalogue identity.",
            "product_id": null,
            "source_ids": [
              "N03"
            ],
            "research_key": "P06",
            "formula_sha256": "d115187c9084ab3b81bbf13e7a0809d1427f5ce8cb8afd70f3fcca768a9689b0",
            "shared_markers": [
              "hydroxypropylgluconamide",
              "hydroxypropylammonium gluconate"
            ],
            "source_version": "2026-09-30:N03"
          }
        },
        "claim_trust_level": "low",
        "technology_family": "gluconamide_gluconate",
        "bond_repair_intensity": null
      },
      "asset": {
        "id": "f995f356-6b92-4b15-8ecd-266fb423d911",
        "notes": "Reviewed internal Bondbuilder staging asset",
        "created_at": "2026-10-04T08:37:55.642259+00:00",
        "product_id": "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
        "public_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p06/ogx-bond-protein-repair-sealing-serum-b3880d013bdd.webp",
        "updated_at": "2026-10-04T08:37:55.642259+00:00",
        "source_type": "retailer",
        "asset_sha256": "b3880d013bdd2eed61eb2c9db849df6001ac9dfca6337e189eaee7afc3dc4a92",
        "published_at": "2026-10-04T08:37:55.642259+00:00",
        "storage_path": "product-intake/2026-10-03/internal-bondbuilder-p06/ogx-bond-protein-repair-sealing-serum-b3880d013bdd.webp",
        "user_approved": true,
        "storage_bucket": "product-images",
        "source_page_url": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
        "source_image_url": "https://image-resizing.booztcdn.com/ogx/ogx360745_cclear_10.webp?has_webp=1&version=dcfa1919ed86bb4e0afb85d2767e6ef7&size=w1300",
        "manifest_batch_id": "bondbuilder-internal-admission-v1:cec884e7-eb60-4171-bc81-389764d88cac",
        "processing_method": "local",
        "quality_confidence": "high"
      },
      "product": {
        "id": "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
        "name": "OGX Bond Protein Repair Sealing Serum",
        "tags": [],
        "brand": "OGX",
        "origin": "curated",
        "brand_id": "3bef8ddb-49c4-47a4-9103-faca256bb34a",
        "category": null,
        "currency": "EUR",
        "tom_take": null,
        "embedding": null,
        "image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-10-03/internal-bondbuilder-p06/ogx-bond-protein-repair-sealing-serum-b3880d013bdd.webp",
        "is_active": true,
        "price_eur": 18.68,
        "created_at": "2026-10-04T08:37:55.642259+00:00",
        "sort_order": 0,
        "updated_at": "2026-10-05T17:58:43.413504+00:00",
        "description": null,
        "category_key": "bondbuilder",
        "affiliate_link": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
        "product_line_id": "3e2ac60e-e192-40b8-bace-74fbe759d3bf",
        "lifecycle_status": "active",
        "net_content_unit": "ml",
        "price_checked_at": "2026-10-03T13:16:51+00:00",
        "net_content_value": 50,
        "short_description": null,
        "suitable_concerns": [],
        "thumbnail_image_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/b3880d013bdd2eed61eb2c9db849df6001ac9dfca6337e189eaee7afc3dc4a92.webp",
        "purchase_link_status": "available",
        "suitable_thicknesses": [],
        "is_chaarlie_recommended": false,
        "purchase_link_checked_at": "2026-10-03T13:16:51+00:00"
      },
      "protocols": [],
      "identifiers": [
        {
          "type": "gtin",
          "value": "3574661818474",
          "source": "Boozt DE; exact pack binding retained in commercial research"
        },
        {
          "type": "retailer_url",
          "value": "https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512",
          "source": "Boozt DE"
        }
      ]
    },
    "preimage_sha256": "c55b73d341ee9b2d7b5736d74a6aea54731e41ae6f1ce447acaf908a0ace2bab",
    "artifact_sha256": "297d6ec2a4953f7683d938d2b784b620bf2cf4c4af3a405731ab2eecfbeb0c61"
  }
]
$reviewed$::jsonb) ORDER BY value#>>'{artifact,productId}'
  LOOP
    artifact := item->'artifact';
    product_id := (artifact->>'productId')::uuid;
    research_key := artifact->>'researchKey';
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_id);
    -- Refuse silently omitted or modified policy migrations even on replay.
    IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
        WHERE oid='public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure)
        IS DISTINCT FROM '16dd604125bfe70bba78cb0d6c956a140d6c14775b8c3e308132ac6e6d39ba24' THEN
      RAISE EXCEPTION 'Bondbuilder reviewed promotion requires reviewed trust and diameter policy';
    END IF;
    preimage := public.bondbuilder_internal_admission_readback_v1(product_id);
    SELECT * INTO prior FROM public.catalog_enrichment_applied_items l
      WHERE l.batch_id=batch AND l.product_key=research_key;
    IF FOUND THEN
      SELECT e.fact_value INTO saved_postimage FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id=product_id AND e.batch_id=batch AND e.fact_key='bondbuilder_promotion_postimage';
      post_hash := encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(saved_postimage),'UTF8')),'hex');
      IF prior.product_id IS DISTINCT FROM product_id OR prior.reviewed_by IS DISTINCT FROM 'nick'
        OR prior.batch_fingerprint IS DISTINCT FROM item->>'preimage_sha256'
        OR prior.content_fingerprint IS DISTINCT FROM post_hash
        OR saved_postimage IS NULL OR preimage IS DISTINCT FROM saved_postimage THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion replay drift: %',research_key;
      END IF;
      postimage := saved_postimage;
    ELSE
      IF preimage IS DISTINCT FROM item->'preimage'
        OR encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(preimage),'UTF8')),'hex')
          IS DISTINCT FROM item->>'preimage_sha256' THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion preimage drift: %',research_key;
      END IF;
      IF EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e WHERE e.product_id=product_id AND e.batch_id=batch)
        OR EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items l WHERE l.product_id=product_id AND l.batch_id=batch) THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion orphan evidence: %',research_key;
      END IF;
      IF NOT public.bondbuilder_profile_valid_v1(artifact->'profile')
        OR artifact#>>'{profile,identity,product_id}' IS DISTINCT FROM product_id::text THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion invalid profile: %',research_key;
      END IF;
      UPDATE public.product_bondbuilder_specs s SET research_profile=artifact->'profile',
        application_mode=artifact#>>'{spec,application_mode}', treatment_mode=artifact#>>'{spec,treatment_mode}',
        usage_protocol=artifact#>>'{spec,usage_protocol}' WHERE s.product_id=product_id;
      INSERT INTO public.product_application_protocols(product_id,category,role,cadence,
        application_stage,application_state,placement,contact_time_seconds,rinse_action,
        reapplication,instruction_modifiers,source_label,source_url,source_text,guidance_payload,guidance_payload_v2)
      VALUES(product_id,'bondbuilder','specialized_bond_treatment',NULL,
        CASE WHEN research_key='P06' THEN NULL ELSE 'pre_shampoo' END,
        CASE artifact#>>'{protocolV2,facts,applicationState}' WHEN 'dry_hair' THEN 'dry' WHEN 'damp_or_dry_hair' THEN 'either' ELSE 'damp' END,
        CASE WHEN research_key='P06' THEN NULL ELSE 'pre_shampoo' END,
        (artifact#>>'{protocolV1,protocolFacts,contactTimeSeconds}')::integer,
        CASE WHEN research_key='P06' THEN 'leave_in' ELSE 'rinse' END,
        'not_stated','[]'::jsonb,'Reviewed product directions',
        artifact#>>'{source,source_url}',artifact#>>'{source,source_text}',artifact->'protocolV1',artifact->'protocolV2');
      UPDATE public.products p SET suitable_thicknesses=ARRAY(SELECT jsonb_array_elements_text(artifact->'eligibleThicknesses')),
        is_chaarlie_recommended=true WHERE p.id=product_id;
      PERFORM public.assert_personal_plan_curated_publication(product_id);
      postimage := public.bondbuilder_internal_admission_readback_v1(product_id);
      post_hash := encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(postimage),'UTF8')),'hex');
    END IF;

    evidence_values := jsonb_build_object('bondbuilder_promotion_preimage',item->'preimage',
      'bondbuilder_promotion_artifact',artifact,'bondbuilder_promotion_postimage',postimage,
      'bondbuilder_promotion_digests',jsonb_build_object('preimage_sha256',item->>'preimage_sha256',
        'artifact_sha256',item->>'artifact_sha256','postimage_sha256',post_hash));
    IF prior.product_id IS NULL THEN
      INSERT INTO public.personal_plan_catalog_fact_evidence(product_id,fact_key,fact_value,
        source_label,source_url,source_text,source_type,checked_at,batch_id,batch_fingerprint,content_fingerprint)
      SELECT product_id,key,value,'Reviewed Bondbuilder recommendation promotion',artifact#>>'{source,source_url}',
        'Exact reviewed promotion preimage, artifact, postimage and canonical SHA-256 digests.',
        'internal_verified','2026-10-06'::date,batch,item->>'preimage_sha256',post_hash FROM jsonb_each(evidence_values);
      INSERT INTO public.catalog_enrichment_applied_items(batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by)
      VALUES(batch,research_key,item->>'preimage_sha256',post_hash,product_id,'nick');
    END IF;
    IF (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence e WHERE e.product_id=product_id AND e.batch_id=batch) <> 4
      OR (SELECT count(*) FROM public.catalog_enrichment_applied_items l WHERE l.product_id=product_id AND l.batch_id=batch) <> 1 THEN
      RAISE EXCEPTION 'Bondbuilder reviewed promotion evidence count drift: %',research_key;
    END IF;
    FOR evidence_item IN SELECT key,value FROM jsonb_each(evidence_values) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id=product_id AND e.fact_key=evidence_item.key AND e.fact_value=evidence_item.value
          AND e.batch_id=batch AND e.source_label='Reviewed Bondbuilder recommendation promotion'
          AND e.source_url=artifact#>>'{source,source_url}'
          AND e.source_text='Exact reviewed promotion preimage, artifact, postimage and canonical SHA-256 digests.'
          AND e.source_type='internal_verified' AND e.checked_at='2026-10-06'::date
          AND e.batch_fingerprint=item->>'preimage_sha256' AND e.content_fingerprint=post_hash) THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion evidence drift: %',research_key;
      END IF;
    END LOOP;
    PERFORM public.assert_personal_plan_curated_publication(product_id);
  END LOOP;
END $promotion$;
-- Execute the actual deferred publication and profile-binding guards before commit.
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
