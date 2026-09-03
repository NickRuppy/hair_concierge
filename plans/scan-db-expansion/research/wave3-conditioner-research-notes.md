# Wave 3 — Conditioner Research Notes

Batch: `scan-db-expansion-wave3-conditioner-2026-09-03`
Manifest: `plans/scan-db-expansion/research/wave3-conditioner-manifest.json`
Validator: `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/wave3-conditioner-manifest.json` → **PASS, 15/15 products, 0 duplicate EANs**

Scope: all `category_key: "conditioner"` items from `A_backlog_remainder` (9: 6 Isana + 3 Being) and `B_topup_new` (6: 2 alverde, 1 Wahre Schätze, 2 MONDAY, 1 OGX) in `plans/scan-db-expansion/wave3-selection.json`.

## Counts

- **Researched:** 15 / 15
- **Complete (validator PASS, no exclusions):** 12
- **Complete but with an excluded (single-source) EAN:** 3 — Wahre Schätze Traube Hydraboost, MONDAY Smooth Antifrizz Conditioner, MONDAY Repair Conditioner. These still validate (the schema requires `excluded_from_apply: true` to go with `cross_source_agreement: false`, which is what's stamped), but per R-B they should not be applied to the catalog until a second source is found or Nick accepts the single-source risk.
- **Recategorized (R-A):** 0. All 15 stayed `conditioner` — see the Being Nourish + Shine note below for the one borderline case that was *considered* and rejected.
- **Parked / excluded outright:** 0. All 15 got a full stamp.

## Recategorizations (R-A)

None. Every item's application role (rinse-out, post-shampoo, Längen und Spitzen) matched `conditioner` on inspection of its own usage instructions. The one item I scrutinized hardest for a possible recategorization was **Being Nourish + Shine Spülung** — see below.

## Flagged for Nick — formula anomaly, not a recategorization

**Being Nourish + Shine Spülung** (EAN 4895248005919): its INCI opens with cleansing surfactants (Cocamidopropyl Betaine, Sodium C14-16 Olefin Sulfonate, Sodium Cocoyl Isethionate, Disodium Laureth Sulfosuccinate) — a much more detergent-heavy profile than a typical rinse-out conditioner, closer to a mild "co-wash" formula. I kept it as `conditioner` because:
- Rossmann sells it in the Conditioner/Spülung line, not Shampoo.
- The product description and usage instructions ("Nach der Haarwäsche... einwirken lassen und ausspülen") position it as a post-shampoo rinse-out step, not a cleanser.
- There's no companion product it could be conflated with — Being's separate "Nourish + Shine Daily Clean Shampoo" already covers the cleansing role.

This is an application-role judgment (R-A), not a hard fact — flagging it because the `weight`/`repair_level` classification I stamped (light / low / moisture) is lower-confidence than the other 14 products given the unusual base. Recorded as `NOTE_FOR_NICK` in that product's `field_rationales`.

## EAN sourcing

### Rossmann-exclusive private label (W5 pattern) — single source accepted
- 6× Isana / Isana Professional conditioners — Isana is Rossmann's own private label, matching the W5 exemption from the pilot rulings. Single rossmann.de source, `cross_source_agreement: true`.

### dm-exclusive private label — single source accepted by analogy, NOT explicitly ruled
- **alverde Conditioner Feuchtigkeit** (4066447919028) and **alverde Conditioner Nutri Care** (4066447975321): alverde NATURKOSMETIK is dm's own private-label naturals brand, sold only at dm — the same retailer-exclusivity logic as W5 (Isana/Rossmann), just not a brand W5 named explicitly. I treated it the same way and marked both `cross_source_agreement: true` on the single dm.de source.
- **Open question for Nick:** please confirm alverde should get the same single-source pass as Isana. If not, both need a second source (or `excluded_from_apply: true`) before applying.

### Cross-source confirmed (R-B satisfied)
- **Being Bye Bye Frizz Conditioner** (4895248005933): rossmann.de + world.openfoodfacts.org (independent product DB, same EAN).
- **Being Curl Power Locken Conditioner** (4895248005940): rossmann.de + bebetei.ro (independent Romanian retailer, "Cod produs" field matches exactly).
- **Being Nourish + Shine Spülung** (4895248005919): rossmann.de + world.openbeautyfacts.org (independent DB; the OBF entry is barcode-only/incomplete but the code itself is independently registered there).
- **OGX Conditioner Coconut Miracle Oil**: dm.de's `gtin` field stores `22796972217` — an **11-digit** value, which is the US UPC `022796972217` with its leading zero(s) stripped by dm's data pipeline. Normalized to a full EAN-13 by zero-padding: `0022796972217` (GS1 check digit verified against the repo's own `validateEanInput` mod-10 algorithm — see verification below). Cross-confirmed via an eBay UK listing quoting the identical UPC `022796972217` for "OGX Damage Remedy + Coconut Miracle Oil Conditioner" (the EU/UK full product name carries a "Damage Remedy +" prefix that dm's shortened German title drops — same GTIN, same 385 ml size, same formula description).

### Excluded — no independent second source found (R-B not satisfied)
Despite real effort, I could not find a second independent source with matching digits for these three. All three validate with `cross_source_agreement: false` + `excluded_from_apply: true` per the schema's own rule.

1. **Garnier Wahre Schätze Conditioner Traube Hydraboost, 250 ml** (dm.de, EAN 3600542656320). flaconi.de and mytime.de both sell the *same product line* but only as a **200 ml** bottle with a **different** EAN (3600542656412, itself confirmed by 2 independent sources). The 250 ml fill appears to be a dm-exclusive size. **Open question for Nick:** either (a) accept the 250 ml/dm-only listing as `excluded_from_apply` for now, or (b) swap the selection to the 200 ml SKU (3600542656412), which already has clean 2-source confirmation.
2. **MONDAY Haircare Smooth Antifrizz Conditioner, 350 ml** (rossmann.de, EAN 4897097266398). Tried: INCI Beauty (Cloudflare-blocked), Superdrug UK (product page has no barcode field), MONDAY Haircare's own site (confirms the formula/INCI but shows no barcode), Danish Rossmann (same EAN, but same corporate parent — not independent per R-B's spirit), ean-search.org and go-upc.com (both blocked/unreachable).
3. **MONDAY Haircare Repair Conditioner, 354 ml** (rossmann.de, EAN 4897097269160). Same situation — MONDAY's own product page confirms an essentially identical INCI list (strong formula match) but carries no barcode; other attempted sources same as above.

**Open question for Nick:** MONDAY Haircare is explicitly called out in the brief as *not* retailer-exclusive, so these two should in principle be confirmable — I just didn't find a working second source in the time available. If you have another lead (a UK/US barcode database that isn't Cloudflare-gated, or willingness to accept the Danish Rossmann storefront as "independent enough" since it's a separate national catalog even under the same parent company), that would resolve both.

## Low-confidence fields flagged

- **Being Nourish + Shine Spülung** — `weight: light`, `repair_level: low`, `balance_direction: moisture` are my best read of an unusually surfactant-heavy INCI (see formula-anomaly note above). Confidence: moderate, not high.
- **Garnier Wahre Schätze Traube Hydraboost** — no `humectants` ingredient flag despite the "Hydraboost"/moisture marketing, because the INCI has no classic humectant (no glycerin, panthenol, or hyaluronate — only grape fruit water and grapeseed oil). This is a deliberate, evidence-driven omission, not an oversight; flagging in case it looks like a gap on review.

## Deviations

Zero `deviation` records across all 15 products (all `protocols[].deviation: null`). Every application-instruction quirk I encountered was an **application-style** difference under R-C ("packaging can never override Chaarlie's category application guidance... the deviation mechanism is reserved for STRUCTURAL mismatches only"), not a structural one:

- Several Isana/Being products state no placement at all ("in das feuchte Haar einmassieren") — template's own Längen-und-Spitzen/Ansatz-aussparen copy stamped unchanged.
- **OGX Conditioner Coconut Miracle Oil** explicitly says "im gesamten Haar" (whole hair) and "3 bis 5 Minuten" — both are application-style facts (placement + timing), not structural mismatches, and the manifest schema itself only allows a per-product `contact_time` override for `TPL-MASK`, never for `TPL-CONDITIONER`. Stamped the template unchanged; the sourced deviation is recorded as an `evidence` row for transparency, not as a `protocols[].deviation`.
- **MONDAY Smooth Antifrizz Conditioner** and **Garnier Wahre Schätze Traube Hydraboost** are the two products whose own copy actually *matches* the template's placement rule verbatim ("Ansatz aussparen" / "Längen und Spitzen") — no tension there at all.

## Stock status

**Isana Spülung Feuchtigkeit** (4068134071149) showed `availability: OutOfStock` on rossmann.de's own product-page JSON-LD at research time (2026-09-03), while every other Isana SKU showed `InStock`. This reads as an ordinary stock gap rather than a delisting — the product page is otherwise fully live (price, description, INCI all present and current) — but flagging it since a stocked-out SKU is a weaker candidate for immediate scan-DB inclusion than the rest of the cohort.

## Open questions for Nick (summary)

1. Does the W5 (Isana/Rossmann-exclusive) single-source exemption extend to **alverde** (dm's own private-label naturals brand)? I assumed yes by direct analogy and stamped both alverde conditioners with `cross_source_agreement: true` on a single dm.de source — please confirm or correct.
2. **Wahre Schätze Traube Hydraboost, 250 ml**: keep as dm-only/`excluded_from_apply`, or switch the selection to the 200 ml SKU (3600542656412) which already has clean 2-source confirmation?
3. **MONDAY Smooth Antifrizz** and **MONDAY Repair Conditioner**: both are single-source/`excluded_from_apply` despite MONDAY not being retailer-exclusive. Any leads for a second source, or should these stay parked until one turns up?
4. **Being Nourish + Shine Spülung**: the surfactant-heavy formula is unusual for a conditioner (co-wash-adjacent). I kept the category and flagged lower confidence on weight/repair_level — worth a second look before it ships.

## Image sourcing

All 15 `candidate_image.url` values spot-checked resolve to ≥1200px bottle packshots (Rossmann CDN via `?width=1600&height=1600&fit=bounds&canvas=1600,1600`, dm CDN via `h_3000,w_3000`). Verified directly by loading two representative URLs (one Rossmann, one dm) in-browser: 1600×1600 and 1217×3000 respectively — both comfortably above the 800px floor. All images are single-bottle product shots (no cartons/multi-packs), taken from each product's primary `image` entry in its retailer JSON-LD.
