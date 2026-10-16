# Specialty oil hair-weight lane — 2026-10-02

Scope: the sixteen exact entries at indexes 48–63 of `natural-oil-weight-v0.5.json`.  The question is relative hair burden after an equal, modest, **leave-on** neat-oil dose.  These are advisory estimates for further calibration, not a scientific ranking or a finished-product rule.

## Result

| ID | Exact INCI | Proposed | Confidence | Nearest alternative | Basis |
|---|---|---:|---:|---:|---|
| rosehip_moschata_seed | ROSA MOSCHATA SEED OIL | light | low | medium | exact cold-pressed liquid; weak film inference |
| passionfruit | PASSIFLORA EDULIS SEED OIL | light | low | medium | hair-specific supplier guidance |
| prickly_pear | OPUNTIA FICUS INDICA SEED OIL | light | low | medium | 53.1 mPa s at 20 C material study; rough comparative film estimate |
| tamanu | CALOPHYLLUM INOPHYLLUM SEED OIL | rich | low | medium | crude material 98.667 mPa s falls to 42.9 after refining |
| brazil_nut | BERTHOLLETIA EXCELSA SEED OIL | light | low | medium | 32.5 mPa s at 25 C; 41.06–41.35 cSt at 40 C across differing protocols |
| kukui | ALEURITES MOLUCCANUS SEED OIL | light | low | medium | exact liquid refined material; weak film inference |
| sacha_inchi | PLUKENETIA VOLUBILIS SEED OIL | light | low | medium | material inference |
| plum | PRUNUS DOMESTICA SEED OIL | medium | low | light | supplier low-to-medium viscosity description |
| raspberry | RUBUS IDAEUS SEED OIL | light | low | medium | material inference |
| coffee | COFFEA ARABICA SEED OIL | medium | low | light | exact slightly-viscous TDS; green/roasted unresolved |
| cranberry | VACCINIUM MACROCARPON SEED OIL | light | low | medium | exact producer spec: 40–60 mPa s at 25 C; rough flow comparison |
| camellia_sinensis | CAMELLIA SINENSIS SEED OIL | light | low | medium | exact RBDW supplier: light-to-medium viscosity |
| broccoli_seed | BRASSICA OLERACEA ITALICA SEED OIL | light | low | medium | exact neat hair guidance |
| peanut | ARACHIS HYPOGAEA OIL | medium | low | light | material inference; no hair evidence retrieved |
| sea_buckthorn_fruit_seed | HIPPOPHAE RHAMNOIDES FRUIT/SEED OIL | unknown (test: medium) | low | light or rich | proportion unknown; test point is not an average |
| sea_buckthorn_seed | HIPPOPHAE RHAMNOIDES SEED OIL | light | low | medium | review reports about 44 viscosity; original condition unresolved |

## Usable direct hair guidance

- [Etja broccoli seed oil](https://biogo.de/en-sk/products/etja-brokkoli-samenol-50ml) declares the exact 100% cold-pressed **BRASSICA OLERACEA ITALICA SEED OIL**, permits direct dry/damp hair use, and says its light texture does not weigh hair down. It does not disclose dose, comparator, hair type, or a controlled method; `broccoli_seed=light` stays low confidence.
- [Cosmacon passion fruit oil](https://www.cosmacon.de/en/glossary/passion-fruit-oil/) identifies **PASSIFLORA EDULIS SEED OIL** and says it can be applied to hair without weighing it down. No method, dose, or comparator is supplied; `passionfruit=light` stays low confidence.
- [Loczek rosehip oil](https://loczek.pl/produkt/etja-zimnotloczony-olej-z-nasion-dzikiej-rozy-do-wlosow-wysokoporowatych/) identifies only **ROSA MOSCHATA SEED OIL** and supports direct leave-on ends application, but makes no heaviness assertion. It establishes practical scope only.

No retrieved source was a direct standardized comparative human-hair heaviness measurement for any of the sixteen exact oils. No value has `direct_hair_measurement` basis.

## What was deliberately excluded

- A silicone/alkane/ester/polymer-led product labelled lightweight cannot prove the weight of a named botanical oil. This excludes specific hair blends containing prickly pear, tamanu, Brazil nut, kukui, sacha inchi, coffee, cranberry, camellia, and either sea-buckthorn declaration. The exact URLs and INCI observations are in the JSON ledger.
- Rinse-off conditioner/masque and shampoo claims cannot establish leave-on burden. This excludes available raspberry, kukui, sacha inchi, coffee, and cranberry formula examples.
- Skin claims such as “light,” “non-greasy,” fast absorption, facial spread and light colour were not used to choose a hair class. Shine, penetration, protein-loss prevention and detangling also are different endpoints.
- The combined `HIPPOPHAE RHAMNOIDES FRUIT/SEED OIL` cannot inherit fruit/pulp or seed alone. The light proposal is explicitly a seed-leaning tendency; fruit/pulp-dominant material has the declared rich alternative. No automatic average was made.

## Interpretation limits

The material-inference entries use an explicit exact-material observation where one was recovered: passionfruit 28 cSt at 40 C; prickly pear 53.1 mPa s at 20 C; tamanu 40.05 cSt at 40 C; sacha inchi 35.4 mPa s; raspberry about 22.3 mPa s near body temperature; and refined peanut 35.2 mPa s/39 cSt at 37 C. The unknown entries have a labelled test proposal instead of a silently integrated class. Grade/refining, substrate, application amount and elapsed time remain unresolved. Source access limits are recorded in the JSON ledger.

The technical anchor for those inferences is [Marsh, Knowles and Simmonds (2023)](https://www.cosmeticsandtoiletries.com/magazine/article/22862759/cosmetics-toiletries-magazine-choosing-the-right-plant-oil-for-hair-and-skin-benefits): viscosity affects spreading and felt heaviness, while hair surface coverage depends on dose and spreading. It is a formulation mechanism, not a measured result for this cohort. It cannot justify a high-PUFA shortcut or transfer between processing grades or botanical species.
