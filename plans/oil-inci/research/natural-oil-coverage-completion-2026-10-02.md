# Natural-oil reference coverage — completion receipt

2026-10-02. Completed local reference extension; whole-catalog completeness remains unverified. The original 25-entry list was not comprehensive across the formulas reviewed.

[Current guide](../../../docs/research/oil-inci/v1.0/03_weight-reference-v0.3.md) and [machine-readable reference](../../../data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.3.json): **64 materials = 63 fixed botanical oils + C8/C10 MCT**, with **56 rough weight estimates and 8 explicit unknowns**. There are 103 exact canonical names/aliases and 89 source records (including identity/exclusion sources). All 25 preceding entries remain unchanged. No standardized hair-weight scale or product-intake approval is claimed.

## What was actually checked

| Evidence universe | Count | Limitation |
| --- | ---: | --- |
| Local category-research/capture JSON | 568 files; 535 raw-formula fields | Includes duplicate copies, calibration sketches and material benchmarks; not 535 distinct current products. |
| Stored catalog fact evidence | 94 rows; 85 distinct products | Matching source text, some partial and previously captured; not refreshed full formulas. |
| Catalog oil subset | 19 of 54 products with matching stored ingredient evidence | 35 oils lack matching evidence in this extraction. |
| Whole catalog | 371 products (347 active) | A count only; no full-formula coverage assertion. |

The [local inventory](natural-oil-coverage-local-inventory-2026-10-02.json) and [literal-declaration supplement](natural-oil-coverage-observed-declarations-2026-10-02.json) identified nine missing oil identities and five distinct variants. No further intact fixed-oil group was found in that finite audited evidence. **All 14 identified gap groups are now accounted for: 13 admitted reference identities and one visible unresolved coconut declaration.** Four source-specific label-display receipts are additional provenance, not global aliases.

## Identified gaps and final treatment

| Observed identity | Final reference treatment | Weight |
| --- | --- | --- |
| `GLYCINE SOJA OIL` | soybean | `light` |
| `ZEA MAYS OIL` | corn_oil | `light` |
| `SALVIA HISPANICA SEED OIL` | chia | `light` |
| `GOSSYPIUM HIRSUTUM SEED OIL` | cottonseed_hirsutum | `light` |
| `MAURITIA FLEXUOSA FRUIT OIL` | buriti | `rich` |
| `BRASSICA OLERACEA ITALICA SEED OIL` | broccoli_seed | `light` |
| `ARACHIS HYPOGAEA OIL` | peanut | `light` |
| `AVENA SATIVA KERNEL OIL` | oat_kernel | `light` |
| `CANOLA OIL` | canola_declaration | `unknown` |
| `MACADAMIA TERNIFOLIA SEED OIL` | macadamia_ternifolia | `light` |
| `MACADAMIA INTEGRIFOLIA/TETRAPHYLLA SEED OIL` | macadamia_hybrid | `unknown` |
| `HELIANTHUS ANNUUS HYBRID OIL` | sunflower_hybrid | `unknown` |
| `COCOS NUCIFERA FRUIT OIL` | Identity review required; no generic whole-coconut match | `unknown` |
| `HIPPOPHAE RHAMNOIDES FRUIT/SEED OIL` | sea_buckthorn_fruit_seed | `unknown` |

Canola is independently confirmed as an INCI declaration by AAK but its weight remains unknown; it is not silently mapped to Napus or Campestris. Oat lacks a product identity in the old calibration record, but its material identity now has independent supplier evidence. The coconut Fruit Oil spelling originates in proposed/captured evidence and remains excluded from generic whole-coconut matching; source-specific corrections in the sealed earlier run are not rewritten.

## Additional common-material research

Beyond observed omissions/variants, 26 further exact entries broaden the reference: corn germ, sesame, rice bran, two rapeseed species, flax, evening primrose, borage, camelina, blackcurrant, meadowfoam, three rosehip species, Edulis passionfruit, prickly pear, Inophyllum tamanu, Brazil nut, kukui, sacha inchi, plum, raspberry, coffee, cranberry, Sinensis camellia and seed-only sea buckthorn. These are researched additions, not asserted product prevalence. Three ordinary/high-oleic sunflower advisory rows refer to one existing INCI, so they do not inflate material count.

Eight admitted identities lack a useful resolved prior:
- Canola (declared INCI) — `CANOLA OIL`.
- Evening primrose — `OENOTHERA BIENNIS OIL`.
- Borage — `BORAGO OFFICINALIS SEED OIL`.
- Blackcurrant seed — `RIBES NIGRUM SEED OIL`.
- Sunflower Hybrid Oil — `HELIANTHUS ANNUUS HYBRID OIL`.
- Macadamia Integrifolia/Tetraphylla — `MACADAMIA INTEGRIFOLIA/TETRAPHYLLA SEED OIL`.
- Sea buckthorn combined fruit/seed — `HIPPOPHAE RHAMNOIDES FRUIT/SEED OIL`.
- Sea buckthorn seed — `HIPPOPHAE RHAMNOIDES SEED OIL`.

Unknowns distinguish evidence/grade conflicts from missing identities. The separately unresolved coconut display is an additional identity blocker, not an admitted weight entry. Butters, essential/aromatic oils, extracts, unspecified Olus blends, hydrogenated/PEG/ferment/copolymer/ester forms and synthetic carriers are documented boundaries rather than forced botanical aliases.

## Main evidence adjudication

Workers produced advisory evidence; the reference contains main's final choices. Three departures are explicit:

- Corn Oil: weak `light` estimate via a reviewed supplier same-grade Oil/Germ Oil declaration bridge and weak Germ Oil sensory evidence; retains `unknown`/`medium` alternatives and separate identities.
- Oat Kernel Oil: weak `light` estimate extrapolated from the independently declared specialty Oat Lipid e material; non-greasy skin behavior supports the proxy, while processing and other grades remain unresolved.
- Buriti: `rich`/low from Beraca's material-specific rich finish, with `light` and `unknown` alternatives; generic repeated light copy is weaker. No averaging of opposing classes into medium.

Prior ordinary sunflower medium/low with a light alternative is preserved. New Heess ordinary/high-oleic sensory wording is advisory support for that alternative, not transferred to the distinct Hybrid Oil. Meadowfoam hair-conditioning evidence is not a weight endpoint. Supplier medical/growth/UV claims, nutrient richness, color, density, fatty-acid ratios and penetration are not used to decide weight.

## Verification and disposition

Artifact checks: [verification receipt](natural-oil-coverage-verification-2026-10-02.json). New verifier checks source/alias integrity, 14-group accounting, all 17 distinct literal declarations (12 exact matches, four source-scoped corrections, one identity blocker), historical entry preservation and false-form boundaries. Existing verifier checks sealed inputs/28 lane records and all 28 historical round-1 files. Negative probes establish that dropped observations, derivative aliases, excluded positive evidence and historical-prior changes fail. Guides/links and new-file whitespace are checked separately. These checks verify research-artifact contracts, not sensory accuracy.

Plan review/reconciliation: [receipt](../reviews/natural-oil-coverage-plan-review-2026-10-02.md). Durable research artifacts have `commit` disposition and remain local for later authorized publication. Transient full review output and temporary downloaded primary PDFs are discarded. No database write, runtime change, commit, push or activation.

## Recommended next step

Obtain complete current declarations for the 35 catalog oils without matching stored ingredient evidence, check the partial stored texts, and run the same exact-identity gap audit before claiming full oil-catalog coverage. Then use contrasting real blends for the next formula-weight calibration round. New exact identities require source-backed addition or visible unknown handling; never default an unfamiliar natural oil to medium. No user decision was required to complete this authorized reference extension.
