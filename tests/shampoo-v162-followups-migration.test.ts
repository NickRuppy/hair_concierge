import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { buildExpansionProtocolRow } from "@/lib/product-intake/expansion-apply-templates"
import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"

const A50 = "7e95671b-41a7-4f5c-9188-e535e46678ba"
const NEQI = "64fb44d5-8701-46ab-bcba-f1747f071e48"
const read = (path: string) => readFileSync(path, "utf8")
const migration = read("supabase/migrations/20261013150000_shampoo_v162_followups.sql")
const rollback = read("plans/shampoo-v162-followups/rollback.sql")
const plan = JSON.parse(read("plans/shampoo-v16-rollout/track-a/apply/apply-plan.json")) as {
  target: Record<string, { rows: string[][] }>
}
const ids = [...Object.keys(plan.target), A50].sort()

function repoFunction(file: string, name: string): string {
  const source = read(`supabase/migrations/${file}.sql`)
  const match = source.match(
    new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]*?\\$function\\$;`),
  )
  assert.ok(match, name)
  return match[0]
}

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  // Entirely in-process WASM Postgres; no connection, network, or persisted DB.
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE products (
      id uuid PRIMARY KEY, name text, brand text, category_key text DEFAULT 'shampoo',
      suitable_thicknesses text[], suitable_concerns text[], description text, short_description text,
      affiliate_link text, purchase_link_status text, purchase_link_checked_at timestamptz,
      updated_at timestamptz DEFAULT now(), origin text DEFAULT 'user', is_active boolean DEFAULT false,
      lifecycle_status text DEFAULT 'active', is_chaarlie_recommended boolean DEFAULT false
    );
    CREATE TABLE product_thickness_eligibility (
      product_id uuid, category_key text, thickness text, created_at timestamptz DEFAULT now(),
      PRIMARY KEY(product_id, category_key, thickness)
    );
    CREATE TABLE product_concern_eligibility (
      product_id uuid, category_key text, concern_key text, created_at timestamptz DEFAULT now(),
      PRIMARY KEY(product_id, category_key, concern_key)
    );
    CREATE TABLE product_shampoo_specs (
      product_id uuid, category_key text DEFAULT 'shampoo', thickness text, shampoo_bucket text,
      scalp_route text, cleansing_intensity text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
      PRIMARY KEY(product_id, thickness, shampoo_bucket),
      FOREIGN KEY(product_id,category_key,thickness) REFERENCES product_thickness_eligibility
        DEFERRABLE INITIALLY DEFERRED
    );
    CREATE TABLE product_application_protocols (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid, category text, role text, cadence jsonb,
      application_stage text, application_state text, placement text, contact_time_seconds integer,
      rinse_action text, reapplication text, instruction_modifiers jsonb DEFAULT '[]',
      source_label text, source_url text, source_text text, guidance_payload jsonb, guidance_payload_v2 jsonb,
      category_key text GENERATED ALWAYS AS (category) STORED,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE personal_plan_product_search_dispositions (product_id uuid);
    CREATE TABLE product_conditioner_specs (product_id uuid, category_key text, thickness text, protein_moisture_balance text);
    CREATE TABLE product_conditioner_rerank_specs (product_id uuid, weight text, repair_level text, balance_direction text);
    CREATE TABLE product_leave_in_specs (product_id uuid, weight text, plan_roles text[], application_stage text[], provides_heat_protection boolean);
    CREATE TABLE product_leave_in_eligibility (product_id uuid, category_key text, thickness text);
    CREATE TABLE product_mask_specs (product_id uuid, weight text);
    CREATE TABLE product_oil_eligibility (product_id uuid, category_key text, thickness text, oil_subtype text);
    CREATE TABLE product_oil_specs (product_id uuid, role_support text[]);
    CREATE TABLE product_dry_shampoo_specs (product_id uuid, primary_effect text, hair_color_fit text, scalp_sensitivity_fit text, format text);
    CREATE TABLE product_deep_cleansing_shampoo_specs (product_id uuid, reset_focus text);
    CREATE TABLE product_bondbuilder_specs (product_id uuid, application_mode text, treatment_mode text, product_format text, usage_protocol text);
    CREATE TABLE product_heat_protectant_specs (product_id uuid, provides_heat_protection boolean);
    CREATE TABLE product_scalp_care_specs (product_id uuid, primary_role text, presentation_format text, rinse_mode text);
  `)
  const foundations = "20260815083332_catalog_authority_schema_foundations"
  for (const name of [
    "catalog_authority_sync_product_eligibility_compat_v1",
    "catalog_authority_sync_contextual_thickness_compat_v1",
    "catalog_authority_prune_contextual_thickness_compat_v1",
  ]) {
    await pg.exec(repoFunction(foundations, name))
  }
  await pg.exec(
    repoFunction(
      "20260814120000_personal_plan_application_use_case_variants",
      "personal_plan_application_family_identity_v1",
    ),
  )
  await pg.exec(`
    ALTER TABLE product_application_protocols ADD COLUMN application_family text GENERATED ALWAYS AS
      (public.personal_plan_application_family_identity_v1(role,guidance_payload,guidance_payload_v2)) STORED;
    CREATE UNIQUE INDEX protocol_identity ON product_application_protocols(product_id,category,role,application_family);
    CREATE TRIGGER aa_catalog_authority_sync_product_eligibility_compat_v1 AFTER INSERT OR UPDATE OF suitable_thicknesses,suitable_concerns ON products
      FOR EACH ROW EXECUTE FUNCTION catalog_authority_sync_product_eligibility_compat_v1();
    CREATE TRIGGER zz_catalog_authority_sync_product_eligibility_compat_v1 AFTER INSERT OR UPDATE OF suitable_thicknesses,suitable_concerns ON products
      FOR EACH ROW EXECUTE FUNCTION catalog_authority_sync_product_eligibility_compat_v1();
    CREATE TRIGGER sync_specs BEFORE INSERT OR UPDATE OF product_id,category_key,thickness ON product_shampoo_specs
      FOR EACH ROW EXECUTE FUNCTION catalog_authority_sync_contextual_thickness_compat_v1();
    CREATE TRIGGER prune_specs AFTER DELETE OR UPDATE OF product_id,category_key,thickness ON product_shampoo_specs
      FOR EACH ROW EXECUTE FUNCTION catalog_authority_prune_contextual_thickness_compat_v1();
  `)
  for (const id of ids) {
    await pg.query(
      `INSERT INTO products(id,name,brand,suitable_thicknesses,suitable_concerns,description,short_description,affiliate_link)
      VALUES ($1,'Fixture','Brand',ARRAY['fine'],ARRAY['trocken'],'Old: empfohlen für','Keep short',$2)`,
      [
        id,
        id === NEQI
          ? "https://www.hagel-shop.de/neqi-volume-victory-shampoo-330-ml-12129028.html?___store=hagel_de"
          : "keep-link",
      ],
    )
    const rows =
      id === A50 ? [["fine", "dehydriert-fettig", "oily", "regular"]] : plan.target[id].rows
    for (const [thickness, bucket, route, intensity] of rows) {
      await pg.query(
        "INSERT INTO product_shampoo_specs(product_id,thickness,shampoo_bucket,scalp_route,cleansing_intensity) VALUES($1,$2,$3,$4,$5)",
        [id, thickness, bucket, route, intensity],
      )
    }
  }
  // Exercise description-only edge cases without pretending these are live rows.
  await pg.query("UPDATE products SET description = NULL WHERE id=$1", [ids[0]])
  await pg.query("DELETE FROM product_shampoo_specs WHERE product_id=$1", [ids[1]])
  await pg.query("DELETE FROM product_shampoo_specs WHERE product_id=$1", [ids[2]])
  await pg.query(
    `INSERT INTO product_shampoo_specs(product_id,thickness,shampoo_bucket,scalp_route,cleansing_intensity)
    SELECT $1,th,bucket,'balanced','regular' FROM unnest(ARRAY['coarse','fine','normal']) th
    CROSS JOIN unnest(ARRAY['trocken','normal','schuppen','irritationen','dehydriert-fettig']) bucket`,
    [ids[2]],
  )
  await pg.query(
    "UPDATE products SET brand='Sebamed',origin='curated',is_active=true,is_chaarlie_recommended=true WHERE id=$1",
    [A50],
  )
  const url = "https://www.dm.de/p/d/1585729/sebamed-shampoo-anti-schuppen-plus"
  const row = buildExpansionProtocolRow("TPL-SHAMPOO-STD", {
    productId: A50,
    evidence: [{ sourceUrl: url, sourceType: "retailer", checkedAt: "2026-10-13" }],
  })
  const pointer = buildProductApplicationPointerV2({
    sourceRole: row.role,
    guidancePayload: row.guidance_payload,
  })
  await pg.query(
    `INSERT INTO product_application_protocols(product_id,category,role,source_url,source_text,guidance_payload,guidance_payload_v2)
    VALUES($1,'shampoo','shampoo_everyday',$2,'Für die tägliche Anwendung geeignet',$3,$4)`,
    [A50, url, JSON.stringify(row.guidance_payload), JSON.stringify(pointer)],
  )
  const gate = "20260811212000_personal_plan_curated_publication_gate"
  await pg.exec(repoFunction(gate, "assert_personal_plan_curated_publication"))
  await pg.exec(
    "ALTER FUNCTION assert_personal_plan_curated_publication(uuid) RENAME TO assert_personal_plan_curated_publication_v1_without_v2",
  )
  await pg.exec(
    repoFunction(
      "20260813085151_personal_plan_catalog_closure",
      "assert_personal_plan_curated_publication",
    ),
  )
  await pg.exec(repoFunction(gate, "validate_personal_plan_curated_publication_dependency"))
  for (const table of ["product_shampoo_specs", "product_application_protocols"]) {
    await pg.exec(`CREATE CONSTRAINT TRIGGER publication AFTER INSERT OR UPDATE OR DELETE ON ${table}
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_personal_plan_curated_publication_dependency()`)
  }
  return pg
}

async function snapshot(pg: PGlite) {
  const result = await pg.query<{ state: unknown }>(`SELECT jsonb_build_object(
    'products',(SELECT jsonb_agg(to_jsonb(p)-'updated_at' ORDER BY id) FROM products p),
    'specs',(SELECT jsonb_agg(to_jsonb(s) ORDER BY product_id,thickness,shampoo_bucket) FROM product_shampoo_specs s),
    'protocols',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM product_application_protocols p),
    'thickness',(SELECT jsonb_agg(to_jsonb(e) ORDER BY product_id,thickness) FROM product_thickness_eligibility e),
    'concerns',(SELECT jsonb_agg(to_jsonb(e) ORDER BY product_id,concern_key) FROM product_concern_eligibility e)
  ) AS state`)
  return result.rows[0].state
}

test("offline Postgres: applies literal V1/V2 through real publication/eligibility functions, renders German lists, and rolls back exactly", async (t) => {
  const pg = await database(t)
  const before = await snapshot(pg)
  await pg.exec(`BEGIN;\n${migration}\nCOMMIT;`)
  assert.equal(
    (await pg.query<{ description: string }>("SELECT description FROM products WHERE id=$1", [A50]))
      .rows[0].description,
    "Shampoo von Sebamed bei Schuppen.",
  )
  const descriptions = await pg.query<{ id: string; description: string | null }>(
    "SELECT id,description FROM products WHERE id=ANY($1::uuid[])",
    [[ids[0], ids[1], ids[2]]],
  )
  assert.equal(descriptions.rows.find((r) => r.id === ids[0])?.description, null)
  assert.equal(descriptions.rows.find((r) => r.id === ids[1])?.description, "Old: empfohlen für")
  assert.equal(
    descriptions.rows.find((r) => r.id === ids[2])?.description,
    "Shampoo von Brand für feines, mittelstarkes und dickes Haar und bei Schuppen, fettiger Kopfhaut, Kopfhautirritationen und trockener Kopfhaut.",
  )
  assert.equal(
    (await pg.query("SELECT 1 FROM products WHERE short_description <> 'Keep short'")).rows.length,
    0,
  )
  const protection = await pg.query<{
    relrowsecurity: boolean
    permitted: boolean
  }>(`SELECT c.relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT') AS permitted
    FROM pg_class c WHERE c.relname LIKE 'shampoo_v162_followups_backup_%'`)
  assert.equal(protection.rows.length, 3)
  assert.ok(protection.rows.every((r) => r.relrowsecurity && !r.permitted))
  await pg.exec(rollback)
  assert.deepEqual(await snapshot(pg), before)
})

test("offline Postgres: live-spec drift and Neqi zero-row update abort all changes and backups", async (t) => {
  for (const drift of ["spec", "neqi"]) {
    const pg = await database(t)
    if (drift === "spec")
      await pg.query(
        "UPDATE product_shampoo_specs SET cleansing_intensity='gentle' WHERE product_id=$1",
        [A50],
      )
    else await pg.query("UPDATE products SET affiliate_link='unexpected' WHERE id=$1", [NEQI])
    const before = await snapshot(pg)
    await assert.rejects(
      pg.exec(`BEGIN;\n${migration}\nCOMMIT;`),
      drift === "spec" ? /A50 old spec/ : /Neqi old affiliate link/,
    )
    await pg.exec("ROLLBACK")
    assert.deepEqual(await snapshot(pg), before)
    assert.equal(
      (
        await pg.query(
          "SELECT 1 FROM pg_class WHERE relname LIKE 'shampoo_v162_followups_backup_%'",
        )
      ).rows.length,
      0,
    )
  }
})
