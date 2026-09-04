import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"
import { APPLICATION_DAY_TYPE_KEYS } from "../src/lib/routines/personal-plan/application/contracts"
import { productApplicationPointerV2Schema } from "../src/lib/routines/personal-plan/application/contracts-v2"
import type { ProductApplicationPointerV2 } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { compileApplicationViewV2 } from "../src/lib/routines/personal-plan/application/compiler-v2"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"

const migrationPath = "supabase/migrations/20260903083832_simplify_oil_heat_capability.sql"

const oils = [
  ["27a2dd61-6e54-4746-8e24-a698dbafbf91", "Neqi Opulent Oil", true],
  ["5827a3b9-a488-4c74-b13a-4d655f94f1c3", "Pantene Pro-V Miracles 7in1 Öl-Spray", true],
  ["5ad6c978-fd27-469e-9f26-ff3f05b9f67a", "Urban Alchemy Smooth Supreme Öl Serum", true],
  ["7b5ff358-1b3b-411d-9220-5e6d30543235", "Maria Nila True Soft Argan Oil", true],
  ["7d8c0150-778d-4cb9-abf5-bfc16ad93b12", "Olaplex No.7 Bonding Oil", true],
  ["e6b87909-6104-4a9a-a3ef-e1c64a1b15b1", "Garnier Fructis Wunderöl", true],
  ["1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf", "OGX Argan Oil", true],
  [
    "c574ee6f-ad22-45c0-b936-57b847d93433",
    "Garnier Fructis Sleek & Stay Heat-Activated Serum",
    false,
  ],
  ["f7f28e1c-e177-4505-906d-c59f4291ba6b", "L'Oréal Paris Elvital Haaröl Öl Magique", true],
  ["55c39339-bac0-4899-9499-ee96fa0bdad8", "Balea Professional Haaröl Plex Care", true],
  ["7dcde56c-40e7-4e84-86b7-f6ac3d407a9d", "Dejan Garz Violet Hair Oil The Britney", true],
  ["4eddfc54-3704-4a3e-a9b7-0cff91538863", "Garnier Fructis Hitzeschutzspray Wunderöl", true],
  ["f89c1edc-cb71-4ec6-ac86-dc27c515568e", "Langhaarmädchen Haaröl Intense Repair", true],
] as const

const evidenceOilIds = new Set([
  "27a2dd61-6e54-4746-8e24-a698dbafbf91",
  "5827a3b9-a488-4c74-b13a-4d655f94f1c3",
  "5ad6c978-fd27-469e-9f26-ff3f05b9f67a",
  "7b5ff358-1b3b-411d-9220-5e6d30543235",
  "7d8c0150-778d-4cb9-abf5-bfc16ad93b12",
  "e6b87909-6104-4a9a-a3ef-e1c64a1b15b1",
  "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf",
  "c574ee6f-ad22-45c0-b936-57b847d93433",
])

const unrelatedEvidenceRows = [
  {
    id: "90000000-0000-4000-8000-000000000010",
    name: "Unrelated valid Oil evidence",
    factValue: {
      category: "oil",
      role_support: ["leave_on_fibre_conditioning"],
      provides_heat_protection: true,
    },
  },
  {
    id: "90000000-0000-4000-8000-000000000011",
    name: "Unrelated legacy Oil evidence",
    factValue: {
      category: "oil",
      role_support: ["pre_heat_protection"],
      weight: "light",
    },
  },
] as const

type TestContext = { after: (fn: () => Promise<void>) => void }

async function database(t: TestContext, count: number = oils.length) {
  const pg = new PGlite()
  t.after(() => pg.close())

  await pg.exec(`
    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      category_key text NOT NULL DEFAULT 'oil',
      origin text NOT NULL DEFAULT 'curated',
      is_active boolean NOT NULL DEFAULT true,
      lifecycle_status text NOT NULL DEFAULT 'active',
      UNIQUE (id, category_key)
    );
    CREATE TABLE public.product_oil_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
      category_key text NOT NULL DEFAULT 'oil' CHECK (category_key = 'oil'),
      weight text NOT NULL DEFAULT 'light',
      role_support text[] NOT NULL,
      provides_heat_protection boolean,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT product_oil_specs_role_support_check CHECK (
        role_support <@ ARRAY[
          'pre_wash_fibre_treatment',
          'leave_on_fibre_conditioning',
          'dry_finish',
          'pre_heat_protection'
        ]::text[]
      )
    );
    CREATE FUNCTION public.test_curated_publication_dependency_trigger()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RETURN NULL;
    END;
    $$;
    CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_dependency
      AFTER UPDATE ON public.product_oil_specs
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION public.test_curated_publication_dependency_trigger();
    CREATE FUNCTION public.personal_plan_application_family_identity_v1(
      p_role text,
      p_guidance_payload jsonb,
      p_guidance_payload_v2 jsonb
    ) RETURNS text LANGUAGE sql IMMUTABLE AS $$
      SELECT COALESCE(p_guidance_payload_v2->>'applicationFamily', p_guidance_payload->>'applicationFamily')
    $$;
    CREATE TABLE public.product_application_protocols (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      category text NOT NULL,
      category_key text GENERATED ALWAYS AS (category) STORED,
      role text NOT NULL,
      application_family text GENERATED ALWAYS AS (
        public.personal_plan_application_family_identity_v1(
          role, guidance_payload, guidance_payload_v2
        )
      ) STORED,
      cadence jsonb,
      application_stage text,
      application_state text,
      placement text,
      contact_time_seconds integer,
      rinse_action text,
      reapplication text,
      instruction_modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_label text NOT NULL,
      source_url text NOT NULL,
      source_text text NOT NULL,
      guidance_payload jsonb,
      guidance_payload_v2 jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT product_application_protocols_role_check CHECK (
        role IN ('leave_on_fibre_conditioning', 'dry_finish', 'pre_heat_protection')
      ),
      CONSTRAINT product_application_protocols_role_category_check CHECK (
        category = 'oil' AND role IN (
          'leave_on_fibre_conditioning', 'dry_finish', 'pre_heat_protection'
        )
      )
    );
    CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_protocol_dependency
      AFTER UPDATE OR DELETE ON public.product_application_protocols
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION public.test_curated_publication_dependency_trigger();
    CREATE UNIQUE INDEX idx_product_application_protocols_product_category_role_family
      ON public.product_application_protocols (product_id, category, role, application_family);
    CREATE TABLE public.personal_plan_catalog_fact_evidence (
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      fact_key text NOT NULL,
      fact_value jsonb NOT NULL,
      source_label text NOT NULL,
      source_url text NOT NULL,
      source_text text NOT NULL,
      source_type text NOT NULL DEFAULT 'manufacturer',
      checked_at date NOT NULL DEFAULT current_date,
      batch_id text NOT NULL DEFAULT 'OIL-20260901-authority-enrichment-v1',
      batch_fingerprint text NOT NULL DEFAULT 'test-batch',
      content_fingerprint text NOT NULL DEFAULT 'test-content',
      PRIMARY KEY (product_id, fact_key, source_url)
    );
    CREATE TABLE public.personal_plan_product_drafts (payload jsonb NOT NULL);
    CREATE TABLE public.personal_plan_routine_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payload jsonb NOT NULL
    );
    CREATE TABLE public.personal_plan_routine_proposals (delta jsonb NOT NULL);
    CREATE TABLE public.personal_plans (active_routine_version_id uuid);
  `)

  for (const [id, name, hasExistingLeaveOn] of oils.slice(0, count)) {
    await pg.query("INSERT INTO public.products (id, name) VALUES ($1, $2)", [id, name])
    await pg.query(
      `INSERT INTO public.product_oil_specs (
        product_id, role_support, provides_heat_protection
      ) VALUES ($1, $2::text[], $3)`,
      [
        id,
        hasExistingLeaveOn
          ? ["leave_on_fibre_conditioning", "dry_finish", "pre_heat_protection"]
          : ["pre_heat_protection"],
        id === "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf" ||
          id === "c574ee6f-ad22-45c0-b936-57b847d93433",
      ],
    )
    if (hasExistingLeaveOn) {
      await protocol(pg, id, "leave_on_fibre_conditioning", "post_wash_damp_conditioning")
    }
    await protocol(pg, id, "pre_heat_protection", "pre_heat_damp")
    if (evidenceOilIds.has(id)) {
      const roleSupport = hasExistingLeaveOn
        ? ["leave_on_fibre_conditioning", "dry_finish", "pre_heat_protection"]
        : ["pre_heat_protection"]
      await pg.query(
        `INSERT INTO public.personal_plan_catalog_fact_evidence (
          product_id, fact_key, fact_value, source_label, source_url, source_text
        ) VALUES ($1, 'oil.authority_facts', $2::jsonb, 'Manufacturer', $3, 'Verified source text')`,
        [
          id,
          JSON.stringify({
            category: "oil",
            role_support: roleSupport,
            weight: "light",
            ...(id === "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf"
              ? { provides_heat_protection: true }
              : {}),
          }),
          `https://example.test/oils/${id}`,
        ],
      )
      await pg.query(
        `INSERT INTO public.personal_plan_catalog_fact_evidence (
          product_id, fact_key, fact_value, source_label, source_url, source_text
        ) VALUES ($1, 'oil.authority_facts', $2::jsonb, 'Manufacturer', $3, 'Verified source text')`,
        [
          id,
          JSON.stringify({ category: "oil", role_support: roleSupport, weight: "light" }),
          `https://example.test/oils/${id}/second-source`,
        ],
      )
    }
  }
  for (const evidence of unrelatedEvidenceRows) {
    await pg.query("INSERT INTO public.products (id, name) VALUES ($1, $2)", [
      evidence.id,
      evidence.name,
    ])
    await pg.query(
      `INSERT INTO public.personal_plan_catalog_fact_evidence (
        product_id, fact_key, fact_value, source_label, source_url, source_text
      ) VALUES ($1, 'oil.authority_facts', $2::jsonb, 'Manufacturer', $3, 'Verified source text')`,
      [evidence.id, JSON.stringify(evidence.factValue), `https://example.test/oils/${evidence.id}`],
    )
  }
  return pg
}

async function protocol(
  pg: PGlite,
  productId: string,
  role: "leave_on_fibre_conditioning" | "pre_heat_protection",
  applicationFamily: string,
) {
  const semanticRole = role === "pre_heat_protection" ? "heat_protection" : "leave_in"
  const sourceUrl = `https://example.test/protocols/${productId}/${role}`
  const guidancePayload = {
    schemaVersion: 1,
    guidanceKey: `oil-${productId}-${role}`,
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "product", category: "oil", productId },
    role: semanticRole,
    applicationFamily,
    compatibleDayTypes: [role === "pre_heat_protection" ? "styling_day" : "wash_day"],
    exactGuidanceRequired: true,
    sequence: { anchor: "damp_leave_on", before: [], after: [], conflictsWith: [] },
    requirements: { requiredCatalogFacts: [], requiredProtocolFacts: [], requiredProfileFacts: [] },
    protocolFacts: {
      applicationArea: "lengths_ends",
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: role === "pre_heat_protection" ? "each_separate_heat_event" : "none",
      amount: null,
      cautions: [],
    },
    steps: [
      { stepKey: "apply", action: "apply_product", copyTemplateDe: "Gleichmäßig verteilen." },
    ],
    evidence: [{ sourceUrl, sourceType: "manufacturer", checkedAt: "2026-09-01" }],
  }
  const guidancePayloadV2 = {
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "oil", productId },
    sourceRole: role,
    role: semanticRole,
    applicationFamily,
    facts: {
      applicationState: "damp_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
      contactTime: null,
      amount: null,
      heat:
        role === "pre_heat_protection"
          ? {
              supportedStates: ["damp_hair"],
              activationRequired: false,
              maximumClaimedTemperatureC: null,
              reapplication: "each_separate_heat_event",
            }
          : null,
      conditionerPolicy: "not_applicable",
    },
    workflowId: null,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [],
    cautionCodes: [],
    evidence: [{ sourceUrl, sourceType: "manufacturer", checkedAt: "2026-09-01" }],
  }

  await pg.query(
    `INSERT INTO public.product_application_protocols (
      product_id, category, role, application_stage,
      application_state, reapplication, source_label, source_url, source_text,
      guidance_payload, guidance_payload_v2
    ) VALUES (
      $1, 'oil', $2, 'damp_leave_on', 'damp', 'not_stated',
      'Manufacturer', $3, 'Verified source text', $4::jsonb, $5::jsonb
    )`,
    [
      productId,
      role,
      sourceUrl,
      JSON.stringify(guidancePayload),
      JSON.stringify(guidancePayloadV2),
    ],
  )
}

test("oil heat capability migration normalizes all thirteen known oil rows and is replay-safe", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")

  await pg.exec(migration)

  const specs = await pg.query<{
    product_id: string
    role_support: string[]
    provides_heat_protection: boolean
  }>(
    `SELECT product_id::text, role_support, provides_heat_protection
       FROM public.product_oil_specs ORDER BY product_id`,
  )
  assert.equal(specs.rows.length, oils.length)
  for (const spec of specs.rows) {
    assert.equal(spec.provides_heat_protection, true)
    assert.ok(spec.role_support.includes("leave_on_fibre_conditioning"))
    assert.ok(!spec.role_support.includes("pre_heat_protection"))
    assert.ok(
      spec.role_support.every((role) =>
        ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"].includes(role),
      ),
    )
  }

  const preheat = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.product_application_protocols
      WHERE category = 'oil' AND role = 'pre_heat_protection'`,
  )
  assert.equal(preheat.rows[0]?.count, "0")
  const leaveOn = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.product_application_protocols
      WHERE category = 'oil' AND role = 'leave_on_fibre_conditioning'`,
  )
  assert.equal(leaveOn.rows[0]?.count, "13")
  const garnier = await pg.query<{
    application_family: string
    guidance_payload: unknown
    guidance_payload_v2: unknown
  }>(
    `SELECT application_family, guidance_payload, guidance_payload_v2
       FROM public.product_application_protocols
      WHERE product_id = 'c574ee6f-ad22-45c0-b936-57b847d93433'
        AND category = 'oil' AND role = 'leave_on_fibre_conditioning'`,
  )
  assert.equal(garnier.rows[0]?.application_family, "post_wash_damp_conditioning")
  assert.equal(
    applicationGuidanceProtocolSchema.parse(garnier.rows[0]?.guidance_payload).role,
    "leave_in",
  )
  const garnierV1 = applicationGuidanceProtocolSchema.parse(garnier.rows[0]?.guidance_payload)
  const garnierV2 = productApplicationPointerV2Schema.parse(garnier.rows[0]?.guidance_payload_v2)
  assert.deepEqual(garnierV1.compatibleDayTypes, [
    "wash_day",
    "intensive_care_day",
    "bond_repair_day",
    "clarifying_wash_day",
  ])
  assert.equal(garnierV1.sequence.before.length, 0)
  assert.equal(garnierV1.protocolFacts.reapplication, "none")
  assert.deepEqual(garnierV1.steps, [
    {
      stepKey: "apply-garnier-leave-on",
      action: "apply_product",
      copyTemplateDe:
        "Einen Pumpstoß gleichmäßig in die feuchten Längen und Spitzen geben und nicht ausspülen.",
    },
  ])
  assert.equal(garnierV2.role, "leave_in")
  assert.equal(garnierV2.facts.heat, null)
  const canonicalProtocols = await pg.query<{
    product_id: string
    role: string
    guidance_payload: unknown
    guidance_payload_v2: unknown
  }>(
    `SELECT product_id::text, role, guidance_payload, guidance_payload_v2
       FROM public.product_application_protocols
      WHERE category = 'oil' AND role = 'leave_on_fibre_conditioning'
      ORDER BY product_id`,
  )
  assert.equal(canonicalProtocols.rows.length, oils.length)
  for (const protocolRow of canonicalProtocols.rows) {
    const v1 = applicationGuidanceProtocolSchema.parse(protocolRow.guidance_payload)
    const v2 = productApplicationPointerV2Schema.parse(protocolRow.guidance_payload_v2)
    assert.equal(v1.scope.kind, "product")
    assert.equal(v1.scope.productId, protocolRow.product_id)
    assert.equal(v1.scope.category, "oil")
    assert.deepEqual(v1.compatibleDayTypes, [
      "wash_day",
      "intensive_care_day",
      "bond_repair_day",
      "clarifying_wash_day",
    ])
    assert.equal(v2.scope.productId, protocolRow.product_id)
    assert.equal(v2.scope.category, "oil")
    assert.equal(v2.sourceRole, protocolRow.role)

    const shampooId = "90000000-0000-4000-8000-000000000001"
    const shampooPointer: ProductApplicationPointerV2 = {
      schemaVersion: 2,
      contractKind: "product_pointer",
      scope: { kind: "product", category: "shampoo", productId: shampooId },
      sourceRole: "shampoo_everyday",
      role: "cleanse",
      applicationFamily: "standard_rinse_out_cleanse",
      facts: {
        applicationState: "wet_hair",
        applicationArea: "scalp_roots",
        rinse: "rinse_out",
        contactTime: null,
        amount: null,
        heat: null,
        conditionerPolicy: "not_applicable",
      },
      workflowId: null,
      requiredCompanionProductId: null,
      runtimeBlockerCode: null,
      exactSteps: [],
      cautionCodes: [],
      evidence: [
        {
          sourceUrl: "https://example.test/shampoo",
          sourceType: "manufacturer",
          checkedAt: "2026-09-01",
        },
      ],
    }
    const compiled = compileApplicationViewV2({
      input: {
        routineItems: [
          {
            itemId: "shampoo",
            productId: shampooId,
            productName: "Shampoo",
            category: "shampoo",
            role: "cleanse",
            sourceRoutineRole: "shampoo_everyday",
            inclusion: "included",
            availability: "owned",
            executable: true,
            catalogFacts: {},
          },
          {
            itemId: `oil-${protocolRow.product_id}`,
            productId: protocolRow.product_id,
            productName: "Oil",
            category: "oil",
            role: "leave_in",
            sourceRoutineRole: "leave_on_fibre_conditioning",
            inclusion: "included",
            availability: "owned",
            executable: true,
            catalogFacts: { provides_heat_protection: true },
          },
        ],
        unresolvedRoutineItems: [],
        profile: {
          heatEvents: [{ id: "heat:dryer", tool: "hair_dryer", route: "airflow_shaping" }],
        },
        dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({
          key,
          sortOrder: index + 1,
        })),
      },
      familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
      productPointers: [shampooPointer, v2],
    })
    const oilBlock = compiled.days
      .find((day) => day.key === "wash_day")
      ?.productBlocks.find((block) => block.productId === protocolRow.product_id)
    assert.ok(oilBlock, protocolRow.product_id)
    assert.match(
      oilBlock.steps.map((step) => step.copyDe).join(" "),
      /Diese Anwendung schützt beim unmittelbar folgenden Styling zugleich vor Hitze\./,
      protocolRow.product_id,
    )
  }

  const evidence = await pg.query<{
    product_id: string
    fact_value: { role_support: string[]; provides_heat_protection: boolean }
  }>(
    `SELECT product_id::text, fact_value FROM public.personal_plan_catalog_fact_evidence
      WHERE fact_key = 'oil.authority_facts'
        AND product_id = ANY($1::uuid[])
      ORDER BY product_id, source_url`,
    [[...evidenceOilIds]],
  )
  assert.equal(evidence.rows.length, 16)
  for (const row of evidence.rows) {
    assert.ok(evidenceOilIds.has(row.product_id))
    assert.equal(row.fact_value.provides_heat_protection, true)
    assert.ok(row.fact_value.role_support.includes("leave_on_fibre_conditioning"))
    assert.ok(!row.fact_value.role_support.includes("pre_heat_protection"))
  }
  const unrelatedEvidence = await pg.query<{ product_id: string; fact_value: unknown }>(
    `SELECT product_id::text, fact_value
       FROM public.personal_plan_catalog_fact_evidence
      WHERE product_id = ANY($1::uuid[])
      ORDER BY product_id`,
    [unrelatedEvidenceRows.map((row) => row.id)],
  )
  assert.deepEqual(
    unrelatedEvidence.rows,
    unrelatedEvidenceRows.map((row) => ({ product_id: row.id, fact_value: row.factValue })),
  )

  await assert.rejects(
    pg.query(
      `UPDATE public.product_oil_specs
        SET role_support = ARRAY['pre_heat_protection']::text[]
        WHERE product_id = $1`,
      [oils[0][0]],
    ),
    /product_oil_specs_role_support_check/i,
  )
  await assert.rejects(
    pg.query(
      `INSERT INTO public.product_application_protocols (
        product_id, category, role, source_label, source_url, source_text,
        guidance_payload, guidance_payload_v2
      ) VALUES (
        $1, 'oil', 'pre_heat_protection', 'Test', 'https://example.test', 'Test',
        '{"applicationFamily":"pre_heat_application"}'::jsonb,
        '{"applicationFamily":"pre_heat_application"}'::jsonb
      )`,
      [oils[0][0]],
    ),
    /product_application_protocols_role_category_check|product_application_protocols_role_check/i,
  )

  await pg.exec(migration)
  assert.equal(
    (
      await pg.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.product_application_protocols WHERE category = 'oil'",
      )
    ).rows[0]?.count,
    "13",
  )
})

test("oil heat capability migration fails closed when its reviewed thirteen-row prestate drifts", async (t) => {
  const pg = await database(t, oils.length - 1)
  const migration = await readFile(migrationPath, "utf8")
  await assert.rejects(pg.exec(migration), /oil|prestate|drift|expected/i)
})

test("oil heat capability migration rejects aggregate-masked leave-on protocol drift", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query(
    `DELETE FROM public.product_application_protocols
      WHERE product_id = $1 AND role = 'leave_on_fibre_conditioning'`,
    [oils[0][0]],
  )
  await protocol(pg, oils[1][0], "leave_on_fibre_conditioning", "between_wash_damp_refresh")

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|expected/i)
})

test("oil heat capability migration rejects malformed target protocol payloads before mutation", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query(
    `UPDATE public.product_application_protocols
        SET guidance_payload = jsonb_set(guidance_payload, '{role}', '"leave_in"'::jsonb)
      WHERE product_id = $1 AND role = 'pre_heat_protection'`,
    [oils[0][0]],
  )

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|payload|expected/i)
  await pg.exec("ROLLBACK")
  const remaining = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM public.product_application_protocols
      WHERE category = 'oil' AND role = 'pre_heat_protection'`,
  )
  assert.equal(remaining.rows[0]?.count, "13")
})

test("oil heat capability migration rejects a legacy heat protocol without source text before mutation", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query(
    `UPDATE public.product_application_protocols
        SET source_text = ''
      WHERE product_id = $1 AND role = 'pre_heat_protection'`,
    [oils[0][0]],
  )

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|evidence|expected/i)
  await pg.exec("ROLLBACK")
  const remaining = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM public.product_oil_specs
      WHERE role_support @> ARRAY['pre_heat_protection']::text[]`,
  )
  assert.equal(remaining.rows[0]?.count, "13")
})

test("oil heat capability migration rejects a legacy heat protocol with broken V1 evidence linkage", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query(
    `UPDATE public.product_application_protocols
        SET guidance_payload = jsonb_set(
          guidance_payload,
          '{evidence,0,sourceUrl}',
          '"https://example.test/other-source"'::jsonb
        )
      WHERE product_id = $1 AND role = 'pre_heat_protection'`,
    [oils[0][0]],
  )

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|evidence|expected/i)
})

test("oil heat capability migration rejects missing authority evidence", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query("DELETE FROM public.personal_plan_catalog_fact_evidence WHERE product_id = $1", [
    oils[0][0],
  ])

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|evidence|expected/i)
})

test("oil heat capability migration rejects changed expected evidence payload", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query(
    `UPDATE public.personal_plan_catalog_fact_evidence
        SET fact_value = jsonb_set(fact_value, '{role_support}', '["dry_finish"]'::jsonb)
      WHERE product_id = $1`,
    [oils[0][0]],
  )

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|evidence|expected/i)
})

test("oil heat capability migration rejects an unexpected oil authority evidence row", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query(
    `INSERT INTO public.personal_plan_catalog_fact_evidence (
      product_id, fact_key, fact_value, source_label, source_url, source_text
    ) VALUES ($1, 'oil.authority_facts', $2::jsonb, 'Manufacturer', $3, 'Verified source text')`,
    [
      "f7f28e1c-e177-4505-906d-c59f4291ba6b",
      JSON.stringify({
        category: "oil",
        role_support: ["pre_heat_protection"],
        weight: "light",
      }),
      "https://example.test/oils/unexpected-evidence",
    ],
  )

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|evidence|expected/i)
})

test("oil heat capability migration rejects an extra global legacy oil row", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  const extraId = "90000000-0000-4000-8000-000000000002"
  await pg.query("INSERT INTO public.products (id, name) VALUES ($1, 'Unexpected legacy Oil')", [
    extraId,
  ])
  await pg.query(
    `INSERT INTO public.product_oil_specs (product_id, role_support, provides_heat_protection)
      VALUES ($1, ARRAY['pre_heat_protection']::text[], false)`,
    [extraId],
  )
  await protocol(pg, extraId, "pre_heat_protection", "pre_heat_damp")

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|expected/i)
})

test("oil heat capability migration rejects an extra global legacy Oil spec without a protocol", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  const extraId = "90000000-0000-4000-8000-000000000003"
  await pg.query(
    "INSERT INTO public.products (id, name) VALUES ($1, 'Unexpected legacy Oil spec')",
    [extraId],
  )
  await pg.query(
    `INSERT INTO public.product_oil_specs (product_id, role_support, provides_heat_protection)
      VALUES ($1, ARRAY['pre_heat_protection']::text[], false)`,
    [extraId],
  )

  await assert.rejects(pg.exec(migration), /oil|prestate|drift|expected/i)
})

test("oil heat capability migration permits an accepted Routine using a retained Oil purpose", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query("INSERT INTO public.personal_plan_routine_versions (payload) VALUES ($1::jsonb)", [
    JSON.stringify({
      items: [
        {
          category: "oil",
          role: "dry_finish",
          product: { kind: "owned", productId: oils[4][0] },
        },
        {
          category: "oil",
          role: "leave_on_fibre_conditioning",
          product: { kind: "owned", productId: oils[4][0] },
        },
      ],
    }),
  ])

  await pg.exec(migration)
})

test("oil heat capability migration holds a transactional Personal Plan legacy-role collision guard", async (t) => {
  const pg = await database(t)
  const migration = await readFile(migrationPath, "utf8")
  await pg.query("INSERT INTO public.personal_plan_routine_versions (payload) VALUES ($1::jsonb)", [
    JSON.stringify({
      items: [
        {
          category: "oil",
          role: "pre_heat_protection",
          product: { kind: "owned", productId: oils[4][0] },
        },
      ],
    }),
  ])

  await assert.rejects(pg.exec(migration), /oil|personal plan|legacy|collision|prestate/i)
})
