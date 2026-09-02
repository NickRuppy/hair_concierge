# Protocol Content Templates — Scan DB Expansion (T3)

> **Rev 2 — normative, from Nick's rulings 2026-09-02 (P1–P9); pending Nick's final copy check.**
> These templates encode **Chaarlie's rules** for how a product category is used.
> They are not averages of the existing catalog. Where an existing live row
> disagrees with a template below, the live row is wrong — see §5.
> Nick has ruled the structure and the behaviour; the German wording still needs
> one copy pass before T4/T5 stamping begins.

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

**Rule vs. fact.** A template constant is Chaarlie's rule and does not need a
per-product source (placement, sequencing, the conditioner relationship, the
heat-reapplication rule). A `⟨…⟩` slot is a product fact and always needs one.
A source that contradicts a **rule** is a deviation for Nick; a source that is
merely silent about a rule changes nothing.

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

### 2.3 Constants shared by all 12 templates

| Field                                   | Value                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                         | `1`                                                                                                                                                                       |
| `protocolVersion`                       | `1`                                                                                                                                                                       |
| `locale`                                | `"de"`                                                                                                                                                                    |
| `exactGuidanceRequired`                 | `true`                                                                                                                                                                    |
| `scope`                                 | `{ "kind": "product", "category": <category>, "productId": <this product's uuid> }`                                                                                        |
| `protocolFacts.cautions`                | `[]` (V1 folds safety copy into the step copy; the schema hard-caps this at length 0)                                                                                     |
| `protocolFacts.conditionerRelationship` | `"not_applicable"` for every template except Mask                                                                                                                         |
| `evidence`                              | ≥1 `{sourceUrl, sourceType, checkedAt}`; `sourceType` `"retailer"` for dm/Rossmann pages, `"manufacturer"` for brand pages; `checkedAt` = `YYYY-MM-DD` of the research run |
| `requirements`                          | `{ "requiredCatalogFacts": [], "requiredProfileFacts": [], "requiredProtocolFacts": [] }`                                                                                  |
| `protocolFacts.workflowId`              | omit (only for the 4 hard-coded exact workflows)                                                                                                                          |
| `protocolFacts.cautionCodes`            | omit unless the source carries a real caution                                                                                                                             |

`requirements` is `[]` everywhere on purpose. `guidance-resolver.ts:105-108` looks
each entry up as a **flat key** in `item.catalogFacts`, which
`application-adapter.ts:83-131` populates from the raw spec row (`weight`,
`role_support`, `roles`, …). The dotted keys some live rows carry
(`leave_in.v3.plan_roles`, `oil.v2.weight`) cannot resolve and would return
`missing_catalog_fact:<key>`. `[]` is the only shape that cannot fail under either
the V1 or the V2 contract.

### 2.4 Column ↔ payload invariants

- `contact_time_seconds` (column) `===` `guidance_payload.protocolFacts.contactTimeSeconds`.
- `placement` (column) `===` `protocolFacts.applicationArea` (same vocabulary:
  `scalp_roots` | `all_hair` | `lengths_ends` | `ends`).
- `rinse_action` (column) uses the payload's `protocolFacts.rinse` value
  (`rinse_out` | `leave_in`) **with exactly one legitimate exception**: the pre-wash
  oil column carries `shampoo_out` while the payload carries `rinse_out`, because the
  product is washed out with shampoo rather than rinsed with water.

**No-rinse code — standardized on `leave_in`.** Rev 1 split leave-in and oil rows
between `do_not_rinse` and `leave_in`. `do_not_rinse` is not a real code:
`applicationGuidanceProtocolSchema` only offers `rinse_out | leave_in`
(`contracts.ts:265`), the current authority validator only accepts
`shampoo_out | leave_in` (`catalog-authority/oil-repair.ts:72`), and the
canonicalization migration writes the column straight from the payload
(`20260811215000_…_stage5_legacy_protocol_canonicalization.sql:135`:
`rinse_action = v_payload#>>'{protocolFacts,rinse}'`). Every template below uses
`leave_in` in both column and payload. The 18 live `do_not_rinse` rows are a
cleanup item (§5).

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
- Never spell numbers out when `contactTimeSeconds` is `null` — `"Zehn Minuten"`
  does not parse. (Spelled-out forms are only safe when the integer is also set.)

Every ruled contact window below (shampoo 2–3 min, conditioner 1–3 min, pre-wash oil
15–20 min) is a **range**, so those templates carry `contactTimeSeconds: null` and
the range copy form. That is correct, not a gap.

### 2.6 Stable-ID convention

`guidanceKey` = `product-<category token>-⟨productId⟩[-<role suffix>]`, matching the
dominant live convention:

| Template            | `guidanceKey`                            |
| ------------------- | ---------------------------------------- |
| SHAMPOO-STD         | `product-shampoo-everyday-⟨productId⟩`   |
| SHAMPOO-TARGETED    | `product-shampoo-everyday-⟨productId⟩`   |
| SHAMPOO-DANDRUFF    | `product-shampoo-dandruff-⟨productId⟩`   |
| CONDITIONER         | `product-conditioner-⟨productId⟩`        |
| MASK                | `product-mask-⟨productId⟩`               |
| LEAVEIN-DAMP        | `product-leave-in-⟨productId⟩-post-wash` |
| LEAVEIN-DRYCARE     | `product-leave-in-⟨productId⟩-dry-care`  |
| LEAVEIN-HEAT        | `product-leave-in-⟨productId⟩-pre-heat`  |
| OIL-DRYFINISH       | `product-oil-⟨productId⟩-dry`            |
| OIL-LEAVEON         | `product-oil-⟨productId⟩-leave-on`       |
| OIL-HEAT            | `product-oil-⟨productId⟩-heat`           |
| OIL-PREWASH         | `product-oil-⟨productId⟩-pre-wash`       |

STD and TARGETED share a key because a shampoo is one or the other, never both.
`stepKey` values are the ones written in each template; keep them stable so
diffs across research runs stay readable.

---

## 3. The 12 templates

Notation:

- `⟨…⟩` — a **product-specific slot** the research engine fills from that product's
  own source.
- `⟨REQUIRED: …⟩` — a slot the engine **must** fill. A stamp that leaves it empty is
  invalid and must not be published.

Everything else is a Chaarlie rule and is not negotiable per product without a
deviation record.

---

### TPL-SHAMPOO-STD

**Key:** `shampoo` × `shampoo_everyday` × `standard_rinse_out_cleanse`
**Applies when:** any generic cleansing shampoo, **regardless of its marketing claim**.
Repair, Volumen, Feuchtigkeit, Curl, Farbschutz, Glanz → all STD (P3).

**Rule (P1).** Shampoo is a scalp product. It is placed on scalp and roots; the
lengths are cleaned by the runoff on the way out. A standard shampoo has **no wait
step** — massage in, rinse out (P1, P4).

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
      "copyTemplateDe": "Ins nasse Haar geben und auf der Kopfhaut aufschäumen und einmassieren."
    },
    {
      "stepKey": "rinse-shampoo",
      "action": "rinse",
      "copyTemplateDe": "Gründlich ausspülen – die Längen werden dabei mitgereinigt."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Schema constraint:** this family allows **exactly one** `apply_product` step
(`contracts.ts:339-349`). A "bei Bedarf wiederholen" second pass is not expressible
here — treat it as a deviation.

**Typical deviations to watch for**

- **A scalp-condition claim** (Urea, empfindliche Kopfhaut, fettige Kopfhaut) →
  wrong template, use TPL-SHAMPOO-TARGETED.
- **A Schuppen claim** → wrong template, use TPL-SHAMPOO-DANDRUFF.
- **A stated wait time.** The rule is no wait for STD. Do not add a `wait` step to
  satisfy a package; record the deviation and let Nick decide whether the product
  is really TARGETED.
- **A "nur in die Längen" instruction** — contradicts P1. Deviation, not a silent
  `lengths_ends` override.
- "2× waschen" / repeat pass → cannot be modelled here; flag for Nick.

---

### TPL-SHAMPOO-TARGETED

**Key:** `shampoo` × `shampoo_everyday` × `targeted_treatment_shampoo`
**Applies when (P3, narrow):** the product carries a **scalp-condition** claim —
Urea, empfindliche/gereizte Kopfhaut, fettige Kopfhaut, and equivalents. Marketing
claims about the hair fibre (Repair, Volumen, Feuchtigkeit, Curl) are **not**
targeted; those are STD.

**Rule (P4).** A targeted shampoo gets a contact window before rinsing:
**2–3 Minuten einwirken lassen.** This is cosmetic framing only — the copy never
names a condition, a diagnosis, or a therapeutic effect (repo rule: cosmetic
guidance stays separate from medically adjacent scalp guidance).

| Column                 | Value                                             |
| ---------------------- | ------------------------------------------------- |
| `application_stage`    | `wet_cleanse`                                     |
| `application_state`    | `null`                                            |
| `placement`            | `scalp_roots`                                     |
| `contact_time_seconds` | `null` (2–3 min is a range — §2.5)                |
| `rinse_action`         | `rinse_out`                                       |
| `reapplication`        | `not_stated`                                      |

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
      "copyTemplateDe": "Ins nasse Haar geben und auf der Kopfhaut aufschäumen und einmassieren."
    },
    {
      "stepKey": "wait-shampoo",
      "action": "wait",
      "copyTemplateDe": "2–3 Minuten einwirken lassen."
    },
    {
      "stepKey": "rinse-shampoo",
      "action": "rinse",
      "copyTemplateDe": "Gründlich ausspülen – die Längen werden dabei mitgereinigt."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- **A longer stated time** (5 or 10 Minuten) → set both column and payload to the
  exact integer and use the digit copy. A shorter or longer window from the source
  overrides the 2–3 min default; the default exists for sources that state nothing.
- **Medical framing** (Pilz, Ekzem, Psoriasis, ärztlicher Rat) → do not paraphrase
  into cosmetic copy. Flag for Nick.
- **Fibre-claim products that arrived here** → move to STD.
- Two-pass rituals → these become `workflowId` products; out of scope for a
  drugstore pilot stamp.

---

### TPL-SHAMPOO-DANDRUFF

**Key:** `shampoo` × `shampoo_dandruff` × `targeted_treatment_shampoo`
**Applies when (P3):** the reviewed shampoo buckets contain `schuppen`. A
treatment-only dandruff shampoo is complete **without** a `shampoo_everyday` row —
do not add one to "complete the payload"
(`docs/product-intake-research-ops.md`, Shampoo rule).

**Rule (P4).** Same contact window as TARGETED: **2–3 Minuten einwirken lassen**,
cosmetic framing only.

| Column                 | Value                              |
| ---------------------- | ---------------------------------- |
| `application_stage`    | `wet_cleanse`                      |
| `application_state`    | `null`                             |
| `placement`            | `scalp_roots`                      |
| `contact_time_seconds` | `null` (2–3 min is a range — §2.5) |
| `rinse_action`         | `rinse_out`                        |
| `reapplication`        | `not_stated`                       |

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
      "copyTemplateDe": "Ins nasse Haar geben und auf der Kopfhaut aufschäumen und einmassieren."
    },
    {
      "stepKey": "wait-dandruff-shampoo",
      "action": "wait",
      "copyTemplateDe": "2–3 Minuten einwirken lassen."
    },
    {
      "stepKey": "rinse-dandruff-shampoo",
      "action": "rinse",
      "copyTemplateDe": "Gründlich ausspülen – die Längen werden dabei mitgereinigt."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- **An exact stated contact time** (common on Ketoconazol/Selendisulfid products) →
  set the integer in both column and payload and use the digit copy.
- **A stated frequency limit** ("2× wöchentlich, max. 4 Wochen"). V1 has no cadence
  slot in the payload; the `cadence` column exists but no live row uses it. Flag
  rather than drop.
- **Anything that reads as medical** (Pilzinfektion, ärztlicher Rat) → do not
  paraphrase into cosmetic copy; flag for Nick.
- 2 applications ("zweimal shampoonieren") → deviation.

---

### TPL-CONDITIONER

**Key:** `conditioner` × `conditioner_rinse_out` × `standard_rinse_out_conditioning`
**Applies when:** any rinse-out conditioner/Spülung.

**Rule (P2).** Conditioner goes on **Längen und Spitzen**, and the copy must say
**"Ansatz aussparen"** (or a natural equivalent) explicitly. Contact time is
**1–3 Minuten**. `all_hair` is not a valid conditioner placement.

| Column                 | Value                              |
| ---------------------- | ---------------------------------- |
| `application_stage`    | `post_cleanse_rinse_off`           |
| `application_state`    | `null`                             |
| `placement`            | `lengths_ends`                     |
| `contact_time_seconds` | `null` (1–3 min is a range — §2.5) |
| `rinse_action`         | `rinse_out`                        |
| `reapplication`        | `not_stated`                       |

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
    "sharedTemplateContactTime": "include",
    "conditionerRelationship": "not_applicable",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-conditioner",
      "action": "apply_product",
      "copyTemplateDe": "Nach der Haarwäsche in Längen und Spitzen verteilen und den Ansatz aussparen."
    },
    {
      "stepKey": "wait-conditioner",
      "action": "wait",
      "copyTemplateDe": "1–3 Minuten einwirken lassen."
    },
    { "stepKey": "rinse-conditioner", "action": "rinse", "copyTemplateDe": "Gründlich ausspülen." }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**`sharedTemplateContactTime: "include"` is deliberate.** The V2 builder suppresses
conditioner contact time entirely unless this is set
(`stage5-v2-builder.ts:204-209`). Since 1–3 Minuten is now a rule and not incidental
copy, it has to reach the Anwendung view. This is the one encoding choice Rev 2 made
that is not literally in the rulings — confirm at the copy check.

**Typical deviations to watch for**

- **A stated exact time** ("2 Minuten") → set the integer in both column and payload
  and switch to the digit copy. A stated longer window ("bis zu 5 Minuten") →
  maximum copy form, integer stays `null`.
- **"Auch auf die Kopfhaut" / "im ganzen Haar"** → contradicts P2. Deviation, not a
  silent `all_hair` override.
- **Leave-in-capable products** ("kann auch im Haar bleiben") → this is a
  **leave_in** product, not a conditioner deviation. Flag for re-categorisation.
- Colour-refreshing conditioners with a timing/gloves warning → flag.

---

### TPL-MASK

**Key:** `mask` × `intensive_conditioning_mask` × `post_shampoo_rinse_out_mask`
**Applies when:** any rinse-out Haarkur/Maske.

**Rule (P5).** Mask goes on **Längen und Spitzen**, Ansatz aussparen. Its canonical
relationship to conditioner is **`replaces_conditioner`** — on a mask day the mask
takes the conditioner's place. `conditioner_after` is not the default and needs an
explicit sourced sequence.

**Contact time is a required per-product slot (P5).** Unlike every other timed
template, the mask has no default window: it comes from the packaging, with a
source. A stamp with no sourced contact time is **invalid** and must not be
published.

| Column                 | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `application_stage`    | `post_cleanse_rinse_off`                                                 |
| `application_state`    | `null`                                                                   |
| `placement`            | `lengths_ends`                                                           |
| `contact_time_seconds` | `⟨REQUIRED: from packaging, with source⟩` — integer, or `null` for a range/maximum (§2.5) |
| `rinse_action`         | `rinse_out`                                                              |
| `reapplication`        | `not_stated`                                                             |

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
    "contactTimeSeconds": "⟨REQUIRED: from packaging, with source — integer for one exact time, null when the source states a range or a maximum⟩",
    "conditionerRelationship": "replaces_conditioner",
    "reapplication": "none",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-mask",
      "action": "apply_product",
      "copyTemplateDe": "Nach der Haarwäsche ins nasse Haar geben, in Längen und Spitzen verteilen und den Ansatz aussparen."
    },
    {
      "stepKey": "wait-mask",
      "action": "wait",
      "copyTemplateDe": "⟨REQUIRED: \"3 Minuten einwirken lassen.\" | \"5–10 Minuten einwirken lassen.\" | \"Bis zu 10 Minuten einwirken lassen.\"⟩"
    },
    { "stepKey": "rinse-mask", "action": "rinse", "copyTemplateDe": "Gründlich ausspülen." }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Validity check for the stamp:** the `wait-mask` step must name a time, the copy
form must match §2.5, and the column and `contactTimeSeconds` must agree.
`"Kurz einwirken lassen."` is **not** an acceptable fill for a mask — if the source
truly states no time, the product is not stampable and goes to Nick.

**Typical deviations to watch for**

- **`conditioner_after`** — only when the source explicitly sequences a conditioner
  after the mask. Otherwise the rule stands.
- **Long contact times (>5 min)** — 10–20 min and "bis zu 10 Minuten" are normal on
  masks. Use the range/maximum copy forms so the V2 parser picks them up.
- **Heat activation** ("unter der Haube", "mit Handtuch warm einwickeln") — not
  representable in this template; deviation.
- **Overnight masks** — wrong family entirely; flag as out of scope for the pilot.
- **"Im ganzen Haar verteilen"** → contradicts P5. Deviation, keep `lengths_ends`.

---

### TPL-LEAVEIN-DAMP

**Key:** `leave_in` × `post_wash_leave_in` × `post_wash_damp_conditioning`
**Applies when (P6):** **the default for all leave-ins.** Unless the product is
explicitly marketed for dry-hair/between-wash use, it gets this template.

| Column                 | Value           |
| ---------------------- | --------------- |
| `application_stage`    | `damp_leave_on` |
| `application_state`    | `null`          |
| `placement`            | `lengths_ends`  |
| `contact_time_seconds` | `null`          |
| `rinse_action`         | `leave_in`      |
| `reapplication`        | `not_stated`    |

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
      "copyTemplateDe": "Eine kleine Menge in Längen und Spitzen verteilen, den Ansatz aussparen. Nicht ausspülen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- **Spray formats** → apply copy becomes "…gleichmäßig aufsprühen"; add
  `amount: {"kind":"qualitative","copyDe":"Gleichmäßig sprühen."}`.
- **"Durchkämmen" as an explicit step** → add a `section` step; common and harmless.
- **A stated leave-on time** → deviation, set the integer.
- **Products that also claim heat protection** → they additionally need a
  TPL-LEAVEIN-HEAT row. That is a **separate** protocol row, not a change to this one.
- **Products explicitly marketed for dry hair between washes** → they get
  TPL-LEAVEIN-DRYCARE **instead of** or **in addition to** this row, depending on
  what the source positions (see below).
- **`post_style_finish` products** (positioned as an after-styling finish) → the
  family is **parked** (P6). No template exists. Flag the product to Nick
  individually; do not force it into this template.

---

### TPL-LEAVEIN-DRYCARE

**Key:** `leave_in` × `post_wash_leave_in` × `between_wash_dry_care`
**Applies when (P6, narrow):** the product is **explicitly marketed for dry-hair or
between-wash use** — Auffrischen zwischen den Wäschen, Spitzenpflege im trockenen
Haar, tägliche Pflege ohne Waschen. A leave-in that merely _tolerates_ dry hair is
still TPL-LEAVEIN-DAMP.

| Column                 | Value          |
| ---------------------- | -------------- |
| `application_stage`    | `dry_hair`     |
| `application_state`    | `dry`          |
| `placement`            | `lengths_ends` |
| `contact_time_seconds` | `null`         |
| `rinse_action`         | `leave_in`     |
| `reapplication`        | `not_stated`   |

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
      "copyTemplateDe": "Mit einer sehr kleinen Menge in trockenen Längen und Spitzen beginnen und nur bei Bedarf ergänzen. Den Ansatz aussparen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- **Products that are _also_ the post-wash leave-in** → they get **both** this and
  TPL-LEAVEIN-DAMP, as separate rows (uniqueness is per family).
- **A product with no explicit dry-hair positioning that landed here** → move it back
  to TPL-LEAVEIN-DAMP. The dry-care template is the exception, not a coin flip.
- "Täglich anwendbar" → fine, no field changes; do not invent a cadence.
- Root-avoidance instructions → already in the copy; keep `lengths_ends`, or drop to
  `ends` when the source is explicitly ends-only.

---

### TPL-LEAVEIN-HEAT

**Key:** `leave_in` × `pre_heat_protection` × `⟨pre_heat_damp | either_state_protection⟩`
**Applies when:** `product_leave_in_specs.provides_heat_protection = true`.

**Rule (P7).** Heat protection must be **reapplied before every separate heat
session**. This is canonical for leave-ins and oils alike and does not depend on
whether the packaging says so.

**Rule (P9).** There is **one** heat-protection template per category. Whether the
product may also be applied on **dry** hair is a **researched per-product fact**, not
a separate template. That fact drives the family slot:

| Researched fact                                  | `applicationFamily`       | `application_stage` | `application_state` | `sequence.anchor` |
| ------------------------------------------------ | ------------------------- | ------------------- | ------------------- | ----------------- |
| Damp hair only (default when the source names one state) | `pre_heat_damp`           | `damp_leave_on`     | `damp`              | `damp_leave_on`   |
| Source explicitly permits damp **or** dry        | `either_state_protection` | `dry_pre_heat`      | `either`            | `dry_pre_heat`    |

| Column                 | Value                             |
| ---------------------- | --------------------------------- |
| `application_stage`    | from the table above              |
| `application_state`    | from the table above              |
| `placement`            | `lengths_ends`                    |
| `contact_time_seconds` | `null`                            |
| `rinse_action`         | `leave_in`                        |
| `reapplication`        | `required` (P7 — never `not_stated`) |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-leave-in-⟨productId⟩-pre-heat",
  "scope": { "kind": "product", "category": "leave_in", "productId": "⟨productId⟩" },
  "role": "heat_protection",
  "applicationFamily": "⟨pre_heat_damp | either_state_protection⟩",
  "compatibleDayTypes": ["styling_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "⟨damp_leave_on | dry_pre_heat⟩",
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
    "reapplication": "each_separate_heat_event",
    "amount": null,
    "cautions": []
  },
  "steps": [
    {
      "stepKey": "apply-pre-heat",
      "action": "apply_product",
      "copyTemplateDe": "⟨damp: \"Vor dem Hitzestyling gleichmäßig ins handtuchtrockene Haar geben und in Längen und Spitzen verteilen.\" | either: \"Vor dem Hitzestyling gleichmäßig ins feuchte oder trockene Haar geben und in Längen und Spitzen verteilen.\"⟩"
    },
    {
      "stepKey": "tool-pre-heat",
      "action": "tool",
      "copyTemplateDe": "Danach wie geplant mit Wärme stylen. Vor jedem weiteren Hitzestyling erneut auftragen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Choose `either_state_protection` only on an explicit "nass oder trocken" source
statement.** "Am besten auf handtuchtrockenem Haar" is a preference, not either-state
— use `pre_heat_damp`.

**Typical deviations to watch for**

- **A stated max temperature** ("Schutz bis 230 °C"). The numeric value belongs in
  `product_leave_in_specs.heat_protection_max_c`; only the sourced sentence may be
  appended to the `tool` step copy.
- **Heat activation required** (`heat_activation_required = true`) → the copy must
  not imply the product works without heat; flag.
- **"Vor dem Glätteisen antrocknen lassen"** → add a `wait` step.
- **Spray formats** → add `amount: {"kind":"qualitative","copyDe":"Gleichmäßig sprühen."}`.
- **A source that says one application lasts the day** → contradicts P7. The rule
  stands; record the deviation.

---

### TPL-OIL-DRYFINISH

**Key:** `oil` × `dry_finish` × `dry_finish`
**Applies when:** `product_oil_specs.role_support` contains `dry_finish`.

| Column                 | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| `application_stage`    | `dry_finish`                                                         |
| `application_state`    | `null`                                                               |
| `placement`            | `lengths_ends` (`ends` for rich/heavy oils — a researched oil-weight fact) |
| `contact_time_seconds` | `null`                                                               |
| `rinse_action`         | `leave_in`                                                           |
| `reapplication`        | `not_stated`                                                         |

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
    "applicationArea": "⟨lengths_ends | ends⟩",
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

**Amount matters for V2.** `stage5-v2-builder.ts:245-250` maps oil `amount.copyDe` to
a V2 enum by regex: `"1 Tropfen"` → `one_drop`, `"wenige"`/`"ein paar Tropfen"` →
`few_drops`. Keep the template phrase or a listed synonym; free-form dosing copy
silently yields no V2 amount.

**Typical deviations to watch for**

- **Spray oils** ("Trocken-Öl-Spray") → apply copy becomes "aufsprühen"; `amount` copy
  should say "Sparsam aufsprühen." (yields no V2 drop count — acceptable).
- **Rich/heavy oils** → `ends` in both column and payload.
- **"Auch ins feuchte Haar"** → the product also needs TPL-OIL-LEAVEON, if
  `role_support` declares `leave_on_fibre_conditioning`.

---

### TPL-OIL-LEAVEON

**Key:** `oil` × `leave_on_fibre_conditioning` × `post_wash_damp_conditioning`
**Applies when:** `role_support` contains `leave_on_fibre_conditioning`.

| Column                 | Value                                          |
| ---------------------- | ---------------------------------------------- |
| `application_stage`    | `damp_leave_on`                                |
| `application_state`    | `null`                                         |
| `placement`            | `lengths_ends` (`ends` for rich/heavy oils)    |
| `contact_time_seconds` | `null`                                         |
| `rinse_action`         | `leave_in`                                     |
| `reapplication`        | `not_stated`                                   |

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
    "applicationArea": "⟨lengths_ends | ends⟩",
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
      "copyTemplateDe": "In die handtuchtrockenen Längen und Spitzen geben; den Ansatz aussparen und nicht ausspülen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- **Sources that only ever say "ins trockene Haar"** → the product does not have this
  role; the fact, not the protocol, is wrong. Send back to fact research.
- **Curly-hair "einkneten" wording** → fine, adjust the apply copy.
- **Rich oils** → `ends`.

---

### TPL-OIL-HEAT

**Key:** `oil` × `pre_heat_protection` × `⟨pre_heat_damp | either_state_protection⟩`
**Applies when:** `role_support` contains `pre_heat_protection`.

**Rule (P7).** Reapplication before every separate heat session, same as the
leave-in heat template.

**Rule (P9).** One heat template for the oil category; the damp/either family value
comes from the researched per-product fact, using the same mapping as
TPL-LEAVEIN-HEAT:

| Researched fact                           | `applicationFamily`       | `application_stage` | `application_state` | `sequence.anchor` |
| ----------------------------------------- | ------------------------- | ------------------- | ------------------- | ----------------- |
| Damp hair only                            | `pre_heat_damp`           | `damp_leave_on`     | `damp`              | `damp_leave_on`   |
| Source explicitly permits damp **or** dry | `either_state_protection` | `dry_pre_heat`      | `either`            | `dry_pre_heat`    |

| Column                 | Value                                |
| ---------------------- | ------------------------------------ |
| `application_stage`    | from the table above                 |
| `application_state`    | from the table above                 |
| `placement`            | `lengths_ends` (`ends` for rich oils) |
| `contact_time_seconds` | `null`                               |
| `rinse_action`         | `leave_in`                           |
| `reapplication`        | `required`                           |

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "locale": "de",
  "guidanceKey": "product-oil-⟨productId⟩-heat",
  "scope": { "kind": "product", "category": "oil", "productId": "⟨productId⟩" },
  "role": "heat_protection",
  "applicationFamily": "⟨pre_heat_damp | either_state_protection⟩",
  "compatibleDayTypes": ["styling_day"],
  "exactGuidanceRequired": true,
  "sequence": {
    "anchor": "⟨damp_leave_on | dry_pre_heat⟩",
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
    "applicationArea": "⟨lengths_ends | ends⟩",
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
      "copyTemplateDe": "⟨damp: \"In die handtuchtrockenen Längen und Spitzen einarbeiten; bei feinem Haar nur die Spitzen und nie den Ansatz.\" | either: \"In handtuchtrockene oder trockene Längen und Spitzen einarbeiten; bei feinem Haar nur die Spitzen und nie den Ansatz.\"⟩"
    },
    {
      "stepKey": "tool-heat",
      "action": "tool",
      "copyTemplateDe": "Danach mit Wärme stylen. Vor jedem weiteren Hitzestyling erneut auftragen."
    }
  ],
  "evidence": [{ "sourceUrl": "⟨url⟩", "sourceType": "retailer", "checkedAt": "⟨YYYY-MM-DD⟩" }]
}
```

**Typical deviations to watch for**

- **Oils claiming heat protection without a stated temperature** — keep the copy free
  of any implied °C limit.
- **Fine-hair root-avoidance** is already in the template copy; keep it.
- The V2 builder maps `applicationArea: "all_hair"` + `role: "heat_protection"` to
  `root_to_tip_hair`, which is never what an oil source means — `all_hair` is not a
  valid choice here.

---

### TPL-OIL-PREWASH

**Key:** `oil` × `pre_wash_fibre_treatment` × `pre_wash_lengths_treatment`
**Applies when:** `role_support` contains `pre_wash_fibre_treatment`.

**Rule (P8).** Canonical pre-wash contact time is **15–20 Minuten** before
shampooing. This is Chaarlie's rule, not a manufacturer claim; a source that states
nothing about timing does not change it. Because it is a range,
`contactTimeSeconds` stays `null` and the range copy form carries it (§2.5).

| Column                 | Value                                   |
| ---------------------- | --------------------------------------- |
| `application_stage`    | `pre_wash`                              |
| `application_state`    | `dry`                                   |
| `placement`            | `lengths_ends`                          |
| `contact_time_seconds` | `null` (15–20 min is a range — §2.5)    |
| `rinse_action`         | `shampoo_out` (the §2.4 exception)      |
| `reapplication`        | `not_stated`                            |

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
    "contactTimeSeconds": null,
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
      "copyTemplateDe": "15–20 Minuten einwirken lassen."
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

For rich oils, swap the dosing line (both `amount.copyDe` and the `dose-pre-wash`
step) to:
`"Fein: mit 1 Tropfen starten; normal: 1 Tropfen; kräftig: 2 Tropfen. Vollständig zwischen den Handflächen anwärmen und sehr dünn verteilen."`

**Typical deviations to watch for**

- **Overnight oiling** ("über Nacht einwirken") → contradicts P8. Do not stamp a
  longer time without Nick's sign-off; record the deviation.
- **A source that states a shorter window** (e.g. "5 Minuten") → deviation, not a
  silent override. P8 is the rule.
- **Sources that say "auch auf die Kopfhaut"** → this crosses into scalp guidance;
  flag rather than paraphrase (repo rule: scalp guidance stays separated).
- **Coconut-oil-type products with protein-sensitivity caveats** → flag for the
  domain reviewer.

---

## 4. Template index

| #   | Template ID      | Category    | Role                        | Family                                    | Timed?                     |
| --- | ---------------- | ----------- | --------------------------- | ----------------------------------------- | -------------------------- |
| 1   | TPL-SHAMPOO-STD      | shampoo     | shampoo_everyday            | standard_rinse_out_cleanse                | no (P1/P4)                 |
| 2   | TPL-SHAMPOO-TARGETED | shampoo     | shampoo_everyday            | targeted_treatment_shampoo                | 2–3 min (P4)               |
| 3   | TPL-SHAMPOO-DANDRUFF | shampoo     | shampoo_dandruff            | targeted_treatment_shampoo                | 2–3 min (P4)               |
| 4   | TPL-CONDITIONER      | conditioner | conditioner_rinse_out       | standard_rinse_out_conditioning           | 1–3 min (P2)               |
| 5   | TPL-MASK             | mask        | intensive_conditioning_mask | post_shampoo_rinse_out_mask               | **required per product** (P5) |
| 6   | TPL-LEAVEIN-DAMP     | leave_in    | post_wash_leave_in          | post_wash_damp_conditioning               | no                         |
| 7   | TPL-LEAVEIN-DRYCARE  | leave_in    | post_wash_leave_in          | between_wash_dry_care                     | no                         |
| 8   | TPL-LEAVEIN-HEAT     | leave_in    | pre_heat_protection         | pre_heat_damp \| either_state_protection  | no                         |
| 9   | TPL-OIL-DRYFINISH    | oil         | dry_finish                  | dry_finish                                | no                         |
| 10  | TPL-OIL-LEAVEON      | oil         | leave_on_fibre_conditioning | post_wash_damp_conditioning               | no                         |
| 11  | TPL-OIL-HEAT         | oil         | pre_heat_protection         | pre_heat_damp \| either_state_protection  | no                         |
| 12  | TPL-OIL-PREWASH      | oil         | pre_wash_fibre_treatment    | pre_wash_lengths_treatment                | 15–20 min (P8)             |

**Parked — no template (P6):** `leave_in` × `post_wash_leave_in` × `post_style_finish`.
Products the research positions as an after-styling finish must be **flagged to Nick
individually** and left unstamped until he rules on the family.

**Dissolved in Rev 2:** the separate damp/either heat templates
(`TPL-LEAVEIN-PREHEAT-DAMP` / `-EITHER`, `TPL-OIL-PREHEAT-DAMP` / `-EITHER`) are now
one template per category with a family slot (P9).

**Out of scope for the pilot:** `pre_heat_dry`, and every family belonging to the
other five categories (`dry_shampoo`, `deep_cleansing_shampoo`, `bondbuilder`,
`heat_protectant`, `scalp_care`).

---

## 5. Cleanup implications

These are existing-row conventions that now contradict a ruling. Factual inventory
only — no tasks assigned, no migration proposed here. Counts taken 2026-09-02 from
`product_application_protocols` (project `pqdkhefxsxkyeqelqegq`).

| Ruling | Contradicting convention in live data | Rows |
| ------ | -------------------------------------- | ---- |
| P1 | Standard shampoos placed `all_hair` instead of `scalp_roots` | 29 of 35 |
| P1/P4 | Standard shampoos carrying a `wait` step | 3 |
| P2 | Rinse-out conditioners placed `all_hair` instead of `lengths_ends` | 20 of 43 |
| P2 | Conditioner copy that never says "Ansatz aussparen" | most rows; the phrase is essentially absent today |
| P2 | Conditioners with no stated contact window ("Kurz einwirken lassen." / "Einige Minuten") | 39 of 43 have `contactTimeSeconds: null` and no ruled range |
| P2 | `sharedTemplateContactTime` omitted, so no conditioner shows a time in V2 | 40 of 43 |
| P3 | Shampoos stamped `targeted_treatment_shampoo` without a scalp-condition claim — clear cases are a Curl shampoo and a "feines, brüchiges Haar" shampoo; all 8 targeted rows need re-checking against the narrowed P3 definition | ≥2 of 8 |
| P5 | Masks with `conditionerRelationship: conditioner_after` | 3 |
| P5 | Masks with `conditionerRelationship: no_conditioner` | 1 |
| P5 | Masks with **no** contact time — would be invalid stamps under Rev 2 | 18 of 35 |
| P6 | `post_style_finish` rows stamped while the family is parked | 3 |
| P7 | Leave-in heat-protection rows with `reapplication` other than `required` (silent heat reapplication) | 21 of 22 |
| P8 | Pre-wash oil rows outside the 15–20 min window (600 s convention, plus 900 s and one 3600 s) | 16 of 17 |
| §2.4 | `rinse_action: do_not_rinse` — a code no validator accepts | 18 |
| — | One shampoo row carries German prose in the enum columns (`application_stage: "Haarwäsche"`, `placement: "Haar"`, `rinse_action: "Ausspülen"`) | 1 |
| §2.6 | Non-conforming `guidanceKey` shapes: 4 slug-based keys with no product uuid, plus 18 carrying the `leave-in-use-case-2026-08-14-…` batch prefix | 22 |
| §2.6 | Keys with a product uuid but a suffix §2.6 does not declare canonical: leave-in heat rows on `-heat` instead of `-pre-heat` (11), oil leave-on rows on `-damp` instead of `-leave-on` (13), and `between_wash_dry_care` rows on `-post-wash` instead of `-dry-care` (4) | 28 |

---

## 6. Stamping checklist (for T2/T4/T5)

Per product, per derived role:

1. Pick the template by `(category, derived role)`. For the two heat templates, pick
   the family from the researched damp/either fact (§3, P9 mapping tables).
2. Replace every `⟨…⟩` slot. `productId` **must** be the real product uuid, or the
   readiness oracle downgrades the row to `verified_incomplete` (§2.1).
3. Every `⟨REQUIRED: …⟩` slot must be filled from a source. A mask with no sourced
   contact time is not stampable (P5).
4. Set `contact_time_seconds` and `protocolFacts.contactTimeSeconds` to the same
   value, and make the wait copy consistent with §2.5.
5. Attach the product's own `source_label` / `source_url` / `source_text` and at
   least one `evidence[]` entry.
6. Emit `deviation: null` only if the source contradicts nothing in the template.
   Any contradiction — including a source that disagrees with a **rule** — becomes
   `{reason, packaging_text}` and goes to Nick.
7. Never write `application_family` or `category_key`. If a V2 pointer is also
   written, its `applicationFamily` must equal the V1 family (§2.2).
8. Assert the §2.4 column↔payload invariants before publishing, including the
   `leave_in` no-rinse code.
