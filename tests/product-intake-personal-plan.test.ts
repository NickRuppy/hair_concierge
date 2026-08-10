import assert from "node:assert/strict"
import test from "node:test"

import { personalPlanProductIntakeSubmissionSchema } from "../src/lib/product-intake/schemas"
import {
  cancelPersonalPlanProductIntake,
  PersonalPlanProductIntakeCompensationError,
  submitPersonalPlanProductIntake,
  type ProductIntakeRepository,
  type ProductIntakeSubmissionRow,
  type ProductIntakeUserProductRow,
} from "../src/lib/product-intake/submissions"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const USER_PRODUCT_ID = "22222222-2222-4222-8222-222222222222"
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333"

function userProduct(
  overrides: Partial<ProductIntakeUserProductRow> = {},
): ProductIntakeUserProductRow {
  return {
    id: USER_PRODUCT_ID,
    user_id: USER_ID,
    category: "mask",
    catalog_product_id: null,
    brand_text: "Unbekannte Marke",
    product_name_text: "Mystery Maske",
    identity_status: "text_only",
    ownership_status: "owned",
    ...overrides,
  }
}

function submission(
  overrides: Partial<ProductIntakeSubmissionRow> = {},
): ProductIntakeSubmissionRow {
  return {
    id: SUBMISSION_ID,
    user_id: USER_ID,
    user_product_usage_id: null,
    user_product_id: USER_PRODUCT_ID,
    personal_plan_request_fingerprint: null,
    source: "personal_plan",
    source_conversation_id: null,
    intake_method: "manual",
    category: "mask",
    brand_text: "Unbekannte Marke",
    product_name_text: "Mystery Maske",
    frequency_range: "weekly_1x",
    front_image_path: null,
    barcode_image_path: null,
    front_image_validation_status: null,
    front_image_validation_metadata: {},
    barcode_image_validation_status: null,
    barcode_image_validation_metadata: {},
    previous_product_id: null,
    previous_product_snapshot: {},
    status: "pending_review",
    researched_payload: {},
    intake_history: [],
    approved_product_id: null,
    ...overrides,
  }
}

function createRepository() {
  const calls: string[] = []
  const repository: ProductIntakeRepository = {
    async loadCatalog() {
      throw new Error("Personal Plan intake must not load the legacy matching catalog")
    },
    async loadBrandResolutionCatalog() {
      throw new Error("Personal Plan intake must not resolve legacy brand matching")
    },
    async findUserProductUsage() {
      throw new Error("Personal Plan intake must not read user_product_usage")
    },
    async insertUserProductUsage() {
      throw new Error("Personal Plan intake must not write user_product_usage")
    },
    async updateUserProductUsage() {
      throw new Error("Personal Plan intake must not write user_product_usage")
    },
    async deleteUserProductUsage() {
      throw new Error("Personal Plan intake must not delete user_product_usage")
    },
    async replaceUsageWithMatchedProduct() {
      throw new Error("Personal Plan intake must not call legacy replacement RPCs")
    },
    async replaceUsageWithPendingSubmission() {
      throw new Error("Personal Plan intake must not call legacy replacement RPCs")
    },
    async cancelProductIntakeUsageForCategory() {
      throw new Error("Personal Plan intake must not call the legacy cancel RPC")
    },
    async createSubmissionForUserProduct(params) {
      calls.push(`create:${params.userId}:${params.userProductId}:${params.frequencyRange}`)
      assert.equal(params.userId, USER_ID)
      assert.equal(params.userProductId, USER_PRODUCT_ID)
      assert.equal(params.category, "mask")
      assert.equal(params.intakeMethod, "manual")
      assert.equal(params.frontImagePath, null)
      return {
        userProduct: userProduct({ identity_status: "pending_review" }),
        submission: submission(),
        replayed: false,
      }
    },
    async cancelSubmissionForUserProduct(params) {
      calls.push(`cancel:${params.userId}:${params.userProductId}:${params.submissionId}`)
      return {
        userProduct: userProduct({ ownership_status: "archived" }),
        submission: submission({ status: "cancelled_by_user" }),
      }
    },
    async findProductSubmission() {
      return null
    },
    async insertProductSubmission() {
      throw new Error("Personal Plan intake uses its guarded creation RPC")
    },
    async updateProductSubmission(id, patch) {
      calls.push(`update:${id}`)
      return submission({ ...patch, id })
    },
    async deleteProductSubmission() {
      throw new Error("not used")
    },
    async verifyUploadedImage() {
      return true
    },
    async commitUploadedImage() {
      throw new Error("not used")
    },
    async removeCommittedImages() {},
    async verifyConversationOwnership() {
      return false
    },
  }
  return { repository, calls }
}

test("Personal Plan parser omits legacy replacement and association inputs", () => {
  const parsed = personalPlanProductIntakeSubmissionSchema.parse({
    intake_method: "manual",
    category: "mask",
    frequency_range: "weekly_1x",
    brand_text: " Unbekannte Marke ",
    product_name_text: " Mystery Maske ",
    replace_existing_confirmed: true,
    existing_usage_id: USER_PRODUCT_ID,
    user_product_id: USER_PRODUCT_ID,
  })

  assert.equal(parsed.brand_text, "Unbekannte Marke")
  assert.equal(parsed.product_name_text, "Mystery Maske")
  assert.equal("replace_existing_confirmed" in parsed, false)
  assert.equal("existing_usage_id" in parsed, false)
  assert.equal("user_product_id" in parsed, false)
})

test("Personal Plan pending intake uses only the guarded user-product adapter", async () => {
  const fake = createRepository()
  const result = await submitPersonalPlanProductIntake({
    userId: USER_ID,
    userProductId: USER_PRODUCT_ID,
    requestFingerprint: "a".repeat(64),
    input: personalPlanProductIntakeSubmissionSchema.parse({
      intake_method: "manual",
      category: "mask",
      frequency_range: "weekly_1x",
      brand_text: "Unbekannte Marke",
      product_name_text: "Mystery Maske",
    }),
    repository: fake.repository,
    now: () => "2026-08-08T10:00:00.000Z",
  })

  assert.deepEqual(fake.calls, [
    `create:${USER_ID}:${USER_PRODUCT_ID}:weekly_1x`,
    `update:${SUBMISSION_ID}`,
  ])
  assert.equal(result.source, "personal_plan")
  assert.equal(result.user_product.id, USER_PRODUCT_ID)
  assert.equal(result.submission.id, SUBMISSION_ID)
})

test("Personal Plan cancellation requires the exact user product and submission IDs", async () => {
  const fake = createRepository()
  await cancelPersonalPlanProductIntake({
    userId: USER_ID,
    userProductId: USER_PRODUCT_ID,
    submissionId: SUBMISSION_ID,
    repository: fake.repository,
    now: () => "2026-08-08T10:00:00.000Z",
  })

  assert.deepEqual(fake.calls, [`cancel:${USER_ID}:${USER_PRODUCT_ID}:${SUBMISSION_ID}`])
})

test("Personal Plan post-create failure reports a definite guarded rollback", async () => {
  const fake = createRepository()
  fake.repository.updateProductSubmission = async () => {
    throw new Error("finalization transport")
  }

  await assert.rejects(
    () =>
      submitPersonalPlanProductIntake({
        userId: USER_ID,
        userProductId: USER_PRODUCT_ID,
        requestFingerprint: "a".repeat(64),
        input: personalPlanProductIntakeSubmissionSchema.parse({
          intake_method: "manual",
          category: "mask",
          frequency_range: "weekly_1x",
          brand_text: "Unbekannte Marke",
          product_name_text: "Mystery Maske",
        }),
        repository: fake.repository,
      }),
    (error) =>
      error instanceof PersonalPlanProductIntakeCompensationError &&
      error.outcome === "rolled_back",
  )
  assert.ok(fake.calls.includes(`cancel:${USER_ID}:${USER_PRODUCT_ID}:${SUBMISSION_ID}`))
})

test("Personal Plan post-create failure exposes an unconfirmed compensation for same-key retry", async () => {
  const fake = createRepository()
  fake.repository.updateProductSubmission = async () => {
    throw new Error("finalization transport")
  }
  fake.repository.cancelSubmissionForUserProduct = async () => {
    throw new Error("compensation transport")
  }

  await assert.rejects(
    () =>
      submitPersonalPlanProductIntake({
        userId: USER_ID,
        userProductId: USER_PRODUCT_ID,
        requestFingerprint: "a".repeat(64),
        input: personalPlanProductIntakeSubmissionSchema.parse({
          intake_method: "manual",
          category: "mask",
          frequency_range: "weekly_1x",
          brand_text: "Unbekannte Marke",
          product_name_text: "Mystery Maske",
        }),
        repository: fake.repository,
      }),
    (error) =>
      error instanceof PersonalPlanProductIntakeCompensationError &&
      error.outcome === "compensation_pending",
  )
})

test("Personal Plan photo replay resumes an unfinished image finalization", async () => {
  const fake = createRepository()
  const temporaryPath = `tmp/${USER_ID}/front.jpg`
  const committedPath = `${USER_ID}/${SUBMISSION_ID}/front-front.jpg`
  fake.repository.createSubmissionForUserProduct = async () => ({
    userProduct: userProduct({ identity_status: "pending_review" }),
    submission: submission({
      intake_method: "photo",
      front_image_path: temporaryPath,
    }),
    replayed: true,
  })
  fake.repository.verifyUploadedImage = async ({ sourcePath }) => {
    fake.calls.push(`verify:${sourcePath}`)
    return true
  }
  fake.repository.commitUploadedImage = async ({ sourcePath }) => {
    fake.calls.push(`commit:${sourcePath}`)
    return committedPath
  }

  await submitPersonalPlanProductIntake({
    userId: USER_ID,
    userProductId: USER_PRODUCT_ID,
    requestFingerprint: "a".repeat(64),
    input: personalPlanProductIntakeSubmissionSchema.parse({
      intake_method: "photo",
      category: "mask",
      frequency_range: "weekly_1x",
      front_image_path: temporaryPath,
    }),
    repository: fake.repository,
  })

  assert.deepEqual(fake.calls, [
    `verify:${temporaryPath}`,
    `commit:${temporaryPath}`,
    `update:${SUBMISSION_ID}`,
  ])
})

test("Personal Plan photo replay returns an already finalized image without moving it twice", async () => {
  const fake = createRepository()
  const temporaryPath = `tmp/${USER_ID}/front.jpg`
  fake.repository.createSubmissionForUserProduct = async () => ({
    userProduct: userProduct({ identity_status: "pending_review" }),
    submission: submission({
      intake_method: "photo",
      front_image_path: `${USER_ID}/${SUBMISSION_ID}/front-front.jpg`,
      front_image_validation_status: "uncertain",
    }),
    replayed: true,
  })
  fake.repository.commitUploadedImage = async () => {
    throw new Error("finalized replay must not move an image twice")
  }

  const result = await submitPersonalPlanProductIntake({
    userId: USER_ID,
    userProductId: USER_PRODUCT_ID,
    requestFingerprint: "a".repeat(64),
    input: personalPlanProductIntakeSubmissionSchema.parse({
      intake_method: "photo",
      category: "mask",
      frequency_range: "weekly_1x",
      front_image_path: temporaryPath,
    }),
    repository: fake.repository,
  })

  assert.deepEqual(fake.calls, [])
  assert.equal(result.submission.id, SUBMISSION_ID)
})
