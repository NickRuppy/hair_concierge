# Existing oil profiles: bounded evidence completion v0.1

Reviewed 2026-10-09. **Three of eight gaps have supported proposed values: Biopark penetration potential, NEQI dropper and Aroma-Zone pour. Five hero prominence values correctly remain unknown under v0.8.** All five heroes have positive maker positioning; none is absent or eligible for an empty hero list. This completes the bounded external search and exact-source reconciliation, not full-profile consolidation or method revision.

[Structured findings, exact formula/input hashes and sources](evidence.json). Governing method: [classification v0.8](../../../../docs/research/oil-inci/v1.0/02_classification-standard-v0.8.md); property scope: [v0.2](../../../../docs/research/oil-inci/v1.0/01_property-set-v0.2.md). Frozen round6 sources and ledgers were read but not edited. Current maker ingredient order matches each relevant captured declaration. Published pages/images do not verify a physical batch.

## External evidence

### Whole coconut identity and penetration

[Biopark's exact 100ml maker page](https://biopark-cosmetics.com/products/organic-coconut-oil-100ml) pairs its single Fruit Oil declaration with cold pressing and an unrefined whole-coconut description. The [DE market page](https://www.ecco-verde.de/biopark-cosmetics/coconut-oil) corroborates the 100ml jar and EAN 3830066651079. Its abbreviated ingredient display is not a replacement declaration.

[Croda's supplier documentation](https://www.crodabeauty.com/en-gb/products/product/2659-seatons_1_refined_1_coconut_1_oil) links the conventional Coconut Oil INCI to pressing coconut flesh. This supports the material-family connection, not equality of refined and unrefined grades or certification of Biopark's batch.

The [Ruetsch et al. primary abstract (2001)](https://pubmed.ncbi.nlm.nih.gov/11413497) reports coconut-derived ions inside treated human hair using cross-sectional TOF-SIMS. This is direct ex-vivo constituent-location evidence. It is not an exact Biopark trial, ordinary-dose guarantee or repair endpoint. The original PDF mirror was not retrievable; no unverified detailed protocol is promoted here. The abstract and existing admitted coconut route suffice for the bounded inference; exact magnitude, retail exposure and processing-grade equivalence remain unproved.

### Exact package observations

- **NEQI Smooth Strength Rosemary Oil, selected DE 75ml:** its [maker gallery](https://neqi-hair.com/products/smooth-strength-rosemary-oil) shows a separate black bulb/collar and glass pipette beside the labelled bottle. [Saved image](neqi-maker-package.png). This directly supports **dropper**; no unit conversion is inferred.
- **Aroma-Zone Haircare Oil with 7 Precious Oils, FR 250ml, ref 0298701:** the [French maker gallery](https://www.aroma-zone.com/info/fiche-technique/huile-de-soin-cheveux-bio-aroma-zone) shows the labelled bottle with screw cap and a close-up continuous stream from its open threaded neck. [Closed package](aroma-maker-package.jpg), [open outlet in use](aroma-maker-usage.jpg). This supports **pour**, beyond cap-shape inference. Separately offered pumps/service caps do not identify the supplied selected mechanism.

### Positive hero positioning and remaining identity limits

- **Evolve Gardenia Monoi:** the [UK 30ml maker page](https://www.evolvebeauty.com/products/weightless-hair-serum) still highlights it and explains flower maceration into coconut oil. This confirms preparation context. It does not allocate all declared coconut to that preparation or establish a unified formula role.
- **Kérastase French and wild camellia:** the [exact DE refillable 75ml page](https://www.kerastase.de/produktlinien/produktart/ole-seren/nach-haartyp-filtern/widerspenstiges-haar/l-huile-originale-nachfullbar/KER_00303.html) separately promotes both. French material is associated with Brittany and cold extraction. The declaration includes Oleifera seed oil and Japonica flower extract. Neither marketing name is explicitly mapped to one exact species/preparation. The [same-code UK maker page](https://www.kerastase.co.uk/ranges/regimen/elixir-ultime/l-huile-originale-l-huile-originale-refillable/KER_00303.html) repeats the same gap. Species cannot be assigned by geography, common-name guess or elimination.
- **NEQI rosemary:** the exact maker's product name and ingredient section explicitly promote rosemary. Its identity is already established at rank 4. Marketing strength provides no new formula-role evidence. Growth and generic peptide claims are excluded from reconciliation.
- **Aroma-Zone Amla macerate:** [current English composition text](https://www.aroma-zone.com/en/product/haircare-oil-with-7-precious-oil) associates it with castor oil. The [linked supplier raw-material page](https://www.aroma-zone.com/en/product/organic-amla-infused-oil) describes castor maceration and filtration but declares Fruit Extract, whereas the captured blend still declares Fruit Powder. That separate material cannot silently replace the blend's declaration or transfer its total castor prominence to amla.

## Internal reconciliation under the existing method

| Field | Recommended current result | Exact reason / stop boundary |
| --- | --- | --- |
| D02 penetration | `penetration_potential`, estimate true, low confidence | Whole-oil preparation is explicitly identified; it occupies the entire single-ingredient conditioning backbone. Admit the existing coconut route only for this source-bound product. Preserve Fruit Oil as a distinct declared identity. |
| D04 dispenser | `dropper`, factual observation | Visible pipette in exact maker gallery. |
| D06 dispenser | `pour`, factual observation | Visible open neck and continuous stream in exact FR package gallery. |
| D01 Gardenia Monoi | `unknown` | Matched ranks 4/6: coconut secondary, Gardenia function unresolved; v0.8 cannot give the mixed-role preparation one prominence. |
| D03 French camellia | `unknown` | Exact ingredient mapping missing. Even an eventual flower-extract mapping would require an admitted formula role. |
| D03 wild camellia | `unknown` | Exact ingredient mapping missing; do not default to Oleifera. |
| D04 rosemary | `unknown` | Rank 4 is auxiliary, outside qualified suffix starting at 7; unresolved lavender at 6 blocks extending the suffix. |
| D06 Amla macerate | `unknown` | Exact matched powder rank 8 remains unresolved; linked extract preparation is not proof of captured blend allocation. |

D02 is a bounded extrapolation, not a global lexicon synonym, new positive botanical family, guaranteed primarily internal action, or a weight/persistence/fit change. Surface conditioning may coexist with penetration. Skin absorption, viscosity, semisolid state and maker repair claims did not choose the value.

The retained unknowns are permitted research outputs. If a fully known hero map is required, exact maker preparation/species evidence is still needed for the camellias and macerates. Rosemary needs a deliberate policy decision for auxiliary heroes outside qualified suffixes. Additional marketing search will not fill that methodological case. Weak evidence must not silently change v0.8.

## Six base-description proposals

These are the existing OE4 wording checkpoint, **proposed for the owning session**, not new measured properties or accepted production copy. They describe architecture and ordinary cosmetic potential without a per-product strengths ranking.

| Base | Proposed German description |
| --- | --- |
| `pure_plant_oil` | Ein Pflanzenöl bildet die Pflegebasis. Seine Lipide können die Haaroberfläche geschmeidiger machen und Glanz unterstützen. |
| `plant_oil_blend` | Mehrere Pflanzenöle bilden die Pflegebasis. Ihre Lipide können die Haaroberfläche geschmeidiger machen und Glanz unterstützen. |
| `silicone_led` | Silikone prägen die Pflegebasis. Ihr gleitender Film kann die Haaroberfläche glatter wirken lassen und Glanz unterstützen. |
| `ester_alkane_led` | Ester und/oder Alkane prägen die Pflegebasis. Sie verteilen die Pflege auf dem Haar; das Haargefühl hängt von der gesamten Formel ab. |
| `hybrid` | Mehrere unterschiedliche Träger prägen gemeinsam die Pflegebasis. Wie sich das Öl auf dem Haar anfühlt, hängt von ihrem Zusammenspiel ab. |
| `water_based` | Wasser prägt die Trägerbasis. Die enthaltenen Pflegestoffe bestimmen das Haargefühl und den verbleibenden Pflegefilm. |

Rejected: guaranteed lightweight/dry ester finish, automatic plant-oil penetration, humidity/heat/UV promises, fixed persistence or removal, repair, protein/moisture direction, and equivalent performance for products sharing a base. None follows from the inherited base category. These descriptions do not change permitted uses or dose.

## Verification and disposition

All eight requested field gaps appear exactly once in `evidence.json`; all source IDs resolve; five retained hero unknowns have explicit reasons. Three saved maker images were visually inspected and SHA-256 bound. Current maker declarations were compared against captured ingredient identities/order, with no formula replacement. Input hashes bind the frozen source packet, working records and current standards. No application tests apply to this research-only artifact; JSON/reference/hash checks pass in `verification.json`.

Only new files under this evidence directory were written. No standards, historical artifacts, runtime, catalog, database, new/holdout product classification or production state changed. Parent owns integration and any wording/method acceptance.
