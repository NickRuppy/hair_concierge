# Existing oil products — recommendation-property enrichment review

**Status:** exact bundle approved by Nick; not yet merged, deployed, or applied

**Scope date:** 2026-09-01

**Supabase project:** `pqdkhefxsxkyeqelqegq`

**Catalog rows inventoried:** 15

**Writes performed:** none

**GTIN work:** excluded; the parent scanner-catalog task owns barcode identity

The database-ready proposal is [`manifest.json`](../../../../data/catalog-enrichment/oil-authority-enrichment-v1/manifest.json). It contains all 15 exact product prestates and targets, all proposed `product_oil_specs`, 15 sheet-authorized eligibility rows, immutable top-level thickness evidence, 18 exact application-protocol rows with canonical V1 guidance payloads, and per-source fact evidence. Its canonical content fingerprint is `bc2cca3c68ae4eea4dd337fcbbd5f02be5d7ac1d42635a26bd68a74255929b2b`.

Nick approved the exact content on 2026-09-01. The manifest is pinned as `state=approved`, `reviewedBy=nick`, `reviewedAt=2026-09-01T11:30:04.000Z`, and `reviewedContentFingerprint=bc2cca3c68ae4eea4dd337fcbbd5f02be5d7ac1d42635a26bd68a74255929b2b`; the SQL executor pins the same fingerprint. Execution still requires the clean reviewed-head, project, fingerprint, and explicit apply gates. Shipping performs no Supabase write, changes no `products` row, touches no identifier/GTIN, and removes no catalog disposition.

Applying an approved successor would be recommendation activation, most visibly for Garnier because its currently unblocked row would gain `provides_heat_protection=true`. That later action requires exact-product approval and a fresh user-journey/readiness check; this draft only prepares the reviewable bundle.

## Publication and activation gates

1. **Shipping:** commit, push, and open the draft PR containing this exact approved bundle.
2. **Merge/deploy:** reconcile the production migration sequence, pass final PR checks, then obtain separate merge and deployment authorization.
3. **Apply:** after the migration is live, run the clean-reviewed-head preflight and separately execute the fingerprint-bound production RPC.
4. **Global readiness:** disposition removal and recommendation activation for the other 14 products remain separate after apply verification and the promotion dry run. No disposition action is included here.

## Executive verdict

All 15 scanner-identified rows were found in the current catalog. None is globally recommendation-ready in its current state. The rows are already cataloged, active, imaged, and purchasable, so this review records `catalog_intake_ready = true` for the property-enrichment task; that is not approval to promote them into global recommendations.

Food and body oils receive only a conservative, lengths-and-ends, shampoo-out role. No proposal infers scalp treatment, hair growth, dandruff treatment, UV protection, or heat protection from ingredient class. Global activation remains gated by Nick's exact-product approval, application of the approved rows, current evidence/protocol records, deliberate supersession of any old disposition blocker, and the promotion dry run.

## Identity exceptions that must stay visible

1. **OGX:** the catalog name `OGX Argan Oil` is generic, but the stored retailer source resolves to **OGX Moroccan Argan Penetrating Oil, 100 ml**. The proposal is for that exact silicone-rich finished product only. Approval must pin its source/formula fingerprint; this task does not rename the row or alter a GTIN.
2. **Primavera:** `Calendulaöl Bio` is not a single calendula oil. It is a sunflower/olive carrier blend with calendula and rosemary extracts. It does not inherit a blanket pure-oil rule.
3. **KoRo:** MCT oil is caprylic/capric triglyceride material derived from coconut, not virgin coconut oil. Coconut-fibre evidence is not transferred to it.
4. **Garnier:** Sleek & Stay is a silicone heat serum with no botanical oil in its current INCI. It stays in this review because `oil` is its existing catalog category.
5. **dmBio olive oil:** the exact current 500 ml retailer page is usable for composition identity; barcode reconciliation stays with the parent scanner task.

## Exact affected inventory and proposed database values

Each eligibility entry has the form `thickness:oil_subtype:oil_purpose:ingredient_flags`. Every product has exactly one thickness and subtype inherited from the authoritative `Haartyp` sheet. Top-level `suitable_thicknesses` exactly matches that eligibility row.

| Product ID                             | Exact product / INCI identity                                                                                                    | `product_oil_specs`                                                                                     | Thicknesses | Eligibility per named thickness               | Protocol role(s)        | Current global verdict                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `517dca50-5d55-4038-ba1d-f9b745708327` | Allgäuer Ölmühle Bio Traubenkernöl; organic grape-seed food oil                                                                  | `light`; `[pre_wash_fibre_treatment]`                                                                   | fine        | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; direct hair evidence remains weak                               |
| `a11855eb-64e5-438f-8880-1d3573efa9fa` | benecosBIO Aprikosenkernöl; `Prunus Armeniaca Kernel Oil`                                                                        | `light`; `[pre_wash_fibre_treatment]`                                                                   | fine        | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; weak evidence limits claims                                     |
| `19aea9c4-4b90-4ec4-8cb6-90cb270010f7` | benecosBIO Macadamianussöl; `Macadamia Integrifolia Seed Oil`                                                                    | `medium`; `[pre_wash_fibre_treatment]`                                                                  | normal      | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; no color/repair claim retained                                  |
| `ca4ae209-79d2-4f4d-8e44-46e586cec62d` | benecosBIO Mandelöl; `Prunus Amygdalus Dulcis Oil`                                                                               | `medium`; `[pre_wash_fibre_treatment]`                                                                  | fine        | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; weak evidence limits claims                                     |
| `3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b` | benecosBIO Wunderbaumsamenöl; `Ricinus Communis Seed Oil`                                                                        | `rich`; `[pre_wash_fibre_treatment]`                                                                    | coarse      | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; growth/scalp claims rejected                                    |
| `29e36443-93ff-4b62-9cf0-55ad9f89f530` | BioGourmet Distelöl; native cold-pressed safflower oil                                                                           | `light`; `[pre_wash_fibre_treatment]`                                                                   | fine        | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; direct safflower evidence supports the conservative role        |
| `acf9d5cd-76e4-49c7-9c04-0af1f20506ad` | dmBio Kokosöl nativ; 100% virgin coconut oil                                                                                     | `rich`; `[pre_wash_fibre_treatment]`                                                                    | coarse      | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; strong oil-level fibre evidence                                 |
| `9bfe0a67-72ad-4951-bb99-9f2f5d5c724a` | dmBio Natives Olivenöl Extra; 100% extra-virgin olive oil                                                                        | `rich`; `[pre_wash_fibre_treatment]`                                                                    | normal      | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; penetration evidence supports the conservative role             |
| `4a95e1de-54e9-4fcd-b227-72a5824d13c1` | Dr. Scheller Jojobaöl; `Simmondsia Chinensis (Jojoba) Seed Oil`                                                                  | `light`; `[pre_wash_fibre_treatment,dry_finish]`                                                        | fine        | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash; dry finish    | `false` until exact-product approval/apply; exact directions support both roles after shaft-only adaptation |
| `c574ee6f-ad22-45c0-b936-57b847d93433` | Garnier Sleek & Stay; `Dimethicone, Bis-(Morpholinomethyl C1-4 Dialkoxysiloxy) Dimethicone, Bis-Cetearyl Amodimethicone, Parfum` | `light`; `[pre_heat_protection]`; adjacent `provides_heat_protection=true`                              | coarse      | `trocken-oel:null:[silicones]`                | pre-heat                | `false` until exact-product approval/apply; direct manufacturer heat claim                                  |
| `3eb198a5-9aab-4f28-9df1-c4869c6a12db` | KoRo MCT Öl; caprylic/capric triglycerides from coconut                                                                          | `light`; `[pre_wash_fibre_treatment]`                                                                   | fine        | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; weak evidence limits claims                                     |
| `38886b62-2c45-4b34-9a24-7d831e97946e` | MoriVeda Moringa Öl Premium; 100% moringa oil                                                                                    | `medium`; `[pre_wash_fibre_treatment]`                                                                  | normal      | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; weak evidence limits claims                                     |
| `2ffeae68-c625-4df5-be02-0c1b620aa0fc` | nedura Schwarzkümmelöl; 100% unfiltered `Nigella sativa` oil                                                                     | `medium`; `[pre_wash_fibre_treatment]`                                                                  | normal      | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash                | `false` until exact-product approval/apply; no growth/scalp claim                                           |
| `1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf` | OGX Moroccan Argan Penetrating Oil 100 ml; silicone-rich formula with argan kernel oil                                           | `medium`; `[leave_on_fibre_conditioning,pre_heat_protection]`; adjacent `provides_heat_protection=true` | normal      | `styling-oel:styling_finish:[oils,silicones]` | damp leave-in; pre-heat | `false` until identity/formula and exact-product approval/apply                                             |
| `1dce2c18-6a45-4017-a748-e3a7f1cba36f` | Primavera Calendulaöl Bio; sunflower/olive/calendula/rosemary blend                                                              | `rich`; `[pre_wash_fibre_treatment,dry_finish]`                                                         | coarse      | `natuerliches-oel:pre_wash_oiling:[oils]`     | pre-wash; dry finish    | `false` until exact-product approval/apply; exact dry-end direction plus approved shared pre-wash protocol  |

`oil_purpose = null` for Garnier is deliberate: assigning `light_finish` would invent a dry-finish role for a heat-only serum. Dr. Scheller and Primavera each have two role protocols, but the current eligibility table holds one purpose per thickness; `pre_wash_oiling` is the conservative compatibility hint, while `role_support` and the exact protocols retain both roles.

## Exact protocol contract

The executable package contains one protocol row for every proposed role (18 total). Every row supplies:

- `product_id`, `category`, `category_key`, role, cadence, application stage/state, placement, contact time, rinse action, reapplication, modifiers, source label/URL/text, and `application_family`;
- a product-scoped canonical V1 `guidance_payload` with German ordered steps, exact amount, sequence anchors, rinse/contact/reapplication facts, and dated evidence;
- lengths-and-ends-only safety language where a source also mentions scalp use.

The aligned Chaarlie-owned carrier protocol is exact: apply to dry lengths and ends only; use a weight-adjusted starting dose of 1–3 drops; leave for 600 seconds; shampoo out; reduce or stop for residue or irritation. Nick approved its inclusion in this exact bundle on 2026-09-01. Production use still requires merge, deployment, the guarded apply, and post-apply verification.

Exact manufacturer/retailer protocols are narrower:

- Dr. Scheller: sparse dry lengths/ends treatment for 600 seconds then shampoo out; or one drop on dry ends, leave in.
- Primavera: shared rich-oil pre-wash protocol plus a very small amount on dry ends, leave in; scalp directions excluded.
- OGX: a few drops on towel-dried lengths/ends; fine hair only on ends; separate exact application before each heat event.
- Garnier: one pump on damp lengths/ends, leave in, then blow-dry or straighten; reapply before a later separate heat event.

## Evidence by exact oil, without blanket transfer

| Exact oil/product                                               | Evidence judgment                                                                                                                                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safflower                                                       | Direct 2024 study includes safflower, plant-oil penetration, and improved fatigue strength.                                                                                              |
| Coconut                                                         | Direct hair-fibre penetration/protein-loss/strength evidence supports pre-wash use, not scalp or growth claims.                                                                          |
| Olive                                                           | Direct comparative penetration evidence supports conservative pre-wash use only.                                                                                                         |
| Castor                                                          | Systematic review does not support hair-growth inference; rich handling remains conservative.                                                                                            |
| Jojoba                                                          | Exact directions support ends and a timed treatment; wax-ester chemistry does not establish growth efficacy.                                                                             |
| OGX and Garnier                                                 | Roles come from exact finished-product formulas, directions, and heat claims, not from botanical-class inference.                                                                        |
| Primavera blend                                                 | Exact end-use direction supports dry ends; carrier evidence does not create a scalp/treatment role for the blend.                                                                        |
| Grapeseed, apricot, macadamia, almond, MCT, moringa, black seed | Identity is established, but direct exact-oil/product hair-fibre evidence is weak or absent. Sheet authority permits inclusion; claims remain limited to the conservative internal role. |

## Source ledger

### Authoritative inclusion matrix

- `Haartyp` sheet: https://docs.google.com/spreadsheets/d/15pR1v1StWCXF1Qj7T1pJgn3GUlZgbp5U/edit?gid=408715675#gid=408715675

### Exact products and INCI

- Allgäuer: https://www.mueller.de/p/allgaeuer-oelmuehle-bio-traubenkernoel-223549/
- benecos apricot: https://cosmondial.com/collections/korper-bad-pflege/products/benecosbio-koerperoel-aprikosenkernoel
- benecos macadamia: https://cosmondial.com/collections/korper-bad-pflege/products/benecosbio-koerperoel-macadamia
- benecos almond: https://cosmondial.com/collections/korper-bad-pflege/products/benecosbio-koerperoel-mandel
- benecos castor: https://cosmondial.com/products/benecosbio-koerperoel-wunderbaumsamen
- BioGourmet safflower: https://bio-gourmet.com/essig-oel-und-dips/biogourmet-produkte-essig-oel-und-dips-disteloel/
- dmBio coconut: https://www.dm.de/p/d/1544928/dmbio-kokosoel-nativ
- dmBio olive: https://www.dm.de/p/d/1512947/dmbio-natives-olivenoel
- Dr. Scheller jojoba: https://dr-scheller.de/products/reines-jojobaol
- Garnier: https://www.garnier.de/haarpflege/haarpflege-marken/fructis/keratin-sleek/serum
- Garnier direction cross-check: https://www.rossmann.de/de/pflege-und-duft-garnier-fructis-sleek-und-stay-heat-activated-serum/p/3600542638852
- KoRo MCT: https://www.dm.de/p/d/1657270/koro-mct-oel
- MoriVeda moringa: https://www.shop-apotheke.com/ernaehrung/upmLDFZ4H/moriveda-moringa-oel-premium-erstpressung-aus-geschaelten-oleifera-samen-schoten.htm
- nedura black seed: https://www.dm.de/nedura-schwarzkuemmeloel-ungefiltert-p4262490410776.html
- OGX retailer: https://www.dm.de/p/d/1442285/ogx-haaroel-moroccan-argan-penetrating-oil
- OGX manufacturer cross-check: https://www.ogxbeauty.com/products/renewing-argan-oil-of-morocco-penetrating-oil
- Primavera: https://www.primaveralife.com/calendulaoel-bio.html

### Hair-fibre evidence

- 2024 oil-penetration study: https://pubmed.ncbi.nlm.nih.gov/38922913/
- Coconut/olive/sunflower penetration comparison: https://pubmed.ncbi.nlm.nih.gov/16258695/
- Coconut single-fibre tensile study: https://pubmed.ncbi.nlm.nih.gov/32949101/
- Coconut/castor/argan systematic review: https://pubmed.ncbi.nlm.nih.gov/35816075/
- Hair-oil evidence-limitations review: https://pmc.ncbi.nlm.nih.gov/articles/PMC9231528/
- Jojoba composition review: https://pubmed.ncbi.nlm.nih.gov/34073772/

## Readiness ledger

- `catalog_intake_ready = true` for all 15 rows for this property-enrichment review. This does not certify a barcode and does not erase the identity fingerprints above.
- `global_recommendation_ready = false` for all 15 current rows. No approval or application has occurred.
- The authoritative sheet plus the aligned conservative protocol resolves the inclusion-policy gap for all 15 rows; weak external evidence limits claims but no longer changes the sheet placement.
- Every row can become a promotion candidate only after its exact identity/property bundle is approved, the shared protocol is recorded in the normative oil authority, and the approved values are applied.
- Any existing `retired`/`blocked` disposition must be deliberately superseded. An attribute upsert alone must not silently activate a product.
- After approved writes, run the ordinary promotion dry run and verify lifecycle, Chaarlie image, evidence, exact protocols, thickness parity, and unsupported-claim absence.

No database change, publication, barcode change, queue mutation, or recommendation activation is part of this package.
