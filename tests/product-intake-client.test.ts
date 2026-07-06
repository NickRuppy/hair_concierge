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

test("needs-more-info photo intake requires explicitly missing follow-up fields", () => {
  const existingUsageId = "00000000-0000-4000-8000-000000000001"
  const committedFrontImagePath = "user-1/submission-1/front-front.jpg"

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "conditioner",
      frequency: "weekly_3_4x",
      brandText: "Garnier",
      productName: "",
      frontImagePath: null,
      committedFrontImagePath,
      existingUsageId,
      missingFields: ["barcode photo", "product name"],
    }),
    false,
  )

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "conditioner",
      frequency: "weekly_3_4x",
      brandText: "Garnier",
      productName: "Hair Food Aloe Vera",
      frontImagePath: null,
      committedFrontImagePath,
      barcodeImagePath: "user-1/submission-1/barcode.jpg",
      existingUsageId,
      missingFields: ["barcode photo", "product name"],
    }),
    true,
  )
})

test("needs-more-info intake gates brand, barcode, and front photo requirements", () => {
  const existingUsageId = "00000000-0000-4000-8000-000000000001"
  const committedFrontImagePath = "user-1/submission-1/front-front.jpg"

  assert.equal(
    canSubmitProductIntake({
      method: "manual",
      category: "conditioner",
      frequency: "weekly_1x",
      brandText: "",
      productName: "Hair Food Aloe Vera",
      missingFields: ["Marke"],
    }),
    false,
  )

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "conditioner",
      frequency: "weekly_1x",
      brandText: "Garnier",
      productName: "Hair Food Aloe Vera",
      frontImagePath: null,
      committedFrontImagePath,
      existingUsageId,
      missingFields: ["EAN"],
    }),
    false,
  )

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "conditioner",
      frequency: "weekly_1x",
      brandText: "Garnier",
      productName: "Hair Food Aloe Vera",
      frontImagePath: null,
      barcodeImagePath: "user-1/submission-1/barcode.jpg",
      missingFields: ["Vorderseite"],
    }),
    false,
  )
})
