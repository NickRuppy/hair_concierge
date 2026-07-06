import assert from "node:assert/strict"
import test from "node:test"

import { INFO_TIP_IDS, INFO_TIPS, type InfoTipId } from "../src/lib/help/info-tips"

const REQUIRED_INFO_TIP_IDS: InfoTipId[] = [
  "product.shampoo",
  "product.conditioner",
  "product.leave_in",
  "product.hair_oil",
  "product.mask",
  "product.scalp_peeling",
  "product.dry_shampoo",
  "product.bond_builder",
  "product.deep_cleansing_shampoo",
  "quiz.hair_texture",
  "quiz.thickness",
  "quiz.density",
  "quiz.pull_test",
  "routine.towel_technique",
  "routine.diffuser",
  "routine.bonnet",
  "routine.pineapple",
  "routine.heat_protection",
]

const GERMAN_COPY_MARKER =
  /(der|die|das|und|nicht|kein|meist|pflege|produkt|haar|haare|kopfhaut|längen|strähne|föhn|glätteisen|schlafhaube)/i

test("required info-tip IDs have German title and body copy", () => {
  for (const id of REQUIRED_INFO_TIP_IDS) {
    const tip = INFO_TIPS[id]

    assert.ok(tip, `Missing info tip: ${id}`)
    assert.equal(typeof tip.title, "string", `${id} title should be a string`)
    assert.equal(typeof tip.body, "string", `${id} body should be a string`)
    assert.ok(tip.title.trim().length > 0, `${id} title should not be empty`)
    assert.ok(tip.body.trim().length > 0, `${id} body should not be empty`)
    assert.match(tip.body, GERMAN_COPY_MARKER, `${id} body should be German copy`)
  }
})

test("optional surface test copy is available for later wiring", () => {
  assert.ok(INFO_TIP_IDS.includes("quiz.surface_test"))
  assert.ok(INFO_TIPS["quiz.surface_test"].title.trim())
  assert.ok(INFO_TIPS["quiz.surface_test"].body.trim())
})
