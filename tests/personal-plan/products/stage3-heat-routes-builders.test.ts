import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { stage3HeatRoutesFromSnapshot } from "../../../src/lib/personal-plan/oil-heat-context"
import type { InitialNeedPlanSnapshot } from "../../../src/lib/personal-plan/types"

/**
 * Heat activation (S3 §4.4): every Stage-3 builder hands the user's heat routes to
 * the authority, derived by one helper. A builder that forgets them makes every
 * heat-activated product `unknown` (fail closed) — this pins that none forgets.
 */

function snapshot(routes: string[]): InitialNeedPlanSnapshot {
  return {
    assessments: {
      heatExposure: {
        events: routes.map((route, index) => ({
          id: `heat:${index}`,
          tool: "hair_dryer",
          route,
          frequency: "weekly_2x",
          sourceRuleIds: [],
        })),
      },
    },
  } as unknown as InitialNeedPlanSnapshot
}

test("heat routes come from shaping and hot-tool events only, sorted and distinct", () => {
  assert.deepEqual(stage3HeatRoutesFromSnapshot(snapshot([])), [])
  assert.deepEqual(stage3HeatRoutesFromSnapshot(snapshot(["ordinary_airflow", "unclassified"])), [])
  assert.deepEqual(
    stage3HeatRoutesFromSnapshot(
      snapshot(["direct_contact_heat", "airflow_shaping", "direct_contact_heat"]),
    ),
    ["airflow_shaping", "direct_contact_heat"],
  )
  assert.deepEqual(stage3HeatRoutesFromSnapshot({} as InitialNeedPlanSnapshot), [])
})

const BUILDERS = [
  "src/lib/personal-plan/products/production-persistence-gateway.ts",
  "src/lib/personal-plan/product-previews.ts",
  "src/lib/discovery/equal-options.ts",
  "src/lib/scan/load-scan-verdict.ts",
  "src/lib/mobile/scan-service.ts",
] as const

test("all Stage-3 authority builders pass heatRoutes from the shared helper", async () => {
  for (const path of BUILDERS) {
    const source = await readFile(new URL(`../../../${path}`, import.meta.url), "utf8")
    assert.match(source, /heatRoutes: stage3HeatRoutesFromSnapshot\(/, path)
  }
  // The scan verdict builder forwards the caller's routes; fit comparison spreads its input.
  const resolve = await readFile(
    new URL("../../../src/lib/scan/resolve-verdict.ts", import.meta.url),
    "utf8",
  )
  assert.match(resolve, /input\.heatRoutes \? \{ heatRoutes: input\.heatRoutes \}/)
  const fit = await readFile(
    new URL("../../../src/lib/personal-plan/products/fit-comparison.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(
    fit,
    /heatCarrierCoverage: \{/,
    "fit comparison must reuse the caller's input",
  )
})
