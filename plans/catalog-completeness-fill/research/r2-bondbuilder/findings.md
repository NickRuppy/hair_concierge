# R2 — October Bondbuilder completeness (research, 2026-10-09)

Read-only research lane (Sonnet). The subagent could not write files; the orchestrator persisted its report here. No DB writes, no engine/apply scripts run. Spot-verified by orchestrator: Aveda GS1 check digit (=4), `cadence: null` hard-coded in `src/lib/product-intake/catalog-enrichment/bondbuilder-reviewed-promotion.ts` (L50/113/220), branched cadence refused in `src/lib/bondbuilder-research/cadence-projection.ts` L19.

## Summary

- Many audit "gaps" on the five new rows (Aveda P07, Première P08, Elvital Plus P04, OGX P06, Redken P05) are deliberate: `bond_repair_axis`/`bond_repair_intensity` NULL by v0.5 standard (L43 "No intensity/axis…"), `product_format` NULL by adapter design (only `cream`/`liquid_spray` map), `cadence` hard-coded null in the promotion builder, diameter + low trust settled by rulings 2026-10-05/06.
- Contract: a bounded, source-bound fact patch is sanctioned; no fresh v0.5 exact-submission run needed (fresh run applies to new intake submissions; these hold reviewed full v0.5 profiles). Precedents: `data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/ogx-amendment.json`, migration `20261007080123_bondbuilder_reviewed_promotion_p08.sql`.

## Live DB state (all five)

Active, recommended, curated, `category_key=bondbuilder`, `suitable_thicknesses={fine,normal,coarse}`; `category` NULL; `suitable_concerns={}`, no concern rows; description/short_description/tom_take/tags empty; spec `usage_protocol=verified_product_protocol`, axis/intensity/format NULL; full v0.5 `research_profile`, `trust_basis=owner_calibration`; one protocol row (`specialized_bond_treatment`), V1+V2 payloads, `cadence` NULL.

| Product | Family / trust | Mode | Protocol id | GTIN |
|---|---|---|---|---|
| Aveda `04a83f16` | gluconamide_gluconate / low | pre_shampoo, rinse_out | f8d9cf57 | none (sku V6B501 + retailer URL) |
| Première `2490911e` | acid_calcium_management / medium | pre_shampoo, rinse_out | a4a8da4d | 3474637196684 |
| Elvital Plus `e5fd7ff9` | acid_calcium_management / medium | pre_shampoo, rinse_out | 14acf19a | 3600524074517 |
| OGX `2c809d0d` | gluconamide_gluconate / low | bedtime_leave_in, leave_in | 9683f6e4 | 3574661818474 |
| Redken `9e5da870` | acid_calcium_management / medium | pre_shampoo, rinse_out | 22e2098c | 3474637248666 |

Reference anchors (K18, OLAPLEX No.3PLUS, Epres) carry `category='Bondbuilder'`, `suitable_concerns={repair}`, and cadences `label_course` / `label_schedule`.

Runtime effect: cadence NULL → safe generic "Nach Herstellerangabe" (`routine/cadence.ts` L185-207). Stage-3 bondbuilder gates only on verified protocol + application_mode/treatment_mode/usage_protocol — format/axis/intensity/concerns/category text are not gates. Legacy chat engine still scores intensity/axis → new five are always `unknown` there.

## Researched values

**Aveda GTIN:** UPC-A `018084067994` (GTIN-14 `00018084067994`), check digit valid, DB canonicaliser returns non-null, no collision. Source T3 parfumdreams.de JSON-LD (150 ml, gtin12, sku 1213914); corroborated escentual.com barcode, e-catalog.co.uk (V6B5010000), Amazon US UPC. aveda.de publishes no GTIN.

**Aveda cadence (T1, aveda.de "ANWENDUNG"):** "Bei leichten bis mittleren Schäden einmal pro Woche, bei mittleren bis schweren Schäden jeden Waschtag anwenden." Stored in profile as `source_stated_conditional` (two branches) → projector refuses branched cadence.

**OGX cadence (T2, non-DE):** ogxbeauty.co.uk / .com: "For best results, use 1-2 times a week." DE source (Boozt, T3) has same directions without frequency. 2026-10-06 amendment explicitly kept UK cadence out of DE runtime.

**Elvital Plus, Redken, Première cadence + format:** unknown — DE manufacturer/retailer directions give no frequency or texture; cross-market statements conflict or refer to predecessors; kerastase.de behind Cloudflare challenge (not bypassed).

**Format:** Aveda stored `gel_cream` (aveda.de "Gel-Creme-Behandlung") — not adapter-mapped; option `cream_treatment` by owner ruling. OGX `serum` not representable in CHECK.

## Before → after (nothing written)

| # | Target | Before | After | Status |
|---|---|---|---|---|
| 1 | `product_identifiers` insert, Aveda | no gtin | `gtin` `018084067994` | ready, needs write go |
| 2 | `products.category` ×5 | NULL | `'Bondbuilder'` | cosmetic parity (chat matcher reads legacy text) |
| 3 | `suitable_concerns` / concern eligibility ×5 | `{}` | `{repair}` | policy ruling |
| 4 | cadence, Aveda f8d9cf57 | NULL | `{"kind":"label_schedule","copy_de":"Bei leichten bis mittleren Schäden einmal pro Woche, bei mittleren bis schweren Schäden jeden Waschtag anwenden."}` | T1 verbatim, conditional — ruling |
| 5 | cadence, OGX 9683f6e4 | NULL | `{"kind":"label_schedule","copy_de":"Ein- bis zweimal pro Woche anwenden."}` | T2 non-DE — ruling (default NULL) |
| 6 | cadence, Elvital/Redken/Première | NULL | NULL | no authoritative DE source |
| 7 | product_format, Aveda | NULL | NULL or `cream_treatment` | ruling |
| 8 | product_format, others | NULL | NULL | unrepresentable/unknown |
| 9 | axis/intensity ×5 | NULL | NULL | standard v0.5 |

## Open questions (for Nick)

1. Aveda: show conditional manufacturer cadence verbatim, or keep generic?
2. OGX: accept UK/US manufacturer "1-2× pro Woche" for DE unit (same manufacturer entity, same directions)? Would reverse 2026-10-06 stance via amendment.
3. `repair` concern on the five (category-wide, like diameter ruling)? No runtime effect found.
4. Aveda format → `cream_treatment`, or leave NULL?
5. (Out of scope) Legacy chat engine scores bondbuilders on intensity/axis.
6. K18 cadence copy reflects US variant ("4–6 Wäschen") while profile selects DE (4 consecutive, then every 4th) — fix separately?
7. Write vehicle: finite CAS-guarded migration (precedent p08) vs smaller SQL batch.
8. Première: kerastase.de only via manual read / pack leaflet.

Also open on anchors: K18 / OLAPLEX / Epres protocol holds (`source_fact_unknown` applied_format, longer_wear, dilution, rinse, local container binding).
