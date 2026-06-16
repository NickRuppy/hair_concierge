import assert from "node:assert/strict"
import test from "node:test"

import {
  PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE,
  PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES,
  ProductIntakeClientImageCompressionError,
  getProductIntakeClientScaledImageDimensions,
  prepareProductIntakeImageForUpload,
  shouldPrepareProductIntakeImageForUpload,
} from "../src/lib/product-intake/client-image-compression"

test("product intake client image preparation keeps small files untouched without browser APIs", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "front.jpg", { type: "image/jpeg" })

  const prepared = await prepareProductIntakeImageForUpload(file)

  assert.equal(prepared, file)
})

test("product intake client image preparation rejects oversized files without browser APIs", async () => {
  const file = new File([new Uint8Array(PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES + 1)], "front.jpg", {
    type: "image/jpeg",
  })

  await assert.rejects(
    () => prepareProductIntakeImageForUpload(file),
    ProductIntakeClientImageCompressionError,
  )
})

test("product intake client image preparation keeps HEIC files untouched without browser decode", async () => {
  const file = new File(
    [new Uint8Array(PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES + 1)],
    "front.heic",
    { type: "image/heic" },
  )

  const prepared = await prepareProductIntakeImageForUpload(file)

  assert.equal(prepared, file)
})

test("product intake client image preparation decides from size or dimensions", () => {
  assert.equal(
    shouldPrepareProductIntakeImageForUpload({
      fileSizeBytes: PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES - 1,
      width: PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE,
      height: PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE,
    }),
    false,
  )
  assert.equal(
    shouldPrepareProductIntakeImageForUpload({
      fileSizeBytes: PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES + 1,
      width: 800,
      height: 800,
    }),
    true,
  )
  assert.equal(
    shouldPrepareProductIntakeImageForUpload({
      fileSizeBytes: PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES - 1,
      width: PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE + 1,
      height: 800,
    }),
    true,
  )
})

test("product intake client image scaling preserves aspect ratio", () => {
  assert.deepEqual(getProductIntakeClientScaledImageDimensions(1200, 800), {
    width: 1200,
    height: 800,
  })
  assert.deepEqual(getProductIntakeClientScaledImageDimensions(3600, 2400), {
    width: 1800,
    height: 1200,
  })
  assert.deepEqual(getProductIntakeClientScaledImageDimensions(2400, 3600), {
    width: 1200,
    height: 1800,
  })
})
