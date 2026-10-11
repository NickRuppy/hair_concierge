import assert from "node:assert/strict"
import test from "node:test"

import type { PGlite } from "@electric-sql/pglite"

import { expandLeaveInEligibility } from "@/lib/leave-in-research/production-adapter"

import liveInputs from "./fixtures/leave-in-heat-activation/live-expander-inputs-2026-10-11.json"
import {
  heatActivationDatabase,
  preHeatActivationDatabase,
} from "./helpers/leave-in-heat-activation-postgres"

/**
 * Leave-In v1.2 eligibility expander (S3 plan §2.5): the SQL function and its
 * TS port agree on every activation × protection × stage combination, and the
 * redefinition moves no live non-activated product.
 */

type ExpanderInput = {
  thicknesses: string[]
  roles: string[]
  care_benefits: string[]
  application_stage: string[]
  provides_heat_protection: boolean
  heat_activation_required: boolean
}
type Row = { thickness: string; need_bucket: string; styling_context: string }

async function sqlExpand(pg: PGlite, input: ExpanderInput): Promise<Row[]> {
  const result = await pg.query<Row>(
    "SELECT thickness, need_bucket, styling_context FROM public.expand_leave_in_eligibility($1, $2, $3, $4, $5, $6)",
    [
      input.thicknesses,
      input.roles,
      input.care_benefits,
      input.application_stage,
      input.provides_heat_protection,
      input.heat_activation_required,
    ],
  )
  return result.rows.map((row) => ({ ...row }))
}

function tsExpand(input: ExpanderInput): Row[] {
  return expandLeaveInEligibility({
    thicknesses: input.thicknesses,
    roles: input.roles,
    careBenefits: input.care_benefits,
    applicationStage: input.application_stage,
    providesHeatProtection: input.provides_heat_protection,
    heatActivationRequired: input.heat_activation_required,
  }).map((row) => ({ ...row }))
}

const STAGES = [
  [],
  ["towel_dry"],
  ["towel_dry", "pre_heat"],
  ["towel_dry", "pre_heat", "dry_hair"],
  ["post_style"],
]

test("TS and SQL expanders agree on the activation × protection × stage matrix", async (t) => {
  const pg = await heatActivationDatabase(t)
  let cases = 0
  for (const activation of [false, true])
    for (const protection of [false, true])
      for (const stage of STAGES)
        for (const roles of [["extension_conditioner"], ["styling_prep"]]) {
          const input: ExpanderInput = {
            thicknesses: ["fine", "normal", "coarse", "unknown"],
            roles,
            care_benefits: ["moisture", "anti_frizz", "shine", "repair", "curl_definition"],
            application_stage: stage,
            provides_heat_protection: protection,
            heat_activation_required: activation,
          }
          assert.deepEqual(tsExpand(input), await sqlExpand(pg, input), JSON.stringify(input))
          cases += 1
        }
  assert.equal(cases, 40)
})

test("activation is never heat protection, and activated products keep their care buckets in heat_style", async (t) => {
  const pg = await heatActivationDatabase(t)
  const neqi: ExpanderInput = {
    thicknesses: ["coarse", "normal"],
    roles: ["styling_prep"],
    care_benefits: ["anti_frizz"],
    application_stage: ["towel_dry", "pre_heat"],
    provides_heat_protection: true,
    heat_activation_required: true,
  }
  assert.deepEqual(await sqlExpand(pg, neqi), [
    { thickness: "coarse", need_bucket: "heat_protect", styling_context: "heat_style" },
    { thickness: "coarse", need_bucket: "moisture_anti_frizz", styling_context: "heat_style" },
    { thickness: "normal", need_bucket: "heat_protect", styling_context: "heat_style" },
    { thickness: "normal", need_bucket: "moisture_anti_frizz", styling_context: "heat_style" },
  ])
  const heatGlow: ExpanderInput = {
    thicknesses: ["normal"],
    roles: ["styling_prep"],
    care_benefits: ["moisture", "anti_frizz", "shine"],
    application_stage: ["towel_dry", "pre_heat", "dry_hair"],
    provides_heat_protection: true,
    heat_activation_required: true,
  }
  assert.deepEqual(await sqlExpand(pg, heatGlow), [
    { thickness: "normal", need_bucket: "heat_protect", styling_context: "heat_style" },
    { thickness: "normal", need_bucket: "moisture_anti_frizz", styling_context: "heat_style" },
    { thickness: "normal", need_bucket: "shine_protect", styling_context: "heat_style" },
  ])
  const activatedUnprotected = await sqlExpand(pg, { ...neqi, provides_heat_protection: false })
  assert.ok(activatedUnprotected.every((row) => row.need_bucket !== "heat_protect"))
})

test("all 68 live-shaped leave-in fixtures keep identical rows", async (t) => {
  const before = await preHeatActivationDatabase(t)
  const after = await heatActivationDatabase(t)
  const rows = (liveInputs as { rows: Array<ExpanderInput & { product_id: string }> }).rows
  assert.equal(rows.length, 68)
  assert.ok(rows.every((row) => row.heat_activation_required === false))
  for (const input of rows) {
    const old = await sqlExpand(before, input)
    assert.deepEqual(await sqlExpand(after, input), old, input.product_id)
    assert.deepEqual(tsExpand(input), old, input.product_id)
  }
})
