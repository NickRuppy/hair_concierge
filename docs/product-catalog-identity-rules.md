# Product Catalog Identity Rules

Last updated: 2026-06-28

This is the first document to consult before adding partner products, importing
vendor spreadsheets, or cleaning existing catalog identity data.

Use this doc to decide how to split:

- `products.brand`
- `products.name`
- `products.product_line_id` / `product_lines.canonical_name`
- `products.category`

Temporary audit files in `ops/` are evidence and review artifacts. This doc is
the durable operator-facing source of truth.

## Display Contract

Product cards in chat render identity in this order:

1. Small top line: `Brand · Line`
2. Main line: product-specific `products.name`
3. Category chip, for example `Shampoo`, `Conditioner`, `Leave-in`, `Maske`
4. Optional compact facts, currently limited for leave-ins to keep one chip row

The practical implication is:

- `brand` should be the parent consumer brand.
- `product_line` should carry stable family/collection identity.
- `name` should be the product-specific part users need to recognize.
- `name` should not repeat `brand` or `product_line`, unless that word is truly
  product-specific and not represented elsewhere.

Example target display:

| Card top line | Card main line | Category chip |
| --- | --- | --- |
| `Garnier · Fructis` | `Hair Food Aloe Vera` | `Leave-in` |
| `Jean&Len · Colorglow` | `Granatapfel Rose Conditioner` | `Conditioner` |
| `Syoss · Intense Volume` | `Shampoo` | `Shampoo` |
| `NEQI · Moisture Mystery` | `Conditioner` | `Conditioner` |

Generic names like `Shampoo` or `Conditioner` are acceptable when `brand`,
`line`, and the category chip make the card clear.

## Decision Order

When adding or correcting a product, follow this order.

1. Check the canonical registry in this doc.
2. Check the live DB for the current brand/line/name split of similar products.
3. Check official brand pages for the product and related products.
4. Check retailer pages when official pages are incomplete, region-specific, or
   unclear.
5. Treat vendor spreadsheets as input data, not final identity truth.
6. Preview the resulting card before any production DB write.

If a new product line is not in this doc, add a proposed registry row first and
mark it `needs-review` until it has enough evidence.

## What Counts As A Product Line

A product line is a stable consumer-facing family, sub-brand, collection, or
range that helps users distinguish products.

Prefer treating something as a line when:

- the brand or retailer shows several products in the same family;
- it appears consistently across product pages, packaging, or category pages;
- it is useful in the chat card as identity, not merely a keyword;
- multiple product types can share it, for example shampoo plus conditioner.

Prefer keeping the wording in `products.name` when:

- it appears on only one product;
- it is an ingredient, scent, format, benefit, or variant;
- moving it to `product_line` would make the product name too generic or less
  recognizable;
- the line already exists under another stable family.

Examples:

- `Jean&Len · Colorglow` is a line because official Jean&Len pages show a
  conditioner, matching shampoo, and set under that family.
- `Garnier · Fructis` is the line; `Hair Food Aloe Vera` stays in the product
  name.
- `OGX · Argan Oil of Morocco` is the line; `Renewing Conditioner` stays in the
  product name.
- `Balea · Professional` is accepted as a flat product line in this catalog
  model, even though it behaves like a sub-brand in retail naming.

## Brand Rules

- Use the parent consumer brand in `products.brand`.
- Do not store line text in `products.brand`.
- Preserve official typography when it is meaningful and established.
- Normalize retailer-expanded brand values back to the parent brand when the
  identity table supports it.

Examples:

| Current or incoming value | Target brand | Target line |
| --- | --- | --- |
| `Balea Aqua` | `Balea` | `Aqua` |
| `Balea Med` | `Balea` | `Med` |
| `Garnier Fructis` | `Garnier` | `Fructis` |
| `Garnier Wahre Schätze` | `Garnier` | `Wahre Schätze` |
| `Elvital` | `L'Oréal Paris` | `Elvital` |
| `L'Oréal Paris Elvital` | `L'Oréal Paris` | `Elvital` |

## Name Rules

`products.name` should be the product-specific display name after brand and line
have been removed.

Keep in `name`:

- variant: `Aloe Vera`, `Granatapfel Rose`, `Volumen Pur`;
- format/type wording when it is part of the recognizable product name:
  `Reparatur Spülung`, `Renewing Conditioner`;
- sub-range words that are not the canonical line: `Hair Food Aloe Vera`,
  `Öl Magique Midnight Serum`, `Fiber Booster Conditioner`;
- product numbers or model-like markers: `No.0`, `No.3`, `7in1`.

Remove from `name`:

- duplicated brand prefix;
- duplicated line prefix;
- combined brand+line prefix already represented by the card top line.

Examples:

| Incoming/current name | Target brand · line | Target name |
| --- | --- | --- |
| `Balea Med Anti Schuppen` | `Balea · Med` | `Anti Schuppen` |
| `Garnier Hair Food Aloe Vera` | `Garnier · Fructis` | `Hair Food Aloe Vera` |
| `Gliss Kur Aqua Revive Conditioner` | `Gliss · Aqua Revive` | `Aqua Revive Conditioner` |
| `Guhl Bond+ Reparatur Spülung` | `Guhl · Bond+ Reparatur` | `Reparatur Spülung` |
| `OGX Renewing Argan Oil of Morocco Conditioner` | `OGX · Argan Oil of Morocco` | `Renewing Conditioner` |
| `Pantene Pro-V Miracles 7in1 Haaröl Spray` | `Pantene · Pro-V Miracles` | `7in1 Haaröl Spray` |
| `Syoss Intense Volume Shampoo` | `Syoss · Intense Volume` | `Shampoo` |

## Category Rules

Category is not a substitute for identity. It is shown as a compact chip on the
card and should help make generic names understandable.

Use existing user-facing category labels where possible:

- `Shampoo`
- `Conditioner`
- `Leave-in`
- `Maske`
- `Öl`
- `Bondbuilder`
- `Tiefenreinigung`
- `Trockenshampoo`
- `Peeling`

Do not leak internal category strings into UI. If a category cannot be mapped to
a public label, fix the category mapping before relying on the chip.

## Canonical Registry

Status values:

- `approved`: safe to use for new products and cleanup drafts.
- `approved-with-caveat`: safe, but follow the naming rule closely.
- `needs-review`: do not write to production until reviewed.
- `deprecated`: do not use for new products; map existing rows away from it.

| Brand | Canonical line | Status | Accepted aliases/current DB values | Naming rule | Evidence |
| --- | --- | --- | --- | --- | --- |
| Balea | Aqua | approved-with-caveat | `Balea · Aqua`, `Balea Aqua · Aqua` | Use for non-Professional Aqua Hyaluron products. Keep `Hyaluron...` in product name. | dm Balea Aqua Hyaluron product evidence; current DB review |
| Balea | Med | approved | `Balea · Med`, `Balea Med · Med` | Normalize brand to `Balea`; keep `Med` as line. | dm `Balea med` product pages |
| Balea | Natural Beauty | approved | `Balea · Natural Beauty` | Remove duplicated `Balea Natural Beauty` prefix from names. | dm `Balea Natural Beauty` series pages |
| Balea | Professional | approved-with-caveat | `Balea · Professional` | Use for products visibly named `Balea PROFESSIONAL`; keep sub-range words like `Aqua Hyaluron`, `Oil Repair`, `Plex Care`, `Ultimate Volume` in name. | dm `Balea PROFESSIONAL` product pages |
| Garnier | Fructis | approved | `Garnier · Fructis`, `Garnier · Hair Food`, `Garnier Fructis · Fructis Hair Food`, older `Fructis` rows | Use `Fructis` as line. Keep `Hair Food Aloe Vera/Macadamia/Papaya`, `Wunderöl`, etc. in name. | Garnier/Retailer `Fructis ... Hair Food` pages |
| Garnier | Wahre Schätze | approved | `Garnier · Wahre Schätze`, `Garnier Wahre Schätze · Wahre Schätze` | Normalize brand to `Garnier`; remove duplicated line prefix from names. | Garnier Germany `Wahre Schätze` pages |
| Gliss | Aqua Revive | approved | `Gliss · Kur` for Aqua Revive row | Replace `Kur` with `Aqua Revive`; keep product-specific category wording in name. | Schwarzkopf/Gliss Aqua Revive page |
| Guhl | Bond+ Reparatur | approved | `Guhl · Bond+` | Replace line `Bond+` with `Bond+ Reparatur`. | Guhl `Bond+ Reparatur` product family |
| Jean&Len | Colorglow | approved | `Jean&Len · Colorglow` | Keep `Colorglow` as line; use product variant/type in name. | Official conditioner, shampoo, and set pages |
| L'Oréal Paris | Elvital | approved | `Elvital · Elvital`, `L'Oréal Paris Elvital · Elvital` | Normalize brand to `L'Oréal Paris`; keep sub-ranges like `Öl Magique` or `Fiber Booster` in name. | L'Oréal Paris Germany Elvital pages |
| Maria Nila | Coils & Curls | approved | `Maria Nila · Coils & Curls` | Remove duplicated line prefix from name. | Maria Nila collections |
| Maria Nila | Structure Repair | approved | `Maria Nila · Structure Repair` | Keep product type if needed, e.g. `Leave-In`. | Maria Nila collections |
| Maria Nila | True Soft | approved | `Maria Nila · True Soft` | Keep product-specific part, e.g. `Argan Oil`. | Maria Nila collections |
| NEQI | Build Boost | approved | `Neqi · Build Boost` | Normalize brand display if needed; remove duplicated line prefix from name. | NEQI collection/product pages |
| NEQI | Moisture Mystery | approved | `Neqi · Moisture Mystery` | Generic product names are acceptable because the card category chip carries product type. | NEQI collection/product pages |
| NEQI | Repair Reveal | approved | `Neqi · Repair Reveal` | Generic product names are acceptable because the card category chip carries product type. | NEQI collection/product pages |
| NEQI | Volume Victory | approved | `Neqi · Volume Victory` | Generic product names are acceptable because the card category chip carries product type. | NEQI collection/product pages |
| OGX | Biotin & Collagen | approved | `OGX · Biotin & Collagen` | Remove duplicated line prefix from name. | OGX product/collection pages |
| OGX | Bond Protein Repair | approved | `OGX · Bond Protein Repair` | Remove duplicated line prefix from name. | OGX collection pages |
| OGX | Argan Oil of Morocco | approved | `OGX · Renewing Argan Oil of Morocco`, loose `OGX Renewing` row | Use `Argan Oil of Morocco` as line; keep `Renewing` in name when needed for label fidelity. | OGX `Argan Oil of Morocco` collection |
| Pantene | Pro-V | approved | `Pantene · Pro-V` | Keep `Pro-V` as line; remove duplicated `Pantene Pro-V` prefix from names. | Retailer/brand naming consistency |
| Pantene | Pro-V Miracles | approved | `Pantene · Pro-V Miracles` | Keep `Pro-V Miracles` as line; product name should be the specific variant. | Retailer/brand naming consistency |
| Syoss | Intense Volume | approved | `Syoss · Intense Volume` | Name can be `Shampoo`; the card category chip carries product type. | Syoss Intense Volume page |

## Partner Product Intake Checklist

Before inserting partner products:

1. Collect each product's proposed brand, possible line, product-specific name,
   category, image, purchase link, price, and source URL.
2. Check this registry for the brand and line.
3. If the line exists, use the canonical spelling and naming rule.
4. If the line is new, verify whether it has multiple products or clear
   collection evidence.
5. Add the new line to this doc with status `needs-review` or `approved`.
6. Compare against live DB products for the same brand before preparing writes.
7. Build a dry-run preview showing card top line, product name, image, price,
   category chip, and source link.
8. Get human approval before production DB writes.

## New Line Review Template

Use this template when a product line is not yet in the registry.

```md
### Brand · Proposed Line

- Status: needs-review
- Proposed canonical brand:
- Proposed canonical line:
- Products observed in the family:
- Source URLs:
- Current/incoming spreadsheet names:
- Recommended product name split:
- Open questions:
```

Approval criteria:

- At least two products in the family, or strong official collection evidence.
- Clear user-facing value on the card.
- No better existing canonical line in this doc.
- Product names remain recognizable after brand/line removal.

## Production Write Guardrail

Do not directly update production product identity from a spreadsheet.

Every DB update should have:

- a reviewed dry-run list;
- canonical brand/line/name target values;
- image and purchase-link checks when adding products;
- preview of the resulting product cards;
- explicit human approval.

If a future agent is unsure, it should stop at a review artifact and ask for
approval rather than guessing.
