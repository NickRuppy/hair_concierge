# Protocol Content Templates — Scan DB Expansion (T3)

> **DRAFT — NOT VERIFIED. Requires Nick's per-template verification before T4/T5 use.**
> Produced 2026-09-02 by grounding every field in the 220 live
> `product_application_protocols` rows for the big five categories
> (project `pqdkhefxsxkyeqelqegq`). Nothing here has been reviewed by a human yet.
> Open decisions are collected in §6 — several of them change template values.

Task: T3 of `plans/2026-09-01-scan-db-expansion-pilot.md`. Fulfils R4/F-06.

---

## 1. What a template is (and is not)

A template is the **canonical content shape** for one
`(category, role, application_family)` combination. The research engine stamps it
per product and then **must** overwrite the product-specific slots and attach
product-specific evidence.

**Templates are research accelerators, not evidence substitutes (F-06).** Every
stamped row still requires:

- `source_label` / `source_url` / `source_text` on the row — the product's own
  packaging text or manufacturer/retailer page confirming this protocol applies.
- `guidance_payload.evidence[]` — at least one `{sourceUrl, sourceType, checkedAt}`
  for that product.
- An explicit `deviation` verdict from the engine: `null` or
  `{reason, packaging_text}`. Anything the source states that contradicts a
  template constant below is a deviation and goes to Nick, not into a silent stamp.

A template is **never** evidence that a product _has_ this role. Role
applicability is derived from the reviewed category facts
(`deriveShampooProtocolRoles`, `product_oil_specs.role_support`,
`product_leave_in_specs.provides_heat_protection`, …), never from this document.

---

## 2. Contract invariants (verified against code + live data)

### 2.1 What makes a row `verified_complete`

`product_application_protocols` has **no `status` column**. `catalog-facts.ts:716-729`
derives `verified_complete` at read time from exactly this:

```
applicationGuidanceProtocolSchema.safeParse(row.guidance_payload).success
  && payload.scope.kind === "product"
  && payload.scope.productId === <this product's id>
  && payload.scope.category === <this category>
```

So a row is complete iff its V1 payload parses **and** is scoped to that exact
product and category. A payload copied from another product silently degrades to
`verified_incomplete`.

### 2.2 Generated columns — never write these

`application_family` and `category_key` are `GENERATED ALWAYS`. The family comes from

```sql
COALESCE(guidance_payload_v2->>'applicationFamily', <V1 family, with role-based fallback>)
```

so **the V2 pointer's family wins**. When both are written they must agree, or the
generated column will not match the V1 template you verified. The V1 fallback also
silently rewrites out-of-set families: `post_wash_leave_in` → `post_wash_damp_conditioning`,
`pre_heat_protection` → `pre_heat_damp`.

### 2.3 Constants shared by all 15 templates

| Field                                   | Value                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                         | `1`                                                                                                                                                                        |
| `protocolVersion`                       | `1`                                                                                                                                                                        |
| `locale`                                | `"de"`                                                                                                                                                                     |
| `exactGuidanceRequired`                 | `true` (220/220 live rows)                                                                                                                                                 |
| `scope`                                 | `{ "kind": "product", "category": <category>, "productId": <this product's uuid> }`                                                                                        |
| `protocolFacts.cautions`                | `[]` (V1 folds safety copy into the step copy; the schema hard-caps this at length 0)                                                                                      |
| `protocolFacts.conditionerRelationship` | `"not_applicable"` for every template except Mask                                                                                                                          |
| `evidence`                              | ≥1 `{sourceUrl, sourceType, checkedAt}`; `sourceType` `"retailer"` for dm/Rossmann pages, `"manufacturer"` for brand pages; `checkedAt` = `YYYY-MM-DD` of the research run |
| `requirements`                          | `{ "requiredCatalogFacts": [], "requiredProfileFacts": [], "requiredProtocolFacts": [] }` — see §6 D-1                                                                     |
| `protocolFacts.workflowId`              | omit (only for the 4 hard-coded exact workflows)                                                                                                                           |
| `protocolFacts.cautionCodes`            | omit unless the source carries a real caution                                                                                                                              |

### 2.4 Column ↔ payload invariants

Live data holds these with **zero exceptions across all 220 rows**, so the pipeline
should assert them:

- `contact_time_seconds` (column) `===` `guidance_payload.protocolFacts.contactTimeSeconds`.
- `placement` (column) `===` `protocolFacts.applicationArea` (same vocabulary:
  `scalp_roots` | `all_hair` | `lengths_ends` | `ends`).
- `rinse_action` (column) is a _superset_ vocabulary of `protocolFacts.rinse`
  (`rinse_out` | `leave_in`): the column additionally uses `shampoo_out` and
  `do_not_rinse`. Per-template canonical column values are given below.

### 2.5 Contact time is not free text — the V2 builder parses the German copy

`stage5-v2-builder.ts:197-236` derives the V2 contact time from
`contactTimeSeconds` first, and when that is `null` it **regex-parses the German
`wait` step copy**. Rules the templates must respect:

- Source states **one exact time** → set `contactTimeSeconds` (and the column), and
  write the matching digit form: `"3 Minuten einwirken lassen."`
- Source states a **range** → leave `contactTimeSeconds` `null` and write the range
  with an en dash and digits: `"2–3 Minuten einwirken lassen."` → parsed as
  `range_seconds`.
- Source states a **maximum** → `"Bis zu 10 Minuten einwirken lassen."` → `maximum_seconds`.
- Source states **no time** → `"Kurz einwirken lassen."`, `contactTimeSeconds: null`.
  For `targeted_treatment_shampoo` this falls through to `label_directed`, which is
  intended. For other families it yields `null`.
- Never spell numbers out when `contactTimeSeconds` is `null` — `"Zehn Minuten"`
  does not parse. (Spelled-out forms are only safe when the integer is also set.)

This rule matches the live data exactly: every row with a stated range or a vague
wait has `contactTimeSeconds: null`; every row with an exact stated time has the
integer set.

---

## 3. The 15 templates

Notation: `⟨…⟩` marks a **product-specific slot** the research engine must fill from
that product's own source. Everything else is the template constant.

---

### TPL-SHAMPOO-EVERYDAY-STD

**Key:** `shampoo` × `shampoo_everyday` × `standard_rinse_out_cleanse` (35 live rows)
**Applies when:** the reviewed shampoo buckets contain at least one non-`schuppen`
bucket and the product is an ordinary cleansing shampoo with no timed treatment step.

| Column                 | Value         |
| ---------------------- | ------------- |
| `application_stage`    | `wet_cleanse` |
| `application_state`    | `null`        |
| `placement`            | `all_hair`    |
| `contact_time_seconds` | `null`        |
| `rinse_action`         | `rinse_out`   |
| `reapplication`        | `not_stated`  |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-shampoo-everyday-⟨productId⟩",
  "scope": { "kind": "product", "category": "shampoo", "productId": "⟨productId⟩" },
  "role": "cleanse",
  "applicationFamily": "standard_rinse_out_cleanse",
  "compatibleDayTypes": ["wash_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "wet_cleanse",
    "before": ["post_cleanse_rinse_off"],
    "after": [],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "all_hair",
    "rinse": "rinse_out",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-shampoo",
      "action": "apply_product",
      "copyTemplateDe": "In das nasse Haar einmassieren und aufschäumen."
    },
    { "stepKey": "rinse-shampoo", "action": "rinse", "copyTemplateDe": "Gründlich ausspülen." }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Schema constraint:** this family allows **exactly one** `apply_product` step. A
"bei Bedarf wiederholen" second pass is not expressible here — treat it as a deviation.

**Typical deviations to watch for**

- Scalp-only instruction ("nur in die Kopfhaut") → `placement`/`applicationArea` `scalp_roots` (5 live rows do this).
- A stated wait time → add a `wait` step; this is unusual for a standard cleanse.
- "2× waschen" / repeat pass → cannot be modelled here; flag for Nick.
- Tiefenreinigung/Anti-Schuppen claims → wrong template (see the two below).

---

### TPL-SHAMPOO-EVERYDAY-TARGETED

**Key:** `shampoo` × `shampoo_everyday` × `targeted_treatment_shampoo` (8 live rows)
**Applies when:** a non-`schuppen` bucket applies **and** the source prescribes a
scalp-targeted or timed treatment step (e.g. Kopfhaut-Kur, Tiefenreinigung, Tonic-Shampoo).

| Column                 | Value                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `application_stage`    | `wet_cleanse`                                                                                                                                |
| `application_state`    | `null`                                                                                                                                       |
| `placement`            | **variance — 4× `scalp_roots` / 4× `all_hair`.** Template default `scalp_roots`; the V2 builder forces `scalp_roots` for shampoo regardless. |
| `contact_time_seconds` | `null` unless an exact time is stated                                                                                                        |
| `rinse_action`         | `rinse_out`                                                                                                                                  |
| `reapplication`        | `not_stated`                                                                                                                                 |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-shampoo-everyday-⟨productId⟩",
  "scope": { "kind": "product", "category": "shampoo", "productId": "⟨productId⟩" },
  "role": "cleanse",
  "applicationFamily": "targeted_treatment_shampoo",
  "compatibleDayTypes": ["wash_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "wet_cleanse",
    "before": ["post_cleanse_rinse_off"],
    "after": [],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "scalp_roots",
    "rinse": "rinse_out",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-shampoo",
      "action": "apply_product",
      "copyTemplateDe": "In die Kopfhaut einmassieren und aufschäumen."
    },
    { "stepKey": "wait-shampoo", "action": "wait", "copyTemplateDe": "Kurz einwirken lassen." },
    { "stepKey": "rinse-shampoo", "action": "rinse", "copyTemplateDe": "Gründlich ausspülen." }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- Exact stated time (2 live rows: 120 s, 180 s) → set both column and payload, use the digit copy.
- Instruction covering the whole hair, not just scalp → `all_hair` (half the live rows).
- Two-pass rituals → these become `workflowId` products; out of scope for a drugstore pilot stamp.

---

### TPL-SHAMPOO-DANDRUFF

**Key:** `shampoo` × `shampoo_dandruff` × `targeted_treatment_shampoo` (8 live rows, fully homogeneous)
**Applies when:** a reviewed `schuppen` bucket exists. A treatment-only dandruff
shampoo is complete **without** `shampoo_everyday` — do not add the everyday row to
"complete the payload" (`docs/product-intake-research-ops.md`, Shampoo rule).

| Column                 | Value         |
| ---------------------- | ------------- |
| `application_stage`    | `wet_cleanse` |
| `application_state`    | `null`        |
| `placement`            | `scalp_roots` |
| `contact_time_seconds` | `null`        |
| `rinse_action`         | `rinse_out`   |
| `reapplication`        | `not_stated`  |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-shampoo-dandruff-⟨productId⟩",
  "scope": { "kind": "product", "category": "shampoo", "productId": "⟨productId⟩" },
  "role": "cleanse",
  "applicationFamily": "targeted_treatment_shampoo",
  "compatibleDayTypes": ["wash_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "wet_cleanse",
    "before": ["post_cleanse_rinse_off"],
    "after": [],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "scalp_roots",
    "rinse": "rinse_out",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-dandruff-shampoo",
      "action": "apply_product",
      "copyTemplateDe": "In die nasse Kopfhaut einmassieren und aufschäumen."
    },
    {
      "stepKey": "wait-dandruff-shampoo",
      "action": "wait",
      "copyTemplateDe": "Kurz einwirken lassen."
    },
    {
      "stepKey": "rinse-dandruff-shampoo",
      "action": "rinse",
      "copyTemplateDe": "Gründlich ausspülen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- An exact stated contact time (common on Ketoconazol/Selendisulfid products) → set it.
- A stated **frequency limit** ("2× wöchentlich, max. 4 Wochen"). V1 has no cadence
  slot in the payload; the `cadence` column exists but 0/8 live rows use it. Flag rather than drop.
- Anything that reads as medical (Pilzinfektion, ärztlicher Rat) → do not paraphrase into
  cosmetic copy; flag for Nick (repo rule: scalp/medical guidance stays separated).
- 2 applications ("zweimal shampoonieren") → deviation.

---

### TPL-CONDITIONER-RINSEOUT

**Key:** `conditioner` × `conditioner_rinse_out` × `standard_rinse_out_conditioning` (43 live rows)
**Applies when:** any rinse-out conditioner/spülung.

| Column                 | Value                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `application_stage`    | `post_cleanse_rinse_off`                                                                                                         |
| `application_state`    | `null`                                                                                                                           |
| `placement`            | **variance — 22× `lengths_ends` / 19× `all_hair`.** Template default `lengths_ends`; decide per product from the source wording. |
| `contact_time_seconds` | `null` unless an exact time is stated (39/43 are `null`)                                                                         |
| `rinse_action`         | `rinse_out`                                                                                                                      |
| `reapplication`        | `not_stated`                                                                                                                     |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-conditioner-⟨productId⟩",
  "scope": { "kind": "product", "category": "conditioner", "productId": "⟨productId⟩" },
  "role": "condition",
  "applicationFamily": "standard_rinse_out_conditioning",
  "compatibleDayTypes": ["wash_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "post_cleanse_rinse_off",
    "before": [],
    "after": ["wet_cleanse"],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "rinse_out",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-conditioner",
      "action": "apply_product",
      "copyTemplateDe": "Nach der Haarwäsche in die Haarlängen einmassieren."
    },
    { "stepKey": "wait-conditioner", "action": "wait", "copyTemplateDe": "Kurz einwirken lassen." },
    { "stepKey": "rinse-conditioner", "action": "rinse", "copyTemplateDe": "Gründlich ausspülen." }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Note on `sharedTemplateContactTime`.** The V2 builder suppresses conditioner contact
time entirely unless `protocolFacts.sharedTemplateContactTime === "include"`
(`stage5-v2-builder.ts:204-209`). Only 3/43 live rows set it. **Template omits it** —
i.e. imported conditioners will show no contact time in the V2 Anwendung view even
when the wait copy names one. See §6 D-2.

**Typical deviations to watch for**

- Stated range ("2–3 Minuten", 6 live rows) → keep `contactTimeSeconds: null`, write the range copy.
- Explicit "auch auf die Kopfhaut" or "im ganzen Haar" → `all_hair`.
- Leave-in-capable products ("kann auch im Haar bleiben") → this is a **leave_in** product,
  not a conditioner deviation. Flag for re-categorisation.
- Colour-refreshing conditioners with a timing/gloves warning → flag.

---

### TPL-MASK-INTENSIVE

**Key:** `mask` × `intensive_conditioning_mask` × `post_shampoo_rinse_out_mask` (35 live rows)
**Applies when:** any rinse-out Haarkur/Maske.

| Column                 | Value                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `application_stage`    | `post_cleanse_rinse_off`                                                                              |
| `application_state`    | `null`                                                                                                |
| `placement`            | **variance — 18× `lengths_ends` / 14× `all_hair`.** Template default `lengths_ends`.                  |
| `contact_time_seconds` | **product-specific and required whenever the source states one exact time** (live: 30/60/120/180/300) |
| `rinse_action`         | `rinse_out`                                                                                           |
| `reapplication`        | `not_stated`                                                                                          |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-mask-⟨productId⟩",
  "scope": { "kind": "product", "category": "mask", "productId": "⟨productId⟩" },
  "role": "intensive_care",
  "applicationFamily": "post_shampoo_rinse_out_mask",
  "compatibleDayTypes": ["intensive_care_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "post_cleanse_rinse_off",
    "before": [],
    "after": ["wet_cleanse"],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "rinse_out",
    "contactTimeSeconds": "⟨seconds | null⟩",
    "conditionerRelationship": "replaces_conditioner",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-mask",
      "action": "apply_product",
      "copyTemplateDe": "Nach der Haarwäsche ins nasse Haar geben und in Längen und Spitzen verteilen."
    },
    {
      "stepKey": "wait-mask",
      "action": "wait",
      "copyTemplateDe": "⟨3 Minuten | 2–3 Minuten | …⟩ einwirken lassen."
    },
    { "stepKey": "rinse-mask", "action": "rinse", "copyTemplateDe": "Gründlich ausspülen." }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

`conditionerRelationship` is the one field where Mask differs from every other
template: 29/35 live rows use `replaces_conditioner`, 3 use `conditioner_after`,
and 1 uses `no_conditioner`. Template default `replaces_conditioner`; switch to
`conditioner_after` only when the source explicitly sequences a conditioner after the mask.

**Typical deviations to watch for**

- **Long contact times (>5 min)** — 10–20 min and "bis zu 10 Minuten" both exist live.
  Use the range/maximum copy forms so the V2 parser picks them up.
- **Heat activation** ("unter der Haube", "mit Handtuch warm einwickeln") — not
  representable in this template; deviation.
- **Overnight masks** — wrong family entirely; flag as out of scope for the pilot.
- "Nicht auf die Kopfhaut" → keep `lengths_ends` and say so in the apply copy.
- 1-minute express masks → normal, just set 60 s.

---

### TPL-LEAVEIN-POSTWASH-DAMP

**Key:** `leave_in` × `post_wash_leave_in` × `post_wash_damp_conditioning` (42 live rows)
**Applies when:** the leave-in is applied to towel-dried/damp hair after washing —
the default leave-in shape.

| Column                 | Value                                      |
| ---------------------- | ------------------------------------------ |
| `application_stage`    | `damp_leave_on` (36/42; 5 use `towel_dry`) |
| `application_state`    | `null` (34/42)                             |
| `placement`            | `lengths_ends` (34/42)                     |
| `contact_time_seconds` | `null`                                     |
| `rinse_action`         | `leave_in`                                 |
| `reapplication`        | `not_stated`                               |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-leave-in-⟨productId⟩-post-wash",
  "scope": { "kind": "product", "category": "leave_in", "productId": "⟨productId⟩" },
  "role": "leave_in",
  "applicationFamily": "post_wash_damp_conditioning",
  "compatibleDayTypes": ["wash_day", "intensive_care_day", "styling_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "damp_leave_on",
    "before": [],
    "after": ["post_rinse_towel_dry"],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "leave_in",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "towel-dry",
      "action": "section",
      "copyTemplateDe": "Das Haar nach dem Waschen sanft handtuchtrocknen."
    },
    {
      "stepKey": "apply",
      "action": "apply_product",
      "copyTemplateDe": "Eine kleine Menge in Längen und Spitzen verteilen. Nicht ausspülen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- Spray formats → apply copy becomes "…gleichmäßig aufsprühen"; add
  `amount: {"kind":"qualitative","copyDe":"Gleichmäßig sprühen."}` (7 live rows do).
- "Durchkämmen" as an explicit step → add a `section` step; common and harmless.
- A stated leave-on time (1 live row: 240 s) → deviation, set the integer.
- Products claiming heat protection → they additionally need a
  `pre_heat_protection` row (TPL-LEAVEIN-PREHEAT-\*), which is a **separate** protocol row.

---

### TPL-LEAVEIN-DRYCARE

**Key:** `leave_in` × `post_wash_leave_in` × `between_wash_dry_care` (12 live rows)
**Applies when:** the source positions the product for dry hair between washes
(Auffrischen, Spitzenpflege, tägliche Pflege im trockenen Haar).

| Column                 | Value                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application_stage`    | `dry_hair` (8/12)                                                                                                                                   |
| `application_state`    | `dry` (8/12)                                                                                                                                        |
| `placement`            | `lengths_ends` (11/12)                                                                                                                              |
| `contact_time_seconds` | `null`                                                                                                                                              |
| `rinse_action`         | **variance — 8× `do_not_rinse` / 4× `leave_in`.** Template default `do_not_rinse` (it pairs with `application_state: dry` in the majority cluster). |
| `reapplication`        | `not_stated`                                                                                                                                        |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-leave-in-⟨productId⟩-dry-care",
  "scope": { "kind": "product", "category": "leave_in", "productId": "⟨productId⟩" },
  "role": "leave_in",
  "applicationFamily": "between_wash_dry_care",
  "compatibleDayTypes": ["refresh_day", "between_wash_care_day"],
  "exactGuidanceRequired": true,
  "sequence": { "anchor": "dry_finish", "before": [], "after": [], "conflictsWith": [] },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "leave_in",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "dry-care",
      "action": "apply_product",
      "copyTemplateDe": "Mit einer sehr kleinen Menge in trockenen Längen und Spitzen beginnen und nur bei Bedarf ergänzen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

Note the column/payload asymmetry: the column vocabulary uses `do_not_rinse` while
the payload enum only offers `leave_in`. Both are correct; they are different vocabularies (§2.4).

**Typical deviations to watch for**

- Products that are _also_ the post-wash leave-in → they get **both** this and
  TPL-LEAVEIN-POSTWASH-DAMP, as separate rows (uniqueness is per family).
- "Täglich anwendbar" → fine, no field changes; do not invent a cadence.
- Root-avoidance instructions → keep `lengths_ends` or drop to `ends`.

---

### TPL-LEAVEIN-POSTSTYLE

**Key:** `leave_in` × `post_wash_leave_in` × `post_style_finish` (3 live rows, fully homogeneous)
**Applies when:** the source positions the product **after** styling as a finishing step.

| Column                 | Value          |
| ---------------------- | -------------- |
| `application_stage`    | `post_style`   |
| `application_state`    | `dry`          |
| `placement`            | `lengths_ends` |
| `contact_time_seconds` | `null`         |
| `rinse_action`         | `do_not_rinse` |
| `reapplication`        | `not_stated`   |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-leave-in-⟨productId⟩-post-style",
  "scope": { "kind": "product", "category": "leave_in", "productId": "⟨productId⟩" },
  "role": "leave_in",
  "applicationFamily": "post_style_finish",
  "compatibleDayTypes": ["styling_day"],
  "exactGuidanceRequired": true,
  "sequence": { "anchor": "dry_finish", "before": [], "after": [], "conflictsWith": [] },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "leave_in",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "post-style-finish",
      "action": "apply_product",
      "copyTemplateDe": "Mit einer sehr kleinen Menge beginnen und nach dem Styling sparsam über Längen und Spitzen geben."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Confidence: low — only 3 live rows.** All three came from one enrichment batch, so
this is one author's convention rather than an established consensus. Nick should
look at this one closely.

**Typical deviations to watch for**

- Products that are really styling products (Wachs, Creme, Gel) → wrong category.
- Anything that also claims heat protection → needs a separate pre-heat row.

---

### TPL-LEAVEIN-PREHEAT-DAMP

**Key:** `leave_in` × `pre_heat_protection` × `pre_heat_damp` (16 live rows)
**Applies when:** `product_leave_in_specs.provides_heat_protection = true` and the
source specifies **damp/towel-dried hair** for the heat-protection application.

| Column                 | Value                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `application_stage`    | **variance — 10× `damp_leave_on` / 5× `dry_pre_heat` / 1× `pre_heat`.** Template default `damp_leave_on`. |
| `application_state`    | `damp` (16/16)                                                                                            |
| `placement`            | `lengths_ends` (10/16; 5× `all_hair`)                                                                     |
| `contact_time_seconds` | `null`                                                                                                    |
| `rinse_action`         | `leave_in`                                                                                                |
| `reapplication`        | `not_stated` (15/16) — **see §6 D-3, this disagrees with the oil pre-heat templates**                     |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-leave-in-⟨productId⟩-pre-heat",
  "scope": { "kind": "product", "category": "leave_in", "productId": "⟨productId⟩" },
  "role": "heat_protection",
  "applicationFamily": "pre_heat_damp",
  "compatibleDayTypes": ["styling_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "damp_leave_on",
    "before": ["heat_tool"],
    "after": [],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "leave_in",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-pre-heat",
      "action": "apply_product",
      "copyTemplateDe": "Vor dem Hitzestyling gleichmäßig ins handtuchtrockene Haar geben und in Längen und Spitzen verteilen."
    },
    {
      "stepKey": "tool-pre-heat",
      "action": "tool",
      "copyTemplateDe": "Danach wie geplant mit Wärme stylen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- **A stated max temperature** ("Schutz bis 230 °C"). Live rows append it to the
  `tool` step copy ("…; Quelle nennt Schutz bis 230 °C") — the numeric value belongs in
  `product_leave_in_specs.heat_protection_max_c`, and only the sourced sentence goes in the copy.
- **Heat activation required** (`heat_activation_required = true`) → the copy must not
  imply the product works without heat; flag.
- "Vor dem Glätteisen antrocknen lassen" → add a `wait` step (1 live row does).
- Spray formats → add `amount: {"kind":"qualitative","copyDe":"Gleichmäßig sprühen."}`.

---

### TPL-LEAVEIN-PREHEAT-EITHER

**Key:** `leave_in` × `pre_heat_protection` × `either_state_protection` (6 live rows)
**Applies when:** heat protection is claimed and the source explicitly permits **damp
or dry** hair ("auf nasses oder trockenes Haar").

| Column                 | Value                         |
| ---------------------- | ----------------------------- |
| `application_stage`    | `dry_pre_heat` (5/6)          |
| `application_state`    | `either` (6/6)                |
| `placement`            | `lengths_ends` (4/6)          |
| `contact_time_seconds` | `null`                        |
| `rinse_action`         | `leave_in` (5/6)              |
| `reapplication`        | `not_stated` — **see §6 D-3** |

Payload is identical to TPL-LEAVEIN-PREHEAT-DAMP except:

```json
{
  "guidanceKey": "product-leave-in-⟨productId⟩-pre-heat",
  "applicationFamily": "either_state_protection",
  "sequence": {
    "anchor": "dry_pre_heat",
    "before": ["heat_tool"],
    "after": [],
    "conflictsWith": []
  },
  "steps": [
    {
      "stepKey": "apply-pre-heat",
      "action": "apply_product",
      "copyTemplateDe": "Vor dem Hitzestyling gleichmäßig ins feuchte oder trockene Haar geben und in Längen und Spitzen verteilen."
    },
    {
      "stepKey": "tool-pre-heat",
      "action": "tool",
      "copyTemplateDe": "Danach wie geplant mit Wärme stylen."
    }
  ]
}
```

**Choose this family only on an explicit "nass oder trocken" source statement.** If
the source names one state, use TPL-LEAVEIN-PREHEAT-DAMP (or flag a `pre_heat_dry`
need — no live leave-in row uses `pre_heat_dry`, so it is not templated here).

**Typical deviations to watch for**

- Same as the damp variant, plus: sources that say "am besten auf handtuchtrockenem Haar"
  are **not** either-state — that is a preference, use the damp family.

---

### TPL-OIL-DRYFINISH

**Key:** `oil` × `dry_finish` × `dry_finish` (24 live rows)
**Applies when:** `product_oil_specs.role_support` contains `dry_finish`.

| Column                 | Value                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `application_stage`    | `dry_finish` (22/24)                                                                                          |
| `application_state`    | `null` (22/24)                                                                                                |
| `placement`            | `lengths_ends` (15/24; 7× `ends`, 2× `all_hair`) — **product-dependent: rich oils on fine hair go to `ends`** |
| `contact_time_seconds` | `null`                                                                                                        |
| `rinse_action`         | `leave_in`                                                                                                    |
| `reapplication`        | `not_stated` (22/24)                                                                                          |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-oil-⟨productId⟩-dry",
  "scope": { "kind": "product", "category": "oil", "productId": "⟨productId⟩" },
  "role": "finish",
  "applicationFamily": "dry_finish",
  "compatibleDayTypes": ["wash_day", "intensive_care_day", "styling_day", "between_wash_care_day"],
  "exactGuidanceRequired": true,
  "sequence": { "anchor": "dry_finish", "before": [], "after": [], "conflictsWith": [] },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "leave_in",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": { "kind": "qualitative", "copyDe": "Wenige Tropfen verwenden." },
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "dose-dry-finish",
      "action": "apply_product",
      "copyTemplateDe": "Wenige Tropfen zwischen den Handflächen verteilen."
    },
    {
      "stepKey": "apply-dry-finish",
      "action": "apply_product",
      "copyTemplateDe": "Sparsam in die trockenen Längen und Spitzen geben; den Ansatz aussparen und nicht ausspülen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Amount matters for V2.** `stage5-v2-builder.ts:245-250` maps oil `amount.copyDe` to a
V2 enum by regex: `"1 Tropfen"` → `one_drop`, `"wenige"`/`"ein paar Tropfen"` →
`few_drops`. Keep the template phrase or a listed synonym; free-form dosing copy
silently yields no V2 amount.

**Typical deviations to watch for**

- Spray oils ("Trocken-Öl-Spray") → apply copy becomes "aufsprühen"; `amount` copy should
  say "Sparsam aufsprühen." (yields no V2 drop count — acceptable).
- Rich/heavy oils → drop `placement`/`applicationArea` to `ends`.
- "Auch ins feuchte Haar" → the product also needs TPL-OIL-LEAVEON-DAMP, if
  `role_support` declares `leave_on_fibre_conditioning`.

---

### TPL-OIL-LEAVEON-DAMP

**Key:** `oil` × `leave_on_fibre_conditioning` × `post_wash_damp_conditioning` (22 live rows)
**Applies when:** `role_support` contains `leave_on_fibre_conditioning`.

| Column                 | Value                             |
| ---------------------- | --------------------------------- |
| `application_stage`    | `damp_leave_on` (21/22)           |
| `application_state`    | `null` (21/22)                    |
| `placement`            | `lengths_ends` (17/22; 4× `ends`) |
| `contact_time_seconds` | `null`                            |
| `rinse_action`         | `leave_in`                        |
| `reapplication`        | `not_stated`                      |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-oil-⟨productId⟩-leave-on",
  "scope": { "kind": "product", "category": "oil", "productId": "⟨productId⟩" },
  "role": "leave_in",
  "applicationFamily": "post_wash_damp_conditioning",
  "compatibleDayTypes": ["wash_day", "intensive_care_day", "styling_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "damp_leave_on",
    "before": [],
    "after": ["post_rinse_towel_dry"],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "leave_in",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": { "kind": "qualitative", "copyDe": "Wenige Tropfen verwenden." },
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "dose-damp",
      "action": "apply_product",
      "copyTemplateDe": "Wenige Tropfen zwischen den Handflächen verteilen."
    },
    {
      "stepKey": "apply-damp",
      "action": "apply_product",
      "copyTemplateDe": "In die handtuchtrockenen Längen und Spitzen geben; nicht ausspülen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- Sources that only ever say "ins trockene Haar" → the product does not have this role;
  the fact, not the protocol, is wrong. Send back to fact research.
- Curly-hair "einkneten" wording → fine, adjust the apply copy.
- Rich oils → `ends`.

---

### TPL-OIL-PREHEAT-DAMP

**Key:** `oil` × `pre_heat_protection` × `pre_heat_damp` (**only 2 live rows**)
**Applies when:** `role_support` contains `pre_heat_protection` and the source names damp hair.

| Column                 | Value                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `application_stage`    | `pre_heat` (2/2) — note this differs from the leave-in damp template's `damp_leave_on`; see §6 D-4 |
| `application_state`    | `damp`                                                                                             |
| `placement`            | `lengths_ends`                                                                                     |
| `contact_time_seconds` | `null`                                                                                             |
| `rinse_action`         | `leave_in`                                                                                         |
| `reapplication`        | `required`                                                                                         |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-oil-⟨productId⟩-heat",
  "scope": { "kind": "product", "category": "oil", "productId": "⟨productId⟩" },
  "role": "heat_protection",
  "applicationFamily": "pre_heat_damp",
  "compatibleDayTypes": ["styling_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "damp_leave_on",
    "before": ["heat_tool"],
    "after": ["post_rinse_towel_dry"],
    "conflictsWith": []
  },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "leave_in",
    "contactTimeSeconds": null,
    "conditionerRelationship": "not_applicable",
    "reapplication": "each_separate_heat_event",
    "amount": { "kind": "qualitative", "copyDe": "Wenige Tropfen verwenden." },
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "dose-heat",
      "action": "apply_product",
      "copyTemplateDe": "Vor dem Hitzestyling wenige Tropfen zwischen den Handflächen verteilen."
    },
    {
      "stepKey": "apply-heat",
      "action": "apply_product",
      "copyTemplateDe": "In die handtuchtrockenen Längen und Spitzen einarbeiten; bei feinem Haar nur die Spitzen und nie den Ansatz."
    },
    {
      "stepKey": "tool-heat",
      "action": "tool",
      "copyTemplateDe": "Danach mit Wärme stylen; vor jedem weiteren separaten Hitzevorgang erneut anwenden."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Confidence: low — 2 live rows.** Both are internally consistent and consistent with
the either-state oil template, so the shape is probably right, but the sample is thin.

**Typical deviations to watch for**

- Oils claiming heat protection **without** a stated temperature — keep the copy free of
  any implied °C limit.
- Fine-hair root-avoidance is already in the template copy; keep it.

---

### TPL-OIL-PREHEAT-EITHER

**Key:** `oil` × `pre_heat_protection` × `either_state_protection` (6 live rows)
**Applies when:** heat-protection role support and the source permits damp **or** dry hair.

| Column                 | Value                |
| ---------------------- | -------------------- |
| `application_stage`    | `dry_pre_heat` (6/6) |
| `application_state`    | `either` (6/6)       |
| `placement`            | `lengths_ends` (5/6) |
| `contact_time_seconds` | `null`               |
| `rinse_action`         | `leave_in`           |
| `reapplication`        | `required` (6/6)     |

Payload identical to TPL-OIL-PREHEAT-DAMP except:

```json
{
  "applicationFamily": "either_state_protection",
  "sequence": {
    "anchor": "dry_pre_heat",
    "before": ["heat_tool"],
    "after": [],
    "conflictsWith": []
  },
  "steps": [
    {
      "stepKey": "dose-heat",
      "action": "apply_product",
      "copyTemplateDe": "Vor dem Hitzestyling wenige Tropfen zwischen den Handflächen verteilen."
    },
    {
      "stepKey": "apply-heat",
      "action": "apply_product",
      "copyTemplateDe": "In handtuchtrockene oder trockene Längen und Spitzen einarbeiten; bei feinem Haar nur die Spitzen und nie den Ansatz."
    },
    {
      "stepKey": "tool-heat",
      "action": "tool",
      "copyTemplateDe": "Danach mit Wärme stylen; vor jedem weiteren separaten Hitzevorgang erneut anwenden."
    }
  ]
}
```

**Typical deviations to watch for**

- Same as the damp variant. Note the V2 builder maps `applicationArea: "all_hair"` +
  `role: "heat_protection"` to `root_to_tip_hair`, which is rarely what an oil source means —
  prefer `lengths_ends`.

---

### TPL-OIL-PREWASH

**Key:** `oil` × `pre_wash_fibre_treatment` × `pre_wash_lengths_treatment` (17 live rows)
**Applies when:** `role_support` contains `pre_wash_fibre_treatment`.

| Column                 | Value                                 |
| ---------------------- | ------------------------------------- |
| `application_stage`    | `pre_wash` (17/17)                    |
| `application_state`    | `dry` (13/17; 4× `null`)              |
| `placement`            | `lengths_ends` (14/17)                |
| `contact_time_seconds` | `600` (13/17; also 900 and 3600 live) |
| `rinse_action`         | `shampoo_out` (13/17; 4× `rinse_out`) |
| `reapplication`        | `not_stated`                          |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-oil-⟨productId⟩-pre-wash",
  "scope": { "kind": "product", "category": "oil", "productId": "⟨productId⟩" },
  "role": "intensive_care",
  "applicationFamily": "pre_wash_lengths_treatment",
  "compatibleDayTypes": ["intensive_care_day"],
  "exactGuidanceRequired": true,
  "sequence": { "anchor": "pre_wash", "before": ["wet_cleanse"], "after": [], "conflictsWith": [] },
  "requirements": {
    "requiredCatalogFacts": [],
    "requiredProtocolFacts": [],
    "requiredProfileFacts": []
  },
  "protocolFacts": {
    "applicationArea": "lengths_ends",
    "rinse": "rinse_out",
    "contactTimeSeconds": 600,
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": {
      "kind": "qualitative",
      "copyDe": "Fein: mit 1 Tropfen starten; normal: 2 Tropfen; kräftig: 3 Tropfen. Nur so viel ergänzen, dass ein sehr dünner Film entsteht."
    },
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "dose-pre-wash",
      "action": "apply_product",
      "copyTemplateDe": "Fein: mit 1 Tropfen starten; normal: 2 Tropfen; kräftig: 3 Tropfen. Nur so viel ergänzen, dass ein sehr dünner Film entsteht."
    },
    {
      "stepKey": "apply-pre-wash",
      "action": "apply_product",
      "copyTemplateDe": "Das Öl sehr dünn ausschließlich in trockenen Längen und Spitzen verteilen; Kopfhaut und Ansatz aussparen."
    },
    {
      "stepKey": "wait-pre-wash",
      "action": "wait",
      "copyTemplateDe": "Zehn Minuten einwirken lassen."
    },
    {
      "stepKey": "rinse-pre-wash",
      "action": "rinse",
      "copyTemplateDe": "Anschließend mit Shampoo auswaschen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

The 600 s default is Chaarlie's own conservative pre-wash convention, not a
manufacturer claim — 13/17 live rows use it regardless of brand. The spelled-out
"Zehn Minuten" is safe **only because** `contactTimeSeconds: 600` is set (§2.5).
For rich oils the live rows swap the dosing line to
`"Fein: mit 1 Tropfen starten; normal: 1 Tropfen; kräftig: 2 Tropfen. Vollständig zwischen den Handflächen anwärmen und sehr dünn verteilen."`

**Typical deviations to watch for**

- **Overnight oiling** ("über Nacht einwirken") — 1 live row uses 3600 s. Anything
  beyond ~1 h is a deviation; do not stamp a longer time without Nick's sign-off.
- Sources that say "auch auf die Kopfhaut" → this crosses into scalp guidance; flag
  rather than paraphrase (repo rule: scalp guidance stays separated).
- Coconut-oil-type products with protein-sensitivity caveats → flag for the domain reviewer.

---

## 4. Combination coverage check

Live data contains **exactly these 15** `(category, role, application_family)`
combinations for the big five, and every template above maps 1:1 to one of them.
No live combination is left untemplated, and no template invents a combination
that does not exist in production.

| #   | Template ID                   | Category    | Role                        | Family                          | Live rows |
| --- | ----------------------------- | ----------- | --------------------------- | ------------------------------- | --------- |
| 1   | TPL-SHAMPOO-EVERYDAY-STD      | shampoo     | shampoo_everyday            | standard_rinse_out_cleanse      | 35        |
| 2   | TPL-SHAMPOO-EVERYDAY-TARGETED | shampoo     | shampoo_everyday            | targeted_treatment_shampoo      | 8         |
| 3   | TPL-SHAMPOO-DANDRUFF          | shampoo     | shampoo_dandruff            | targeted_treatment_shampoo      | 8         |
| 4   | TPL-CONDITIONER-RINSEOUT      | conditioner | conditioner_rinse_out       | standard_rinse_out_conditioning | 43        |
| 5   | TPL-MASK-INTENSIVE            | mask        | intensive_conditioning_mask | post_shampoo_rinse_out_mask     | 35        |
| 6   | TPL-LEAVEIN-POSTWASH-DAMP     | leave_in    | post_wash_leave_in          | post_wash_damp_conditioning     | 42        |
| 7   | TPL-LEAVEIN-DRYCARE           | leave_in    | post_wash_leave_in          | between_wash_dry_care           | 12        |
| 8   | TPL-LEAVEIN-POSTSTYLE         | leave_in    | post_wash_leave_in          | post_style_finish               | 3         |
| 9   | TPL-LEAVEIN-PREHEAT-DAMP      | leave_in    | pre_heat_protection         | pre_heat_damp                   | 16        |
| 10  | TPL-LEAVEIN-PREHEAT-EITHER    | leave_in    | pre_heat_protection         | either_state_protection         | 6         |
| 11  | TPL-OIL-DRYFINISH             | oil         | dry_finish                  | dry_finish                      | 24        |
| 12  | TPL-OIL-LEAVEON-DAMP          | oil         | leave_on_fibre_conditioning | post_wash_damp_conditioning     | 22        |
| 13  | TPL-OIL-PREHEAT-DAMP          | oil         | pre_heat_protection         | pre_heat_damp                   | 2         |
| 14  | TPL-OIL-PREHEAT-EITHER        | oil         | pre_heat_protection         | either_state_protection         | 6         |
| 15  | TPL-OIL-PREWASH               | oil         | pre_wash_fibre_treatment    | pre_wash_lengths_treatment      | 17        |

Deliberately **not** templated: `pre_heat_dry` (no live big-five row uses it) and
every family belonging to the other five categories (`dry_shampoo`,
`deep_cleansing_shampoo`, `bondbuilder`, `heat_protectant`, `scalp_care`) — out of
scope for the pilot.

---

## 5. Where the live data genuinely disagrees

Ranked by how much a wrong choice would hurt. Nick should look hardest at the top three.

| Rank | Combination                 | Disagreement                                                                                                                                                                               | Template choice                                                                       |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1    | Mask                        | `placement` 18 `lengths_ends` / 14 `all_hair` (near-tie); `conditionerRelationship` 29 `replaces_conditioner` / 3 `conditioner_after` / 1 `no_conditioner`; contact time spans 30 s–20 min | `lengths_ends` + `replaces_conditioner`; both overridden per product                  |
| 2    | Conditioner                 | `placement` 22 `lengths_ends` / 19 `all_hair` (near-tie)                                                                                                                                   | `lengths_ends`                                                                        |
| 3    | Shampoo everyday × targeted | `placement` **4/4 tie** between `scalp_roots` and `all_hair`                                                                                                                               | `scalp_roots` (V2 forces it anyway)                                                   |
| 4    | Leave-in pre-heat damp      | `application_stage` 10 `damp_leave_on` / 5 `dry_pre_heat` / 1 `pre_heat`; sequence anchor splits the same way                                                                              | `damp_leave_on`                                                                       |
| 5    | Leave-in dry care           | `rinse_action` 8 `do_not_rinse` / 4 `leave_in`; `application_stage` 8 `dry_hair` / 3 `dry_finish` / 1 `damp_leave_on`                                                                      | `do_not_rinse` + `dry_hair`                                                           |
| 6    | Leave-in post-wash damp     | `compatibleDayTypes` 32/42 on one value but 5 distinct sets exist; `sequence.after` splits `post_rinse_towel_dry` (20) vs `post_cleanse_rinse_off` (17) vs `[]` (5)                        | `["wash_day","intensive_care_day","styling_day"]` + `after: ["post_rinse_towel_dry"]` |
| 7    | Oil dry finish / leave-on   | `placement` `lengths_ends` vs `ends` tracks oil weight, not author preference                                                                                                              | `lengths_ends`, override to `ends` for rich oils                                      |
| 8    | Oil pre-wash                | `rinse_action` 13 `shampoo_out` / 4 `rinse_out`; contact time 600/900/3600                                                                                                                 | `shampoo_out` + 600 s                                                                 |

**One data defect found while sampling, unrelated to templates:** one
`shampoo_everyday` × `standard_rinse_out_cleanse` row carries German prose in the
enum columns — `application_stage: "Haarwäsche"`, `placement: "Haar"`,
`rinse_action: "Ausspülen"`. Worth a cleanup ticket; it is not a template question.

---

## 6. Open decisions for Nick (these change template values)

**D-1 — `requiredCatalogFacts`: template uses `[]`. Confirm.**
Live rows are split: shampoo/conditioner/mask always `[]`; leave-in uses
`["leave_in.plan_roles"]` (32) or `["leave_in.v3.plan_roles"]` (29); oil uses
`["oil.v2.weight","oil.v2.role_support"]` (33) or `["oil.v2.role_support"]` (19).
`guidance-resolver.ts:105-108` looks each entry up as a **flat key** in
`item.catalogFacts`, which `application-adapter.ts:83-131` populates from the raw
spec row (`weight`, `role_support`, `roles`, …). Dotted keys therefore cannot
resolve and would return `missing_catalog_fact:<key>` — they appear inert today only
because the V1 resolver is bypassed under the V2 contract. `[]` is the shape that
cannot fail under either contract, so the templates use it. If you want the
requirement expressed, the correct keys are the undotted spec column names.

**D-2 — Conditioner contact time will not surface in V2. Confirm.**
`sharedTemplateContactTime` is omitted by the template (matching 40/43 live rows), so
the V2 builder returns `null` contact time for every imported conditioner even when the
wait copy names a range. Set it to `"include"` in the template if imported
conditioners should show a time.

**D-3 — Pre-heat `reapplication` is inconsistent across categories.**
All 8 oil pre-heat rows use column `required` / payload `each_separate_heat_event`;
15/16 leave-in pre-heat rows use `not_stated` / `none`. The templates preserve the
existing split rather than harmonising it. If reapplying before each separate heat
event is the product rule, the leave-in templates should change too — that is a
product decision, not a data one.

**D-4 — Oil pre-heat damp uses `application_stage: "pre_heat"`, leave-in pre-heat damp
uses `"damp_leave_on"`,** for the same role and family. Two rows on one side, ten on the
other; both templates follow their own category's majority. Worth one ruling.

**D-5 — TPL-LEAVEIN-POSTSTYLE rests on 3 rows and TPL-OIL-PREHEAT-DAMP on 2.**
Both are internally consistent, but the sample is too thin to call them consensus.
Either accept them as provisional (and re-check after the pilot) or park those two
combinations and route matching products to Nick individually.

---

## 7. Stamping checklist (for T2/T4/T5)

Per product, per derived role:

1. Pick the template by `(category, derived role, family the source implies)`.
2. Replace every `⟨…⟩` slot. `productId` **must** be the real product uuid, or the
   readiness oracle downgrades the row to `verified_incomplete` (§2.1).
3. Set `contact_time_seconds` and `protocolFacts.contactTimeSeconds` to the same value,
   and make the wait copy consistent with §2.5.
4. Attach the product's own `source_label` / `source_url` / `source_text` and at least
   one `evidence[]` entry.
5. Emit `deviation: null` only if the source contradicts nothing in the template. Any
   contradiction becomes `{reason, packaging_text}` and goes to Nick.
6. Never write `application_family` or `category_key`. If a V2 pointer is also written,
   its `applicationFamily` must equal the V1 family (§2.2).
7. Assert the §2.4 column↔payload invariants before publishing.
