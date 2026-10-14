import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase", "migrations")
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_catalog_authority_schema_foundations.sql"),
)

assert.ok(migrationFile, "catalogue authority schema foundations migration is missing")

const sql = readFileSync(join(migrationsDir, migrationFile), "utf8")
const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase()
const schemaAuditSql = readFileSync(
  join(process.cwd(), "scripts", "catalog-authority", "schema-audit.sql"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase()

const categoryTables = {
  product_shampoo_specs: "shampoo",
  product_conditioner_specs: "conditioner",
  product_conditioner_rerank_specs: "conditioner",
  product_leave_in_specs: "leave_in",
  product_leave_in_eligibility: "leave_in",
  product_heat_protectant_specs: "heat_protectant",
  product_oil_specs: "oil",
  product_oil_eligibility: "oil",
  product_mask_specs: "mask",
  product_scalp_care_specs: "scalp_care",
  product_dry_shampoo_specs: "dry_shampoo",
  product_bondbuilder_specs: "bondbuilder",
  product_deep_cleansing_shampoo_specs: "deep_cleansing_shampoo",
} as const

function assertSql(fragment: string) {
  const pattern = fragment
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+")
  assert.match(normalizedSql, new RegExp(pattern, "i"))
}

test("migration creates normalized service-only eligibility relations", () => {
  for (const table of ["product_thickness_eligibility", "product_concern_eligibility"]) {
    assertSql(`create table public.${table}`)
    assertSql(`alter table public.${table} enable row level security`)
    assertSql(`revoke all on table public.${table} from public, anon, authenticated`)
    assertSql(`grant select, insert, update, delete on table public.${table} to service_role`)
  }

  assertSql("primary key (product_id, category_key, thickness)")
  assertSql("primary key (product_id, category_key, concern_key)")
  assertSql("check (thickness in ('fine', 'normal', 'coarse'))")
  assertSql("check (length(btrim(concern_key)) > 0)")
})

test("migration backfills eligibility idempotently from legacy arrays and category-valid tuples", () => {
  assertSql("cross join lateral unnest(coalesce(product.suitable_thicknesses, '{}'::text[]))")
  assertSql("cross join lateral unnest(coalesce(product.suitable_concerns, '{}'::text[]))")
  assertSql("on conflict (product_id, category_key, thickness) do nothing")
  assertSql("on conflict (product_id, category_key, concern_key) do nothing")

  for (const [table, category] of [
    ["product_shampoo_specs", "shampoo"],
    ["product_conditioner_specs", "conditioner"],
    ["product_leave_in_eligibility", "leave_in"],
    ["product_oil_eligibility", "oil"],
  ] as const) {
    assert.match(
      normalizedSql,
      new RegExp(
        `from public\\.${table}[^;]+join public\\.products[^;]+category_key = '${category}'`,
        "i",
      ),
    )
  }
})

test("migration establishes the product spine keys in expand-before-validate order", () => {
  assertSql("validate constraint products_origin_check")
  assertSql("validate constraint products_category_key_fkey")
  assertSql("add constraint products_id_category_key_key unique (id, category_key)")
  assert.match(
    normalizedSql,
    /add constraint products_category_key_not_null_check check \(category_key is not null\) not valid/,
  )
  assert.doesNotMatch(normalizedSql, /validate constraint products_category_key_not_null_check/)
  assert.doesNotMatch(normalizedSql, /alter column category_key set not null/)
  assert.doesNotMatch(normalizedSql, /category\.is_catalog_supported = true/)
})

test("every category fact table carries constant identity and an unvalidated composite FK", () => {
  for (const [table, category] of Object.entries(categoryTables)) {
    assert.match(
      normalizedSql,
      new RegExp(
        `alter table public\\.${table}[^;]+add column category_key text[^;]+not null[^;]+default '${category}'`,
        "i",
      ),
    )
    assert.match(
      normalizedSql,
      new RegExp(
        `constraint ${table}_category_key_check check \\(category_key = '${category}'\\)`,
        "i",
      ),
    )
    assert.match(
      normalizedSql,
      new RegExp(
        `constraint ${table}_product_category_fkey foreign key \\(product_id, category_key\\) references public\\.products\\(id, category_key\\) on update restrict on delete cascade not valid`,
        "i",
      ),
    )
    assertSql(
      `create index ${table}_product_category_idx on public.${table} (product_id, category_key)`,
    )
    assert.doesNotMatch(
      normalizedSql,
      new RegExp(`validate constraint ${table}_product_category_fkey`, "i"),
    )
  }
})

test("the schema receipt inspects supporting indexes and both eligibility FK layers", () => {
  assert.match(schemaAuditSql, /from pg_catalog\.pg_index/)
  assert.match(schemaAuditSql, /product\\_%\\_product\\_category\\_idx/)
  assert.match(schemaAuditSql, /product\\_%\\_thickness\\_eligibility\\_fkey/)
})

test("exact protocols assert their indexed category against product identity", () => {
  assertSql(
    "alter table public.product_application_protocols add column category_key text generated always as (category) stored",
  )
  assert.doesNotMatch(normalizedSql, /product_application_protocols_category_key_check/)
  assertSql(
    "constraint product_application_protocols_product_category_fkey foreign key (product_id, category_key) references public.products(id, category_key) on update restrict on delete cascade not valid",
  )
})

test("contextual thickness rows reference normalized eligibility without validating historical debt", () => {
  for (const table of [
    "product_shampoo_specs",
    "product_conditioner_specs",
    "product_leave_in_eligibility",
    "product_oil_eligibility",
  ]) {
    assertSql(
      `constraint ${table}_thickness_eligibility_fkey foreign key (product_id, category_key, thickness) references public.product_thickness_eligibility(product_id, category_key, thickness) on update restrict on delete no action deferrable initially deferred not valid`,
    )
    assert.doesNotMatch(
      normalizedSql,
      new RegExp(`validate constraint ${table}_thickness_eligibility_fkey`, "i"),
    )
  }
})

test("expand-phase compatibility keeps existing product and contextual writers valid", () => {
  assertSql(
    "create function public.catalog_authority_set_category_key_compat_v1() returns trigger language plpgsql security definer set search_path = ''",
  )
  assertSql(
    "create trigger catalog_authority_set_category_key_compat_v1 before insert on public.products",
  )
  assertSql(
    "new.category_key := case pg_catalog.lower(pg_catalog.btrim(coalesce(new.category, '')))",
  )

  assertSql(
    "create function public.catalog_authority_sync_product_eligibility_compat_v1() returns trigger language plpgsql security definer set search_path = ''",
  )
  assertSql(
    "create trigger aa_catalog_authority_sync_product_eligibility_compat_v1 after insert or update of suitable_thicknesses, suitable_concerns on public.products",
  )
  assertSql(
    "create trigger zz_catalog_authority_sync_product_eligibility_compat_v1 after insert or update of suitable_thicknesses, suitable_concerns on public.products",
  )
  assertSql("if tg_name like 'zz_%' then")
  assertSql("new.category_key not in ('heat_protectant', 'dry_shampoo', 'scalp_care')")
  assertSql(
    "create function public.catalog_authority_sync_contextual_thickness_compat_v1() returns trigger language plpgsql security definer set search_path = ''",
  )
  assertSql(
    "create function public.catalog_authority_prune_contextual_thickness_compat_v1() returns trigger language plpgsql security definer set search_path = ''",
  )

  for (const table of [
    "product_shampoo_specs",
    "product_conditioner_specs",
    "product_leave_in_eligibility",
    "product_oil_eligibility",
  ]) {
    assertSql(
      `create trigger catalog_authority_sync_contextual_thickness_compat_v1 before insert or update of product_id, category_key, thickness on public.${table}`,
    )
    assertSql(
      `create trigger catalog_authority_prune_contextual_thickness_compat_v1 after delete or update of product_id, category_key, thickness on public.${table}`,
    )
  }

  for (const signature of [
    "public.catalog_authority_set_category_key_compat_v1()",
    "public.catalog_authority_sync_product_eligibility_compat_v1()",
    "public.catalog_authority_sync_contextual_thickness_compat_v1()",
    "public.catalog_authority_prune_contextual_thickness_compat_v1()",
  ]) {
    assertSql(`revoke all on function ${signature} from public, anon, authenticated`)
  }
})
