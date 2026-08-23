---
category: tools
document_type: product_category_option_pool
status: confirmed
option_pool_version: 3
source_snapshot_at: 2026-08-04
decision_file: docs/personal-plan/categories/tools/decision.md
evidence_file: docs/personal-plan/categories/tools/evidence.md
product_spec_file: docs/personal-plan/categories/tools/product-spec.md
candidate_file: docs/personal-plan/categories/tools/product-candidates.md
---

# Hair Tools product-category option pool

## Correct hierarchy

The user-facing structure is product-led:

```text
Hair Tools
└── Product category
    └── Recognizable product type
        └── Exact product example
```

Jobs, goals, and problems are mappings on the product type. They explain why a product is relevant; they do not replace the product-category name.

In the implemented five-stage journey, broad product-type ownership is refined in Stage 2 and exact product examples appear in Stage 3. Any older “Stage 2 example” wording below refers to that Stage-3 exact-product surface.

Example:

```text
Bürsten & Kämme
└── Grobzinkiger Kamm
    └── Tangle Teezer Wide Tooth Comb

Best mapped jobs: Entwirren, Produkt verteilen
```

## The eight Hair Tools product categories

The canonical internal product-type values remain in `product-spec.md`. The labels below are the user-facing category and product names.

### 1. Haartrockner & Luftstyler

Primary purpose: Haare mit Luft trocknen.

Products underneath:

- Föhn;
- Warmluftbürste;
- Air Multi-Styler.

Attachments/capabilities on those products:

- Diffusor;
- Präzisions-/Konzentratordüse;
- verifizierte Styling-Aufsätze.

Best mapped jobs:

- Haare trocknen;
- Locken/Wellen beim Trocknen unterstützen;
- Luft gezielt führen;
- bei einer passenden Styling-Route Form oder Volumen erzeugen.

A diffuser or concentrator is not its own subcategory or separate product recommendation. It is a verified property of the dryer or styler.

### 2. Hitzestyling-Tools

Primary purpose: Haare mit direkter Hitze formen oder stylen.

Products underneath:

- Glätteisen;
- Lockenstab;
- Welleneisen;
- automatischer Curler;
- Thermoroller;
- Heizbürste;
- beheizter Multi-Styler.

Best mapped jobs:

- glätten oder formen;
- Locken oder Wellen erzeugen;
- Volumen oder ein Set erzeugen.

The engine may map several products to the same job, but the user should normally see one recommended route rather than a grid of similar heated products.

### 3. Heatless Styling & Setzen

Primary purpose: Haare ohne direkte Hitze formen oder setzen.

Products underneath:

- Heatless Lockenband;
- klassische Set-/Lockenwickler;
- Schaumstoffwickler;
- Flexi-Rods;
- Locken-/Setting-Former.

Best mapped jobs:

- Locken oder Wellen ohne direkte Hitze erzeugen;
- Volumen oder ein Set erzeugen;
- eine Form während einer längeren Set-Zeit halten.

These products are neutral alternatives to heated tools when they can genuinely perform the same job. The user is not expected to own both.

### 4. Bürsten & Kämme

Primary purpose: Haare entwirren und Produkt verteilen.

Products underneath:

- grobzinkiger Kamm;
- Detangling-Bürste;
- Paddle-Bürste;
- Vent-Bürste;
- Rundbürste;
- Styling-/Definitionsbürste;
- Afro-Pick;
- Stiel-/Abteilkamm.

Best mapped jobs:

- entwirren;
- Produkt verteilen;
- glätten;
- beim Föhnen Form erzeugen;
- Struktur definieren oder Ansatzvolumen unterstützen;
- Haare abteilen.

One suitable detangling/distribution product covers the foundation. Additional brush types are included only when they serve another selected job.

### 5. Clips, Haargummis & Fixierhilfen

Primary purpose: Haare halten, fixieren oder abteilen.

Products underneath:

- weiches Haargummi;
- Scrunchie;
- Claw Clip;
- Abteilclips;
- Ansatzvolumen-Clips;
- Haarnadeln;
- Haarband.

Best mapped jobs:

- Haare zusammenhalten;
- Haare abteilen;
- ein Styling- oder Set-Ergebnis fixieren;
- eine Wasch-, Auftrags- oder Nachtschutz-Routine unterstützen.

These are optional supporting products, not a mandatory basis category by themselves.

### 6. Wasch- & Auftragshilfen

Primary purpose: Produkte beim Waschen oder Auftragen kontrolliert platzieren und verteilen.

Products underneath:

- Kopfhaut-/Shampoo-Bürste;
- Dusch-Detangler;
- Applikatorflasche;
- Applikatorkamm.

Best mapped jobs:

- Shampoo oder ein Kopfhautprodukt gezielt verteilen;
- Produkt kontrolliert an Ansatz, Kopfhaut oder Längen auftragen;
- Haare während einer passenden Wasch-/Auftragsroutine entwirren.

These remain optional and appear only when another selected plan step creates a real application job.

### 7. Nachtschutz

Primary purpose: Haare über Nacht reibungsärmer halten, abdecken oder eine Form bewahren.

Products underneath:

- glatter Kissenbezug;
- Bonnet;
- Längen-/Spitzenschutz;
- weiches Nacht-Haargummi/Scrunchie.

Best mapped jobs:

- Oberflächenreibung reduzieren;
- Haare locker zusammenhalten;
- eine Frisur oder Definition über Nacht besser erhalten;
- Längen oder Spitzen abdecken.

The user normally receives one suitable optional form, not a bundle containing all Night Protection products.

### 8. Handtücher & Trocknungsmaterialien

Primary purpose: Wasser aufnehmen und sanftes Trocknen unterstützen.

Products underneath:

- normales Handtuch als bereits vorhandener Kontext;
- Mikrofaser-Handtuch;
- Mikrofaser-Haarturban/-Wrap;
- glattes Baumwolltuch/T-Shirt.

Best mapped jobs:

- Wasser aufnehmen;
- nasses Haar halten oder einwickeln;
- sanftes Drücken/Scrunchen erleichtern.

Technique remains more important than the material: gently press, blot, or scrunch instead of rubbing. A user who reports `no_towel` receives no towel product recommendation and no invented rubbing behavior.

## How purposes are used

The purpose mapping answers only three questions behind the scenes:

1. Which product types can perform a job the user actually has?
2. Which reported product type should be prioritized first?
3. Which one exact example can cover a missing product route?

The category labels and product names remain stable regardless of the user's goal. A `Grobzinkiger Kamm` is always listed under `Bürsten & Kämme`; `Entwirren` and `Produkt verteilen` merely explain why it was selected.

Each product category has one broad primary purpose for orientation. Within it, the recommended product type may show the narrower primary purpose for which it was selected in this plan; additional verified jobs remain secondary capabilities. For example, `Haartrockner & Luftstyler` primarily dries hair, while `Föhn mit Diffusor` may be selected primarily to support curls or waves during drying. Neither purpose is a new user input or an independent recommendation trigger.

No purpose may be invented from catalog availability. A flat iron in the pool does not mean the user wants straighter hair. A bonnet in the pool does not mean the user has an overnight problem. Application guidance is provided after a relevant product route is reported or acquired, without assuming the user's existing technique.

## Visible card hierarchy

The standard recommendation card uses this order:

1. product category: `Bürsten & Kämme`;
2. recommended product type: `Grobzinkiger Kamm`;
3. mapped reason: `Zum sanften Entwirren und Verteilen von Produkt`;
4. exact example when useful: `Tangle Teezer Wide Tooth Comb`.

The card must not use `Sanft entwirren` as the subcategory name.

When heated and heatless products are compared for the same outcome, the shared explanation may introduce the choice, but both options retain their own product identity:

- `Hitzestyling-Tools` -> `Lockenstab`;
- `Heatless Styling & Setzen` -> `Heatless Lockenband`.

The user compares products and methods that can serve the purpose; the purpose does not become a replacement product category.

## What one user sees

The full option pool is an internal catalog/recommendation structure. A user sees:

- all product categories that produce a real `basis` result for them;
- the recognizable product type recommended within each category;
- one exact product example when helpful;
- one alternative only when it is a meaningfully different route, such as heated versus heatless;
- all subordinate products inside one collapsed `Optional für dich` section.

Example:

```text
Bürsten & Kämme

Ein grobzinkiger Kamm
Zum sanften Entwirren und Verteilen von Produkt.

Beispiel: Tangle Teezer Wide Tooth Comb
Alternative: Detangling-Bürste, wenn diese Form besser zur Route passt
```

## Complete catalog coverage

There is no fixed product-count target. The exact pool is coherent when:

- every enabled exact-product card has one verified example; a valid generic route may instead show the confirmed Stage 2 catalog-gap state;
- one additional product is present only for a genuinely different form or trade-off;
- one multi-capability product is stored and shown once;
- variants, colours, and similar brands do not create artificial choice;
- gaps remain visible instead of being filled with weak products.

Immediate product work remains:

1. qualify the strongest existing Sheet product in each already covered product category;
2. add one well-evidenced heatless roller/rod/former for the volume/set route;
3. qualify one applicator bottle or comb only if that optional route is enabled;
4. research a length/tip Night Protection product as optional coverage;
5. avoid adding further dryers, straighteners, curling irons, ordinary brushes, or clips until existing candidates are resolved and deduplicated.

Exact product identities, prices, and sources remain in `product-candidates.md`; the canonical product-type enum remains in `product-spec.md`.

## Review question for this step

Is this the intended structure: eight product-named subcategories, recognizable product types underneath, and purposes used only to map those products to the right user?
