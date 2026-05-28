import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { HeatToolsScreen } from "../src/components/onboarding/screens/heat-tools-screen"
import { hairProfileFullSchema } from "../src/lib/validators"
import { STYLING_TOOL_LABELS, STYLING_TOOL_OPTIONS, STYLING_TOOLS } from "../src/lib/vocabulary"

test("thermal rollers are a supported heat tool with German profile label", () => {
  assert.ok(STYLING_TOOLS.includes("thermal_rollers"))
  assert.equal(STYLING_TOOL_LABELS.thermal_rollers, "Thermo-Lockenwickler")
  assert.ok(
    STYLING_TOOL_OPTIONS.some(
      (option) => option.value === "thermal_rollers" && option.label === "Thermo-Lockenwickler",
    ),
  )
})

test("hair profile validator accepts thermal rollers as a styling tool", () => {
  const parsed = hairProfileFullSchema.parse({
    hair_texture: "wavy",
    thickness: "normal",
    density: "medium",
    concerns: [],
    goals: [],
    styling_tools: ["thermal_rollers"],
  })

  assert.deepEqual(parsed.styling_tools, ["thermal_rollers"])
})

test("heat tools onboarding screen renders thermal rollers as a selectable option", () => {
  const html = renderToStaticMarkup(
    <HeatToolsScreen
      selected={["thermal_rollers"]}
      onToggle={() => {}}
      onContinue={() => {}}
      onBack={() => {}}
      onNone={() => {}}
    />,
  )

  assert.match(html, /Thermo-Lockenwickler/)
})
