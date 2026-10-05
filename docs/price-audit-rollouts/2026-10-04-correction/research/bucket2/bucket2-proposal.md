# Bucket 2: exact proposal, 2026-10-04

Read-only. All live facts are in `live-catalog.json`; current dm responses are retained alongside this report. No repository or production changes were made.

| Product | Exact current German offer | Outcome | Proposed handling |
|---|---|---|---|
| got2b Schutzengel | [dm, 200 ml, €4.95](https://www.dm.de/p/d/1267310/got2b-hitzeschutzspray-schutzengel), GTIN 4015100894141, DAN 1267310 | Enabled cart; Lieferbar, 2–3 working days; observed 2026-10-04 08:09:34.503 UTC | Commerce-only candidate in `got2b-commerce-only.json`. Keep every identifier, property, protocol and recommendation flag unchanged in this maintenance. |
| Balea Oil Repair Intensiv Conditioner | [dm, 200 ml, €1.25](https://www.dm.de/p/d/1703916/balea-professional-conditioner-oil-repair-intensiv), GTIN 4070765001402 | Enabled cart; Lieferbar; observed about 08:03 UTC, primary MCP 08:00:32.476 UTC | Integrate separate blind category assessment before combined exact product proposal. This lane supplies commerce and protocol provenance only. |
| Balea 2-Phasen Hitzeschutz | [dm, 200 ml, €1.95](https://www.dm.de/p/d/1460813/balea-hitzeschutzspray), GTIN 4070765016758 | Reachable, disabled cart, Momentan nicht lieferbar; about 08:00 UTC | No commerce mutation. Preserve existing price, URL, unavailable status, recommendation and identity. |

The Balea stock conflict is resolved: MCP `purchasable=true` is not stock proof. The rendered exact PDP explicitly prevents adding the product to the cart. Rossmann's native name search showed alternatives; all 22 Müller matches excluded Balea; Amazon DE showed different Balea 2in1/leave-in products, no verified exact 2-Phasen pack. Specialist leads lacked exact current GTIN/price/DE orderability. No substitute was selected. Search limits do not imply universal absence.

## Exact commerce-only candidate

Schutzengel retains its existing dm URL, €4.95, EUR and `purchase_link_status=available`. Change `net_content_value: null → 200`, `net_content_unit: null → ml`, and the two checked timestamps from 2026-08-09 to the actual check above. `got2b-commerce-only.json` contains complete expected-before values, deterministic SHA256, and protected snapshots. Parent must refresh the optimistic precondition before writing. No chemical-continuity assertion is needed: the existing dm DAN, name, pack and independently verified current category facts support this retail association.

## Separate protocol and identity proposals

- Both heat sprays retain exact category values `format=spray`, `provides_heat_protection=true`, `suitable_thicknesses=[]`.
- Schutzengel: `reapplication: not_stated → optional`, supported by [current manufacturer instructions](https://www.got2b.de/haarstyling/produkt/settings/schutzengel-hitzeschutz-spray.html). Keep damp initial application and v1/v2 `reapplication=none`: these express no **required** extra occurrence. Refresh source evidence; retain `maximumClaimedTemperatureC=null` under AD-6. Numeric marketing claims remain source evidence only. These changes require their own exact review and are excluded from the commerce file.
- Balea: retain `application_state=either`, `reapplication=required`, shake/15cm/damp application then repeat on dry sections before tools. Source refresh is a separate proposal only; retain `maximumClaimedTemperatureC=null` under AD-6. Numeric marketing claims remain source evidence only.
- Conditioner: current dm instructions confirm wet application, brief unspecified contact and rinse-out. Replace outdated Vivavoss provenance with current dm; no invented seconds. Existing v2 lengths/ends policy is retained. Category, suitability and stale description changes belong to the separate Conditioner agent.
- Current GTINs have no other catalog owner in today's read-only query. JSON lists additive identifier candidates separately; none are included in commerce-only maintenance. Retain old identifiers. Conditioner association must be reviewed together with its fresh authority facts.

Old canonical German catalog INCI remains unrecovered. JSON retains yesterday's exact historical declaration comparisons with their original provenance and fresh current INCI. Those variants do not prove unchanged chemistry or chemical reformulation; no concentration is inferred from list order.

## Verification and readiness

All three proposed v1 guidance payloads and v2 pointers pass current repository schemas. Current INCI/identity came from fresh dm MCP; actual cart states were verified through the browser; current GTIN ownership query returned no rows. No promotion, image-finalization, final handoff or live recommendation dry-run was performed.

Heat research is complete for this bounded proposal; Conditioner category research is owned by the separate lane. `catalog_intake_ready=false` and `global_recommendation_ready=false` describe unperformed final-package/image/promotion gates, not instructions to pause or deactivate existing products. No recommendation flags change from any sourcing result.

Remaining decisions: review the exact optional-protocol/identifier proposals separately from price maintenance, and integrate/review the Conditioner agent's independent classification. The unavailable Balea offer needs better purchase evidence, not a policy decision or automatic pause.

Correction after root review: both heat v2 proposals retain the live `maximumClaimedTemperatureC=null`. Authority: `docs/product-intake-research-ops.md:335–337`, `docs/product-application-protocol-templates.md:886–888`, `docs/personal-plan/categories/heat-protectant/decision.md:109–122`, and `plans/leave-in-inci/adapter-decisions.md:37–39`. Schema acceptance did not authorize restoring numeric degree semantics. The commerce-only file is byte-for-byte unchanged.
