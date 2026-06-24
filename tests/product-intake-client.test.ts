import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProductIntakeSubmissionPayload,
  canSubmitProductIntake,
} from "../src/lib/product-intake/client"

test("photo intake can submit with a committed front image only for an existing usage edit", () => {
  const committedFrontImagePath = "user-1/submission-1/front-front.jpg"
  const existingUsageId = "00000000-0000-4000-8000-000000000001"

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "mask",
      frequency: "weekly_1x",
      brandText: "",
      productName: "",
      frontImagePath: null,
      committedFrontImagePath,
    }),
    false,
  )

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "mask",
      frequency: "weekly_1x",
      brandText: "",
      productName: "",
      frontImagePath: null,
      committedFrontImagePath,
      existingUsageId,
    }),
    true,
  )

  const payload = buildProductIntakeSubmissionPayload({
    method: "photo",
    category: "mask",
    frequency: "weekly_1x",
    brandText: "",
    productName: "",
    frontImagePath: null,
    committedFrontImagePath,
    existingUsageId,
  })

  assert.equal(payload.front_image_path, undefined)
  assert.equal(payload.existing_usage_id, existingUsageId)
})
