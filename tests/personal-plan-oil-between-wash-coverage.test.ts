import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { compileApplicationViewV2 as compileApplicationViewV2Impl } from "../src/lib/routines/personal-plan/application/compiler-v2"
import { APPLICATION_DAY_TYPE_KEYS } from "../src/lib/routines/personal-plan/application/contracts"
import type { ProductApplicationPointerV2 } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"

const compileApplicationViewV2 = compileApplicationViewV2Impl

type BackfillItem = {
  product_id: string
  product_name: string
  source_role: string
  guidance_payload_v2: ProductApplicationPointerV2
}

const artifact = JSON.parse(
  readFileSync(
    "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
    "utf8",
  ),
) as { items: BackfillItem[] }
const oilItems = artifact.items.filter((item) => item.guidance_payload_v2.scope.category === "oil")
const oilProductIds = [...new Set(oilItems.map((item) => item.product_id))]
const conventionalProductIds = oilProductIds.filter((productId) =>
  oilItems.some(
    (item) =>
      item.product_id === productId &&
      (item.guidance_payload_v2.role === "finish" ||
        item.guidance_payload_v2.role === "leave_in") &&
      item.guidance_payload_v2.facts.rinse === "leave_in" &&
      (item.guidance_payload_v2.facts.applicationArea === "hair_lengths_ends" ||
        item.guidance_payload_v2.facts.applicationArea === "hair_ends") &&
      item.guidance_payload_v2.workflowId === null &&
      item.guidance_payload_v2.requiredCompanionProductId === null &&
      item.guidance_payload_v2.runtimeBlockerCode === null,
  ),
)

test("the reviewed Oil cohort has 27 conventional leave-on products and 13 exact-only exceptions", () => {
  assert.equal(oilProductIds.length, 40)
  assert.equal(conventionalProductIds.length, 27)
  const exactOnly = oilProductIds
    .filter((productId) => !conventionalProductIds.includes(productId))
    .map((productId) => oilItems.find((item) => item.product_id === productId)!.product_name)
    .sort()
  assert.deepEqual(exactOnly, [
    "Allgäuer Ölmühle Bio Traubenkernöl",
    "BioGourmet Distelöl",
    "Garnier Fructis Sleek & Stay Heat-Activated Serum",
    "KoRo MCT Öl",
    "MoriVeda Premium Moringaöl",
    "NANOIL Avocadoöl",
    "benecos BIO Körperöl Aprikosenkernöl",
    "benecos BIO Körperöl Macadamianussöl",
    "benecos BIO Körperöl Mandelöl",
    "benecos BIO Körperöl Wunderbaumsamenöl",
    "dmBio Kokosöl nativ",
    "dmBio natives Olivenöl extra",
    "nedura Schwarzkümmelöl ungefiltert",
  ])
})

test("every current conventional Oil compiles to one dry-first damp-alternative between-wash card", () => {
  for (const currentProductId of conventionalProductIds) {
    const candidate = oilItems.find(
      (item) =>
        item.product_id === currentProductId &&
        (item.guidance_payload_v2.role === "finish" ||
          item.guidance_payload_v2.role === "leave_in"),
    )!
    const pointer = candidate.guidance_payload_v2
    const dayKey = pointer.role === "finish" ? "between_wash_care_day" : "refresh_day"
    const result = compileApplicationViewV2({
      input: {
        routineItems: [
          {
            itemId: `item-${currentProductId}`,
            productId: currentProductId,
            productName: candidate.product_name,
            category: "oil",
            role: pointer.role,
            sourceRoutineRole: candidate.source_role,
            inclusion: "included",
            availability: "owned",
            executable: true,
            applicationInstanceKey: `assignment-${currentProductId}`,
            catalogFacts: { weight: "medium" },
          },
        ],
        unresolvedRoutineItems: [],
        profile: {},
        dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({
          key,
          sortOrder: index + 1,
        })),
      } as never,
      familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
      productPointers: oilItems
        .filter(
          (item) =>
            item.product_id === currentProductId && item.source_role === candidate.source_role,
        )
        .map((item) => item.guidance_payload_v2),
    })

    assert.deepEqual(result.pointerIssues, [], candidate.product_name)
    const blocks =
      result.days
        .find(({ key }) => key === dayKey)
        ?.productBlocks.filter((block) => block.productId === currentProductId) ?? []
    assert.equal(blocks.length, 1, candidate.product_name)
    assert.deepEqual(
      blocks[0]?.steps.filter(({ action }) => action === "section").map(({ copyDe }) => copyDe),
      ["Auf trockenem Haar (empfohlen)", "Nach leichtem Anfeuchten"],
      candidate.product_name,
    )
    if (pointer.facts.applicationArea === "hair_ends") {
      const copy = blocks[0]?.steps.map(({ copyDe }) => copyDe).join(" ") ?? ""
      assert.match(copy, /Spitzen/, candidate.product_name)
      assert.doesNotMatch(copy, /Längen/, candidate.product_name)
    }
  }
})
