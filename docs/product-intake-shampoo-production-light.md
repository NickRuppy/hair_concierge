# Shampoo Production Light v1

Status: implemented local research adapter — not live production logic

Use this workflow when Nick wants to research one or many current German regular
shampoos with the full Shampoo INCI method, but only needs the production
Shampoo database properties as the reviewed output.

“Light” means reduced output, not reduced research. The operator still resolves
the exact product/formula and applies the full Shampoo v1.4 method first. The
adapter then projects that reviewed product truth into the smaller field set
used by the current production catalog.

## When to use it

Use **Shampoo Production Light v1** for:

- a new Shampoo product that should be prepared for Product Intake quickly;
- a frozen batch such as “research these 50 shampoos for the current production
  Shampoo fields”;
- calibration work where the team wants to compare ingredient-derived Shampoo
  fields with current catalog labels.

Do not use it for:

- conditioners, masks, leave-ins, oils or other categories;
- explicit deep-cleansing shampoos, unless the purpose is to route them out of
  regular Shampoo;
- medical treatment claims, diagnosed scalp disease or hair-loss efficacy;
- database import, publication or user-facing activation.

The full Shampoo v1.4 engine remains independent and unchanged. Use
`docs/research/shampoo-inci/v1.4/` for complete eight-property research,
method validation, holdouts and future ingredient-based matching. This adapter
does not replace that engine and does not activate its eight-property model in
production.

## Source-of-truth stack

| Layer | Owning source | What it controls |
| --- | --- | --- |
| Full formula research | `docs/research/shampoo-inci/v1.4/classification-standard.md` and `new-product-research-runbook.md` | Exact identity, canonical INCI, eight direct properties, confidence and evidence. |
| Production projection | `src/lib/shampoo/production-light-adapter.ts` | Deterministic projection from reviewed v1.4 truth into current Shampoo fields. |
| Catalog/product handoff | `docs/product-intake-research-ops.md` | Brand identity, image, price, purchase URL, protocols, approval and guarded apply. |

Fixture and calibration evidence:

- fixture batch manifest:
  `tests/fixtures/shampoo-production-light/batch-manifest.json`;
- ten-product calibration report:
  `data/research/shampoo-production-light-v1/calibration-v1/report.md`.

## Required input

The adapter consumes a complete research envelope. It does not fetch sources,
read Supabase, infer identity from a barcode, or perform new web research by
itself.

Each product envelope must include:

- `version: "shampoo-production-light-v1"`;
- pinned `researchMethod` metadata:
  - `policyId: "shampoo-classification-v1.4"`;
  - `modelVersion: "shampoo-inci-v1.4"`;
  - the adapter's expected v1.4 policy SHA-256;
  - the adapter's expected v1.4 runbook SHA-256;
- exact German product identity and formula provenance;
- normalized complete INCI and formula fingerprint;
- all eight v1.4 direct properties with value, confidence and rationale:
  `cleansingStrength`, `conditioningLevel`, `weightPotential`,
  `focusPrimary`, `focusSecondary`, `usageRole`, `scalpComfortTarget`,
  `dandruffSupport`;
- production projection assessment:
  - `fine`, `normal` and `coarse` thickness judgments as `ideal`,
    `conditional` or `not_suited`;
  - one primary scalp target and, only when independently supported, one
    secondary scalp target;
  - confidence and conclusion-first rationale for each projected production
    field;
- optional legacy/catalog comparison metadata for reviewer visibility.

All final direct properties must be moderate-or-high confidence. A low
confidence direct property means the product goes back to research instead of
producing a partial production payload. Once identity and formula are canonical,
`scalpComfortTarget` and `dandruffSupport` must also resolve to their positive or
negative value; `unknown` returns `needs_research`.

### Research envelope v1 skeleton

This is a compact structurally valid template. Replace example values with the
reviewed product evidence; do not leave placeholder evidence in a real run.

```json
{
  "version": "shampoo-production-light-v1",
  "researchMethod": {
    "policyId": "shampoo-classification-v1.4",
    "modelVersion": "shampoo-inci-v1.4",
    "policySha256": "0f9f6a6d4ae789be0febaf66ed178c4247776553a1ed9839255fcc6971928f24",
    "runbookSha256": "a7d80414831777bc3a0ef5f81686552b3c419fe71550d2eac0d0bbb817016c9d"
  },
  "identity": {
    "productId": "example-shampoo",
    "market": "DE",
    "exactProductName": "Example Shampoo",
    "exactPackSize": "250 ml",
    "gtinAliases": ["4103040051752"],
    "capturedAt": "2026-09-02T10:00:00.000+02:00",
    "confidence": "high",
    "conflictStatus": "none",
    "sources": [
      {
        "url": "https://example.com/example-shampoo",
        "tier": "manufacturer_de",
        "capturedAt": "2026-09-02T10:00:00.000+02:00"
      }
    ]
  },
  "formula": {
    "status": "canonical",
    "canonicalInci": "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Sodium Chloride, Panthenol, Parfum",
    "inciFingerprintSha256": "8ef7cad6b7cfeb4196cdf5fd9071663b480cd964adbc30734ae98d952a7fd6f9",
    "canonicalSource": "manufacturer_de",
    "evidenceRefs": ["source:manufacturer-inci"],
    "sources": [
      {
        "url": "https://example.com/example-shampoo",
        "tier": "manufacturer_de",
        "capturedAt": "2026-09-02T10:00:00.000+02:00"
      }
    ]
  },
  "properties": {
    "cleansingStrength": {
      "value": "moderate",
      "confidence": "high",
      "rationale": "Example rationale from full v1.4 formula analysis.",
      "evidenceRefs": ["formula:surfactant-system"]
    },
    "conditioningLevel": {
      "value": "low",
      "confidence": "moderate",
      "rationale": "Example rationale from full v1.4 formula analysis.",
      "evidenceRefs": ["formula:conditioning-routes"]
    },
    "weightPotential": {
      "value": "low",
      "confidence": "moderate",
      "rationale": "Example rationale from deposition, persistence and reset-capacity assessment.",
      "evidenceRefs": ["formula:weight-v3"]
    },
    "focusPrimary": {
      "value": "general",
      "confidence": "high",
      "rationale": "Example rationale after post-unblind positioning reconciliation.",
      "evidenceRefs": ["claim:positioning"]
    },
    "focusSecondary": {
      "value": [],
      "confidence": "high",
      "rationale": "No distinct secondary focus with independent formula route.",
      "evidenceRefs": ["claim:positioning"]
    },
    "usageRole": {
      "value": "regular",
      "confidence": "high",
      "rationale": "No non-default usage trigger under v1.4.",
      "evidenceRefs": ["claim:usage"]
    },
    "scalpComfortTarget": {
      "value": "targeted",
      "confidence": "high",
      "rationale": "Sensitive-scalp positioning and the whole formula support a scalp-comfort target.",
      "evidenceRefs": ["claim:positioning", "formula:comfort-signals"]
    },
    "dandruffSupport": {
      "value": "not_supported",
      "confidence": "high",
      "rationale": "No Piroctone Olamine or Climbazole in the complete INCI.",
      "evidenceRefs": ["formula:dandruff-active-check"]
    }
  },
  "thicknesses": [
    {
      "thickness": "fine",
      "fit": "ideal",
      "confidence": "moderate",
      "rationale": "Example production-light thickness projection.",
      "evidenceRefs": ["projection:thickness-fine"]
    },
    {
      "thickness": "normal",
      "fit": "ideal",
      "confidence": "high",
      "rationale": "Example production-light thickness projection.",
      "evidenceRefs": ["projection:thickness-normal"]
    },
    {
      "thickness": "coarse",
      "fit": "conditional",
      "confidence": "moderate",
      "rationale": "Example production-light thickness projection.",
      "evidenceRefs": ["projection:thickness-coarse"]
    }
  ],
  "scalpTargets": {
    "primary": {
      "target": "ordinary",
      "confidence": "high",
      "rationale": "General Shampoo positioning and formula support the balanced route.",
      "positioningEvidenceRefs": ["claim:positioning"],
      "formulaEvidenceRefs": ["formula:whole-formula"]
    },
    "secondary": {
      "target": "sensitive",
      "confidence": "moderate",
      "rationale": "Only include secondary when independent positioning and formula evidence support it.",
      "positioningEvidenceRefs": ["claim:sensitive"],
      "formulaEvidenceRefs": ["formula:comfort-signals"],
      "independentlySupported": true
    }
  },
  "positioning": {
    "explicitResetPositioning": false,
    "evidenceRefs": ["claim:positioning"]
  },
  "legacyComparison": {
    "suitableThicknesses": ["fine", "normal"],
    "buckets": ["normal"]
  }
}
```

`scalpTargets.secondary` and `legacyComparison` are optional. Include a secondary
scalp target only when it is truly independently supported.

## Command

The command is available now:

```bash
npm run research:shampoo:production-light -- --input <research-envelope.json> --output <artifact-dir>
```

For a frozen batch:

```bash
npm run research:shampoo:production-light -- --manifest <frozen-batch-manifest.json> --output <artifact-dir>
```

The command is local and filesystem-only. It must not require `.env.local`, a
Supabase connection, product-image credentials or live product identifiers.

Single-product mode prints the source input SHA-256 in stdout. Batch mode writes
one SHA-256 receipt per manifest member in `batch-summary.json`, so a reviewer
can tie every projected artifact back to the exact reviewed input envelope.

### Batch manifest v1 skeleton

Batch mode requires a strict manifest:

```json
{
  "version": "shampoo-production-light-batch-v1",
  "products": [
    {
      "productId": "sebamed-every-day-shampoo",
      "exactProductName": "Sebamed Every-Day Shampoo",
      "gtinAliases": ["4103040051752"],
      "selectionNotes": "Low-cleansing sensitive-scalp calibration case with low conditioning and low weight.",
      "input": "sebamed-every-day-shampoo.json"
    }
  ]
}
```

Each product entry is prevalidated before any batch output is written:

- `productId` must be unique and use only letters, numbers, `.`, `_` or `-`
  after an initial letter/number;
- `exactProductName` must be nonempty and must match
  `identity.exactProductName` in the input envelope;
- `gtinAliases` must contain at least one 8-14 digit GTIN and must match
  `identity.gtinAliases` after canonicalization;
- `selectionNotes` must be nonempty so the frozen batch remains reviewable;
- `input` must be a relative path inside the manifest directory and must match
  an input envelope whose `identity.productId` equals the manifest `productId`.

The fixture manifest at
`tests/fixtures/shampoo-production-light/batch-manifest.json` is the reference
shape.

## Copyable future invocations

Single product:

> Please research this product with **Shampoo Production Light v1**. Resolve the
> exact current German identity and canonical INCI using the Shampoo v1.4
> runbook, complete the full eight-property research envelope, then run the
> production-light adapter. Stop at local artifacts: `production-light.json` and
> `production-light-summary.md`. Do not write to Supabase, Product Intake, the
> catalog or live recommendations.

Batch:

> Please research these 50 shampoos with **Shampoo Production Light v1**. First
> freeze the batch manifest with exact product names, known GTIN aliases and
> selection notes. For each item, apply the full Shampoo v1.4 identity/formula
> and classification process, then run the production-light adapter. The batch
> is complete only when every manifest item is accounted for as
> `property_lane_ready`, `needs_research` or `routed_deep_cleansing`, with
> per-product JSON/Markdown artifacts plus a batch summary. Do not write to
> Supabase, Product Intake, the catalog or live recommendations.

## Output statuses

| Status | Meaning | Next step |
| --- | --- | --- |
| `property_lane_ready` | The ingredient research is complete enough to propose current production Shampoo properties. | Nick can review the property package. Product Intake still owns identity/image/price/protocols/apply. |
| `needs_research` | A required input, property, projection assessment or confidence gate is missing, contradictory or unsupported. | Rework the research envelope, then rerun the adapter. Do not hand-edit the output. |
| `routed_deep_cleansing` | The product is a true reset/deep-cleansing product, not a regular Shampoo item. | Use the existing deep-cleansing category workflow instead. No regular Shampoo payload is emitted. |

`property_lane_ready` is not `catalog_intake_ready` and not
`global_recommendation_ready`. It only says the Shampoo property lane is
reviewable.

## Production fields emitted

For `property_lane_ready`, the JSON contains the exact current production
Shampoo fields:

- `suitable_thicknesses`: only thicknesses judged `ideal`;
- `category_specs.product_shampoo_specs[]`:
  - `thickness`: `fine`, `normal` or `coarse`;
  - `shampoo_bucket`: `normal`, `dehydriert-fettig`, `trocken`,
    `irritationen` or `schuppen`;
  - `scalp_route`: `balanced`, `oily`, `dry`, `irritated` or `dandruff`;
  - `cleansing_intensity`: `gentle`, `regular` or `clarifying`;
- `required_protocol_roles`: derived role keys only:
  - `shampoo_everyday` for non-`schuppen` rows;
  - `shampoo_dandruff` for `schuppen` rows;
- field rationales, field confidence and reviewer-facing warnings.

The adapter does not produce `products` rows, GTIN ownership, image URLs,
affiliate links, prices or exact `product_application_protocols` rows. Product
Intake owns those.

## Projection semantics

### Observed cleansing intensity

`cleansing_intensity` stores the formula-observed intensity:

- `cleansingStrength: low` -> `gentle`;
- `cleansingStrength: moderate` -> `regular`;
- ordinary `cleansingStrength: strong` -> `regular`;
- `strong` with alternating clarifying/reset support -> `clarifying`;
- explicit reset/deep-cleansing positioning with compatible architecture ->
  `routed_deep_cleansing`.

Strong cleansing alone does not make a regular Shampoo a deep-cleansing product.
If a route such as sensitive scalp is otherwise supported but the observed
cleansing intensity is stronger than ideal for that route, the truth stays
visible in the payload and later fit logic may treat it as a trade-off.

### Scalp target

The adapter chooses one primary scalp target by default. A secondary target is
valid only when the exact-product positioning and the formula independently
support a second real use case.

| Research target | Production bucket | Production route |
| --- | --- | --- |
| ordinary/general | `normal` | `balanced` |
| oily or sebum-led | `dehydriert-fettig` | `oily` |
| dry scalp or dry flakes | `trocken` | `dry` |
| sensitive, itchy or uncomfortable scalp | `irritationen` | `irritated` |
| true dandruff | `schuppen` | `dandruff` |

Dry flakes do not create a dandruff row. A dandruff row requires
`dandruffSupport: supported` and exact anti-dandruff positioning. Under v1.4,
`Piroctone Olamine` and `Climbazole` are the recognized cosmetic dandruff
signals. Tea tree, mint, menthol, rosemary, salicylic acid alone or vague
anti-flake wording does not upgrade dandruff support.

### Thickness

The envelope records `ideal`, `conditional` and `not_suited` for fine, normal
and coarse hair. Only `ideal` becomes a production eligibility value. Conditional
fits stay in the rationale so Nick can see the nuance without turning the
binary production field into a maybe-state.

Thickness is a whole-formula call. The researcher must reconcile
`weightPotential`, `conditioningLevel`, surfactant architecture, focus and
positioning. A single polymer, silicone, oil or marketing phrase cannot decide
the result alone.

### Secondary focus and usage role

Secondary focus is optional. Empty is valid and expected for many products.

Usage role defaults to `regular`. Use a non-default role only when v1.4 gives a
product-level trigger. Frequent use requires explicit mild/frequent positioning
and non-strong cleansing. Alternating use requires strong cleansing plus a
clarifying/reset/buildup/oily-root trigger. Treatment use is reserved for a
problem-led recognized active route, especially true anti-dandruff formulas.

## Rework loop

If Nick rejects one field or the adapter returns `needs_research`, do not patch
`production-light.json` directly.

1. Reopen the research envelope.
2. Fix the exact blocked fact, rationale, source conflict or projection
   assessment.
3. Preserve the previous evidence and the reason for the change.
4. Rerun the adapter.
5. Review the regenerated JSON and Markdown together.

This keeps the review artifact reproducible and prevents the production payload
from drifting away from the formula research.

## Batch artifacts

A complete batch output contains:

- one per-product folder for every manifest item;
- `production-light.json` per product;
- `production-light-summary.md` per product;
- `batch-summary.json`;
- `batch-summary.md`.

`batch-summary.json` includes each product's `inputSha256`, relative input path,
artifact directory and final status.

The batch summary must count:

- property-lane ready products;
- products routed to deep cleansing;
- products needing research.

No product may silently disappear from the batch. A duplicate product id, missing
member output, manifest mismatch or malformed input is a hard failure before the
batch output is published. Per-product warnings preserve legacy/catalog
disagreements for review.

## Handoff to Product Intake

After Nick approves a `property_lane_ready` package, Product Intake still must
complete the normal lanes from `docs/product-intake-research-ops.md`:

- canonical brand, product line, clean name and category identity;
- exact identifiers and GTIN aliases;
- source list, purchase URL and price;
- raw image candidate, image processing and final Chaarlie image approval;
- exact role-keyed application protocols;
- dry-run validation, explicit final handoff and guarded Supabase apply.

The property package may be used as the Shampoo property evidence for Product
Intake, but it does not authorize catalog writes, publication, recommendation
promotion or user-facing ingredient claims.

## Final stop boundary

Stop at local artifacts unless Nick separately authorizes the next gate.

This workflow must not:

- write to Supabase;
- mutate Product Intake review state;
- create, update or approve catalog products;
- activate ingredient-based recommendations;
- change Personal Plan behavior;
- publish user-facing claims;
- merge, deploy or clean up the worktree.
