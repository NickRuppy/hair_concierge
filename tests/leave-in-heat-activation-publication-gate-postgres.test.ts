import assert from "node:assert/strict"
import test from "node:test"

import type { PGlite } from "@electric-sql/pglite"

import {
  HEAT_ACTIVATED_WORKFLOW,
  S3_SCHEMA_MIGRATION,
  heatActivationDatabase,
  insertLeaveIn,
  insertProtocol,
  preHeatActivationDatabase,
  readRepoFile,
  transaction,
  type LeaveInSeed,
} from "./helpers/leave-in-heat-activation-postgres"

/**
 * Leave-In v1.2 heat activation: row-local CHECKs + deferred curated-publication
 * gate (S3 plan §3, cases A1–A5, R1–R9, L1). Each case is one transaction; the
 * deferred gate runs at COMMIT, the CHECKs at the offending statement.
 */

const ID = {
  gliss: "00000000-0000-4000-8000-00000000a001",
  heatGlow: "00000000-0000-4000-8000-00000000a002",
  olaplex: "00000000-0000-4000-8000-00000000a003",
  neqi: "00000000-0000-4000-8000-00000000a004",
  s1HeatGlow: "00000000-0000-4000-8000-00000000a005",
  bad: "00000000-0000-4000-8000-00000000a0ff",
} as const

const GLISS_SHAPE: Omit<LeaveInSeed, "id"> = {
  specs: {
    roles: ["replacement_conditioner"],
    plan_roles: ["pre_heat_application"],
    application_stage: ["towel_dry"],
    provides_heat_protection: true,
  },
  fit: "replacement_capable",
  protocols: [{ role: "pre_heat_protection" }],
}

const HEAT_GLOW_ACTIVATED: Omit<LeaveInSeed, "id"> = {
  specs: {
    roles: ["styling_prep"],
    plan_roles: ["pre_heat_application"],
    application_stage: ["towel_dry", "pre_heat", "dry_hair"],
    provides_heat_protection: true,
    heat_activation_required: true,
    heat_activation_route: "airflow_shaping",
    care_benefits: ["moisture", "anti_frizz", "shine"],
  },
  fit: "booster_only",
  protocols: [
    { role: "pre_heat_protection", family: "pre_heat_damp" },
    { role: "pre_heat_protection", family: "pre_heat_dry" },
    // Legacy rows kept for the seven frozen routines (Q1); no longer required.
    { role: "post_wash_leave_in", family: "post_wash_damp_conditioning" },
    { role: "post_wash_leave_in", family: "between_wash_dry_care" },
  ],
}

async function seedCase(pg: PGlite, seed: LeaveInSeed) {
  return transaction(pg, (db) => insertLeaveIn(db, seed))
}

test("A1 Gliss/Redken heat-only shape: rejected before the migration, accepted after (T1.1 parity)", async (t) => {
  const before = await preHeatActivationDatabase(t)
  assert.match(
    (await seedCase(before, { id: ID.gliss, ...GLISS_SHAPE })) ?? "accepted",
    /curated publication requires complete category facts/,
  )
  const after = await heatActivationDatabase(t)
  assert.equal(await seedCase(after, { id: ID.gliss, ...GLISS_SHAPE }), null)
})

test("A2 HEAT&GLOW activated shape with legacy post-wash rows is accepted", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.equal(await seedCase(pg, { id: ID.heatGlow, ...HEAT_GLOW_ACTIVATED }), null)
})

test("A3 Olaplex post-wash + pre-heat (not activated) stays accepted", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.equal(
    await seedCase(pg, {
      id: ID.olaplex,
      specs: {
        roles: ["replacement_conditioner"],
        plan_roles: ["post_wash_leave_in", "pre_heat_application"],
        application_stage: ["towel_dry"],
        provides_heat_protection: true,
      },
      fit: "replacement_capable",
      protocols: [{ role: "post_wash_leave_in" }, { role: "pre_heat_protection" }],
    }),
    null,
  )
})

test("A4 Neqi user-submitted activated row with one pre-heat protocol is accepted", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.equal(
    await seedCase(pg, {
      id: ID.neqi,
      origin: "user_submitted",
      recommended: false,
      thicknesses: ["normal", "coarse"],
      specs: {
        roles: ["styling_prep"],
        plan_roles: ["pre_heat_application"],
        application_stage: ["towel_dry", "pre_heat"],
        provides_heat_protection: true,
        heat_activation_required: true,
        heat_activation_route: "airflow_shaping",
      },
      fit: "booster_only",
      protocols: [{ role: "pre_heat_protection" }],
    }),
    null,
  )
})

async function seedS1HeatGlow(pg: PGlite) {
  assert.equal(
    await seedCase(pg, {
      id: ID.s1HeatGlow,
      specs: {
        roles: ["extension_conditioner"],
        plan_roles: ["post_wash_leave_in", "pre_heat_application"],
        application_stage: ["towel_dry", "pre_heat", "dry_hair"],
        provides_heat_protection: true,
      },
      fit: "booster_only",
      protocols: [
        { role: "post_wash_leave_in", family: "post_wash_damp_conditioning" },
        { role: "pre_heat_protection", family: "pre_heat_damp" },
      ],
    }),
    null,
  )
}

test("A5 one UPDATE flips activation + plan_roles inside a deferred transaction that replaces the protocol", async (t) => {
  const pg = await heatActivationDatabase(t)
  await seedS1HeatGlow(pg)
  assert.equal(
    await transaction(pg, async (db) => {
      await db.query(
        `UPDATE public.product_leave_in_specs
            SET heat_activation_required = true, heat_activation_route = 'airflow_shaping',
                plan_roles = ARRAY['pre_heat_application'], roles = ARRAY['styling_prep']
          WHERE product_id = $1`,
        [ID.s1HeatGlow],
      )
      await db.query(
        "DELETE FROM public.product_application_protocols WHERE product_id = $1 AND role = 'pre_heat_protection'",
        [ID.s1HeatGlow],
      )
      await insertProtocol(
        db,
        ID.s1HeatGlow,
        "pre_heat_protection",
        "pre_heat_damp",
        HEAT_ACTIVATED_WORKFLOW,
      )
      await insertProtocol(
        db,
        ID.s1HeatGlow,
        "pre_heat_protection",
        "pre_heat_dry",
        HEAT_ACTIVATED_WORKFLOW,
      )
    }),
    null,
  )
})

test("R1 activation with a post-wash plan role is rejected immediately", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...HEAT_GLOW_ACTIVATED,
      specs: {
        ...HEAT_GLOW_ACTIVATED.specs,
        plan_roles: ["post_wash_leave_in", "pre_heat_application"],
      },
    })) ?? "accepted",
    /product_leave_in_specs_heat_activation_pre_heat_only/,
  )
})

test("R2 activation without a pre_heat stage is rejected", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...HEAT_GLOW_ACTIVATED,
      specs: { ...HEAT_GLOW_ACTIVATED.specs, application_stage: ["towel_dry", "dry_hair"] },
    })) ?? "accepted",
    /product_leave_in_specs_heat_activation_pre_heat_only/,
  )
})

test("R3 activation with a conditioner-replacement role is rejected", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...HEAT_GLOW_ACTIVATED,
      specs: { ...HEAT_GLOW_ACTIVATED.specs, roles: ["replacement_conditioner", "styling_prep"] },
    })) ?? "accepted",
    /product_leave_in_specs_heat_activation_pre_heat_only/,
  )
})

test("R4 route and activation must agree (route iff required)", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...HEAT_GLOW_ACTIVATED,
      specs: { ...HEAT_GLOW_ACTIVATED.specs, heat_activation_route: null },
    })) ?? "accepted",
    /product_leave_in_specs_heat_activation_route_iff_required/,
  )
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...GLISS_SHAPE,
      specs: { ...GLISS_SHAPE.specs, heat_activation_route: "airflow_shaping" },
    })) ?? "accepted",
    /product_leave_in_specs_heat_activation_route_iff_required/,
  )
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...HEAT_GLOW_ACTIVATED,
      specs: { ...HEAT_GLOW_ACTIVATED.specs, heat_activation_route: "hot_air" },
    })) ?? "accepted",
    /product_leave_in_specs_heat_activation_route_check/,
  )
})

test("R5 curated activated product without heat protection is rejected at COMMIT", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...HEAT_GLOW_ACTIVATED,
      specs: { ...HEAT_GLOW_ACTIVATED.specs, provides_heat_protection: false },
    })) ?? "accepted",
    /curated publication requires complete category facts/,
  )
})

test("R6 a fit row edited alone to replacement_capable is rejected at COMMIT", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.equal(await seedCase(pg, { id: ID.heatGlow, ...HEAT_GLOW_ACTIVATED }), null)
  assert.match(
    (await transaction(pg, async (db) => {
      await db.query(
        "UPDATE public.product_leave_in_fit_specs SET conditioner_relationship = 'replacement_capable' WHERE product_id = $1",
        [ID.heatGlow],
      )
    })) ?? "accepted",
    /curated publication requires complete category facts/,
  )
})

test("R7 deleting the activated product's pre-heat protocols is rejected at COMMIT", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.equal(await seedCase(pg, { id: ID.heatGlow, ...HEAT_GLOW_ACTIVATED }), null)
  assert.match(
    (await transaction(pg, async (db) => {
      await db.query(
        "DELETE FROM public.product_application_protocols WHERE product_id = $1 AND role = 'pre_heat_protection'",
        [ID.heatGlow],
      )
    })) ?? "accepted",
    /curated publication requires complete category facts/,
  )
})

test("R8 curated pre-heat-only product without heat protection stays rejected (regression)", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...GLISS_SHAPE,
      specs: { ...GLISS_SHAPE.specs, provides_heat_protection: false },
    })) ?? "accepted",
    /curated publication requires complete category facts/,
  )
})

test("R9 setting activation before plan_roles fails at the first statement", async (t) => {
  const pg = await heatActivationDatabase(t)
  await seedS1HeatGlow(pg)
  assert.match(
    (await transaction(pg, async (db) => {
      await db.query(
        "UPDATE public.product_leave_in_specs SET heat_activation_required = true, heat_activation_route = 'airflow_shaping' WHERE product_id = $1",
        [ID.s1HeatGlow],
      )
      await db.query(
        "UPDATE public.product_leave_in_specs SET plan_roles = ARRAY['pre_heat_application'], roles = ARRAY['styling_prep'] WHERE product_id = $1",
        [ID.s1HeatGlow],
      )
    })) ?? "accepted",
    /product_leave_in_specs_heat_activation_pre_heat_only/,
  )
})

test("R10 an activated curated product whose heat row is a shared template is rejected at COMMIT", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...HEAT_GLOW_ACTIVATED,
      protocols: [{ role: "pre_heat_protection", family: "pre_heat_damp", workflow: false }],
    })) ?? "accepted",
    /curated publication requires complete category facts/,
  )
})

test("R11 a non-activated curated product carrying the activated workflow is rejected at COMMIT", async (t) => {
  const pg = await heatActivationDatabase(t)
  assert.match(
    (await seedCase(pg, {
      id: ID.bad,
      ...GLISS_SHAPE,
      protocols: [{ role: "pre_heat_protection", workflow: true }],
    })) ?? "accepted",
    /curated publication requires complete category facts/,
  )
})

test("L1 the schema migration aborts on unknown drift of either redefined function", async (t) => {
  const migration = await readRepoFile(S3_SCHEMA_MIGRATION)
  const expandDrift = await preHeatActivationDatabase(t)
  const expandSource = (
    await expandDrift.query<{ def: string }>(
      "SELECT pg_get_functiondef('public.expand_leave_in_eligibility(text[],text[],text[],text[],boolean,boolean)'::regprocedure) AS def",
    )
  ).rows[0]!.def
  await expandDrift.exec(expandSource.replace("DECLARE", "DECLARE\n  -- drift"))
  await assert.rejects(expandDrift.exec(migration), /expand_leave_in_eligibility lineage changed/)

  const gateDrift = await preHeatActivationDatabase(t)
  const gateSource = (
    await gateDrift.query<{ def: string }>(
      "SELECT pg_get_functiondef('public.assert_personal_plan_curated_publication_v1_without_v2(uuid)'::regprocedure) AS def",
    )
  ).rows[0]!.def
  await gateDrift.exec(gateSource.replace("DECLARE", "DECLARE\n  -- drift"))
  await assert.rejects(gateDrift.exec(migration), /curated publication gate lineage changed/)
})

test("the schema migration adds the route column, validated CHECKs and the fit dependency trigger", async (t) => {
  const pg = await heatActivationDatabase(t)
  const constraints = await pg.query<{ conname: string; convalidated: boolean }>(
    "SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'public.product_leave_in_specs'::regclass AND conname LIKE '%heat_activation%' ORDER BY conname",
  )
  assert.deepEqual(
    constraints.rows.map((row) => [row.conname, row.convalidated]),
    [
      ["product_leave_in_specs_heat_activation_pre_heat_only", true],
      // Pre-existing production CHECK, reproduced by the harness.
      ["product_leave_in_specs_heat_activation_requires_styling_role", true],
      ["product_leave_in_specs_heat_activation_route_check", true],
      ["product_leave_in_specs_heat_activation_route_iff_required", true],
    ],
  )
  const triggers = await pg.query<{ tgname: string }>(
    "SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.product_leave_in_fit_specs'::regclass AND NOT tgisinternal",
  )
  assert.ok(
    triggers.rows.some(
      (row) => row.tgname === "validate_personal_plan_curated_publication_dependency",
    ),
  )
})
