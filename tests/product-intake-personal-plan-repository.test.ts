import assert from "node:assert/strict"
import test from "node:test"

import { createSupabaseProductIntakeRepository } from "../src/lib/product-intake/repository"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const USER_PRODUCT_ID = "22222222-2222-4222-8222-222222222222"
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333"
const NOW = "2026-08-08T10:00:00.000Z"

function rpcAdminStub() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  return {
    calls,
    admin: {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args })
        return Promise.resolve({
          data: {
            userProduct: {
              id: USER_PRODUCT_ID,
              user_id: USER_ID,
              category: "mask",
              catalog_product_id: null,
              brand_text: "Marke",
              product_name_text: "Maske",
              identity_status: "pending_review",
              ownership_status: "owned",
            },
            submission: {
              id: SUBMISSION_ID,
              user_id: USER_ID,
              user_product_usage_id: null,
              user_product_id: USER_PRODUCT_ID,
              source: "personal_plan",
              category: "mask",
              status: "pending_review",
            },
          },
          error: null,
        })
      },
    },
  }
}

test("Personal Plan repository uses the guarded create RPC with no legacy usage argument", async () => {
  const fake = rpcAdminStub()
  const repository = createSupabaseProductIntakeRepository(fake.admin as never)

  await repository.createSubmissionForUserProduct({
    userId: USER_ID,
    userProductId: USER_PRODUCT_ID,
    requestFingerprint: "a".repeat(64),
    category: "mask",
    frequencyRange: "weekly_1x",
    intakeMethod: "manual",
    brandText: "Marke",
    productNameText: "Maske",
    frontImagePath: null,
    barcodeImagePath: null,
    now: NOW,
  })

  assert.deepEqual(fake.calls, [
    {
      name: "product_intake_create_submission_for_user_product",
      args: {
        p_user_id: USER_ID,
        p_user_product_id: USER_PRODUCT_ID,
        p_category: "mask",
        p_frequency_range: "weekly_1x",
        p_intake_method: "manual",
        p_brand_text: "Marke",
        p_product_name_text: "Maske",
        p_front_image_path: null,
        p_barcode_image_path: null,
        p_request_fingerprint: "a".repeat(64),
        p_source_conversation_id: null,
        p_created_at: NOW,
      },
    },
  ])
})

test("Personal Plan repository cancellation is scoped by owner, user product, and submission", async () => {
  const fake = rpcAdminStub()
  const repository = createSupabaseProductIntakeRepository(fake.admin as never)

  await repository.cancelSubmissionForUserProduct({
    userId: USER_ID,
    userProductId: USER_PRODUCT_ID,
    submissionId: SUBMISSION_ID,
    now: NOW,
  })

  assert.deepEqual(fake.calls, [
    {
      name: "product_intake_cancel_submission_for_user_product",
      args: {
        p_user_id: USER_ID,
        p_user_product_id: USER_PRODUCT_ID,
        p_submission_id: SUBMISSION_ID,
        p_updated_at: NOW,
      },
    },
  ])
})
