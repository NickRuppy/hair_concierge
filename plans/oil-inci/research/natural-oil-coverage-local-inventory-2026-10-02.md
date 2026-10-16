# Local natural-oil coverage inventory — 2026-10-02

`natural-oil-weight-v0.2.json` has 25 reference entries. This read-only inventory compares that list with a finite local source universe; it does not assign priors or claim market completeness.

| Local source universe | Formula evidence available | Limit |
| --- | ---: | --- |
| Leave-in, conditioner, shampoo research plus oil capture JSON | 568 JSON files parsed; 535 `raw_inci`/`rawInci` fields | Artifacts include calibration and replay copies, so counts deduplicate exact formula strings. |
| Catalog evidence extraction | 94 fact-evidence rows for 85 products | It is stored commercial source text, not freshly verified INCI. The catalog total is 371 products, but the other products did not expose stored full INCI in these fields. |
| Oil lexicon and category standards | identity/context only | Never counted as product-formula prevalence. |

## Genuine absent identities with product-declaration evidence

| Identity | Evidence | Priority |
| --- | --- | --- |
| `GLYCINE SOJA OIL` | 5 distinct local formula strings (15 artifact occurrences), including [leave-in slot 04](../../../data/research/leave-in-inci/v1.0/calibration-envelopes/slot-04.json) and [shampoo formula](../../../data/research/shampoo-inci/v1.3/products/wahre-schatze-sanfte-hafermilch/formula-source.json); 2 catalog products | High |
| `ZEA MAYS OIL` / `ZEA MAYS (CORN) OIL` | [Olaplex No.7 capture](../capture/round-1/olaplex-k18.json) and 1 catalog product; already admitted by the local supplement lexicon but absent from the weight reference | High |
| `SALVIA HISPANICA SEED OIL` | 1 distinct leave-in formula (6 artifact occurrences): [unseen packet u4](../../../data/research/leave-in-inci/v1.0/corpus/unseen-test/unseen-packet.json) | High |
| `GOSSYPIUM HIRSUTUM SEED OIL` | 1 distinct shampoo formula (4 artifact occurrences): [Nivea Classic Care source](../../../data/research/shampoo-inci/holdout-v2/products/nivea-classic-care/formula-source.json) | High |
| `MAURITIA FLEXUOSA FRUIT OIL` | 2 catalog products, including stored source text for Langhaarmädchen at catalog-evidence lines 337 and 1831 | High |
| `BRASSICA OLERACEA ITALICA SEED OIL` | 1 catalog product; stored source text at line 472 | High |
| `ARACHIS HYPOGAEA (PEANUT) OIL` | 1 catalog product; stored source text at line 1937 | High |
| `AVENA SATIVA KERNEL OIL` | 1 local conditioner calibration formula at [line 252](../../../data/research/conditioner-inci/v1.0/calibration-pilot-formulas.json) | Medium: record has no product identity |
| `CANOLA OIL` | 2 distinct local formula strings (8 artifact occurrences), including [leave-in slot 03](../../../data/research/leave-in-inci/v1.0/calibration-envelopes/slot-03.json) | Medium: common-name declaration; map identity before admission |

The JSON companion holds the complete 25-entry covered list, exact evidence paths, counts, and non-actions.

## Do not auto-merge these variants

- `MACADAMIA TERNIFOLIA SEED OIL` and `MACADAMIA INTEGRIFOLIA/TETRAPHYLLA SEED OIL` are not the reference's exact `MACADAMIA INTEGRIFOLIA SEED OIL`.
- `HELIANTHUS ANNUUS HYBRID OIL`, `COCOS NUCIFERA FRUIT OIL`, and `HIPPOPHAE RHAMNOIDES FRUIT/SEED OIL` differ in declared form or plant part from the nearest reference entry.
- Butters, hydrogenated/PEG/ferment/ester/copolymer forms, `OLUS OIL`, and essential/aromatic oils are boundary material rather than additions to this intact fixed-oil reference.

No priors, frozen runs, consumers, or matching rules changed.
