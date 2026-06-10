import assert from "node:assert/strict"
import test from "node:test"

import { buildEvalSeedPayloads } from "../scripts/eval-chat/client"

test("buildEvalSeedPayloads keeps routine inventory out of hair_profiles writes", () => {
  const { hairProfileRow, routineUsageRows } = buildEvalSeedPayloads(
    "user_eval",
    {
      hair_texture: "wavy",
      drying_method: "air_dry",
      onboarding_completed: true,
    },
    [
      {
        category: "shampoo",
        product_name: "Soft Wash",
        frequency_range: "weekly_3_4x",
      },
      {
        category: "conditioner",
      },
    ],
  )

  assert.deepEqual(hairProfileRow, {
    user_id: "user_eval",
    hair_texture: "wavy",
    drying_method: "air_dry",
  })

  assert.deepEqual(routineUsageRows, [
    {
      user_id: "user_eval",
      category: "shampoo",
      product_name: "Soft Wash",
      frequency_range: "weekly_3_4x",
    },
    {
      user_id: "user_eval",
      category: "conditioner",
      product_name: null,
      frequency_range: null,
    },
  ])
})

test("buildEvalSeedPayloads seeds shampoo usage from profile override when inventory omits it", () => {
  const { hairProfileRow, routineUsageRows } = buildEvalSeedPayloads("user_eval", {
    hair_texture: "wavy",
    shampoo_frequency: "weekly_3_4x",
  })

  assert.deepEqual(hairProfileRow, {
    user_id: "user_eval",
    hair_texture: "wavy",
  })

  assert.deepEqual(routineUsageRows, [
    {
      user_id: "user_eval",
      category: "shampoo",
      product_name: null,
      frequency_range: "weekly_3_4x",
    },
  ])
})
