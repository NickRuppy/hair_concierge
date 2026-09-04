import assert from "node:assert/strict"
import test from "node:test"

import {
  OIL_WASH_FAMILY_DAY_TYPES,
  oilProtocolSupportsHeatEvent,
} from "../src/lib/personal-plan/oil-heat-context"

const hairDryerEvent = { tool: "hair_dryer" as const, route: "airflow_shaping" as const }

test("a wash-family heat event requires the Oil protocol to cover the complete family", () => {
  assert.equal(oilProtocolSupportsHeatEvent(["wash_day"], hairDryerEvent), false)
  assert.equal(oilProtocolSupportsHeatEvent([...OIL_WASH_FAMILY_DAY_TYPES], hairDryerEvent), true)
})

test("a styling heat event requires explicit styling-day Oil protocol compatibility", () => {
  const directHeatEvent = { tool: "straightener" as const, route: "direct_contact_heat" as const }
  assert.equal(oilProtocolSupportsHeatEvent([...OIL_WASH_FAMILY_DAY_TYPES], directHeatEvent), false)
  assert.equal(oilProtocolSupportsHeatEvent(["styling_day"], directHeatEvent), true)
})
