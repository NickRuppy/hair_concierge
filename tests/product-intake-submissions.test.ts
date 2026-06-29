import assert from "node:assert/strict"
import test from "node:test"

import { isProductIntakeEnabled } from "../src/lib/product-intake/config"
import { ProductIntakePersistenceError } from "../src/lib/product-intake/errors"
import { validateProductIntakeImageFile } from "../src/lib/product-intake/image-validation"
import { isMissingProductIntakeUploadError } from "../src/lib/product-intake/repository"
import { createProductIntakePostHandler } from "../src/lib/product-intake/route-handlers"
import { createDefaultAgentV2ConversationState } from "../src/lib/agent-v2/production/persisted-session-state"
import {
  chatProductIntakeSubmissionSchema,
  onboardingProductIntakeSubmissionSchema,
} from "../src/lib/product-intake/schemas"
import {
  cancelProductIntakeUsage,
  ProductIntakeConflictError,
  ProductIntakeOwnershipError,
  submitProductIntake,
  type ProductIntakeRepository,
  type ProductIntakeSubmissionRow,
  type ProductIntakeUsageRow,
} from "../src/lib/product-intake/submissions"
import type { ProductIntakeCatalog } from "../src/lib/product-intake/product-matching"
import type { BrandResolutionCatalogInput } from "../src/lib/product-identity/brand-resolution"
import type { ProductFrequency, ProductIntakeCategoryKey } from "../src/lib/types"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_CONVERSATION_ID = "33333333-3333-4333-8333-333333333333"
const EXISTING_USAGE_ID = "44444444-4444-4444-8444-444444444444"
const OTHER_USAGE_ID = "55555555-5555-4555-8555-555555555555"

const catalog: ProductIntakeCatalog = {
  products: [
    {
      id: "product-garnier-mask",
      name: "Hair Food Aloe Maske",
      brandId: "brand-garnier",
      productLineId: "line-fructis",
      categoryKey: "mask",
      isActive: true,
      isChaarlieRecommended: true,
    },
  ],
  identifiers: [],
}

const brandCatalog: BrandResolutionCatalogInput = {
  brands: [
    {
      id: "brand-garnier",
      canonical_name: "Garnier",
    },
  ],
  productLines: [
    {
      id: "line-fructis",
      brand_id: "brand-garnier",
      canonical_name: "Fructis",
    },
  ],
  brandAliases: [
    {
      brand_id: "brand-garnier",
      product_line_id: "line-fructis",
      alias: "Garnier Fructis",
    },
  ],
}

type FakeRepoOptions = {
  usage?: ProductIntakeUsageRow | null
  conversationIds?: string[]
  uploadedPaths?: string[]
  failCommitKinds?: Array<"front" | "barcode">
  failMatchedUsage?: boolean
  failSubmissionLink?: boolean
  submissions?: ProductIntakeSubmissionRow[]
}

function makeUsage(
  overrides: Partial<ProductIntakeUsageRow> & { id?: string; category?: ProductIntakeCategoryKey },
): ProductIntakeUsageRow {
  return {
    id: overrides.id ?? "usage-1",
    user_id: USER_ID,
    category: overrides.category ?? "mask",
    product_name: null,
    frequency_range: null,
    brand_text: null,
    product_id: null,
    product_submission_id: null,
    match_status: "text_only",
    intake_method: null,
    source: null,
    front_image_path: null,
    ...overrides,
  }
}

function makeSubmission(
  overrides: Partial<ProductIntakeSubmissionRow> & { id?: string },
): ProductIntakeSubmissionRow {
  return {
    id: overrides.id ?? "submission-1",
    user_id: USER_ID,
    user_product_usage_id: null,
    source: "onboarding",
    source_conversation_id: null,
    intake_method: "manual",
    category: "mask",
    brand_text: null,
    product_name_text: null,
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

function createFakeRepository(options: FakeRepoOptions = {}) {
  let usage = options.usage ?? null
  const submissions = new Map<string, ProductIntakeSubmissionRow>(
    (options.submissions ?? []).map((submission) => [submission.id, submission]),
  )
  let nextSubmission = 1
  let nextUsage = 1
  const calls: string[] = []
  const catalogModes: string[] = []
  const openStatuses = new Set([
    "pending_review",
    "researching",
    "ready_for_review",
    "needs_more_info",
  ])

  function closeOpenSubmission(id: string, now = "2026-06-13T10:00:00.000Z") {
    const current = submissions.get(id)
    if (!current || !openStatuses.has(current.status)) return
    if (usage?.product_submission_id === id) {
      throw new Error("trigger violation: close unsuccessful submission after unlinking usage")
    }
    calls.push(`rpc_cancel_submission:${id}`)
    submissions.set(id, {
      ...current,
      status: "cancelled_by_user",
      user_product_usage_id: null,
      updated_at: now,
    })
  }

  const repository: ProductIntakeRepository = {
    async loadCatalog(params) {
      catalogModes.push(params?.eligibilityMode ?? "default")
      return catalog
    },
    async loadBrandResolutionCatalog() {
      return brandCatalog
    },
    async findUserProductUsage() {
      return usage
    },
    async insertUserProductUsage(row) {
      calls.push("insert_usage")
      usage = makeUsage({
        id: `usage-new-${nextUsage++}`,
        ...row,
      })
      return usage
    },
    async updateUserProductUsage(id, patch) {
      calls.push(`update_usage:${id}`)
      assert.ok(usage, "expected existing usage")
      usage = { ...usage, ...patch, id }
      return usage
    },
    async deleteUserProductUsage(id) {
      calls.push(`delete_usage:${id}`)
      if (usage?.id === id) usage = null
    },
    async replaceUsageWithMatchedProduct(params) {
      calls.push(`replace_usage_matched:${params.productId}`)
      if (options.failMatchedUsage) {
        throw new Error("failed matched usage")
      }

      const oldSubmissionId = usage?.product_submission_id ?? null
      const usagePatch = {
        user_id: params.userId,
        category: params.category,
        product_name: params.productName,
        frequency_range: params.frequencyRange,
        brand_text: params.brandText,
        product_id: params.productId,
        product_submission_id: null,
        match_status: "matched" as const,
        intake_method: params.intakeMethod,
        source: params.source,
        front_image_path: null,
        updated_at: params.now,
      }

      if (params.existingUsageId) {
        assert.equal(usage?.id, params.existingUsageId)
        usage = { ...usage, ...usagePatch, id: params.existingUsageId }
      } else {
        usage = makeUsage({
          id: `usage-new-${nextUsage++}`,
          ...usagePatch,
        })
      }

      if (oldSubmissionId) closeOpenSubmission(oldSubmissionId, params.now)
      return usage
    },
    async replaceUsageWithPendingSubmission(params) {
      calls.push(`replace_usage_pending:${params.submissionId}`)
      if (options.failSubmissionLink) {
        throw new Error("failed submission link")
      }

      const submission = submissions.get(params.submissionId)
      assert.ok(submission, "expected pending submission")
      assert.equal(submission.user_id, params.userId)
      assert.equal(submission.category, params.category)
      assert.equal(submission.status, "pending_review")

      const oldSubmissionId = usage?.product_submission_id ?? null
      const usagePatch = {
        user_id: params.userId,
        category: params.category,
        product_name: params.productName,
        frequency_range: params.frequencyRange,
        brand_text: params.brandText,
        product_id: null,
        product_submission_id: params.submissionId,
        match_status: "pending_review" as const,
        intake_method: params.intakeMethod,
        source: params.source,
        front_image_path: params.frontImagePath,
        updated_at: params.now,
      }

      if (params.existingUsageId) {
        assert.equal(usage?.id, params.existingUsageId)
        usage = { ...usage, ...usagePatch, id: params.existingUsageId }
      } else {
        usage = makeUsage({
          id: `usage-new-${nextUsage++}`,
          ...usagePatch,
        })
      }

      if (oldSubmissionId && oldSubmissionId !== params.submissionId) {
        closeOpenSubmission(oldSubmissionId, params.now)
      }

      const linkedSubmission = {
        ...submission,
        user_product_usage_id: usage.id,
        updated_at: params.now,
      }
      calls.push(`rpc_link_submission:${params.submissionId}`)
      submissions.set(params.submissionId, linkedSubmission)
      return { usage, submission: linkedSubmission }
    },
    async cancelProductIntakeUsageForCategory({ category, now }) {
      calls.push(`cancel_usage:${category}`)
      const existingUsage = usage
      const submissionId = existingUsage?.product_submission_id ?? null
      usage = null
      if (submissionId) closeOpenSubmission(submissionId, now)
      return {
        category,
        usage_id: existingUsage?.id ?? null,
        submission_id: submissionId,
      }
    },
    async findProductSubmission(id, userId) {
      calls.push(`find_submission:${id}`)
      const submission = submissions.get(id) ?? null
      return submission?.user_id === userId ? submission : null
    },
    async insertProductSubmission(row) {
      calls.push("insert_submission")
      const submission = makeSubmission({
        id: `submission-new-${nextSubmission++}`,
        ...row,
      })
      submissions.set(submission.id, submission)
      return submission
    },
    async updateProductSubmission(id, patch) {
      calls.push(`update_submission:${id}:${patch.status ?? "link"}`)
      if (options.failSubmissionLink && patch.user_product_usage_id) {
        throw new Error("failed submission link")
      }
      if (
        (patch.status === "cancelled_by_user" || patch.status === "rejected") &&
        usage?.product_submission_id === id
      ) {
        throw new Error("trigger violation: close unsuccessful submission after unlinking usage")
      }
      const current =
        submissions.get(id) ??
        makeSubmission({
          id,
          status: "pending_review",
          user_product_usage_id: usage?.id ?? null,
        })
      const updated = { ...current, ...patch }
      submissions.set(id, updated)
      return updated
    },
    async deleteProductSubmission(id) {
      calls.push(`delete_submission:${id}`)
      submissions.delete(id)
    },
    async verifyUploadedImage({ sourcePath, userId }) {
      calls.push(`verify_image:${sourcePath}`)
      if (!sourcePath.startsWith(`tmp/${userId}/`)) return false
      return options.uploadedPaths ? options.uploadedPaths.includes(sourcePath) : true
    },
    async commitUploadedImage({ sourcePath, userId, submissionId, kind }) {
      calls.push(`commit_image:${kind}:${sourcePath}`)
      if (options.failCommitKinds?.includes(kind)) {
        throw new Error(`failed ${kind} commit`)
      }
      if (!sourcePath.includes(userId)) throw new Error("bad source path")
      if (options.uploadedPaths && !options.uploadedPaths.includes(sourcePath)) {
        throw new Error("missing source upload")
      }
      return `${userId}/${submissionId}/${kind}-${sourcePath.split("/").pop() ?? "image.jpg"}`
    },
    async removeCommittedImages(paths) {
      calls.push(`remove_images:${paths.join(",")}`)
    },
    async verifyConversationOwnership(conversationId) {
      calls.push(`verify_conversation:${conversationId}`)
      return (options.conversationIds ?? []).includes(conversationId)
    },
  }

  return {
    repository,
    get usage() {
      return usage
    },
    get submissions() {
      return Array.from(submissions.values())
    },
    calls,
    catalogModes,
  }
}

function manualInput(overrides: Record<string, unknown> = {}) {
  return {
    intake_method: "manual",
    category: "mask",
    frequency_range: "weekly_1x",
    brand_text: "Garnier Fructis",
    product_name_text: "Hair Food Aloe Maske",
    ...overrides,
  }
}

test("product intake feature flag defaults production off and preview/dev on", () => {
  assert.equal(isProductIntakeEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false)
  assert.equal(isProductIntakeEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true)
  assert.equal(isProductIntakeEnabled({ NODE_ENV: "development" }), true)
  assert.equal(
    isProductIntakeEnabled({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      PRODUCT_INTAKE_ENABLED: "true",
    }),
    true,
  )
  assert.equal(
    isProductIntakeEnabled({ NODE_ENV: "development", PRODUCT_INTAKE_ENABLED: "0" }),
    false,
  )
})

test("manual intake schemas require category, frequency, brand identity, and product name", () => {
  const parsed = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "manual",
    category: "mask",
    frequency_range: "1_2x",
    brand_text: " Garnier Fructis ",
    product_name_text: " Hair Food Aloe Maske ",
  })

  assert.equal(parsed.frequency_range as ProductFrequency, "weekly_1x")
  assert.equal(parsed.brand_text, "Garnier Fructis")
  assert.equal(parsed.product_name_text, "Hair Food Aloe Maske")

  assert.equal(
    onboardingProductIntakeSubmissionSchema.safeParse({
      intake_method: "manual",
      category: "peeling",
      frequency_range: "weekly_1x",
      brand_text: "Brand",
      product_name_text: "Name",
    }).success,
    false,
  )

  assert.equal(
    onboardingProductIntakeSubmissionSchema.safeParse({
      intake_method: "manual",
      category: "mask",
      frequency_range: "weekly_1x",
      product_name_text: "Name",
    }).success,
    false,
  )
})

test("matched manual intake links user usage to the existing product without creating a submission", async () => {
  const fake = createFakeRepository()

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse(manualInput()),
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "matched")
  assert.equal(result.matched_product_id, "product-garnier-mask")
  assert.equal(result.submission, null)
  assert.equal(fake.usage?.product_id, "product-garnier-mask")
  assert.equal(fake.usage?.product_submission_id, null)
  assert.equal(fake.usage?.match_status, "matched")
  assert.deepEqual(fake.catalogModes, ["intake_dedupe"])
  assert.deepEqual(fake.calls, ["replace_usage_matched:product-garnier-mask"])
})

test("matched photo intake verifies and clears tmp uploads without creating a submission", async () => {
  const frontPath = `tmp/${USER_ID}/front.jpg`
  const barcodePath = `tmp/${USER_ID}/barcode.jpg`
  const fake = createFakeRepository({ uploadedPaths: [frontPath, barcodePath] })
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    brand_text: "Garnier Fructis",
    product_name_text: "Hair Food Aloe Maske",
    front_image_path: frontPath,
    barcode_image_path: barcodePath,
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input,
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "matched")
  assert.equal(result.submission, null)
  assert.equal(fake.usage?.product_id, "product-garnier-mask")
  assert.deepEqual(fake.submissions, [])
  assert.deepEqual(fake.calls, [
    `verify_image:${frontPath}`,
    `verify_image:${barcodePath}`,
    "replace_usage_matched:product-garnier-mask",
    `remove_images:${frontPath},${barcodePath}`,
  ])
})

test("matched photo intake keeps tmp uploads if matched usage write fails", async () => {
  const frontPath = `tmp/${USER_ID}/front.jpg`
  const barcodePath = `tmp/${USER_ID}/barcode.jpg`
  const fake = createFakeRepository({
    uploadedPaths: [frontPath, barcodePath],
    failMatchedUsage: true,
  })
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    brand_text: "Garnier Fructis",
    product_name_text: "Hair Food Aloe Maske",
    front_image_path: frontPath,
    barcode_image_path: barcodePath,
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input,
        repository: fake.repository,
        now: () => "2026-06-13T10:00:00.000Z",
      }),
    /failed matched usage/,
  )

  assert.deepEqual(fake.calls, [
    `verify_image:${frontPath}`,
    `verify_image:${barcodePath}`,
    "replace_usage_matched:product-garnier-mask",
  ])
  assert.equal(fake.usage, null)
  assert.deepEqual(fake.submissions, [])
})

test("unknown manual intake creates a pending submission and pending usage slot", async () => {
  const fake = createFakeRepository()

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse(
      manualInput({
        brand_text: "Unbekannte Marke",
        product_name_text: "Mystery Maske",
      }),
    ),
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "pending_review")
  assert.equal(result.matched_product_id, null)
  assert.equal(fake.submissions.length, 1)
  assert.equal(
    fake.submissions[0].researched_payload &&
      Object.keys(fake.submissions[0].researched_payload).length,
    0,
  )
  assert.equal(fake.submissions[0].user_product_usage_id, fake.usage?.id)
  assert.equal(fake.usage?.product_id, null)
  assert.equal(fake.usage?.product_submission_id, fake.submissions[0].id)
  assert.equal(fake.usage?.match_status, "pending_review")
})

test("photo intake creates a pending submission with image paths and uncertain validation", async () => {
  const fake = createFakeRepository()
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: `tmp/${USER_ID}/front.jpg`,
    barcode_image_path: `tmp/${USER_ID}/barcode.jpg`,
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input,
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "pending_review")
  assert.equal(result.intake_method, "photo")
  assert.equal(fake.submissions[0].intake_method, "photo")
  assert.equal(
    fake.submissions[0].front_image_path,
    `${USER_ID}/${fake.submissions[0].id}/front-front.jpg`,
  )
  assert.equal(
    fake.submissions[0].barcode_image_path,
    `${USER_ID}/${fake.submissions[0].id}/barcode-barcode.jpg`,
  )
  assert.equal(fake.submissions[0].front_image_validation_status, "uncertain")
  assert.equal(fake.submissions[0].barcode_image_validation_status, "uncertain")
  assert.equal(fake.usage?.front_image_path, `${USER_ID}/${fake.submissions[0].id}/front-front.jpg`)
  assert.equal(fake.usage?.match_status, "pending_review")
})

test("photo intake cleans committed front image and does not create review row if barcode commit fails", async () => {
  const frontPath = `tmp/${USER_ID}/front.jpg`
  const barcodePath = `tmp/${USER_ID}/barcode.jpg`
  const fake = createFakeRepository({
    uploadedPaths: [frontPath, barcodePath],
    failCommitKinds: ["barcode"],
  })
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: frontPath,
    barcode_image_path: barcodePath,
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input,
        repository: fake.repository,
        now: () => "2026-06-13T10:00:00.000Z",
      }),
    /failed barcode commit/,
  )

  const frontCommitCall = fake.calls.find((call) => call.startsWith("commit_image:front:"))
  assert.ok(frontCommitCall)
  assert.equal(fake.submissions.length, 0)
  assert.equal(fake.usage, null)
  const removedPath = fake.calls.find((call) => call.startsWith("remove_images:"))
  assert.ok(removedPath)
  assert.match(removedPath, new RegExp(`^remove_images:${USER_ID}/[0-9a-f-]+/front-front\\.jpg$`))
  assert.ok(!fake.calls.some((call) => call.startsWith("insert_submission")))
})

test("photo intake cleans rows/images without mutating usage if pending replacement RPC fails", async () => {
  const frontPath = `tmp/${USER_ID}/front.jpg`
  const barcodePath = `tmp/${USER_ID}/barcode.jpg`
  const fake = createFakeRepository({
    uploadedPaths: [frontPath, barcodePath],
    failSubmissionLink: true,
  })
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: frontPath,
    barcode_image_path: barcodePath,
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input,
        repository: fake.repository,
        now: () => "2026-06-13T10:00:00.000Z",
      }),
    /failed submission link/,
  )

  assert.equal(fake.submissions.length, 0)
  assert.equal(fake.usage, null)
  assert.ok(fake.calls.some((call) => call.startsWith("replace_usage_pending:")))
  assert.ok(fake.calls.some((call) => call.startsWith("delete_submission:")))
  const removedPath = fake.calls.find((call) => call.startsWith("remove_images:"))
  assert.ok(removedPath)
  assert.match(
    removedPath,
    new RegExp(
      `^remove_images:${USER_ID}/[0-9a-f-]+/front-front\\.jpg,${USER_ID}/[0-9a-f-]+/barcode-barcode\\.jpg$`,
    ),
  )
})

test("photo intake persists only server-derived uncertain validation state", async () => {
  const frontPath = `tmp/${USER_ID}/front.jpg`
  const barcodePath = `tmp/${USER_ID}/barcode.jpg`
  const fake = createFakeRepository({ uploadedPaths: [frontPath, barcodePath] })
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: frontPath,
    front_image_validation_status: "valid_product_front",
    front_image_validation_metadata: {
      source: "server_upload_validation",
      validation: "file_signature_only",
      mime_type: "image/jpeg",
    },
    barcode_image_path: barcodePath,
    barcode_image_validation_status: "valid_barcode",
    barcode_image_validation_metadata: {
      source: "server_upload_validation",
      validation: "file_signature_only",
      mime_type: "image/jpeg",
    },
  })

  await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input,
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(fake.submissions[0].front_image_validation_status, "uncertain")
  assert.deepEqual(fake.submissions[0].front_image_validation_metadata, {})
  assert.equal(fake.submissions[0].barcode_image_validation_status, "uncertain")
  assert.deepEqual(fake.submissions[0].barcode_image_validation_metadata, {})
  const historyEntry = fake.submissions[0].intake_history[0] as {
    at?: string
    fields?: { front_image_validation_status?: string }
  }
  assert.equal(historyEntry.at, "2026-06-13T10:00:00.000Z")
  assert.equal(historyEntry.fields?.front_image_validation_status, "uncertain")
})

test("photo intake rejects image paths that do not belong to the user", async () => {
  const fake = createFakeRepository()
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: "tmp/someone-else/front.jpg",
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input,
        repository: fake.repository,
      }),
    /Bildpfad gehört nicht zu diesem Nutzer/,
  )
})

test("photo intake rejects stale committed image paths instead of reusing old submission photos", async () => {
  const fake = createFakeRepository()
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: `${USER_ID}/old-submission/front.jpg`,
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input,
        repository: fake.repository,
      }),
    /temporären Upload/,
  )

  assert.equal(fake.submissions.length, 0)
  assert.equal(fake.usage, null)
})

test("photo intake verifies tmp uploads exist before creating submission rows", async () => {
  const fake = createFakeRepository({ uploadedPaths: [] })
  const input = onboardingProductIntakeSubmissionSchema.parse({
    intake_method: "photo",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: `tmp/${USER_ID}/guessed.jpg`,
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input,
        repository: fake.repository,
      }),
    /Upload nicht gefunden/,
  )

  assert.deepEqual(fake.calls, [`verify_image:tmp/${USER_ID}/guessed.jpg`])
  assert.equal(fake.submissions.length, 0)
  assert.equal(fake.usage, null)
})

test("empty onboarding placeholder usage can be claimed without replacement confirmation", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({ id: "placeholder", category: "mask" }),
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse(manualInput()),
    repository: fake.repository,
  })

  assert.equal(result.status, "matched")
  assert.equal(fake.usage?.id, "placeholder")
  assert.equal(fake.usage?.product_id, "product-garnier-mask")
})

test("tracked usage requires explicit replacement confirmation", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Altes Produkt",
      frequency_range: "weekly_1x",
    }),
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input: onboardingProductIntakeSubmissionSchema.parse(manualInput()),
        repository: fake.repository,
      }),
    ProductIntakeConflictError,
  )
})

test("onboarding same usage id can update a tracked slot without replacement confirmation", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Altes Produkt",
      frequency_range: "weekly_1x",
    }),
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse(
      manualInput({
        existing_usage_id: EXISTING_USAGE_ID,
      }),
    ),
    repository: fake.repository,
  })

  assert.equal(result.status, "matched")
  assert.equal(fake.usage?.id, EXISTING_USAGE_ID)
  assert.equal(fake.usage?.product_id, "product-garnier-mask")
})

test("onboarding same pending photo usage can be saved again without reuploading the front image", async () => {
  const oldFrontPath = `${USER_ID}/old-submission/front-old.jpg`
  const fake = createFakeRepository({
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Mystery Maske",
      frequency_range: "weekly_1x",
      product_submission_id: "old-submission",
      match_status: "pending_review",
      source: "onboarding",
      intake_method: "photo",
      front_image_path: oldFrontPath,
    }),
    submissions: [
      makeSubmission({
        id: "old-submission",
        user_product_usage_id: EXISTING_USAGE_ID,
        intake_method: "photo",
        brand_text: "Unbekannte Marke",
        product_name_text: "Mystery Maske",
        front_image_path: oldFrontPath,
        status: "pending_review",
        intake_history: [{ at: "2026-06-13T09:00:00.000Z" }],
      }),
    ],
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse({
      intake_method: "photo",
      category: "mask",
      frequency_range: "weekly_3_4x",
      brand_text: "Unbekannte Marke",
      product_name_text: "Mystery Maske aktualisiert",
      existing_usage_id: EXISTING_USAGE_ID,
    }),
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "pending_review")
  assert.equal(result.usage.id, EXISTING_USAGE_ID)
  assert.equal(result.usage.front_image_path, oldFrontPath)
  assert.equal(fake.submissions.length, 1)
  assert.equal(fake.submissions[0].id, "old-submission")
  assert.equal(fake.submissions[0].front_image_path, oldFrontPath)
  assert.equal(fake.submissions[0].frequency_range, "weekly_3_4x")
  assert.equal(fake.submissions[0].intake_history.length, 2)
  assert.ok(!fake.calls.includes("insert_submission"))
  assert.ok(!fake.calls.some((call) => call.startsWith("commit_image:front")))
})

test("needs-more-info submission can be completed in place and reopened for review", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Mystery Maske",
      frequency_range: "weekly_1x",
      product_submission_id: "old-submission",
      match_status: "needs_more_info",
      source: "onboarding",
      intake_method: "manual",
    }),
    submissions: [
      makeSubmission({
        id: "old-submission",
        user_product_usage_id: EXISTING_USAGE_ID,
        brand_text: "Unbekannte Marke",
        product_name_text: "Mystery Maske",
        status: "needs_more_info",
        user_facing_resolution_reason: "Der genaue Produktname fehlt.",
        user_facing_next_step: "Bitte ergänze den Namen auf der Vorderseite.",
        user_facing_missing_fields: ["product_name_text"],
        notification_sent_at: "2026-06-13T09:00:00.000Z",
        intake_history: [{ at: "2026-06-13T09:00:00.000Z" }],
      }),
    ],
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse(
      manualInput({
        product_name_text: "Mystery Maske reparierend",
        existing_usage_id: EXISTING_USAGE_ID,
      }),
    ),
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "pending_review")
  assert.equal(fake.submissions.length, 1)
  assert.equal(fake.submissions[0].id, "old-submission")
  assert.equal(fake.submissions[0].status, "pending_review")
  assert.equal(fake.submissions[0].product_name_text, "Mystery Maske reparierend")
  assert.equal(fake.submissions[0].user_facing_resolution_reason, null)
  assert.equal(fake.submissions[0].user_facing_next_step, null)
  assert.deepEqual(fake.submissions[0].user_facing_missing_fields, [])
  assert.equal(fake.submissions[0].notification_sent_at, null)
  assert.equal(fake.usage?.match_status, "pending_review")
  assert.ok(!fake.calls.includes("insert_submission"))
})

test("chat needs-more-info follow-up can update the pending submission in place", async () => {
  const fake = createFakeRepository({
    conversationIds: [CONVERSATION_ID],
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Mystery Maske",
      frequency_range: "weekly_1x",
      product_submission_id: "old-submission",
      match_status: "needs_more_info",
      source: "chat",
      intake_method: "manual",
    }),
    submissions: [
      makeSubmission({
        id: "old-submission",
        user_product_usage_id: EXISTING_USAGE_ID,
        source: "chat",
        source_conversation_id: CONVERSATION_ID,
        brand_text: "Unbekannte Marke",
        product_name_text: "Mystery Maske",
        status: "needs_more_info",
        user_facing_resolution_reason: "Der genaue Produktname fehlt.",
        user_facing_next_step: "Bitte ergänze den Namen.",
        user_facing_missing_fields: ["product_name_text"],
        notification_sent_at: "2026-06-13T09:00:00.000Z",
      }),
    ],
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "chat",
    input: chatProductIntakeSubmissionSchema.parse(
      manualInput({
        product_name_text: "Mystery Maske reparierend",
        source_conversation_id: CONVERSATION_ID,
        existing_usage_id: EXISTING_USAGE_ID,
      }),
    ),
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "pending_review")
  assert.equal(fake.submissions.length, 1)
  assert.equal(fake.submissions[0].id, "old-submission")
  assert.equal(fake.submissions[0].status, "pending_review")
  assert.equal(fake.submissions[0].source, "chat")
  assert.equal(fake.submissions[0].source_conversation_id, CONVERSATION_ID)
  assert.equal(fake.submissions[0].product_name_text, "Mystery Maske reparierend")
  assert.equal(fake.submissions[0].notification_sent_at, null)
  assert.equal(fake.usage?.match_status, "pending_review")
  assert.ok(!fake.calls.includes("insert_submission"))
})

test("stale chat follow-up card cannot update a different pending submission", async () => {
  const oldSubmissionId = "66666666-6666-4666-8666-666666666666"
  const newSubmissionId = "77777777-7777-4777-8777-777777777777"
  const fake = createFakeRepository({
    conversationIds: [CONVERSATION_ID],
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "New Pending Maske",
      frequency_range: "weekly_1x",
      product_submission_id: newSubmissionId,
      match_status: "pending_review",
      source: "chat",
      intake_method: "manual",
    }),
    submissions: [
      makeSubmission({
        id: newSubmissionId,
        user_product_usage_id: EXISTING_USAGE_ID,
        source: "chat",
        source_conversation_id: CONVERSATION_ID,
        brand_text: "Neue Marke",
        product_name_text: "New Pending Maske",
        status: "pending_review",
      }),
    ],
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "chat",
        input: chatProductIntakeSubmissionSchema.parse(
          manualInput({
            product_name_text: "Old Card Maske",
            source_conversation_id: CONVERSATION_ID,
            existing_usage_id: EXISTING_USAGE_ID,
            existing_submission_id: oldSubmissionId,
          }),
        ),
        repository: fake.repository,
      }),
    ProductIntakeConflictError,
  )

  assert.equal(fake.submissions.length, 1)
  assert.equal(fake.submissions[0].id, newSubmissionId)
  assert.equal(fake.submissions[0].product_name_text, "New Pending Maske")
})

test("onboarding same pending photo usage updates the current reference when a new front image is uploaded", async () => {
  const oldFrontPath = `${USER_ID}/old-submission/front-old.jpg`
  const newFrontUploadPath = `tmp/${USER_ID}/front-new.jpg`
  const fake = createFakeRepository({
    uploadedPaths: [newFrontUploadPath],
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Mystery Maske",
      frequency_range: "weekly_1x",
      product_submission_id: "old-submission",
      match_status: "pending_review",
      source: "onboarding",
      intake_method: "photo",
      front_image_path: oldFrontPath,
    }),
    submissions: [
      makeSubmission({
        id: "old-submission",
        user_product_usage_id: EXISTING_USAGE_ID,
        intake_method: "photo",
        brand_text: "Unbekannte Marke",
        product_name_text: "Mystery Maske",
        front_image_path: oldFrontPath,
        status: "pending_review",
      }),
    ],
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse({
      intake_method: "photo",
      category: "mask",
      frequency_range: "weekly_1x",
      brand_text: "Unbekannte Marke",
      product_name_text: "Mystery Maske",
      front_image_path: newFrontUploadPath,
      existing_usage_id: EXISTING_USAGE_ID,
    }),
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  const newFrontPath = `${USER_ID}/old-submission/front-front-new.jpg`
  assert.equal(result.status, "pending_review")
  assert.equal(result.usage.front_image_path, newFrontPath)
  assert.equal(fake.submissions.length, 1)
  assert.equal(fake.submissions[0].id, "old-submission")
  assert.equal(fake.submissions[0].front_image_path, newFrontPath)
  assert.ok(fake.calls.includes(`commit_image:front:${newFrontUploadPath}`))
  assert.ok(fake.calls.includes(`remove_images:${oldFrontPath}`))
  assert.ok(!fake.calls.includes("insert_submission"))
})

test("onboarding mismatched usage id still requires replacement confirmation", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Altes Produkt",
      frequency_range: "weekly_1x",
    }),
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "onboarding",
        input: onboardingProductIntakeSubmissionSchema.parse(
          manualInput({
            existing_usage_id: OTHER_USAGE_ID,
          }),
        ),
        repository: fake.repository,
      }),
    ProductIntakeConflictError,
  )
})

test("chat still requires replacement confirmation for a tracked slot", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_name: "Altes Produkt",
      frequency_range: "weekly_1x",
    }),
  })

  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "chat",
        input: chatProductIntakeSubmissionSchema.parse(manualInput()),
        repository: fake.repository,
      }),
    ProductIntakeConflictError,
  )
})

test("confirmed unknown replacement stores previous slot state and cancels old pending submission", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({
      id: "existing-usage",
      product_name: "Altes Produkt",
      frequency_range: "weekly_1x",
      product_submission_id: "old-submission",
      match_status: "pending_review",
      source: "onboarding",
      intake_method: "manual",
    }),
    submissions: [
      makeSubmission({
        id: "old-submission",
        user_product_usage_id: "existing-usage",
        status: "pending_review",
      }),
    ],
  })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "onboarding",
    input: onboardingProductIntakeSubmissionSchema.parse(
      manualInput({
        brand_text: "Unbekannte Marke",
        product_name_text: "Mystery Maske",
        replace_existing_confirmed: true,
      }),
    ),
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.equal(result.status, "pending_review")
  const newSubmission = fake.submissions.find((submission) => submission.id !== "old-submission")
  const oldSubmission = fake.submissions.find((submission) => submission.id === "old-submission")
  assert.ok(newSubmission)
  assert.equal(newSubmission.previous_product_snapshot.product_name, "Altes Produkt")
  assert.equal(oldSubmission?.status, "cancelled_by_user")
  assert.equal(fake.usage?.product_submission_id, newSubmission.id)
  assert.deepEqual(
    fake.calls.filter(
      (call) =>
        call.startsWith("replace_usage_pending:") ||
        call === "rpc_cancel_submission:old-submission" ||
        call.startsWith(`rpc_link_submission:${newSubmission.id}`),
    ),
    [
      `replace_usage_pending:${newSubmission.id}`,
      "rpc_cancel_submission:old-submission",
      `rpc_link_submission:${newSubmission.id}`,
    ],
  )
})

test("failed pending replacement leaves old pending usage untouched", async () => {
  const fake = createFakeRepository({
    failSubmissionLink: true,
    usage: makeUsage({
      id: "existing-usage",
      product_name: "Altes Produkt",
      frequency_range: "weekly_1x",
      product_submission_id: "old-submission",
      match_status: "pending_review",
      source: "onboarding",
      intake_method: "manual",
    }),
    submissions: [
      makeSubmission({
        id: "old-submission",
        user_product_usage_id: "existing-usage",
        status: "pending_review",
      }),
    ],
  })

  await assert.rejects(() =>
    submitProductIntake({
      userId: USER_ID,
      source: "onboarding",
      input: onboardingProductIntakeSubmissionSchema.parse(
        manualInput({
          brand_text: "Unbekannte Marke",
          product_name_text: "Mystery Maske",
          replace_existing_confirmed: true,
        }),
      ),
      repository: fake.repository,
      now: () => "2026-06-13T10:00:00.000Z",
    }),
  )

  const oldSubmission = fake.submissions.find((submission) => submission.id === "old-submission")
  assert.equal(oldSubmission?.status, "pending_review")
  assert.equal(fake.usage?.product_submission_id, "old-submission")
  assert.ok(fake.calls.some((call) => call.startsWith("replace_usage_pending:")))
  assert.ok(!fake.calls.includes("rpc_cancel_submission:old-submission"))
})

test("cancelling an onboarding usage deletes the slot before closing the linked pending submission", async () => {
  const fake = createFakeRepository({
    usage: makeUsage({
      id: EXISTING_USAGE_ID,
      product_submission_id: "old-submission",
      match_status: "pending_review",
      source: "onboarding",
      intake_method: "photo",
    }),
    submissions: [
      makeSubmission({
        id: "old-submission",
        user_product_usage_id: EXISTING_USAGE_ID,
        status: "pending_review",
      }),
    ],
  })

  const result = await cancelProductIntakeUsage({
    userId: USER_ID,
    category: "mask",
    repository: fake.repository,
    now: () => "2026-06-13T10:00:00.000Z",
  })

  assert.deepEqual(result, {
    category: "mask",
    usage_id: EXISTING_USAGE_ID,
    submission_id: "old-submission",
  })
  assert.equal(fake.usage, null)
  assert.equal(fake.submissions[0].status, "cancelled_by_user")
  assert.equal(fake.submissions[0].user_product_usage_id, null)
  assert.deepEqual(fake.calls.slice(-2), [
    "cancel_usage:mask",
    "rpc_cancel_submission:old-submission",
  ])
})

test("chat intake verifies source conversation ownership and preserves owned conversation id", async () => {
  const fake = createFakeRepository({ conversationIds: [CONVERSATION_ID] })

  const result = await submitProductIntake({
    userId: USER_ID,
    source: "chat",
    input: chatProductIntakeSubmissionSchema.parse(
      manualInput({
        brand_text: "Unbekannte Marke",
        product_name_text: "Mystery Maske",
        source_conversation_id: CONVERSATION_ID,
      }),
    ),
    repository: fake.repository,
  })

  assert.equal(result.status, "pending_review")
  assert.equal(fake.submissions[0].source, "chat")
  assert.equal(fake.submissions[0].source_conversation_id, CONVERSATION_ID)
  assert.deepEqual(
    fake.calls.filter((call) => call.startsWith("verify_conversation")),
    [`verify_conversation:${CONVERSATION_ID}`],
  )

  const denied = createFakeRepository({ conversationIds: [CONVERSATION_ID] })
  await assert.rejects(
    () =>
      submitProductIntake({
        userId: USER_ID,
        source: "chat",
        input: chatProductIntakeSubmissionSchema.parse(
          manualInput({
            source_conversation_id: OTHER_CONVERSATION_ID,
          }),
        ),
        repository: denied.repository,
      }),
    ProductIntakeOwnershipError,
  )
})

test("route handler returns controlled disabled response before auth or persistence", async () => {
  const handler = createProductIntakePostHandler("onboarding", {
    isEnabled: () => false,
    createServerClient: async () => {
      throw new Error("auth should not be called while disabled")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/product-intake/onboarding", {
      method: "POST",
      body: JSON.stringify(manualInput()),
    }),
  )
  const body = await response.json()

  assert.equal(response.status, 503)
  assert.equal(body.code, "product_intake_disabled")
})

test("chat route persists pending product context after product intake submission", async () => {
  const fake = createFakeRepository({ conversationIds: [CONVERSATION_ID] })
  const persistedTransitions: unknown[] = []
  const handler = createProductIntakePostHandler("chat", {
    isEnabled: () => true,
    createServerClient: async () =>
      ({
        auth: {
          getUser: async () => ({
            data: { user: { id: USER_ID } },
          }),
        },
      }) as never,
    createAdminClient: (() => ({})) as never,
    createRepository: () => fake.repository,
    loadConversationState: async () => createDefaultAgentV2ConversationState(),
    persistConversationStateTransition: async (_admin, params) => {
      persistedTransitions.push(params.transition)
      return { status: "persisted", error: null }
    },
    now: () => "2026-06-28T18:00:00.000Z",
  })

  const response = await handler(
    new Request("https://example.test/api/product-intake/chat", {
      method: "POST",
      body: JSON.stringify({
        intake_method: "manual",
        category: "conditioner",
        frequency_range: "weekly_3_4x",
        brand_text: "Jean & Lean",
        product_name_text: "Mystery Rose Conditioner",
        source_conversation_id: CONVERSATION_ID,
      }),
    }),
  )
  const body = await response.json()

  assert.equal(response.status, 202)
  assert.equal(body.status, "pending_review")
  assert.equal(persistedTransitions.length, 1)

  const transition = persistedTransitions[0] as {
    reason?: string
    next_state?: {
      agent_v2?: {
        active_product_contexts?: Array<Record<string, unknown>>
        active_resolved_product_context?: unknown
      }
    }
  }
  assert.equal(transition.reason, "product_intake_submission_context")
  assert.deepEqual(transition.next_state?.agent_v2?.active_product_contexts, [
    {
      status: "pending_review",
      product_id: null,
      submission_id: body.submission.id,
      category: "conditioner",
      brand_text: "Jean & Lean",
      product_name_text: "Mystery Rose Conditioner",
      display_name: "Jean & Lean Mystery Rose Conditioner",
      original_user_message: "Ich habe Jean & Lean Mystery Rose Conditioner eingereicht.",
      source: "product_intake_submission",
      updated_at: "2026-06-28T18:00:00.000Z",
    },
  ])
  assert.equal(transition.next_state?.agent_v2?.active_resolved_product_context, null)
})

test("route handler returns controlled client error for wrong-user upload paths", async () => {
  const fake = createFakeRepository()
  const handler = createProductIntakePostHandler("onboarding", {
    isEnabled: () => true,
    createServerClient: async () =>
      ({
        auth: {
          getUser: async () => ({
            data: { user: { id: USER_ID } },
          }),
        },
      }) as never,
    createAdminClient: (() => ({})) as never,
    createRepository: () => fake.repository,
  })

  const response = await handler(
    new Request("https://example.test/api/product-intake/onboarding", {
      method: "POST",
      body: JSON.stringify({
        intake_method: "photo",
        category: "mask",
        frequency_range: "weekly_1x",
        front_image_path: "tmp/someone-else/front.jpg",
      }),
    }),
  )
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.code, "product_intake_upload_owner_mismatch")
  assert.match(body.error, /Bildpfad gehört nicht zu diesem Nutzer/)
})

test("route handler returns controlled expired response for missing tmp uploads", async () => {
  const fake = createFakeRepository({ uploadedPaths: [] })
  const handler = createProductIntakePostHandler("onboarding", {
    isEnabled: () => true,
    createServerClient: async () =>
      ({
        auth: {
          getUser: async () => ({
            data: { user: { id: USER_ID } },
          }),
        },
      }) as never,
    createAdminClient: (() => ({})) as never,
    createRepository: () => fake.repository,
  })

  const response = await handler(
    new Request("https://example.test/api/product-intake/onboarding", {
      method: "POST",
      body: JSON.stringify({
        intake_method: "photo",
        category: "mask",
        frequency_range: "weekly_1x",
        front_image_path: `tmp/${USER_ID}/missing.jpg`,
      }),
    }),
  )
  const body = await response.json()

  assert.equal(response.status, 410)
  assert.equal(body.code, "product_intake_upload_expired")
  assert.match(body.error, /Upload nicht gefunden/)
})

test("route handler keeps storage verification failures as persistence errors", async () => {
  const fake = createFakeRepository()
  fake.repository.verifyUploadedImage = async () => {
    throw new ProductIntakePersistenceError("verify product intake image: Storage unavailable")
  }
  const handler = createProductIntakePostHandler("onboarding", {
    isEnabled: () => true,
    createServerClient: async () =>
      ({
        auth: {
          getUser: async () => ({
            data: { user: { id: USER_ID } },
          }),
        },
      }) as never,
    createAdminClient: (() => ({})) as never,
    createRepository: () => fake.repository,
  })
  const originalConsoleError = console.error
  console.error = () => {}

  try {
    const response = await handler(
      new Request("https://example.test/api/product-intake/onboarding", {
        method: "POST",
        body: JSON.stringify({
          intake_method: "photo",
          category: "mask",
          frequency_range: "weekly_1x",
          front_image_path: `tmp/${USER_ID}/front.jpg`,
        }),
      }),
    )
    const body = await response.json()

    assert.equal(response.status, 500)
    assert.equal(body.error, "Produkt konnte nicht gespeichert werden.")
  } finally {
    console.error = originalConsoleError
  }
})

test("storage upload verification classifies only missing objects as expired user uploads", () => {
  assert.equal(
    isMissingProductIntakeUploadError({
      status: 404,
      statusCode: "NoSuchKey",
      message: "Object not found",
    }),
    true,
  )

  assert.equal(
    isMissingProductIntakeUploadError({
      status: 404,
      statusCode: "NoSuchBucket",
      message: "Bucket not found",
    }),
    false,
  )

  assert.equal(
    isMissingProductIntakeUploadError({
      status: 403,
      statusCode: "AccessDenied",
      message: "Access denied",
    }),
    false,
  )

  assert.equal(
    isMissingProductIntakeUploadError({
      status: 503,
      statusCode: "ServiceUnavailable",
      message: "Storage temporarily unavailable",
    }),
    false,
  )
})

test("image validation accepts image signatures and rejects non-images", async () => {
  const png = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])],
    "front.png",
    { type: "image/png" },
  )
  const validated = await validateProductIntakeImageFile(png, "front")

  assert.equal(validated.mimeType, "image/png")
  assert.equal(validated.extension, "png")
  assert.equal(validated.validationStatus, "uncertain")
  assert.equal(validated.validationMetadata.validation, "file_signature_only")

  const text = new File([new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f])], "front.txt", {
    type: "text/plain",
  })

  await assert.rejects(
    () => validateProductIntakeImageFile(text, "front"),
    /Bitte lade ein JPG-, PNG-, WebP-, HEIC- oder HEIF-Bild hoch/,
  )
})
