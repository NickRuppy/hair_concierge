---
category: tools
document_type: product_spec
status: confirmed
spec_version: 2
source_snapshot_at: 2026-08-04
source_sheet: https://docs.google.com/spreadsheets/d/1hcNgMECCvtySin3FQNquMgtiG9PazxkmXA46AQ6vjIY/edit
runtime_authority_after_implementation: product_tool_specs
validator_after_implementation: src/lib/product-specs/tools.ts
---

# Hair Tools canonical product specification

## Purpose and boundary

This document turns the four existing Hair Tools source tabs into one canonical, multi-capability product contract for Personal Plan Stage 3 Produkte. It is subordinate to `decision.md`: the category policy decides what job and capability are needed; this specification decides which verified product facts are sufficient to supply a concrete example.

The source Google Sheet remains research input. It is not runtime authority and must not be imported column-for-column. Exact products enter the catalog only through a researched, human-reviewed internal curation path. Broad product-family/form ownership is collected in onboarding, including the confirmed conditional Heatless drilldown; customer brand/model submission remains out of scope for Tools in V1.

This pass changes no end-user UI. The already reviewed exact-product card—now located in Stage 3—continues to show only product identity, job-relevant capabilities or attachments, and price, plus a safety/protocol fact only when it changes use. Earlier “Stage 1 route / Stage 2 example” wording in this document means “Stage-2 refined route / Stage-3 example” under the implemented five-stage journey.

## Source snapshot

The workbook `Produklisten` currently has four relevant tabs:

| Tab | Rows | Existing strengths | Material gaps |
|---|---:|---|---|
| `Föhne` | 8 | identity, model, wattage, weight, price, mostly exact product URLs | no attachment facts, no images, no normalized capabilities or heat/speed controls |
| `Bürsten` | 8 | identity, broad material/technology, broad target, price | most URLs are brand homepages; no normalized form, use state, geometry, heat safety, or verified job facts |
| `Heat-Tools` | 6 | identity, partial maximum temperature, price | URLs are not exact product pages; no minimum/settings, use state, geometry, or protocol; possible AirStyle duplicate |
| `Frisuren-Tools` | 5 | identity, broad holding/sectioning purpose, price | URLs are generic; no dimensions, material/coating, hold strength, tension/fit, or quantity facts |

The 27 rows are candidates, not 27 approved product identities. `AirStyle Pro` in `Föhne` and `AirStyle` in `Heat-Tools` may describe one physical product and must be resolved before intake.

The current list covers candidates for airflow, heated styling, brushes, and securing/sectioning. It does not yet cover Heatless styling/setting, wash/application, Night Protection, or drying textiles.

## Chosen canonical shape

Use one shared `products` identity and one `product_tool_specs` authority. Do not create independent dryer, heat-tool, brush, and accessory product identities or ranking tables.

Existing shared tables retain:

- canonical brand and product-line identity;
- display name and image;
- price/currency;
- exact purchase destination when the product is used as a shopping example;
- lifecycle and catalog visibility.

Evidence sources are not purchase destinations. They live at fact level in `evidenceByFact`; an exact manufacturer page or manual may prove a fact even when the shopping destination is a different authorized retailer URL.

`product_tool_specs` adds only tool-specific facts:

```ts
type ToolProductSpec = {
  productId: string
  productTypes: ToolProductType[]
  capabilities: ToolCapability[]
  supportedUseStates: Array<"wet" | "damp" | "dry"> | null
  attachments: ToolAttachmentFact[]
  familyFacts: ToolFamilyFacts
  applicationProtocol: ToolApplicationProtocol | null
  evidenceByFact: Record<string, ToolFactEvidence>
  specVersion: number
  verifiedAt: string
}
```

The intended persistence is one `product_tool_specs` row per physical product with typed arrays plus validated JSON fact blocks. A multi-styler can therefore expose several `productTypes`, capabilities, attachments, and family fact blocks without duplicate product rows. TypeScript/Zod validation and database checks must reject unknown vocabulary and malformed blocks before approval.

### Catalog and intake boundary

Add one catalog category key, `tools`, with `is_catalog_supported = true`. Do not create eight product-category keys: the families remain typed product forms and capabilities inside `product_tool_specs`.

Keep `is_intake_supported = false` for the existing customer owned-product intake in V1. The database already separates `is_catalog_supported` from `is_intake_supported`; reuse those flags. Do not add `tools` to the public `SUPPORTED_PRODUCT_CATEGORY_KEYS` contract. Keep `productIntakeCategorySchema`, public product lookup/UI category sets, public intake hooks, and public labels unchanged. Create or extend a separate internal catalog/review-category contract containing `tools`; add `product_tool_specs` to `PRODUCT_INTAKE_REQUIRED_SPEC_TABLES_BY_CATEGORY` and `ProductIntakeTargetSpecTable`. The internal curator path may then require Tool-spec readiness without exposing brand/model/attachment intake to users.

Treat a manufacturer model number as a real identity fact. Extend `product_identifiers` with a `manufacturer_model` type rather than assuming the Sheet's `Modell` value is always a product line.

## Product-type vocabulary

Product types describe recognizable physical forms, not jobs or marketing promises.

| Family | Allowed V1 product types |
|---|---|
| Airflow | `hair_dryer`, `hot_air_brush`, `air_multi_styler` |
| Heated styling | `flat_iron`, `curling_iron`, `curling_wand`, `wave_iron`, `automatic_curler`, `heated_rollers`, `heated_brush`, `heated_multi_styler` |
| Heatless styling | `heatless_curling_band`, `setting_roller`, `foam_roller`, `flexi_rod`, `setting_former` |
| Brushes/combs | `wide_tooth_comb`, `detangling_brush`, `paddle_brush`, `vent_brush`, `round_brush`, `styling_brush`, `hair_pick`, `sectioning_comb` |
| Securing/sectioning | `soft_hair_tie`, `scrunchie`, `claw_clip`, `sectioning_clip`, `root_volume_clip`, `hair_pin`, `headband` |
| Wash/application | `scalp_brush`, `applicator_bottle`, `applicator_comb`, `water_spray_bottle` |
| Night Protection | `pillowcase`, `bonnet`, `length_tip_sleeve`, `soft_night_tie` |
| Drying textiles | `microfiber_towel`, `smooth_cotton_cloth`, `drying_wrap` |

`pineapple` and `loose_tied` are application routes, not product types. A compatible scrunchie or soft tie may support them.

## Capability vocabulary

Capabilities are verified jobs a product can perform. V1 allows:

- airflow: `dry_hair`, `diffuse_airflow`, `concentrate_airflow`, `air_shape`;
- styling: `straighten`, `smooth`, `curl`, `wave`, `create_volume`, `set_style`;
- brush/comb: `detangle`, `distribute_product`, `smooth`, `define_pattern`, `airflow_shape`;
- securing/application: `section_hair`, `hold_hair`, `secure_gently`, `apply_product`, `wash_scalp_assist`;
- protection/textile: `reduce_surface_friction`, `contain_hair`, `preserve_shape`, `absorb_water`, `plop`.

Do not encode `anti_frizz`, `shine`, `repair`, `anti_breakage`, `growth`, `damage_prevention`, `salon`, `travel`, or `for_all_hair` as hard capabilities. Some may be user-facing claims or practical attributes, but none independently proves route eligibility.

## Core eligibility facts

Every approved example requires:

1. resolved physical product identity, brand, and model/variant;
2. exact manufacturer product page, manual, or equally exact evidence source, not a generic brand homepage;
3. image suitable for the product card;
4. current price/currency at approval time;
5. at least one allowed `productType`;
6. at least one verified route-relevant `capability`;
7. every route-critical family fact required below;
8. fact-level provenance and verification date;
9. no hard safety or protocol conflict;
10. active catalog lifecycle.

A catalog row may exist with incomplete facts, but it is `unknown` and cannot be the saved `capability_example` until all facts required for that route are verified. Availability is not a fit gate, but a broken/non-specific purchase URL blocks publication of that source as the active shopping destination.

`supportedUseStates` is required only when hair state can change eligibility or safe use. `null` means the form is not state-sensitive; missing evidence for a state-sensitive form is an eligibility gap and must not be represented as `null`.

## Attachment facts

Attachments require more structure than a string array:

```ts
type ToolAttachmentFact = {
  type:
    | "diffuser"
    | "concentrator"
    | "smoothing_nozzle"
    | "round_brush_head"
    | "paddle_brush_head"
    | "curl_barrel"
    | "other_verified_head"
  provision: "included" | "compatible_sold_separately"
  compatibilityScope: "this_exact_product" | "named_model_family"
  modelFamily?: string
}
```

Do not infer attachment compatibility from brand, connector appearance, product name, or a generic accessories page. A diffuser route qualifies only when the exact product has a verified included or compatible diffuser fact.

## Family-specific fact blocks

Only facts that can change eligibility, safe use, application, or a meaningful choice are canonical.

### Airflow

```ts
type AirflowFacts = {
  heatSettingsCount?: number
  speedSettingsCount?: number
  coolSettingVerified?: boolean
  weightG?: number
  foldable?: boolean
  measuredNoiseDb?: number
}
```

- Heat/speed control and attachments may change the route or practical trade-off.
- Weight, foldability, and measured noise are optional comparison details, not hair-fit gates.
- Wattage is not a V1 ranking or suitability field.
- `ionisch`, `anti-frizz`, `schnell trocknend`, or `Salon` remains a claim unless verified into a narrower allowed fact.

### Heated styling

```ts
type HeatedStylingFacts = {
  contactMode: "continuous_pass" | "stationary_hold" | "set_and_release"
  temperatureControl: "fixed" | "adjustable"
  fixedTemperatureC?: number
  minTemperatureC?: number
  maxTemperatureC?: number
  plateWidthMm?: number
  barrelDiametersMm?: number[]
  autoShutoffMinutes?: number
  wetToDryUseVerified: boolean
}
```

- `maxTemperatureC` alone does not prove adjustability or the lowest setting.
- `contactMode` selects the safe category fallback: continuous-pass tools explicitly keep moving; stationary/set tools require a verified hold/set-and-release protocol. Do not infer it for a broad heterogeneous type such as `heated_brush` or `heated_multi_styler`.
- `fixed` requires a verified `fixedTemperatureC`; `adjustable` requires verified settings or a verified minimum and maximum. Unknown control behavior is ineligible for an exact heated route.
- Plate width and barrel diameter are geometry/trade-off facts; they must not be guessed from names such as `Wide` or `Wand`.
- Default use is dry hair unless exact wet-to-dry use is verified.
- `ceramic`, `ionic`, or `gentle` does not prove damage prevention.

### Heatless styling

```ts
type HeatlessStylingFacts = {
  setGeometry: "band" | "roller" | "rod" | "former"
  sizeOrDiameterMm?: number[]
  material?: string
  fasteningMethod?: string
  tensionAdjustable?: boolean
}
```

The product must support a named curl/wave/volume route. Exact eligibility also requires the shared supported use state, securing/setup and required pieces, applicable sequence or set duration, and result-changing geometry where relevant. `Heatless` never exempts it from comfortable-tension and stop/adjust-on-pain guidance; do not infer overnight use.

### Brushes and combs

```ts
type BrushCombFacts = {
  blowDryUseVerified?: boolean
}
```

The product type already carries the recognizable form; the capability carries its job. The shared top-level `supportedUseStates` field is the only runtime use-state authority. Store `blowDryUseVerified` only when the product participates in a heat-assisted route. Do not add V1 geometry measurements, bristle-length/flexibility, nubs, cushion construction, material taxonomy, row counts, or size variants. A selected form never proves gentle technique.

### Securing and sectioning

V1 has no dedicated `SecuringFacts` block. Shared product identity, one recognized product type, and one supported securing/sectioning capability are sufficient for the single low-salience optional example. Do not store dimensions, hold strength, quantity, coating, seams, contact material, or fit scoring. `Knickfrei`, `anti-pull`, and similar marketing claims remain unsupported; application guidance still says to loosen/reposition/remove when it pulls or hurts.

### Wash and application

V1 has no dedicated `WashApplicationFacts` block. Product type and supported job are enough for the single low-salience optional example. Do not add contact-mode, applicator-mode, material, cleaning, pressure, or convenience schemas. These products remain optional aids; no product type or stored fact may imply growth, anti-shedding, or medical efficacy.

### Night Protection

```ts
type NightProtectionFacts = {
  material: string
  closureOrFit?: string
  adjustableFit?: boolean
  intendedCoverage: "pillow_surface" | "whole_hair" | "lengths_ends" | "loose_securing"
}
```

Material and intended coverage are required. Closure/adjustability is retained only for worn bonnet/sleeve forms. Do not store detailed dimensions, thread count, fabric grading, or personal fit scoring. These facts do not prove repair, breakage prevention, or growth.

### Drying textiles

V1 has no dedicated `DryingTextileFacts` block. Shared product identity/card data, one recognized product type (`microfiber_towel | smooth_cotton_cloth | drying_wrap`), and its supported job are sufficient for an optional exact example. Do not store dimensions, thickness, weight, absorbency, fabric-quality rankings, or closure details for recommendation logic. Gentle pressing/scrunching remains the primary behavior rule regardless of product; verified product directions may still override the generic technique where necessary.

## Application protocol and evidence

`applicationProtocol` stores exact product-specific directions only when they change the safe category fallback:

- verified temperature range/settings;
- attachment or head required for the recommended route;
- product-specific contact-time or sequence only when explicitly supplied;
- for Heatless, product-specific setup/securing, set duration, and day/overnight sequence only when explicitly supplied;
- for heated tools, the hold/set-and-release sequence for stationary-by-design contact modes;
- for air shaping, whether pre-drying uses an external dryer, the same device mode/attachment, or a direct dry-and-shape workflow;
- an explicit Heat-protection direction, distinguishing a recommendation from a true protocol requirement;
- cleaning or replacement direction only when material to safe use.

Do not fabricate temperature, distance, pass count, contact time, set duration, or attachment compatibility.

When manufacturer directions establish wet/damp/dry eligibility, intake projects that result into top-level `supportedUseStates`; `applicationProtocol` may retain the supporting wording or sequence but is not a second use-state authority.

An exact air-shaping example is executable only when its protocol identifies the supported starting state and how the linked pre-dry occurrence is fulfilled. Do not assume a universal dryness percentage or separate conventional dryer. A protocol-marked Heat-protection requirement promotes portfolio coverage; generic manufacturer marketing does not.

Every decision-changing field requires `evidenceByFact[factKey]` with:

```ts
type ToolFactEvidence = {
  sourceUrl: string
  sourceType: "manufacturer" | "authorized_retailer" | "packaging" | "manual"
  verifiedAt: string
  note?: string
}
```

Manufacturer product pages/manuals are preferred. A retailer source may fill a fact only when identity is exact and the manufacturer does not expose it. Marketing prose may be stored as a claim for display review but cannot silently become a capability or fit rule.

## Existing-column migration

| Sheet column | Canonical treatment |
|---|---|
| `Tool-Name` | candidate display identity; reconcile against brand/model before creating one product row |
| `Marke` | canonical `brands` identity |
| `Modell` | candidate model/variant identity; resolve as `manufacturer_model` or a true product line rather than assuming either |
| `Technologie` | never import wholesale; map only to a narrower verified family fact or discard |
| `Leistung / Watt` | omit from V1 canonical ranking/spec; retain only as non-authoritative research note if useful |
| `Temperaturbereich` | map to verified min/max and control type; `bis X` supplies only a maximum |
| `Gewicht` | normalize to `weightG` as an optional practical trade-off |
| `Zielgruppe / Haartyp` | reject raw marketing buckets; translate only into verified geometry/use-state facts if justified |
| `Besondere Features` | map to allowed capability or fact only after verification; otherwise retain as an untrusted source claim or discard |
| `Preis (€)` | `products.price_eur`; required for an approved visible example |
| `Bezugsquelle` | classify as evidence source, purchase destination, or both; generic brand homepages are insufficient for either role |

No row may become eligible merely because `Zielgruppe = Alle` or `Besondere Features = Schonend`.

## Current candidate coverage

| Route | Current candidate status | What is needed before enabling an exact card |
|---|---|---|
| ordinary airflow drying | several dryer candidates | normalize identity/capability, image, controls, exact evidence |
| diffuser airflow | unknown | verify included/compatible diffuser for at least one exact dryer |
| concentrated airflow | not a V1 route/gate | retain verified concentrator inclusion only as an exact card fact |
| heated straightening | candidate products exist; reported-use-only route | exact product URLs, controls/use state/contact mode, geometry where relevant |
| heated curl/wave | candidate products exist | exact URLs, settings/use state, barrel/shape facts |
| heated volume/shape | incomplete | add or verify a heated roller/brush route |
| heatless curl/wave | missing; reported created-style alternative only | add at least one curling-band/set and one roller/rod/former with the route-critical protocol minimum; never trigger from `curl_definition` |
| foundational detangling | candidates exist | verify form and wet/dry use state; add a wide-tooth comb candidate |
| airflow shaping brush | candidate exists | verify round/vent geometry and heat safety |
| holding/sectioning | candidates exist | exact URLs plus size/material/hold facts |
| wash/application | missing | add one gentle scalp/wash aid and one applicator route only if enabled |
| Night Protection | missing | add a verified example for each Night form that should receive an exact card; generic routes may show the catalog-gap state |
| drying textile | missing | add at least one microfiber towel/wrap; cotton T-shirt may remain generic guidance rather than a catalog SKU |

## Addition priorities

Research and intake are route-led, not brand-led.

### Priority A — route blockers

1. Qualify at least one current dryer with a verified diffuser attachment or add one that does.
2. Add one wide-tooth comb.
3. Add a heated volume/shape example if that route remains enabled.
4. Add a heatless curling band/set.
5. Add a heatless roller/rod/former option.
6. Add at least one Night Protection example for each enabled form.
7. Add one microfiber towel or wrap.

### Priority B — optional-family coverage

8. Add one gentle scalp/wash aid.
9. Add one controlled applicator bottle/comb.
10. Verify one soft securing option and one sectioning option from the current list.
11. Verify one airflow-shaping brush from the current list.

Do not add a second similar product until the first valid route example is approved, unless the second represents a genuinely different route or practical trade-off.

## Operator and integration journey

1. A researcher starts with a source-sheet candidate or a route gap.
2. Identity is resolved against existing products, brands, product lines, and identifiers before facts are researched.
3. The candidate receives allowed product types and capabilities; duplicate physical products are merged into one identity.
4. Only route-critical family facts and product-specific protocol are researched from exact sources.
5. The package is validated against the typed Tool spec. Missing route-critical facts keep it `unknown`.
6. Human review approves identity, facts, claims, image, price, fact sources, and any separate purchase destination.
7. Approval writes the shared product identity plus one canonical `product_tool_specs` row.
8. Coverage checks determine which Stage 1 routes have at least one valid Stage 2 example.
9. A route without a valid example may remain visible generically, but exact shopping is disabled and Stage 2 shows the confirmed catalog-gap state rather than an invented match.
10. Later product changes create reviewed replacement facts and the normal proposed-plan update; they do not silently rewrite a confirmed user plan.

## Verification fixtures

1. one dryer with ordinary drying only;
2. one dryer with verified included diffuser;
3. one multi-styler with airflow and heated product types but one identity;
4. generic brand homepage blocks example approval;
5. `bis 200 C` stores maximum only and cannot imply adjustable temperature;
6. marketing `anti-frizz` does not create a capability;
7. two source rows resolve to one physical AirStyle identity;
8. wet detangler qualifies only for its verified use state;
9. wide-tooth comb covers the foundational route without a second brush requirement;
10. Heatless set with painful/non-adjustable tension guidance remains safety-limited;
11. exact diffuser compatibility missing produces `unknown`, not a recommendation;
12. missing image or price blocks approved card-example readiness;
13. one optional tool remains outside shopping until opt-in;
14. no valid route example produces a visible catalog gap;
15. unknown product type, capability, attachment, or fact key fails validation.
16. `tools` is catalog-supported while the public owned-product intake still rejects it;
17. a verified `manufacturer_model` identifier resolves an exact device without forcing it into `product_lines`;
18. a state-sensitive product with missing `supportedUseStates` remains ineligible, while a state-insensitive form may store `null`;
19. fixed heat without `fixedTemperatureC`, or adjustable heat without verified settings/range, fails route readiness;
20. a fact-evidence URL does not silently populate the product's shopping destination.

## Remaining gates

- Final counterpart review was reconciled on 2026-08-05.
- Nick confirmed the property contract and route-gap list on 2026-08-04.
- Route-led product research is authorized. A generic deterministic route does not require an exact product to remain visible, but its Stage-3 card stays disabled until a product qualifies. Keep the source Sheet unchanged and do not create product rows, process final images, or run guarded publish until the exact researched candidates receive separate review and approval.
