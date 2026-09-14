# Shampoo Research Notes — Batch 04

> **STATUS: RESEARCH-DRAFT — not approved data.**
> Evidence only; nothing has been applied to a database, approved, promoted,
> committed, published, or activated.
>
> **CLASSIFICATION INVALIDATED 2026-09-03:** identity, EAN, commercial, raw-image,
> source, and protocol research is being preserved. The current Shampoo property
> projections, repeatability statement, and prior `property_lane_ready` claim are not
> v1.4-reviewed output and must not be applied or used as classification priors. They
> will be regenerated only from the approved `shampoo-v14/` research packages.

Checked date: 2026-09-02
Manifest: `shampoo-manifest-04.json` (assembled; research-only)
Batch scope: extension ranks 160–167, 8 candidates.

Confidence: **solid** = directly sourced; **inferred** = whole-formula/claims judgment;
**guessed-conservative** = incomplete/mixed evidence with an explicit conservative
choice.

## Batch roster and status

| Position | Rank | Product | Status |
| ---: | ---: | --- | --- |
| 46 | 160 | ISANA MED — Shampoo Totes Meer | projectable; targeted scalp-comfort route |
| 47 | 161 | Balea PROFESSIONAL — Shampoo Plex Care | projectable |
| 48 | 162 | ISANA PROFESSIONAL — Shampoo Keratin & Repair | projectable with non-numeric wait deviation |
| 49 | 163 | ISANA PROFESSIONAL — Plex Shampoo | projectable |
| 50 | 164 | ISANA MEN — Shampoo Energy Power | projectable with name correction and non-numeric wait deviation |
| 51 | 165 | Garnier Wahre Schätze — Shampoo Kokosmilch & Macadamia | projectable; image verified |
| 52 | 166 | John Frieda Sheer Blonde — Refresh & Shine Shampoo | projectable; current formula/image resolved |
| 53 | 167 | AUSSIE — Shampoo Bouncy Curls | projectable; EAN independently corroborated |

## Cell checkpoints

| Cell | Products | Source packet | Independent assessment | Adapter/equality | State |
| --- | ---: | --- | --- | --- | --- |
| 04A | 46–50 | frozen | clean Lane A rerun + Lane B complete | equality PASS | 5 projectable |
| 04B | 51–53 | frozen | Lane A + Lane B complete | equality PASS | 3 projectable |

## Open questions for Nick

None at kickoff. Rossmann-only EANs remain excluded from apply unless an independent
source verifies the exact identifier; source gaps are never filled by invented digits.

## Cell 04A preliminary evidence state

- All five products have exact current German retailer pages, complete INCI, valid
  EANs corroborated by a second retailer, EUR prices, usage text, and visually checked
  product-only packshot candidates.
- Balea Plex Care's official dm packshot was re-requested at the same asset path with
  a 4000×4000 fit and visually verified as an exact front-facing product-only image;
  the delivered rendition is 985×4000 and clears the canonical roughly 800 px
  long-side bar.
- Rank 164 is an identity-name correction: the frozen roster says `Energy Effect`,
  while the current exact-EAN Rossmann product body and front pack say `Energy Power`
  for EAN `4305615633428`. This is preserved for independent adjudication rather than
  silently retaining the stale name.
- The first Lane A serialization combined conditioning and weight into one field and
  therefore does not satisfy the required eight-property v1.4 contract. Its blind
  receipt is retained as a process artifact, but a fresh formula-first Lane A rerun is
  the only Lane A used for comparison. No combined field is projected or copied into
  a manifest.
- Clean Lane A and independent Lane B agree on 35/40 properties (87.5%). Final
  adjudication retains `gentle` as the secondary focus for Totes Meer because the
  exact product is explicitly for sensitive/itchy scalp and pH-neutral; keeps Plex
  Care secondary focus empty because repair is the evidenced product role; and uses
  moderate rather than high conditioning for the two ISANA PROFESSIONAL products
  because their rinse-off, silicone-free/non-rich systems do not justify the high
  band. Keratin & Repair and Energy Power preserve the exact `kurz einwirken lassen`
  instruction as non-numeric `TPL-SHAMPOO-STD` deviations.
- The Energy Power name is the current exact-EAN pack/PDP identity. `Energy Effect`
  is retained only as the stale selection name in the rationale, never silently used
  as the final clean name.

## Cell 04B preliminary evidence state

- Garnier Kokosmilch & Macadamia has a current 250 ml EAN/formula supported by
  Rossmann and Budni. The 1200x1200 Rossmann front packshot was downloaded and
  visually verified as exact, product-only imagery.
- John Frieda Refresh & Shine uses the current German dm plus manufacturer formula.
  A materially older same-EAN formula on Rossmann Denmark remains documented and is
  not merged. The original official range image failed the product-only bar; an exact
  dm product-only packshot was recovered and visually verified at 1054x2800.
- AUSSIE Bouncy Curls has complete exact German dm evidence and independent official
  P&G/for-me GTIN corroboration. The P&G record calls it "Aussie Shampoo Curls" but
  shares exact GTIN `8006530325530` with dm DE's 300 ml Bouncy Curls PDP; it is now
  `cross_source_agreement: true` and no longer excluded from later apply review. A
  higher-resolution dm rendition was recovered and visually verified as product-only
  at 810x2800.
- Lane A and Lane B agree on 20/24 properties (83.3%). Adjudication uses moderate
  conditioning and weight for Garnier because oils plus Polyquaternium-10 provide
  several bounded deposition routes; moderate weight for John Frieda because its
  current formula contains multiple emollient/refatting routes; and moderate
  cleansing for AUSSIE because several surfactant routes make `low` too optimistic
  despite the sulfate-free chassis.

## Batch 04 repeatability gate

The valid eight-product comparison passes at 55/64 (85.9%). Per-property agreement
is cleansing 7/8, conditioning 5/8, weight 6/8, primary focus 8/8, secondary focus
5/8, usage 8/8, scalp comfort 8/8, and dandruff 8/8. This clears the 75% overall and
60% per-property thresholds, with the required 100% dandruff agreement. Commercial,
image, identifier, protocol, and adapter gates remain separate.

## Production Light projection

The pinned PR #508 CLI projected all 8 products as `property_lane_ready`, with no
warnings, routes, or research blocks. A second run was byte-for-byte deterministic
and all receipt input hashes matched. All eight products require
`shampoo_everyday`; Balea Plex Care projects normal/coarse thicknesses, while the
other seven project fine/normal/coarse. Adapter-to-manifest equality is **PASS
(8/8)**. Canonical expansion-manifest validation is **PASS (8/8)**: two deviation
flags, no excluded EANs, no duplicate EANs, and no existing-product updates. These
structural projection results are invalidated pending the v1.4 rerun.

## Per-product handoff ledger

Confidence fields are identity/EAN, formula, properties, protocol, image, and
commercial, respectively. `solid` means direct source evidence; `inferred` is a
whole-formula/claims judgment; `guessed-conservative` records an incomplete or
mixed evidence lane without filling a gap by assumption.

### 160 — ISANA MED Shampoo Totes Meer

- Sources: [Rossmann DE PDP](https://www.rossmann.de/de/pflege-und-duft-isana-med-shampoo-totes-meer/p/4305615629230) (identity, 200 ml, EAN, price, INCI, claims, image); [Rossmann HU PDP](https://shop.rossmann.hu/termek/isana-med-holt-tengeri-sampon-200-ml?q=isana+sensitive&suggestionType=0-res-product) (EAN/formula corroboration and wet-hair/rinse use capture).
- Confidence: **solid / solid / inferred / guessed-conservative / solid / solid**.
- `TPL-SHAMPOO-TARGETED`; sensitive/itchy-scalp positioning is kept cosmetic, not medical. Open gap: the opened DE PDP did not expose directions, so the protocol transparently cites the HU wet-hair/rinse fallback rather than presenting it as German packaging copy.

### 161 — Balea PROFESSIONAL Shampoo Plex Care

- Sources: [dm DE PDP](https://www.dm.de/p/d/1674700/balea-professional-shampoo-plex-care) (identity, 250 ml, GTIN, price, INCI, claims, directions); [dm RO PDP](https://www.dm.ro/p/d/1674700/balea-professional-sampon-plex-care) (EAN/formula corroboration).
- Confidence: **solid / solid / inferred / solid / solid / solid**.
- `TPL-SHAMPOO-STD`; the high deposition/conditioning assessment projects normal/coarse only. The manifest uses the recovered official dm 985×4000 exact front-facing product-only packshot. Open gap: only later image-pipeline finalization remains.

### 162 — ISANA PROFESSIONAL Shampoo Keratin & Repair

- Sources: [Rossmann DE PDP](https://www.rossmann.de/de/de/pflege-und-duft-isana-professional-shampoo-keratin-und-repair/p/4305615830940) (identity, 250 ml, EAN, price, INCI, claims, directions, image); [Rossmann HU PDP](https://shop.rossmann.hu/termek/isana-hair-professional-anti-haarbruch-sampon-250-ml) (EAN/formula corroboration).
- Confidence: **solid / solid / inferred / solid / solid / solid**.
- `TPL-SHAMPOO-STD` with a genuine non-numeric deviation: “Sanft ins feuchte Haar einmassieren, **kurz einwirken lassen** und sorgfältig ausspülen.” Open gap: none material.

### 163 — ISANA PROFESSIONAL Plex Shampoo

- Sources: [Rossmann DE PDP](https://www.rossmann.de/de/pflege-und-duft-isana-professional-plex-shampoo/p/4305615975917) (identity, 250 ml, EAN, displayed price, INCI, claims, directions, image); [Rossmann TR PDP](https://www.rossmann.com.tr/isana-professional-plex-sampuan-250-ml-p-sr23110228) (EAN/claims/directions corroboration).
- Confidence: **solid / solid / inferred / solid / solid / solid**.
- `TPL-SHAMPOO-STD`; repair marketing does not create a treatment protocol. Open gap: the DE shop showed the price but was online unavailable; availability is not treated as an identity or formula gap.

### 164 — ISANA MEN Shampoo Energy Power

- Sources: [Rossmann DE PDP](https://www.rossmann.de/de/pflege-und-duft-isana-men-shampoo-energy-effect/p/4305615633428) (exact EAN, 300 ml, price, INCI, directions, current pack/PDP identity); [Allegro EAN listing](https://allegro.pl/produkt/isana-men-energy-power-szampon-kofeina-keratyna-7bb9abb8-31ff-4fbe-9ceb-700e88588c73?fromInactiveOffer=archived) (Energy Power/EAN/formula/directions corroboration).
- Confidence: **solid / solid / inferred / solid / solid / solid**.
- Name correction: frozen selection text says `Energy Effect`; current exact-EAN pack and PDP say `Energy Power`. The manifest uses **Shampoo Energy Power**; the stale name exists only in rationale/evidence. `TPL-SHAMPOO-STD` carries the genuine non-numeric **„kurz einwirken lassen“** deviation. Open gap: none material.

### 165 — Garnier Wahre Schätze Shampoo Kokosmilch & Macadamia Normales & Trockenes Haar

- Sources: [Rossmann DE PDP](https://www.rossmann.de/de/pflege-und-duft-garnier-wahre-schaetze-shampoo-kokosmilch-und-macadamia-normales-und-trockenes-haar/p/3600542462402) (identity, 250 ml, EAN, EUR price, INCI, directions, image); [Budni PDP](https://www.budni.de/sortiment/produkte/5399571009) (EAN/size/formula corroboration).
- Confidence: **solid / solid / inferred / solid / solid / solid**.
- `TPL-SHAMPOO-STD`; dry-hair marketing is not converted into a scalp route. Open gap: none material.

### 166 — John Frieda Sheer Blonde Refresh & Shine Shampoo

- Sources: [dm DE PDP](https://www.dm.de/p/d/3122567/john-frieda-shampoo-sheer-blonde) (current German identity, 250 ml, GTIN, INCI, directions, recovered exact image); [John Frieda DE-CH manufacturer PDP](https://www.johnfrieda.com/de-ch/produkte/blonde/sheer-blonde/refresh-shine-shampoo/) (current formula/250 ml corroboration); [Rossmann DK PDP](https://www.rossmann.dk/da/pleje-og-duft-john-frieda-sheer-blonde-sheer-blonde-refresh-og-shine-shampoo/p/5037156296105) (same-EAN older alternate formula, recorded rather than merged).
- Confidence: **solid / solid / inferred / solid / solid / guessed-conservative**.
- `TPL-SHAMPOO-STD`; current German dm/manufacturer formula is used, while the older Danish formula remains a version-conflict note. Open gap: current dm price was not captured, so `price_eur` is intentionally absent.

### 167 — AUSSIE Shampoo Bouncy Curls

- Source: [dm DE PDP](https://www.dm.de/p/d/3135993/aussie-shampoo-bouncy-curls) (identity, 300 ml, EAN, EUR price, INCI, directions, recovered exact image).
- Confidence: **guessed-conservative / solid / inferred / solid / solid / solid**.
- `TPL-SHAMPOO-STD`. dm DE's exact 300 ml Bouncy Curls PDP and the official [P&G/for-me record](https://www.for-me-online.de/teilnahmebedingungen-aktion/aussie-shampoo-50prozent) independently corroborate GS1-valid EAN `8006530325530`. The P&G record uses the shorter label "Aussie Shampoo Curls"; the shared GTIN is the identity bridge. No digits are inferred or invented.

## Batch disposition

All eight entries are research-complete manifest candidates, not approved catalog
data. The separate human review/apply gate owns any database action. Protocol deviations are ranks 162 and 164; rank
160 retains the transparent non-DE directions fallback.

## Final wave receipt

- Frozen roster: **53/53 selected candidates accounted for** in four batches
  (15/15/15/8), plus the separate known Glycolic Gloss catalog correction.
- New-product research manifests: **52** product rows. One selected candidate, Gliss
  Scalp Balance Tiefenreinigung (rank 157), resolved to an existing catalog product
  and is therefore an update rather than a new row.
- Existing-product updates: **2** total — the Glycolic Gloss rename and the verified
  Gliss Scalp Balance EAN addition. There are no duplicate EANs across new rows.
- Research EAN coverage: **53/53 selected candidates** have at least one GS1-valid EAN
  in the frozen research envelopes. The four manifests contain 52 new-product EANs:
  **51** have cross-source agreement and **1** remains explicitly excluded from apply
  (Wahre Schätze Honig).
- Recovery disposition: **0 evidence holds** and **0 structural exclusions** remain.
  The approved recovery rules use current exact-GTIN manufacturer formula first,
  otherwise independent current exact-EAN retailer corroboration; generic rinse-out
  shampoos may use `TPL-SHAMPOO-STD` without separate exact-SKU directions when that
  mechanical-use basis is disclosed. Candidate images use the owning runbook's
  roughly 800 px long-side standard. Routed deep-cleansing outcomes: **1** (rank 157,
  already represented by its existing product update rather than counted twice).
- Protocol deviations: **9** total. Each preserves the cited contact-time wording;
  marketing or medically adjacent claims were not converted into medical guidance.
- Automated gates: all four canonical expansion validators **PASS** (15/15 + 1/1
  update, 15/15,
  14/14 + 1/1 update, and 8/8), and exact adapter-to-manifest equality **PASS** for
  all 52 new-product rows. Aggregate checks also pass for source text, cross-source
  URL count, false-agreement exclusion, EAN uniqueness, roster accounting, and
  `git diff --check`. The final adapter/CLI/package/direct-dependency blob audit also
  matches pinned PR #508 merge `da8c9cc33452e7c8ca81f15fcad1d7c525210938`.
- Open evidence work is confined to independent corroboration of the one excluded
  Honig EAN. No additional product-policy decision is required from Nick before
  reviewing these drafts; moving that identifier toward apply later requires new
  qualifying evidence, not a lower confidence threshold.
- Stop state: **research draft only**. No database write, catalog apply, image upload,
  approval, recommendation activation, commit, push, merge, or deployment occurred.
