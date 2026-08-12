import assert from "node:assert/strict"
import test from "node:test"

import {
  SHARED_APPLICATION_TEMPLATE_BY_KEY_V2,
  SHARED_APPLICATION_TEMPLATES_V2,
} from "../src/lib/routines/personal-plan/application/shared-templates-v2"

test("Stage 5 V2 shared template registry contains unique, validated guidance keys", () => {
  const keys = SHARED_APPLICATION_TEMPLATES_V2.map(({ guidanceKey }) => guidanceKey)

  assert.equal(new Set(keys).size, keys.length)
  assert.equal(SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.size, keys.length)
})

test("regular shampoo has one canonical technique with no product or conditioner wording", () => {
  const template = SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get("shampoo.standard-scalp-cleanse.v2")

  assert.ok(template)
  assert.deepEqual(
    template.steps.map(({ copyTemplateDe }) => copyTemplateDe),
    [
      "Haare und Kopfhaut vollständig anfeuchten.",
      "Eine kleine Menge auf die Kopfhaut geben und sanft einmassieren. Die Längen werden beim Ausspülen mitgereinigt.",
      "Gründlich ausspülen.",
    ],
  )
  assert.doesNotMatch(JSON.stringify(template), /OGX|Conditioner/i)
})

test("ordinary templates contain only the two reviewed interpolation variables", () => {
  const variables = SHARED_APPLICATION_TEMPLATES_V2.flatMap((template) =>
    template.steps.flatMap((step) =>
      [...step.copyTemplateDe.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]),
    ),
  )

  assert.deepEqual([...new Set(variables)].sort(), ["contact_time_de"])
})
