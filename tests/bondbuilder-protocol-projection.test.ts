import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  makeBondbuilderProfile,
  fact,
  sealProfile,
  unknownFact,
} from "./fixtures/bondbuilder-research/profile"
import { projectBondbuilderProtocol } from "../src/lib/bondbuilder-research/protocol-projection"
import { projectBondbuilderCadence } from "../src/lib/bondbuilder-research/cadence-projection"
import { adaptReviewedProductApplicationPointersV2 } from "../src/lib/routines/personal-plan/application/product-protocol-adapter"

const productId = "30000000-0000-4000-8000-000000000001"

test("exact DE OGX bedtime directions project without inventing a wash, finite wait or DE cadence", () => {
  const { profile } = JSON.parse(
    readFileSync(
      new URL(
        "../data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/ogx-amendment.json",
        import.meta.url,
      ),
      "utf8",
    ),
  )
  const before = structuredClone(profile)
  const result = projectBondbuilderProtocol(profile, profile.identity.product_id)
  assert.equal(result.status, "resolved")
  if (result.status !== "resolved") return
  assert.equal(result.pointer.applicationFamily, "overnight_leave_in_treatment")
  assert.equal(result.pointer.facts.contactTime, null)
  assert.equal(result.pointer.facts.overnightAllowed, true)
  assert.equal(result.pointer.facts.shampooAfterTreatment, undefined)
  assert.equal(result.pointer.facts.rinse, "leave_in")
  assert.equal(
    result.pointer.exactSteps.some((s) => s.action === "rinse"),
    false,
  )
  const copy = result.pointer.exactSteps.map((s) => s.copyDe).join(" ")
  assert.match(copy, /Vor dem Schlafengehen/)
  assert.match(copy, /zwischen den Händen/)
  assert.match(copy, /Über Nacht im Haar lassen\. Nicht ausspülen\./)
  assert.doesNotMatch(copy, /Shampoo|Conditioner|Minuten|1–2/)
  assert.equal(projectBondbuilderCadence(profile), null)
  assert.equal(result.cadenceHold, "exact_product_cadence_unavailable")
  assert.deepEqual(profile, before)
  for (const action of ["shampoo", "rinse", "apply_conditioner"]) {
    const contradictory = structuredClone(profile)
    contradictory.application.sequence.value.push({
      action,
      optional: false,
      timing: null,
      source_ids: ["D06-OGX-BOOZT"],
      note: "A wash instruction must not be manufactured from bedtime.",
    })
    sealProfile(contradictory)
    assert.equal(
      projectBondbuilderProtocol(contradictory, profile.identity.product_id).status,
      "hold",
      action,
    )
  }
  const earlyWait = structuredClone(profile)
  earlyWait.application.sequence.value.unshift(earlyWait.application.sequence.value.pop())
  sealProfile(earlyWait)
  assert.equal(
    projectBondbuilderProtocol(earlyWait, profile.identity.product_id).status,
    "hold",
    "overnight wait must follow application",
  )
  const forbiddenOvernight = structuredClone(profile)
  forbiddenOvernight.application.longer_wear.value.overnight_allowed = false
  sealProfile(forbiddenOvernight)
  assert.equal(
    projectBondbuilderProtocol(forbiddenOvernight, profile.identity.product_id).status,
    "hold",
    "explicit longer-wear contradiction",
  )
})
function protocolProfile() {
  const profile = makeBondbuilderProfile()
  profile.application.market_applicability = "cross_market_complement"
  return sealProfile(profile)
}
test("epres exact projection carries finished dilution, minimum wait and overnight through the reviewed pointer reader", () => {
  const profile = protocolProfile()
  profile.application.dilution.value!.concentrate = { quantity: 1, unit: "vial" }
  sealProfile(profile)
  const result = projectBondbuilderProtocol(profile, productId)
  assert.equal(result.status, "resolved")
  if (result.status !== "resolved") return
  assert.equal(result.pointer.scope.productId, productId)
  assert.equal(result.pointer.facts.dilution?.finishedVolumeMl, 150)
  assert.equal(result.pointer.facts.dilution?.concentrateAmount, 1)
  assert.deepEqual(result.pointer.facts.contactTime, {
    kind: "minimum_seconds",
    minimumSeconds: 600,
  })
  assert.equal(result.pointer.facts.overnightAllowed, true)
  assert.equal(result.pointer.facts.applicationState, "pre_wash_dry_hair")
  const copy = result.pointer.exactSteps.map((s) => s.copyDe).join(" ")
  assert.match(copy, /150 ml fertige Mischung/)
  assert.match(copy, /ungewaschene/)
  assert.match(copy, /Mindestens 10 Minuten/)
  assert.match(copy, /über Nacht/)
  assert.doesNotMatch(copy, /150 ml Wasser/)
  const row = {
    product_id: productId,
    category: "bondbuilder",
    role: "specialized_bond_treatment",
    guidance_payload_v2: result.pointer,
    application_state: null,
    reapplication: null,
    source_url: profile.sources[0].url,
    source_text: profile.sources.find(
      (source) => source.id === profile.application.direction_source_ids[0],
    )!.observation,
    updated_at: "2026-10-02",
  }
  assert.equal(adaptReviewedProductApplicationPointersV2([row]).length, 1)
  assert.equal(
    adaptReviewedProductApplicationPointersV2([
      { ...row, product_id: "30000000-0000-4000-8000-000000000099" },
    ]).length,
    0,
  )
  assert.equal(
    adaptReviewedProductApplicationPointersV2([{ ...row, role: "post_wash_leave_in" }]).length,
    0,
  )
  assert.equal(
    adaptReviewedProductApplicationPointersV2([
      { ...row, source_url: "https://unrelated.example/product" },
    ]).length,
    0,
  )
  assert.equal(adaptReviewedProductApplicationPointersV2([{ ...row, source_text: "" }]).length, 0)
})

test("reviewed distribution translations preserve source facts while unreviewed wording and unknown area stay held", () => {
  for (const [source, expected] of [
    ["Roots to ends", "Vom Ansatz bis zu den Spitzen verteilen."],
    ["Fully saturate dry hair.", "Das trockene Haar vollständig benetzen."],
    ["Massage into wet lengths.", "In die feuchten Längen einmassieren."],
  ]) {
    const profile = protocolProfile()
    profile.application.distribution = fact(source)
    sealProfile(profile)
    const before = structuredClone(profile)
    const result = projectBondbuilderProtocol(profile, productId)
    assert.equal(result.status, "resolved", source)
    if (result.status !== "resolved") continue
    assert.equal(
      result.pointer.exactSteps.find((step) => step.stepKey === "distribute")?.copyDe,
      expected,
    )
    assert.deepEqual(profile, before)
  }
  const unreviewed = protocolProfile()
  unreviewed.application.distribution = fact("Roots to ends and then add another treatment.")
  sealProfile(unreviewed)
  assert.deepEqual(projectBondbuilderProtocol(unreviewed, productId), {
    status: "hold",
    reasons: ["distribution_requires_reviewed_translation"],
  })
  const missingArea = protocolProfile()
  missingArea.application.application_area = unknownFact()
  sealProfile(missingArea)
  assert.deepEqual(projectBondbuilderProtocol(missingArea, productId), {
    status: "hold",
    reasons: ["missing_exact_application_facts"],
  })
})

test("reviewed P04/P05/P07 direction literals retain their exact German copy and conditioner requirement", () => {
  const p04 = protocolProfile()
  p04.application.dilution = unknownFact()
  p04.application.longer_wear = unknownFact()
  p04.application.amount = fact({ kind: "qualitative", instruction: "Apply a generous amount." })
  p04.application.conditioner = fact({
    before: "not_stated",
    after: "recommended",
    minimum_wait_seconds: null,
    guidance_reference: null,
  })
  sealProfile(p04)
  const p04Result = projectBondbuilderProtocol(p04, productId)
  assert.equal(p04Result.status, "resolved")
  if (p04Result.status === "resolved") {
    const copy = p04Result.pointer.exactSteps.map((step) => step.copyDe).join(" ")
    assert.match(copy, /Eine großzügige Menge verwenden\./)
    assert.match(copy, /Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen\./)
    assert.doesNotMatch(copy, /Wenn du keine zusätzliche Pflege brauchst/)
  }

  const p05 = protocolProfile()
  p05.application.dilution = unknownFact()
  p05.application.longer_wear = unknownFact()
  p05.application.amount = unknownFact()
  p05.application.distribution = unknownFact()
  p05.application.conditioner = fact({
    before: "not_stated",
    after: "recommended",
    minimum_wait_seconds: null,
    guidance_reference: null,
  })
  sealProfile(p05)
  const p05Result = projectBondbuilderProtocol(p05, productId)
  assert.equal(p05Result.status, "resolved")
  if (p05Result.status === "resolved")
    assert.match(
      p05Result.pointer.exactSteps.map((step) => step.copyDe).join(" "),
      /Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen\./,
    )

  const p07 = protocolProfile()
  p07.application.dilution = unknownFact()
  p07.application.longer_wear = unknownFact()
  p07.application.amount = unknownFact()
  p07.application.distribution = fact("Apply from roots to tips.")
  sealProfile(p07)
  const p07Result = projectBondbuilderProtocol(p07, productId)
  assert.equal(p07Result.status, "resolved")
  if (p07Result.status === "resolved")
    assert.equal(
      p07Result.pointer.exactSteps.find((step) => step.stepKey === "distribute")?.copyDe,
      "Vom Ansatz bis in die Spitzen verteilen.",
    )
})

test("unsupported timing and identity produce holds without a borrowed routine", () => {
  for (const mutate of [
    (p: ReturnType<typeof makeBondbuilderProfile>) => {
      p.application.placement = fact("between_washes")
    },
    (p: ReturnType<typeof makeBondbuilderProfile>) => {
      p.application.state_modifiers = fact(["at_bedtime"])
    },
    (p: ReturnType<typeof makeBondbuilderProfile>) => {
      p.identity.product_id = "30000000-0000-4000-8000-000000000099"
    },
    (p: ReturnType<typeof makeBondbuilderProfile>) => {
      p.application.market_applicability = "unresolved"
    },
  ]) {
    const profile = protocolProfile()
    mutate(profile)
    sealProfile(profile)
    assert.equal(projectBondbuilderProtocol(profile, productId).status, "hold")
  }
})

test("post-shampoo treatment permits its optional Conditioner's own rinse only after the full wait", () => {
  const profile = protocolProfile()
  const app = profile.application
  app.placement = fact("post_shampoo")
  app.treatment_role = fact("leave_in_treatment")
  app.hair_state = fact("damp")
  app.state_modifiers = fact(["thoroughly_towel_dried"])
  app.amount = fact({
    kind: "starting_dose",
    amount: { quantity: 1, unit: "pump" },
    add_as_needed: true,
  })
  app.dilution = unknownFact()
  app.longer_wear = unknownFact()
  app.timing = fact({ kind: "exact_seconds", seconds: 240, purpose: "wait_before_next_step" })
  app.conditioner = fact({
    before: "not_allowed",
    after: "optional",
    minimum_wait_seconds: 240,
    guidance_reference: "owner-approved-existing-conditioner",
  })
  app.rinse = fact({ treatment_mode: "leave_in", standalone_treatment_rinse: false })
  app.sequence = fact([
    {
      action: "shampoo",
      optional: false,
      timing: null,
      source_ids: ["R07"],
      note: "Shampoo first.",
    },
    {
      action: "towel_dry",
      optional: false,
      timing: null,
      source_ids: ["R07"],
      note: "Dry thoroughly.",
    },
    {
      action: "apply_treatment",
      optional: false,
      timing: null,
      source_ids: ["R07"],
      note: "Apply.",
    },
    {
      action: "wait",
      optional: false,
      timing: app.timing.value,
      source_ids: ["R07"],
      note: "Full wait.",
    },
    {
      action: "apply_conditioner",
      optional: true,
      timing: null,
      source_ids: ["R07"],
      note: "Normal conditioner if needed.",
    },
    {
      action: "rinse",
      optional: true,
      timing: null,
      source_ids: ["R07"],
      note: "Rinse the conditioner.",
    },
  ])
  sealProfile(profile)
  const result = projectBondbuilderProtocol(profile, productId)
  assert.equal(result.status, "resolved")
  if (result.status !== "resolved") return
  assert.deepEqual(result.pointer.facts.amount, {
    kind: "starting_dose",
    quantity: 1,
    unit: "pump",
    addAsNeeded: true,
  })
  assert.equal(
    result.pointer.exactSteps.some((s) => s.action === "rinse"),
    false,
  )
  assert.equal(result.pointer.facts.conditionerSequence?.minimumWaitSeconds, 240)
  assert.match(
    result.pointer.exactSteps.find((step) => step.stepKey === "conditioner-after")?.copyDe ?? "",
    /Danach kannst du deinen üblichen Conditioner verwenden und diesen wie gewohnt ausspülen\./,
  )
  assert.match(
    result.pointer.exactSteps.find((step) => step.stepKey === "conditioner-after")?.copyDe ?? "",
    /Wenn du keine zusätzliche Pflege brauchst, lässt du diesen Schritt weg\./,
  )
  const invalid = structuredClone(profile)
  invalid.application.sequence.value!.splice(4, 0, {
    action: "rinse",
    optional: false,
    timing: null,
    source_ids: ["R07"],
    note: "Invalid standalone rinse.",
  })
  sealProfile(invalid)
  assert.equal(projectBondbuilderProtocol(invalid, productId).status, "hold")
})
