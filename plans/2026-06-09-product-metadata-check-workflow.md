# Product Metadata Check Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the concrete HAI-124 product metadata issues and add guardrails so product names, prices, links, purchase-link status, and sheet aliases can be checked continuously without wiping enriched commercial metadata.

**Architecture:** Use id-based Supabase migrations for known product corrections, keep purchase-link status separate from lifecycle, preserve commercial fields during classification ingestion, and add a read-only audit script that produces reviewable JSON/CSV reports. The Google Sheet remains the product-list source of truth; old `data/products-from-excel/` files are treated as generated/legacy inputs.

**Tech Stack:** Supabase SQL migrations, TypeScript scripts with `tsx`, existing affiliate URL gate helpers, Node test runner via `npm run test:node`.

---

## Source Docs

- Spec/investigation: `docs/hai-124-product-metadata-overview.md`
- Sheet alias review: `docs/hai-124-sheet-alias-review.md`
- Relevant ticket: HAI-124, `Produktdaten-Check für Preise, Links und Sonderzeichen etablieren`

## Promised End-State

- The beta-reported rows are corrected by stable production ids.
- `Gliss Ultimate Repair Spülung` is treated as a leave-in spray conditioner, not a rinse-out conditioner.
- Purchase-link status can be flagged while products remain active.
- Product ingestion no longer nulls `affiliate_link`, `image_url`, or `price_eur` when a generated source row omits those fields.
- A read-only audit command flags suspicious names, missing prices, missing images, deny-listed hosts, stale known prices, and purchase-link status mismatches.
- Sheet aliases and successor substitutions are documented for review, not silently converted into duplicate products.

## Scope Boundaries

In scope:

- Product metadata corrections for the rows documented in HAI-124.
- A small purchase-link metadata schema.
- Minimal product drawer UI for unavailable stored shop links.
- Ingestion guardrails for commercial fields.
- Read-only audit tooling and tests.
- Documentation of sheet aliases and shop/source policy.

Out of scope:

- Image backfill and UI rendering; handled by HAI-125.
- Large high-end/profi catalog expansion from `HiE-*` tabs.
- Full browser scraping infrastructure for every retailer.
- Automatic production writes from audit output.
- Recommendation-rule redesign beyond the Gliss category/spec correction.

## Target File Map

Create:

- `data/product-metadata-audit/known-price-checks.json`
  - Reviewed expected-price watchlist for known products where price drift should be checked without scraping.

- `data/product-metadata-audit/product-id-aliases.json`
  - Reviewed identity map from legacy/sheet names to stable production product ids.

- `supabase/migrations/20260609203400_product_metadata_health_fields.sql`
  - Adds purchase-link status/check timestamp fields.

- `supabase/migrations/20260609204000_hai_124_product_metadata_corrections.sql`
  - Applies id-based product corrections and Gliss leave-in spec migration.

- `src/lib/product-metadata/health.ts`
  - Pure helpers for host policy, suspicious-name checks, price delta checks, missing-field checks, and audit status assembly.

- `scripts/audit-product-metadata.ts`
  - Read-only production audit command with JSON and CSV output.

- `tests/product-metadata-health.test.ts`
  - Unit tests for metadata health helpers.

Modify:

- `scripts/ingest-products.ts`
  - Resolve existing products by stable id or reviewed alias before falling back to `name,category`, preserve commercial fields unless source explicitly provides a value or a force flag is set, and stop blindly deleting legacy leave-in specs.

- `src/lib/types.ts`
  - Add purchase-link status fields to shared product typing if the product schema/type currently enumerates product columns.

- `src/lib/validators/index.ts`
  - Accept `purchase_link_status`, `purchase_link_checked_at`, and `price_checked_at` in product validation if product rows are parsed there.

- `src/lib/affiliate-research/url-gate.ts`
  - Keep existing allow/deny behavior; do not add a second host-preference concept unless a consumer is added in the same change.

- `src/components/chat/product-display-model.ts`
  - Add purchase-link status-aware shop CTA labels and helper copy.

- `src/components/chat/product-detail-drawer.tsx`
  - Render concise helper text under the drawer footer CTA when the stored purchase link is unavailable.

- `tests/product-display-model.test.ts`
  - Cover unavailable-link CTA label/helper behavior.

- `tests/product-card-rendering.test.tsx`
  - Cover drawer/footer rendering if existing render tests support the drawer flow; otherwise add a focused drawer test.

- `tests/affiliate-research-url-gate.test.ts`
  - Cover URL gate behavior, including brand-direct links.

- `docs/hai-124-product-metadata-overview.md`
  - Keep as final investigation and decision record.

- `docs/hai-124-sheet-alias-review.md`
  - Keep as human review list for sheet deviations.

Inspect:

- `scripts/write-affiliate-links.ts`
  - Confirm write safety remains compatible with the audit output.

- `scripts/export-missing-affiliate-links.ts`
  - Decide whether to call the new audit helper or leave this as a narrower legacy command.

- `src/lib/product-utils.ts`
  - Check whether product display or eligibility code needs purchase-link status awareness.

## Implementation Tasks

### Task 1: Add Purchase-Link Status Columns

**Files:**

- Create: `supabase/migrations/20260609203400_product_metadata_health_fields.sql`
- Modify if needed: `src/lib/types.ts`
- Modify: `src/lib/validators/index.ts`
- Test: `tests/admin-product-support-specs.test.ts`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260609203400_product_metadata_health_fields.sql`:

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_link_status text,
  ADD COLUMN IF NOT EXISTS purchase_link_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_checked_at timestamptz;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_purchase_link_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_purchase_link_status_check
  CHECK (
    purchase_link_status IS NULL
    OR purchase_link_status IN ('available', 'unavailable')
  );
```

Important rollout rule:

- `NULL` is only a transitional migration state before the full purchase-link audit/backfill.
- The approved correction/status migration must set every product row to `available` or `unavailable` and then run `ALTER TABLE public.products ALTER COLUMN purchase_link_status SET NOT NULL;`.
- There is no `unknown` product state in the final schema or UI.

- [ ] **Step 2: Update product types/validators**

Inspect `src/lib/types.ts` and update it if product objects are enumerated there. Update `src/lib/validators/index.ts` so product parsing preserves the new fields:

```ts
purchase_link_status: "available" | "unavailable"
purchase_link_checked_at: string | null
price_checked_at: string | null
```

For zod validators, accept the new values:

```ts
purchase_link_status: z.enum(["available", "unavailable"]).nullable().optional(),
purchase_link_checked_at: z.string().nullable().optional(),
price_checked_at: z.string().nullable().optional(),
```

Reason:

- Final persisted product rows must be binary and non-null after the approved backfill migration.
- Admin/product validation still needs to tolerate omitted fields in create/edit payloads and tests where these metadata fields are not part of the edited form.
- Omitted/null validator input is a technical API compatibility state, not a product-facing `unknown` state.

- [ ] **Step 3: Add validator coverage**

In `tests/admin-product-support-specs.test.ts`, add:

```ts
test("product schema accepts product metadata health fields", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: null,
      purchase_link_status: "unavailable",
      purchase_link_checked_at: "2026-06-09T00:00:00.000Z",
      price_checked_at: "2026-06-09T00:00:00.000Z",
    }),
  )

  assert.equal(parsed.success, true)
  if (!parsed.success) {
    throw new Error("Expected product metadata health fields to parse")
  }
  assert.equal(parsed.data.purchase_link_status, "unavailable")
  assert.equal(parsed.data.purchase_link_checked_at, "2026-06-09T00:00:00.000Z")
  assert.equal(parsed.data.price_checked_at, "2026-06-09T00:00:00.000Z")
})
```

- [ ] **Step 4: Run node tests**

Run:

```bash
npm run test:node
```

Expected: product schema tests pass.

### Task 2: Prepare Approved HAI-124 Correction And Status Migration

**Files:**

- Create: `supabase/migrations/20260609204000_hai_124_product_metadata_corrections.sql`
- Input: reviewed full purchase-link audit proposal from Task 6.
- Test manually with SQL dry-run queries before applying to production.

- [ ] **Step 1: Create correction migration only after review approval**

Do not auto-generate or auto-apply this migration from the audit. Create it only after the reviewed proposal is approved.

The migration must include:

- id-based product metadata fixes for known HAI-124 rows
- approved unavailable-link replacements discovered by the audit
- binary `purchase_link_status` values for corrected/reviewed rows
- no `ALTER COLUMN purchase_link_status SET NOT NULL` until a later generated full-catalog status backfill migration has classified every row

Template for `supabase/migrations/20260609204000_hai_124_product_metadata_corrections.sql`:

```sql
BEGIN;

UPDATE public.products
SET
  name = 'Guhl Panthenol + Reparatur 2in1 Kur & Spülung',
  affiliate_link = 'https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/',
  price_eur = 4.95,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '11d42d9d-b8d8-42ae-a432-9a3d0f9d3504';

UPDATE public.products
SET
  price_eur = 34.00,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '4827c174-92e9-4121-ab70-843d5c037ad0';

DELETE FROM public.product_conditioner_specs
WHERE product_id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0';

DELETE FROM public.product_conditioner_rerank_specs
WHERE product_id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0';

UPDATE public.products
SET
  name = 'Gliss Ultimate Repair Sprüh-Conditioner',
  category = 'Leave-in',
  affiliate_link = 'https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-express-repair-spuelung/p/4015100813494',
  price_eur = 4.49,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  tags = ARRAY(
    SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || ARRAY['leave-in', 'spray', 'hitzeschutz', 'repair'])
  ),
  updated_at = now()
WHERE id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0';

INSERT INTO public.product_leave_in_fit_specs (
  product_id,
  weight,
  conditioner_relationship,
  care_benefits
)
VALUES (
  '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0',
  'light',
  'booster_only',
  ARRAY['heat_protect', 'repair', 'detangle_smooth']::text[]
)
ON CONFLICT (product_id) DO UPDATE
SET
  weight = EXCLUDED.weight,
  conditioner_relationship = EXCLUDED.conditioner_relationship,
  care_benefits = EXCLUDED.care_benefits,
  updated_at = now();

INSERT INTO public.product_leave_in_specs (
  product_id,
  format,
  weight,
  roles,
  provides_heat_protection,
  heat_protection_max_c,
  heat_activation_required,
  care_benefits,
  ingredient_flags,
  application_stage
)
VALUES (
  '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0',
  'spray',
  'light',
  ARRAY['styling_prep']::text[],
  true,
  230,
  false,
  ARRAY['repair', 'detangling', 'anti_frizz']::text[],
  ARRAY['silicones', 'polymers']::text[],
  ARRAY['towel_dry', 'pre_heat']::text[]
)
ON CONFLICT (product_id) DO UPDATE
SET
  format = EXCLUDED.format,
  weight = EXCLUDED.weight,
  roles = EXCLUDED.roles,
  provides_heat_protection = EXCLUDED.provides_heat_protection,
  heat_protection_max_c = EXCLUDED.heat_protection_max_c,
  heat_activation_required = EXCLUDED.heat_activation_required,
  care_benefits = EXCLUDED.care_benefits,
  ingredient_flags = EXCLUDED.ingredient_flags,
  application_stage = EXCLUDED.application_stage,
  updated_at = now();

UPDATE public.products
SET
  price_eur = 26.99,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = 'a1d705b4-b973-486d-b853-2c795b6db681';

UPDATE public.products
SET
  price_eur = 34.19,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '514ffd65-e4a5-4f7f-96c5-0f194e3b3b36';

UPDATE public.products
SET
  price_eur = 32.20,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '6513692a-b54f-4acc-9c77-5799d3dd200c';

UPDATE public.products
SET
  price_eur = 25.67,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '6d6c3ff2-9d12-4f27-a56f-b5b72cf53318';

-- Apply reviewed full-catalog purchase-link statuses here.
-- Every product row must receive exactly one binary state:
--   purchase_link_status = 'available'    -- online buyable at the stored link
--   purchase_link_status = 'unavailable'  -- not online buyable at the stored link
--
-- The NOT NULL gate belongs in the generated full-catalog status backfill
-- migration after the reviewed audit proposal has classified every row.

COMMIT;
```

- [ ] **Step 2: Add a pre-apply row-count assertion for known corrections**

Before applying the migration, run this SQL against the target database:

```sql
SELECT id, name, category, affiliate_link, price_eur
FROM public.products
WHERE id IN (
  '11d42d9d-b8d8-42ae-a432-9a3d0f9d3504',
  '4827c174-92e9-4121-ab70-843d5c037ad0',
  '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0',
  'a1d705b4-b973-486d-b853-2c795b6db681',
  '514ffd65-e4a5-4f7f-96c5-0f194e3b3b36',
  '6513692a-b54f-4acc-9c77-5799d3dd200c',
  '6d6c3ff2-9d12-4f27-a56f-b5b72cf53318'
)
ORDER BY name;
```

Expected: exactly 7 rows return.

- [ ] **Step 3: Add a post-apply validation query**

After applying the migration in a non-production database first, run:

```sql
SELECT
  p.id,
  p.name,
  p.category,
  p.price_eur,
  p.purchase_link_status,
  l.weight AS leave_in_weight,
  l.conditioner_relationship,
  l.care_benefits,
  EXISTS (
    SELECT 1
    FROM public.product_conditioner_specs c
    WHERE c.product_id = p.id
  ) AS has_conditioner_specs,
  EXISTS (
    SELECT 1
    FROM public.product_conditioner_rerank_specs c
    WHERE c.product_id = p.id
  ) AS has_conditioner_rerank_specs
FROM public.products p
LEFT JOIN public.product_leave_in_fit_specs l ON l.product_id = p.id
WHERE p.id IN (
  '11d42d9d-b8d8-42ae-a432-9a3d0f9d3504',
  '4827c174-92e9-4121-ab70-843d5c037ad0',
  '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'
)
ORDER BY p.name;
```

Expected:

- Guhl has no `*`, points to Müller, price `4.95`, and `purchase_link_status='available'`.
- Olaplex keeps name `Olaplex No.5 Leave-In`, price `34.00`.
- Gliss category is `Leave-in`, price `4.49`, leave-in fit is `light`, `booster_only`, with heat/repair/smoothing benefits.
- Gliss has `has_conditioner_specs=false` and `has_conditioner_rerank_specs=false`.

- [ ] **Step 4: Verify binary full-catalog status before later NOT NULL migration**

Run this SQL before creating/applying the later generated full-catalog status backfill migration with `ALTER COLUMN ... SET NOT NULL`:

```sql
SELECT purchase_link_status, count(*)
FROM public.products
GROUP BY purchase_link_status
ORDER BY purchase_link_status;
```

Expected:

- only `available` and `unavailable` appear
- no `NULL`
- no `unknown`

Availability definition:

- `available` means the stored link is online-buyable at the time of the audit.
- `unavailable` means the stored link is not online-buyable at the time of the audit.
- Store-only availability, wishlist-only pages, and `online nicht verfügbar` count as `unavailable`.

### Task 3: Preserve Commercial Metadata During Ingestion

**Files:**

- Create: `data/product-metadata-audit/product-id-aliases.json`
- Modify: `scripts/ingest-products.ts`
- Test: add focused tests if ingestion helpers are extracted; otherwise verify with dry-run/manual mocked input.

- [ ] **Step 1: Create reviewed product identity aliases**

Create `data/product-metadata-audit/product-id-aliases.json`:

```json
[
  {
    "id": "11d42d9d-b8d8-42ae-a432-9a3d0f9d3504",
    "aliases": [
      { "name": "Guhl Panthenol*", "category": "Conditioner (Drogerie)" },
      { "name": "Guhl Panthenol", "category": "Conditioner (Drogerie)" },
      { "name": "Guhl Panthenol + Reparatur 2in1 Kur & Spülung", "category": "Conditioner (Drogerie)" }
    ]
  },
  {
    "id": "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0",
    "aliases": [
      { "name": "Gliss Ultimate Repair Spülung", "category": "Conditioner (Drogerie)" },
      { "name": "Gliss Ultimate Repair Express-Repair-Spülung", "category": "Leave-in" },
      { "name": "Gliss Ultimate Repair Sprüh-Conditioner", "category": "Leave-in" }
    ]
  },
  {
    "id": "4827c174-92e9-4121-ab70-843d5c037ad0",
    "aliases": [
      { "name": "Olaplex No.5 Leave-In", "category": "Leave-in" },
      { "name": "Original OLAPLEX N°5LEAVE-IN Conditioner", "category": "Leave-in" }
    ]
  }
]
```

- [ ] **Step 2: Extend product input with optional id**

In `scripts/ingest-products.ts`, extend `ProductInput`:

```ts
interface ProductInput {
  id?: string
  name: string
  // existing fields stay unchanged
}
```

When parsing CSV, read optional `id`:

```ts
id: obj.id || undefined,
```

- [ ] **Step 3: Add identity and commercial-field helpers**

In `scripts/ingest-products.ts`, add a helper near `normalizeProductInput`:

```ts
type ProductIdentityAlias = {
  id: string
  aliases: Array<{ name: string; category: string | null }>
}

type CommercialProductFields = {
  affiliate_link?: string | null
  image_url?: string | null
  price_eur?: number | null
}

function mergeCommercialFields(
  existing: CommercialProductFields | null,
  incoming: CommercialProductFields,
  forceCommercialOverwrite: boolean,
): Required<CommercialProductFields> {
  if (forceCommercialOverwrite) {
    return {
      affiliate_link: incoming.affiliate_link ?? null,
      image_url: incoming.image_url ?? null,
      price_eur: incoming.price_eur ?? null,
    }
  }

  return {
    affiliate_link: incoming.affiliate_link ?? existing?.affiliate_link ?? null,
    image_url: incoming.image_url ?? existing?.image_url ?? null,
    price_eur: incoming.price_eur ?? existing?.price_eur ?? null,
  }
}

function productIdentityKey(name: string, category: string | null | undefined): string {
  return `${name.trim().toLowerCase()}|||${category?.trim().toLowerCase() ?? ""}`
}

function loadProductIdentityAliases(): Map<string, string> {
  const file = path.join(process.cwd(), "data", "product-metadata-audit", "product-id-aliases.json")
  if (!fs.existsSync(file)) return new Map()

  const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as ProductIdentityAlias[]
  const aliases = new Map<string, string>()

  for (const row of parsed) {
    for (const alias of row.aliases) {
      aliases.set(productIdentityKey(alias.name, alias.category), row.id)
    }
  }

  return aliases
}
```

- [ ] **Step 4: Resolve existing product identity before writing**

Before processing the loop, load aliases and the force flag:

```ts
const forceCommercialOverwrite = process.env.FORCE_COMMERCIAL_METADATA_OVERWRITE === "1"
const identityAliases = loadProductIdentityAliases()
```

Inside the product loop, resolve the target product id by explicit source id first, reviewed alias second, and `name,category` only as a fallback:

```ts
async function findExistingProduct(product: ProductInput): Promise<
  | {
      id: string
      affiliate_link: string | null
      image_url: string | null
      price_eur: number | null
    }
  | null
> {
  const aliasedId =
    product.id ?? identityAliases.get(productIdentityKey(product.name, product.category ?? null))

  if (aliasedId) {
    const { data, error } = await supabase
      .from("products")
      .select("id, affiliate_link, image_url, price_eur")
      .eq("id", aliasedId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to read existing product id ${aliasedId}: ${error.message}`)
    }
    return data
  }

  let query = supabase
    .from("products")
    .select("id, affiliate_link, image_url, price_eur")
    .eq("name", product.name)

  query =
    product.category == null
      ? query.is("category", null)
      : query.eq("category", product.category)

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(`Failed to read existing product ${product.name}: ${error.message}`)
  }
  return data
}
```

Use it before merging fields:

```ts
const existingProduct = await findExistingProduct(product)

const commercialFields = mergeCommercialFields(
  existingProduct,
  {
    affiliate_link: product.affiliate_link,
    image_url: product.image_url,
    price_eur: product.price_eur,
  },
  forceCommercialOverwrite,
)
```

- [ ] **Step 5: Update by id when an existing product is resolved**

If `existingProduct?.id` exists, update that product by id instead of upserting by `name,category`. If no existing product is resolved, keep the existing insert/upsert behavior for new products.

```ts
const productPayload = {
  name: product.name,
  brand: product.brand || null,
  description,
  category: product.category || null,
  affiliate_link: commercialFields.affiliate_link,
  image_url: commercialFields.image_url,
  price_eur: commercialFields.price_eur,
  tags: product.tags || [],
  suitable_thicknesses: product.suitable_thicknesses || [],
  suitable_concerns: product.suitable_concerns || [],
  is_active: product.is_active ?? true,
  sort_order: product.sort_order ?? i,
  embedding: JSON.stringify(embedding),
}

const writeQuery = existingProduct?.id
  ? supabase.from("products").update(productPayload).eq("id", existingProduct.id)
  : supabase.from("products").upsert(productPayload, { onConflict: "name,category" })

const { data: upsertedProduct, error } = await writeQuery.select("id, category").single()
```

- [ ] **Step 6: Guard legacy leave-in spec deletion**

The recommendation engine still reads `product_leave_in_specs`, while the current ingestion script deletes that table for every leave-in row after writing `product_leave_in_fit_specs`. The script currently has no write path that repopulates `product_leave_in_specs`; it only deletes. Change that behavior:

```ts
const shouldReplaceLegacyLeaveInSpecs =
  product.leave_in_specs != null || process.env.REPLACE_LEGACY_LEAVE_IN_SPECS === "1"
```

Only delete `product_leave_in_specs` inside the leave-in block when `shouldReplaceLegacyLeaveInSpecs` is true. The canonical `product_leave_in_fit_specs` upsert can still run for every leave-in product. Do not add a new legacy-spec write path in HAI-124 unless recommendation selection is also updated and tested.

- [ ] **Step 7: Add dry-run logging for preserved commercial fields**

When the source omits a field but the existing row preserves it, log:

```ts
if (!forceCommercialOverwrite) {
  if (!product.affiliate_link && commercialFields.affiliate_link) {
    console.log(`  Preserved affiliate_link for ${product.name}`)
  }
  if (!product.image_url && commercialFields.image_url) {
    console.log(`  Preserved image_url for ${product.name}`)
  }
  if (product.price_eur == null && commercialFields.price_eur != null) {
    console.log(`  Preserved price_eur for ${product.name}`)
  }
}
```

- [ ] **Step 8: Run checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both pass.

Note: `scripts/` are excluded from `tsconfig.json`, so `npm run typecheck` does not type-check `scripts/ingest-products.ts`. `npm run lint` and direct `tsx` execution are the verification paths for script edits.

### Task 4: Confirm Existing URL Gate Coverage

**Files:**

- Inspect: `src/lib/affiliate-research/url-gate.ts`
- Modify: `tests/affiliate-research-url-gate.test.ts`

- [ ] **Step 1: Keep one host verdict source**

Use the existing `urlGate` helper for audit host verdicts. Do not add `preferredHostLane` or `shouldPreferCandidatePrice` in this implementation; the audit does not consume a ranked shop lane yet, and `urlGate` already accepts allowed retailers plus brand-direct hosts.

- [ ] **Step 2: Add a regression test for brand-direct links**

Add to `tests/affiliate-research-url-gate.test.ts` if not already covered:

```ts
test("urlGate accepts official brand-direct Olaplex URLs", () => {
  const res = urlGate({
    chosen_url: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
    brand: "Olaplex",
  })

  assert.equal(res.pass, true)
})
```

- [ ] **Step 3: Run node tests**

Run:

```bash
npm run test:node
```

Expected: URL gate tests pass.

### Task 5: Add Product Metadata Health Helpers

**Files:**

- Create: `data/product-metadata-audit/known-price-checks.json`
- Create: `src/lib/product-metadata/health.ts`
- Create: `tests/product-metadata-health.test.ts`

- [ ] **Step 1: Create known-price watchlist**

Create `data/product-metadata-audit/known-price-checks.json`:

```json
[
  {
    "id": "11d42d9d-b8d8-42ae-a432-9a3d0f9d3504",
    "expected_price_eur": 4.95,
    "max_delta_eur": 0.05,
    "source_url": "https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/"
  },
  {
    "id": "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0",
    "expected_price_eur": 4.49,
    "max_delta_eur": 0.05,
    "source_url": "https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-express-repair-spuelung/p/4015100813494"
  },
  {
    "id": "4827c174-92e9-4121-ab70-843d5c037ad0",
    "expected_price_eur": 34,
    "max_delta_eur": 0.05,
    "source_url": "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner"
  },
  {
    "id": "a1d705b4-b973-486d-b853-2c795b6db681",
    "expected_price_eur": 26.99,
    "max_delta_eur": 0.05,
    "source_url": "https://www.douglas.de/de/p/5010218791"
  },
  {
    "id": "514ffd65-e4a5-4f7f-96c5-0f194e3b3b36",
    "expected_price_eur": 34.19,
    "max_delta_eur": 0.05,
    "source_url": "https://www.douglas.de/de/p/5011380000"
  },
  {
    "id": "6513692a-b54f-4acc-9c77-5799d3dd200c",
    "expected_price_eur": 32.2,
    "max_delta_eur": 0.05,
    "source_url": "https://www.notino.de/malibu-c/hard-water-wallness-tiefenreinigendes-shampoo/"
  },
  {
    "id": "6d6c3ff2-9d12-4f27-a56f-b5b72cf53318",
    "expected_price_eur": 25.67,
    "max_delta_eur": 0.05,
    "source_url": "https://www.notino.de/bumble-and-bumble/bb-sunday-shampoo-reinigendes-detox-shampoo/"
  }
]
```

- [ ] **Step 2: Create helper module**

Create `src/lib/product-metadata/health.ts`:

```ts
import { isUsableUrl, urlGate } from "../affiliate-research/url-gate"

export type ProductMetadataAuditInput = {
  id: string
  name: string
  brand: string | null
  category: string | null
  affiliate_link: string | null
  image_url: string | null
  price_eur: number | string | null
  purchase_link_status: "available" | "unavailable" | null
  is_active: boolean | null
}

export type ExpectedPriceCheck = {
  id: string
  expected_price_eur: number
  max_delta_eur: number
  source_url: string
}

export type ProductMetadataFinding =
  | "suspicious_name_marker"
  | "missing_affiliate_link"
  | "denylisted_host"
  | "unapproved_host"
  | "missing_price"
  | "stale_price"
  | "missing_image"
  | "unavailable"

const SUSPICIOUS_NAME_MARKERS = /[*†‡#]/

export function hasSuspiciousNameMarker(name: string): boolean {
  return SUSPICIOUS_NAME_MARKERS.test(name)
}

export function numericPrice(value: number | string | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

export function hasStalePrice(
  row: ProductMetadataAuditInput,
  expected: ExpectedPriceCheck | undefined,
): boolean {
  if (!expected) return false
  const current = numericPrice(row.price_eur)
  if (current == null) return false
  return Math.abs(current - expected.expected_price_eur) > expected.max_delta_eur
}

export function auditProductMetadata(
  row: ProductMetadataAuditInput,
  expected?: ExpectedPriceCheck,
): ProductMetadataFinding[] {
  const findings: ProductMetadataFinding[] = []

  if (hasSuspiciousNameMarker(row.name)) findings.push("suspicious_name_marker")
  if (!isUsableUrl(row.affiliate_link)) {
    findings.push("missing_affiliate_link")
  } else {
    const verdict = urlGate({
      chosen_url: row.affiliate_link,
      brand: row.brand,
    })
    if (!verdict.pass) {
      if (verdict.reason.includes("denylisted")) findings.push("denylisted_host")
      else findings.push("unapproved_host")
    }
  }

  if (numericPrice(row.price_eur) == null) findings.push("missing_price")
  if (hasStalePrice(row, expected)) findings.push("stale_price")
  if (!row.image_url?.trim()) findings.push("missing_image")
  if (row.purchase_link_status === "unavailable") findings.push("unavailable")

  return findings
}
```

- [ ] **Step 3: Add unit tests**

Create `tests/product-metadata-health.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  auditProductMetadata,
  hasSuspiciousNameMarker,
  hasStalePrice,
  numericPrice,
} from "../src/lib/product-metadata/health"

test("hasSuspiciousNameMarker flags footnote artifacts", () => {
  assert.equal(hasSuspiciousNameMarker("Guhl Panthenol*"), true)
  assert.equal(hasSuspiciousNameMarker("Olaplex No.5 Leave-In"), false)
})

test("numericPrice accepts numbers and German decimal strings", () => {
  assert.equal(numericPrice(4.99), 4.99)
  assert.equal(numericPrice("4,99"), 4.99)
  assert.equal(numericPrice(""), null)
})

test("auditProductMetadata reports known metadata issues", () => {
  const findings = auditProductMetadata({
    id: "p1",
    name: "Guhl Panthenol*",
    brand: "Guhl",
    category: "Conditioner (Drogerie)",
    affiliate_link: "https://geizhals.de/foo",
    image_url: null,
    price_eur: null,
    purchase_link_status: "unavailable",
    is_active: true,
  })

  assert.deepEqual(findings.sort(), [
    "denylisted_host",
    "missing_image",
    "missing_price",
    "suspicious_name_marker",
    "unavailable",
  ].sort())
})

test("hasStalePrice flags watched price drift", () => {
  assert.equal(
    hasStalePrice(
      {
        id: "p1",
        name: "Olaplex No.5 Leave-In",
        brand: "Olaplex",
        category: "Leave-in",
        affiliate_link: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
        image_url: "https://example.com/image.jpg",
        price_eur: 19.65,
        purchase_link_status: "available",
        is_active: true,
      },
      {
        id: "p1",
        expected_price_eur: 34,
        max_delta_eur: 0.05,
        source_url: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
      },
    ),
    true,
  )
})
```

- [ ] **Step 4: Run node tests**

Run:

```bash
npm run test:node
```

Expected: metadata health tests pass.

### Task 6: Add Read-Only Product Metadata Audit Command

**Files:**

- Create: `scripts/audit-product-metadata.ts`
- Modify if useful: `package.json`

- [ ] **Step 1: Create audit script**

Create `scripts/audit-product-metadata.ts`:

```ts
import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"

import {
  auditProductMetadata,
  type ExpectedPriceCheck,
  type ProductMetadataAuditInput,
} from "../src/lib/product-metadata/health"
import { hostOf, isUsableUrl } from "../src/lib/affiliate-research/url-gate"

loadEnv({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type AuditRow = ProductMetadataAuditInput & {
  findings: string[]
}

type PurchaseLinkProposalRow = AuditRow & {
  checked_purchase_link_status: "available" | "unavailable" | null
  replacement_affiliate_link: string | null
  replacement_price_eur: number | null
  replacement_purchase_link_status: "available" | null
  replacement_evidence: string | null
  review_action: "keep_link" | "replace_link" | "manual_review"
}

function csvEscape(value: unknown): string {
  const raw = Array.isArray(value) ? value.join(";") : String(value ?? "")
  return `"${raw.replace(/"/g, '""')}"`
}

function loadExpectedPriceChecks(): Map<string, ExpectedPriceCheck> {
  const file = path.join(process.cwd(), "data", "product-metadata-audit", "known-price-checks.json")
  if (!fs.existsSync(file)) return new Map()

  const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as ExpectedPriceCheck[]
  return new Map(parsed.map((row) => [row.id, row]))
}

async function fetchProducts(): Promise<ProductMetadataAuditInput[]> {
  const rows: ProductMetadataAuditInput[] = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,brand,category,affiliate_link,image_url,price_eur,purchase_link_status,is_active")
      .order("category", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...(data as ProductMetadataAuditInput[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function checkStoredLinkBuyability(
  row: ProductMetadataAuditInput,
): Promise<"available" | "unavailable" | null> {
  if (!isUsableUrl(row.affiliate_link)) return "unavailable"

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let response: Response
  try {
    response = await fetch(row.affiliate_link as string, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Hair Concierge product metadata audit; contact: product-data-review",
      },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) return null

  const html = (await response.text()).toLowerCase()
  const host = hostOf(response.url)

  if (host.includes("rossmann.de")) {
    if (html.includes("online momentan nicht verfügbar")) return "unavailable"
    if (html.includes("in den warenkorb")) return "available"
    return null
  }

  if (host.includes("mueller.de")) {
    if (html.includes("lieferbar") && html.includes("in den warenkorb")) return "available"
    return null
  }

  if (host.includes("dm.de")) {
    if (html.includes("nicht online verfügbar") || html.includes("online nicht verfügbar")) {
      return "unavailable"
    }
    if (html.includes("lieferbar") || html.includes("in den warenkorb")) return "available"
    return null
  }

  if (
    host.includes("douglas.de") ||
    host.includes("notino.de") ||
    host.includes("flaconi.de") ||
    host.includes("olaplex.de")
  ) {
    if (
      html.includes("nicht lieferbar") ||
      html.includes("ausverkauft") ||
      html.includes("demnächst wieder lieferbar") ||
      html.includes("out of stock")
    ) {
      return "unavailable"
    }
    if (
      html.includes("in den warenkorb") ||
      html.includes("in den warenkorb legen") ||
      html.includes("in stock") ||
      html.includes("lieferbar")
    ) {
      return "available"
    }
    return null
  }

  return null
}

function writeOutputs(rows: AuditRow[], proposalRows: PurchaseLinkProposalRow[]): void {
  const outDir = path.join(process.cwd(), "tmp", "product-metadata-audit")
  fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(
    path.join(outDir, "product-metadata-audit.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  )

  const header = ["id", "category", "brand", "name", "price_eur", "purchase_link_status", "affiliate_link", "findings"]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.category,
        row.brand,
        row.name,
        row.price_eur,
        row.purchase_link_status,
        row.affiliate_link,
        row.findings,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ]

  fs.writeFileSync(path.join(outDir, "product-metadata-audit.csv"), `${lines.join("\n")}\n`)

  fs.writeFileSync(
    path.join(outDir, "purchase-link-review-proposal.json"),
    `${JSON.stringify(proposalRows, null, 2)}\n`,
  )

  const proposalHeader = [
    "id",
    "category",
    "brand",
    "name",
    "affiliate_link",
    "price_eur",
    "checked_purchase_link_status",
    "replacement_affiliate_link",
    "replacement_price_eur",
    "replacement_purchase_link_status",
    "replacement_evidence",
    "review_action",
  ]
  const proposalLines = [
    proposalHeader.join(","),
    ...proposalRows.map((row) =>
      [
        row.id,
        row.category,
        row.brand,
        row.name,
        row.affiliate_link,
        row.price_eur,
        row.checked_purchase_link_status,
        row.replacement_affiliate_link,
        row.replacement_price_eur,
        row.replacement_purchase_link_status,
        row.replacement_evidence,
        row.review_action,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ]

  fs.writeFileSync(
    path.join(outDir, "purchase-link-review-proposal.csv"),
    `${proposalLines.join("\n")}\n`,
  )
}

async function main(): Promise<void> {
  const products = await fetchProducts()
  const expectedPrices = loadExpectedPriceChecks()
  const audited = products
    .map((row) => ({
      ...row,
      findings: auditProductMetadata(row, expectedPrices.get(row.id)),
    }))

  const proposalRows: PurchaseLinkProposalRow[] = []
  for (const row of audited) {
    const checkedStatus = await checkStoredLinkBuyability(row)
    const isGuhl = row.id === "11d42d9d-b8d8-42ae-a432-9a3d0f9d3504"

    proposalRows.push({
      ...row,
      checked_purchase_link_status: checkedStatus,
      replacement_affiliate_link: isGuhl
        ? "https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/"
        : null,
      replacement_price_eur: isGuhl ? 4.95 : null,
      replacement_purchase_link_status: isGuhl ? "available" : null,
      replacement_evidence: isGuhl
        ? "Müller exact 200 ml Guhl Panthenol + Reparatur 2in1 Kur & Spülung page, online buyable."
        : null,
      review_action: isGuhl ? "replace_link" : checkedStatus === "available" ? "keep_link" : "manual_review",
    })
  }

  const withFindings = audited.filter((row) => row.findings.length > 0)
  writeOutputs(withFindings, proposalRows)

  const counts = new Map<string, number>()
  for (const row of withFindings) {
    for (const finding of row.findings) counts.set(finding, (counts.get(finding) ?? 0) + 1)
  }

  console.log(`Audited ${audited.length} products.`)
  console.log(`Rows with findings: ${withFindings.length}`)
  for (const [finding, count] of Array.from(counts.entries()).sort()) {
    console.log(`- ${finding}: ${count}`)
  }
  console.log("Wrote tmp/product-metadata-audit/product-metadata-audit.{json,csv}")
  console.log("Wrote tmp/product-metadata-audit/purchase-link-review-proposal.{json,csv}")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Add npm script**

In `package.json`, add:

```json
"audit:products": "tsx scripts/audit-product-metadata.ts"
```

- [ ] **Step 3: Add retailer buyability checks before migration use**

Before using `purchase-link-review-proposal.csv` as migration input, implement and verify host-specific buyability checks for the stored links. Minimum HAI-124 behavior:

- Rossmann: `Online momentan nicht verfügbar` means `unavailable`; a visible online cart/order path means `available`.
- Müller: `Lieferbar in 2 - 3 Werktagen` plus `In den Warenkorb` means `available`.
- dm: deliverable/online orderable means `available`; online unavailable/store-only means `unavailable`.
- Douglas/Notino/Flaconi/brand direct: online in-stock/orderable means `available`; wishlist-only, out-of-stock, or future availability means `unavailable`.

For unavailable stored links, search favored shops for an exact same SKU/default size replacement. The script should write candidates to the proposal but must not update Supabase.

- [ ] **Step 4: Run audit locally**

Apply the schema migration from Task 1 before running this command; `scripts/audit-product-metadata.ts` selects `purchase_link_status`.

Run:

```bash
npm run audit:products
```

Expected:

- Command does not write to Supabase.
- Outputs are written under `tmp/product-metadata-audit/`.
- `purchase-link-review-proposal.csv` contains one row for every product.
- Each row has `checked_purchase_link_status='available'`, `checked_purchase_link_status='unavailable'`, or `checked_purchase_link_status=null` with `review_action='manual_review'`.
- `null` in the proposal means the script could not reliably determine buyability from the fetched page. It is not a product state and must be manually resolved before migration.
- Unavailable or indeterminate stored links either have a reviewed replacement candidate or `review_action='manual_review'`.
- Guhl proposes replacing the Rossmann URL with the Müller URL at `4.95 EUR` and `replacement_purchase_link_status='available'`.
- Findings include missing images until HAI-125 is done.
- Findings include no `Guhl Panthenol*` after the correction migration is applied.

Note: `scripts/` are excluded from `tsconfig.json`, so this script must be verified by `npm run lint` and by executing `npm run audit:products` after Task 1 schema migration is applied.

### Task 7: Add User-Facing Unavailable Link CTA

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/components/chat/product-display-model.ts`
- Modify: `src/components/chat/product-detail-drawer.tsx`
- Test: `tests/product-display-model.test.ts`

- [ ] **Step 1: Add product type field**

In `src/lib/types.ts`, add the field to `Product` if product columns are enumerated there:

```ts
purchase_link_status?: "available" | "unavailable" | null
```

Reason:

- The database migration makes persisted product rows binary and non-null after the approved status backfill.
- The TypeScript shape remains optional/null-tolerant so existing test fixtures and partial product projections do not all need immediate churn.
- UI logic treats only explicit `"unavailable"` as unavailable; omitted/null behaves like the normal CTA.

- [ ] **Step 2: Add display helper functions**

In `src/components/chat/product-display-model.ts`, add:

```ts
export const UNAVAILABLE_PURCHASE_LINK_HELPER =
  "Der hinterlegte Shop meldet den Artikel aktuell als online nicht verfügbar."

export function isPurchaseLinkUnavailable(product: Product): boolean {
  return product.purchase_link_status === "unavailable"
}

export function getProductShopCtaLabel(product: Product): string {
  if (isPurchaseLinkUnavailable(product)) {
    return "Shop-Link aktuell nicht verfügbar"
  }

  return getShopLabel(product.affiliate_link)
}

export function getPurchaseLinkHelperText(product: Product): string {
  return isPurchaseLinkUnavailable(product) ? UNAVAILABLE_PURCHASE_LINK_HELPER : ""
}
```

- [ ] **Step 3: Use helpers in the drawer footer**

In `src/components/chat/product-detail-drawer.tsx`, replace the current `shopLabel` usage with `getProductShopCtaLabel(product)` and render the helper text below the CTA area:

```tsx
const shopLabel = getProductShopCtaLabel(product)
const purchaseLinkHelperText = getPurchaseLinkHelperText(product)
```

In the footer, keep the anchor clickable and add:

```tsx
{purchaseLinkHelperText && (
  <p className="text-xs leading-5 text-muted-foreground">{purchaseLinkHelperText}</p>
)}
```

Expected drawer behavior:

- If `purchase_link_status='available'`: normal CTA, e.g. `Bei Müller kaufen`.
- If `purchase_link_status='unavailable'`: clickable CTA text `Shop-Link aktuell nicht verfügbar`.
- Helper text appears under/near the CTA only when unavailable: `Der hinterlegte Shop meldet den Artikel aktuell als online nicht verfügbar.`

- [ ] **Step 4: Add display-model tests**

In `tests/product-display-model.test.ts`, add coverage:

```ts
test("getProductShopCtaLabel uses unavailable link CTA copy", () => {
  const product = {
    ...createWellaLikeLeaveIn(),
    affiliate_link: "https://www.rossmann.de/de/p/example",
    purchase_link_status: "unavailable",
  }

  assert.equal(getProductShopCtaLabel(product), "Shop-Link aktuell nicht verfügbar")
  assert.equal(
    getPurchaseLinkHelperText(product),
    "Der hinterlegte Shop meldet den Artikel aktuell als online nicht verfügbar.",
  )
})

test("getProductShopCtaLabel keeps normal shop CTA for available links", () => {
  const product = {
    ...createWellaLikeLeaveIn(),
    affiliate_link: "https://www.mueller.de/p/example/",
    purchase_link_status: "available",
  }

  assert.equal(getProductShopCtaLabel(product), "Bei Müller kaufen")
  assert.equal(getPurchaseLinkHelperText(product), "")
})
```

- [ ] **Step 5: Run node tests**

Run:

```bash
npm run test:node
```

Expected: product display-model tests pass.

### Task 8: Document Sheet Alias Workflow

**Files:**

- Modify: `docs/hai-124-sheet-alias-review.md`
- Modify: `docs/hai-124-product-metadata-overview.md`

- [ ] **Step 1: Add owner workflow to alias doc**

Append this section to `docs/hai-124-sheet-alias-review.md`:

```md
## Review Workflow

1. Compare each relevant sheet tab against active production products.
2. Classify each non-exact name as `alias`, `successor`, `category_move`, `inactive_cut`, or `missing`.
3. Add reviewed aliases here before applying data migrations.
4. Use id-based updates for existing products.
5. Create new product rows only when no active or inactive production row represents the intended product.
```

- [ ] **Step 2: Add high-end scope statement**

In `docs/hai-124-product-metadata-overview.md`, keep the current finding that `HiE-*` tabs are largely absent and add:

```md
Decision: `HiE-*` products are not part of the HAI-124 correction batch unless beta scope explicitly expands to high-end/profi recommendations.
```

### Task 9: Final Verification And Shipping Gates

**Files:**

- No new files.

- [ ] **Step 1: Run node tests**

Run:

```bash
npm run test:node
```

Expected: node tests pass, including URL gate, metadata health, and product schema coverage.

- [ ] **Step 2: Run repo checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both pass.

- [ ] **Step 3: Run product audit**

Run:

```bash
npm run audit:products
```

Expected after correction migration:

- No active product has a suspicious `*` name marker.
- No active product has a deny-listed affiliate host except rows intentionally left for separate review.
- Every product row has binary `purchase_link_status`: `available` or `unavailable`.
- Missing images remain visible as HAI-125 follow-up.
- Guhl uses the approved Müller link, price `4.95`, and `purchase_link_status='available'`.
- Products with no approved buyable exact-SKU replacement remain active with `purchase_link_status='unavailable'`.

- [ ] **Step 4: Supabase migration gate**

Before merge, check the target Supabase migration state for:

- `20260609203400_product_metadata_health_fields`
- `20260609204000_hai_124_product_metadata_corrections`

Expected: each migration is either applied intentionally before app-code merge or clearly listed as unapplied in the handoff. Do not merge app code that expects binary non-null `purchase_link_status` until the schema and approved status backfill migration are applied.

- [ ] **Step 5: Run the final review gate before shipping**

After local checks pass, run the available repo review gate for this thread. If an `autoreview` skill/tool is available in the execution environment, use it; otherwise use the repo-standard code-review path available to the agent, such as `code-reviewer` or `request-code-review`. Fix accepted findings, rerun relevant checks, then ask for explicit user approval before committing, pushing, or opening a PR.

## Execution Handoff

Recommended execution mode: `superpowers:subagent-driven-development`.

Reason: Tasks 1-2, 3-6, and 7-8 are separable enough for staged implementation and review checkpoints, while the data migration needs careful human-visible validation before production application.
