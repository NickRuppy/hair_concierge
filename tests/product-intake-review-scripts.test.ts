import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  PromotionGateError,
  REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY,
  buildPromotionPayload,
  promoteProductById,
  shouldCapturePromotionError,
  validatePromotableProduct,
} from "../scripts/product-intake/promote"
import { deriveSuitableThicknessesFromSpecOperations } from "../scripts/product-intake/approve"
import {
  buildQueueReport,
  matchesQueueFilters,
  projectQueueRow,
  queueResultLimit,
  renderQueueOutput,
  type ProductIntakeQueueRow,
} from "../scripts/product-intake/queue-reporting"
import {
  buildAgentV2ProductIntakeReviewStateTransition,
  buildProductIntakeReviewMessage,
  buildProductIntakeReviewRagContext,
} from "../src/lib/product-intake/notifications"
import {
  createDefaultAgentV2ConversationState,
  type AgentV2ConversationStateV2,
} from "../src/lib/agent-v2/production/persisted-session-state"
import type { ProductSubmission } from "../src/lib/types"
import { parseArgs } from "../scripts/product-intake/cli"
import { loadQueueRows } from "../scripts/product-intake/queue"

const reviewMigration = readFileSync(
  "supabase/migrations/20260617120000_product_intake_review_workflow_functions.sql",
  "utf8",
)
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>
}
const approveScript = readFileSync("scripts/product-intake/approve.ts", "utf8")
const approvePackageScript = readFileSync("scripts/product-intake/approve-package.ts", "utf8")
const linkExistingScript = readFileSync("scripts/product-intake/link-existing.ts", "utf8")
const queueScript = readFileSync("scripts/product-intake/queue.ts", "utf8")
const prepareResearchScript = readFileSync("scripts/product-intake/prepare-research.ts", "utf8")
const researchQueueScript = readFileSync("scripts/product-intake/research-queue.ts", "utf8")
const requestInfoScript = readFileSync("scripts/product-intake/request-info.ts", "utf8")
const researchScript = readFileSync("scripts/product-intake/research.ts", "utf8")
const reviewActionsScript = readFileSync("scripts/product-intake/review-actions.ts", "utf8")
const promoteScript = readFileSync("scripts/product-intake/promote.ts", "utf8")
const notifyPendingScript = readFileSync("scripts/product-intake/notify-pending.ts", "utf8")
const cleanupPhotosScript = readFileSync("scripts/product-intake/cleanup-photos.ts", "utf8")
const cleanupStorageScript = readFileSync("scripts/product-intake/cleanup-storage.ts", "utf8")
const notificationsSource = readFileSync("src/lib/product-intake/notifications.ts", "utf8")
const productsRouteSource = readFileSync("src/app/api/products/route.ts", "utf8")
const selectionSource = readFileSync("src/lib/recommendation-engine/selection.ts", "utf8")

test("Phase 4A package scripts expose the script-first review workflow", () => {
  assert.equal(packageJson.scripts["products:intake:queue"], "tsx scripts/product-intake/queue.ts")
  assert.equal(
    packageJson.scripts["products:intake:review"],
    "tsx scripts/product-intake/review.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:prepare-research"],
    "tsx scripts/product-intake/prepare-research.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:research-queue"],
    "tsx scripts/product-intake/research-queue.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:research"],
    "tsx scripts/product-intake/research.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:approve"],
    "tsx scripts/product-intake/approve.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:approve-package"],
    "tsx scripts/product-intake/approve-package.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:approve-ready"],
    "tsx scripts/product-intake/approve-ready.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:link-existing"],
    "tsx scripts/product-intake/link-existing.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:request-info"],
    "tsx scripts/product-intake/request-info.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:notify-pending"],
    "tsx scripts/product-intake/notify-pending.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:promote"],
    "tsx scripts/product-intake/promote.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:cleanup-storage"],
    "tsx scripts/product-intake/cleanup-storage.ts",
  )
})

test("review workflow migration adds trigger-safe review RPCs", () => {
  const normalized = reviewMigration.toLowerCase().replace(/\s+/g, " ")

  for (const functionName of [
    "product_intake_approve_reviewed_product",
    "product_intake_link_existing_product",
    "product_intake_request_more_info",
    "product_intake_reject_submission",
  ]) {
    assert.match(normalized, new RegExp(`create or replace function public\\.${functionName}`))
    assert.match(normalized, new RegExp(`grant execute on function public\\.${functionName}`))
  }

  assert.match(normalized, /origin,\s*is_chaarlie_recommended/)
  assert.match(normalized, /'user_submitted',\s*false/)
  assert.doesNotMatch(normalized, /drop constraint if exists products_name_category_unique/)
  assert.match(
    normalized,
    /concat_ws\(' ', product_payload ->> 'canonical_brand', product_payload ->> 'clean_name'\)/,
  )
  assert.match(normalized, /exact product already exists; use link-existing/)
  assert.match(normalized, /identifier already exists; use link-existing/)
  assert.match(normalized, /existing\.identifier_type in \('ean', 'gtin', 'barcode'\)/)
  assert.match(normalized, /product_intake_review_normalize_identifier_value/)
  assert.match(
    normalized,
    /product_intake_review_normalize_identity_text\(product_payload ->> 'clean_name'\)/,
  )
  assert.match(normalized, /concat_ws\(\s*' ',\s*product_payload ->> 'canonical_brand'/)
  assert.match(normalized, /product_payload ->> 'product_line'/)
  assert.match(
    normalized,
    /add column normalized_identifier_value text generated always as \( public\.product_intake_review_normalize_identifier_value\(identifier_type, identifier_value\) \) stored/,
  )
  assert.match(normalized, /partition by product_id, identifier_type, normalized_identifier_value/)
  assert.match(normalized, /product_id = null,[\s\S]{0,120}product_submission_id = null/)
  assert.match(normalized, /status = 'approved'/)
  assert.match(normalized, /status = 'matched_existing'/)
  assert.match(normalized, /status = 'needs_more_info'/)
  assert.match(normalized, /status = 'rejected'/)
  assert.match(normalized, /notification_sent_at = null/)
  assert.match(
    normalized,
    /cleanup_after = coalesce\(cleanup_after, p_reviewed_at \+ interval '30 days'\)/,
  )
})

test("destructive review scripts default to dry-run and require explicit confirmation", () => {
  assert.match(linkExistingScript, /Dry-run only/)
  assert.match(linkExistingScript, /--apply --confirm/)
  assert.match(linkExistingScript, /Link-existing writes require --confirm/)

  assert.match(requestInfoScript, /Dry-run only/)
  assert.match(requestInfoScript, /Request-info writes require --confirm/)
  assert.match(requestInfoScript, /Reject writes require --confirm/)
  assert.match(requestInfoScript, /function sanitizeMissingFields/)
  assert.match(requestInfoScript, /typeof field === "string"/)
  assert.match(requestInfoScript, /field\.trim\(\)/)
  assert.match(cleanupStorageScript, /DEFAULT_TMP_MAX_AGE_HOURS = 6/)
  assert.match(cleanupPhotosScript, /DEFAULT_TMP_MAX_AGE_HOURS = 6/)
  assert.match(cleanupStorageScript, /Storage cleanup writes require --confirm/)
  assert.match(notificationsSource, /existingProductIntakeReviewMessageId/)
  assert.match(notificationsSource, /markNotificationSent/)
  assert.match(notificationsSource, /bumpConversationUpdatedAt/)
  assert.match(notificationsSource, /if \(!marked\)/)
  assert.doesNotMatch(notificationsSource, /\.from\("messages"\)\.delete\(\)/)
  assert.match(notificationsSource, /updated_at: params\.updatedAt/)
  assert.match(notificationsSource, /product_intake_offer/)
  assert.match(productsRouteSource, /\.eq\("is_chaarlie_recommended", true\)/)
  assert.match(selectionSource, /\.eq\("is_chaarlie_recommended", true\)/)

  assert.match(reviewActionsScript, /Refusing to update closed submission/)
  assert.match(reviewActionsScript, /\.eq\("status", params\.submission\.status\)/)
  assert.match(reviewActionsScript, /\.eq\("updated_at", params\.submission\.updated_at\)/)
  assert.match(researchScript, /submission\.researched_payload \?\? {}/)
  assert.match(reviewActionsScript, /error\?\.message \?\? "no row updated"/)
  assert.match(researchScript, /saveResearchedPayload/)
  assert.match(reviewActionsScript, /saveResearchedPayload/)
  assert.match(reviewActionsScript, /dryRunResearchedPayload/)
  assert.match(prepareResearchScript, /statusFilter:\s*"pending_review"/)
  assert.doesNotMatch(prepareResearchScript, /\.update\(/)
  assert.doesNotMatch(researchQueueScript, /flagBool\(args,\s*["']apply["']/)
  assert.doesNotMatch(researchQueueScript, /\.update\(/)
  assert.doesNotMatch(researchQueueScript, /\.insert\(/)
  assert.doesNotMatch(researchQueueScript, /\.upsert\(/)
  assert.doesNotMatch(researchQueueScript, /\.delete\(/)
  assert.doesNotMatch(researchQueueScript, /--apply/)
  assert.match(approvePackageScript, /Approve-package writes require --confirm/)
  assert.match(approvePackageScript, /approveSubmissionById/)
  assert.match(approvePackageScript, /saveResearchedPayload/)
  assert.doesNotMatch(approvePackageScript, /product_intake_link_existing_product/)
  assert.match(queueScript, /REVIEW_LANE_STATUSES = \[/)
  assert.doesNotMatch(queueScript, /REVIEW_LANE_STATUSES = \[\s*"pending_review"/)
  assert.match(queueScript, /--report|flagBool\(args, "report"\)/)
  assert.match(queueScript, /flag\(args, "category"\)/)
  assert.match(queueScript, /flag\(args, "source"\)/)
  assert.doesNotMatch(queueScript, /flag\(args, "notification"\)/)
  assert.match(queueScript, /renderQueueOutput/)

  assert.doesNotMatch(promoteScript, /Dry-run only/)
  assert.match(promoteScript, /confirm:\s*flagBool\(args, "confirm"\)/)
  assert.match(promoteScript, /Product \${productId} not found/)
  assert.match(promoteScript, /is_active=true/)
  assert.match(promoteScript, /lifecycle_status/)
  assert.match(promoteScript, /missing required category specs/)
  assert.match(promoteScript, /proposed_action:[\s\S]{0,160}"already_recommended"/)
  assert.match(promoteScript, /is_chaarlie_recommended:\s*true/)
  assert.match(promoteScript, /updated_at:\s*updatedAt/)
  assert.match(promoteScript, /origin !== "user_submitted"/)
  assert.match(promoteScript, /\.from\("product_submissions"\)/)
  assert.match(promoteScript, /\.eq\("status", "approved"\)/)
  assert.match(promoteScript, /stage:\s*"promote_product"/)
  assert.match(promoteScript, /flushProductIntakeSentry/)
  assert.match(promoteScript, /shouldCapturePromotionError/)
  assert.match(promoteScript, /\.eq\("is_active", true\)/)
  assert.match(promoteScript, /\.eq\("lifecycle_status", "active"\)/)
  assert.match(promoteScript, /\.eq\("is_chaarlie_recommended", false\)/)
  assert.match(promoteScript, /\.eq\("updated_at", product\.updated_at\)/)
  assert.doesNotMatch(promoteScript, /origin:\s*"curated"/)
  assert.match(approveScript, /stage:\s*"append_addition_record"/)
  assert.match(approveScript, /committed:\s*true/)
  assert.match(queueScript, /\.lte\("created_at"/)
  assert.match(queueScript, /\.gte\("created_at"/)
  assert.match(approveScript, /flushProductIntakeSentry/)
  assert.match(linkExistingScript, /flushProductIntakeSentry/)
  assert.match(requestInfoScript, /flushProductIntakeSentry/)
  assert.doesNotMatch(notifyPendingScript, /stage:\s*"notify_pending"/)
  assert.match(notifyPendingScript, /flushProductIntakeSentry/)
})

test("product intake CLI preserves inline flag values containing equals signs", () => {
  const args = parseArgs(["extra", "--reason=pH=5,5", "--apply"])

  assert.equal(args.flags.get("reason"), "pH=5,5")
  assert.equal(args.flags.get("apply"), true)
  assert.deepEqual(args.positional, ["extra"])
})

test("queue reporting derives ops status, filters, report counts, and csv output", () => {
  const now = new Date("2026-06-17T12:00:00.000Z")
  const rows: ProductIntakeQueueRow[] = [
    {
      id: "submission-1",
      created_at: "2026-06-16T12:00:00.000Z",
      updated_at: "2026-06-17T10:00:00.000Z",
      user_id: "user-1",
      source: "chat",
      category: "mask",
      brand_text: "Garnier",
      product_name_text: "Hair Food, Aloe",
      front_image_path: "front.jpg",
      barcode_image_path: null,
      status: "approved",
      reviewed_at: "2026-06-17T09:00:00.000Z",
      approved_product_id: "product-1",
      notification_sent_at: null,
      cleanup_after: "2026-06-17T11:00:00.000Z",
      photos_deleted_at: null,
      researched_payload: { draft: {}, final: {} },
    },
    {
      id: "submission-2",
      created_at: "2026-06-09T12:00:00.000Z",
      updated_at: "2026-06-10T10:00:00.000Z",
      user_id: "user-2",
      source: "onboarding",
      category: "conditioner",
      brand_text: null,
      product_name_text: "Repair",
      front_image_path: null,
      barcode_image_path: null,
      status: "pending_review",
      notification_sent_at: null,
      cleanup_after: null,
      photos_deleted_at: null,
      researched_payload: {},
    },
    {
      id: "submission-3",
      created_at: "2026-06-14T12:00:00.000Z",
      updated_at: "2026-06-15T10:00:00.000Z",
      user_id: "user-3",
      source: "chat",
      category: "shampoo",
      brand_text: "dm",
      product_name_text: "Shampoo",
      front_image_path: null,
      barcode_image_path: null,
      status: "rejected",
      notification_sent_at: "2026-06-15T11:00:00.000Z",
      cleanup_after: "2026-06-20T11:00:00.000Z",
      photos_deleted_at: "2026-06-16T11:00:00.000Z",
      researched_payload: { final: {} },
    },
  ]

  const projected = projectQueueRow(rows[0], now, (userId) => `hash-${userId}`)
  assert.equal(projected.age_days, 1)
  assert.equal(projected.notification_status, "pending")
  assert.equal(projected.approval_outcome, "approved")
  assert.equal(projected.research_state, "draft_and_final")
  assert.equal(projected.photo_retention, "cleanup_due")

  assert.equal(matchesQueueFilters(rows[0], {}, now), true)
  assert.equal(matchesQueueFilters(rows[2], { minAgeDays: 4 }, now), false)
  assert.equal(
    queueResultLimit({ report: false, format: "table", limit: 50, limitExplicit: false }),
    50,
  )
  assert.equal(
    queueResultLimit({ report: true, format: "table", limit: 50, limitExplicit: false }),
    null,
  )
  assert.equal(
    queueResultLimit({ report: false, format: "json", limit: 50, limitExplicit: false }),
    null,
  )
  assert.equal(
    queueResultLimit({ report: false, format: "csv", limit: 50, limitExplicit: false }),
    null,
  )
  assert.equal(
    queueResultLimit({ report: false, format: "json", limit: 5, limitExplicit: true }),
    5,
  )
  assert.equal(queueResultLimit({ report: false, format: "csv", limit: 5, limitExplicit: true }), 5)

  const report = buildQueueReport(rows, now)
  assert.deepEqual(report.by_status, { approved: 1, pending_review: 1, rejected: 1 })
  assert.deepEqual(report.by_age_bucket, { "0-1d": 1, "8+d": 1, "2-3d": 1 })
  assert.deepEqual(report.by_notification_status, { pending: 1, none: 1, sent: 1 })
  assert.deepEqual(report.by_research_state, {
    draft_and_final: 1,
    none: 1,
    final_only: 1,
  })

  const emptyReport = renderQueueOutput({
    rows: [],
    now,
    hashUserId: (userId) => `hash-${userId}`,
    report: true,
    format: "table",
    compact: false,
  })
  const emptyJson = renderQueueOutput({
    rows: [],
    now,
    hashUserId: (userId) => `hash-${userId}`,
    report: false,
    format: "json",
    compact: false,
  })
  const emptyCsv = renderQueueOutput({
    rows: [],
    now,
    hashUserId: (userId) => `hash-${userId}`,
    report: false,
    format: "csv",
    compact: false,
  })
  const emptyTable = renderQueueOutput({
    rows: [],
    now,
    hashUserId: (userId) => `hash-${userId}`,
    report: false,
    format: "table",
    compact: false,
  })

  assert.deepEqual(emptyReport, {
    kind: "json",
    value: {
      total: 0,
      by_status: {},
      by_age_bucket: {},
      by_category: {},
      by_source: {},
      by_notification_status: {},
      by_approval_outcome: {},
      by_research_state: {},
      by_photo_retention: {},
    },
  })
  assert.deepEqual(emptyJson, { kind: "json", value: [] })
  assert.equal(emptyCsv.kind, "csv")
  assert.match(emptyCsv.value, /^id,age_days,created_at/)
  assert.equal(emptyTable.kind, "empty_text")

  const csv = renderQueueOutput({
    rows: [rows[0]],
    now,
    hashUserId: (userId) => `hash-${userId}`,
    report: false,
    format: "csv",
    compact: false,
  })
  assert.equal(csv.kind, "csv")
  assert.match(csv.value, /"Hair Food, Aloe"/)
})

test("queue loader defaults to review lane and preserves explicit pending backlog filter", async () => {
  const now = new Date("2026-06-17T12:00:00.000Z")
  const baseRow: ProductIntakeQueueRow = {
    id: "submission-base",
    created_at: "2026-06-17T10:00:00.000Z",
    updated_at: "2026-06-17T11:00:00.000Z",
    user_id: "user-base",
    source: "chat",
    category: "mask",
    brand_text: "Garnier",
    product_name_text: "Hair Food",
    front_image_path: null,
    barcode_image_path: null,
    status: "pending_review",
    notification_sent_at: null,
    cleanup_after: null,
    photos_deleted_at: null,
    researched_payload: {},
  }
  const rows: ProductIntakeQueueRow[] = [
    { ...baseRow, id: "pending", status: "pending_review" },
    { ...baseRow, id: "researching", status: "researching" },
    { ...baseRow, id: "ready", status: "ready_for_review" },
    { ...baseRow, id: "needs-info", status: "needs_more_info" },
    { ...baseRow, id: "approved", status: "approved" },
  ]

  const reviewLaneRows = await loadQueueRows({
    supabase: fakeQueueSupabase(rows),
    statusFilter: null,
    categoryFilter: null,
    sourceFilter: null,
    includeClosed: false,
    minAgeDays: null,
    maxAgeDays: null,
    resultLimit: null,
    now,
  })

  assert.deepEqual(
    reviewLaneRows.map((row) => row.status),
    ["researching", "ready_for_review", "needs_more_info"],
  )

  const pendingRows = await loadQueueRows({
    supabase: fakeQueueSupabase(rows),
    statusFilter: "pending_review",
    categoryFilter: null,
    sourceFilter: null,
    includeClosed: false,
    minAgeDays: null,
    maxAgeDays: null,
    resultLimit: null,
    now,
  })

  assert.deepEqual(
    pendingRows.map((row) => row.id),
    ["pending"],
  )
})

test("queue loader pages complete exports while preserving explicit sample limits", async () => {
  const now = new Date("2026-06-17T12:00:00.000Z")
  const rows = Array.from(
    { length: 1001 },
    (_, index): ProductIntakeQueueRow => ({
      id: `submission-${index + 1}`,
      created_at: "2026-06-17T10:00:00.000Z",
      updated_at: "2026-06-17T11:00:00.000Z",
      user_id: `user-${index + 1}`,
      source: "chat",
      category: "mask",
      brand_text: "Garnier",
      product_name_text: `Hair Food ${index + 1}`,
      front_image_path: null,
      barcode_image_path: null,
      status: "pending_review",
      notification_sent_at: null,
      cleanup_after: null,
      photos_deleted_at: null,
      researched_payload: {},
    }),
  )

  const exportSupabase = fakeQueueSupabase(rows)
  const exportRows = await loadQueueRows({
    supabase: exportSupabase,
    statusFilter: "pending_review",
    categoryFilter: null,
    sourceFilter: null,
    includeClosed: false,
    minAgeDays: null,
    maxAgeDays: null,
    resultLimit: null,
    now,
  })

  assert.equal(exportRows.length, 1001)
  assert.deepEqual(exportSupabase.rangeCalls, [
    { from: 0, to: 999 },
    { from: 1000, to: 1999 },
  ])
  assert.deepEqual(exportSupabase.orderCalls, ["created_at", "id", "created_at", "id"])

  const largeSampleRows = Array.from(
    { length: 1501 },
    (_, index): ProductIntakeQueueRow => ({
      ...rows[0],
      id: `large-submission-${index + 1}`,
      user_id: `large-user-${index + 1}`,
      product_name_text: `Large Hair Food ${index + 1}`,
    }),
  )
  const sampleSupabase = fakeQueueSupabase(largeSampleRows)
  const sampleRows = await loadQueueRows({
    supabase: sampleSupabase,
    statusFilter: "pending_review",
    categoryFilter: null,
    sourceFilter: null,
    includeClosed: false,
    minAgeDays: null,
    maxAgeDays: null,
    resultLimit: 1500,
    now,
  })

  assert.equal(sampleRows.length, 1500)
  assert.deepEqual(sampleSupabase.rangeCalls, [
    { from: 0, to: 999 },
    { from: 1000, to: 1499 },
  ])
  assert.deepEqual(sampleSupabase.orderCalls, ["created_at", "id", "created_at", "id"])
})

test("promotion command reports state and preserves category-specific readiness gates", () => {
  assert.deepEqual(REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY.conditioner, [
    "product_conditioner_specs",
    "product_conditioner_rerank_specs",
  ])
  assert.deepEqual(REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY.leave_in, [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
  ])
  assert.deepEqual(REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY.oil, ["product_oil_eligibility"])

  const payload = buildPromotionPayload({
    product: {
      id: "product-1",
      name: "Garnier Hair Food Aloe",
      category: "Maske",
      category_key: "mask",
      origin: "user_submitted",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    },
    dryRun: true,
    reviewer: "Nick",
    notes: "Approved in Phase 4B",
  })

  assert.equal(payload.current_recommendation_state, false)
  assert.equal(payload.origin, "user_submitted")
  assert.equal(payload.category, "Maske")
  assert.equal(payload.category_key, "mask")
  assert.equal(payload.lifecycle_status, "active")
  assert.equal(payload.is_active, true)
  assert.equal(payload.dry_run, true)
  assert.equal(payload.proposed_action, "promote")
  assert.equal(payload.reviewer, "Nick")
  assert.equal(payload.notes, "Approved in Phase 4B")

  assert.deepEqual(
    validatePromotableProduct({
      id: "product-1",
      category: null,
      category_key: "mask",
      origin: "user_submitted",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    }),
    ["product_mask_specs"],
  )

  assert.throws(
    () =>
      validatePromotableProduct({
        id: "product-2",
        category: null,
        category_key: "mask",
        origin: "user_submitted",
        is_active: false,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
      }),
    /is_active=true/,
  )
  assert.throws(
    () =>
      validatePromotableProduct({
        id: "product-3",
        category: null,
        category_key: "mask",
        origin: "user_submitted",
        is_active: true,
        lifecycle_status: "discontinued",
        is_chaarlie_recommended: false,
      }),
    /promotion requires active/,
  )
  assert.throws(
    () =>
      validatePromotableProduct({
        id: "product-4",
        category: null,
        category_key: "mask",
        origin: "user_submitted",
        is_active: true,
        lifecycle_status: null,
        is_chaarlie_recommended: false,
      }),
    /lifecycle_status is missing/,
  )

  assert.equal(shouldCapturePromotionError(new PromotionGateError("missing specs")), false)
  assert.equal(shouldCapturePromotionError(new Error("database unavailable")), true)
})

test("promotion command blocks missing specs and stale guarded updates", async () => {
  const product = {
    id: "product-1",
    name: "Garnier Hair Food Aloe",
    category: "Maske",
    category_key: "mask",
    origin: "user_submitted",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: false,
    updated_at: "2026-06-17T10:00:00.000Z",
  }

  await withSilencedConsole(async () => {
    const missingSpecSupabase = fakePromotionSupabase({
      product,
      approvedSubmissionRows: [{ id: "submission-1", approved_product_id: "product-1" }],
      specRowsByTable: { product_mask_specs: [] },
      updateResult: { id: "product-1", updated_at: "2026-06-17T11:00:00.000Z" },
    })

    await assert.rejects(
      () =>
        promoteProductById({
          supabase: missingSpecSupabase,
          productId: "product-1",
          confirm: true,
          reviewer: "Nick",
          notes: null,
        }),
      /missing required category specs/,
    )
    assert.equal(missingSpecSupabase.updateCalls.length, 0)

    const staleSupabase = fakePromotionSupabase({
      product,
      approvedSubmissionRows: [{ id: "submission-1", approved_product_id: "product-1" }],
      specRowsByTable: { product_mask_specs: [{ product_id: "product-1" }] },
      updateResult: null,
    })

    await assert.rejects(
      () =>
        promoteProductById({
          supabase: staleSupabase,
          productId: "product-1",
          confirm: true,
          reviewer: "Nick",
          notes: null,
        }),
      /changed after validation/,
    )
    assert.deepEqual(staleSupabase.updateCalls[0]?.filters, {
      id: "product-1",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
      updated_at: "2026-06-17T10:00:00.000Z",
    })
  })
})

test("promotion command requires an approved intake submission and updates only after readiness checks pass", async () => {
  const product = {
    id: "product-1",
    name: "Garnier Hair Food Aloe",
    category: "Maske",
    category_key: "mask",
    origin: "user_submitted",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: false,
    updated_at: "2026-06-17T10:00:00.000Z",
  }

  await withSilencedConsole(async () => {
    const noApprovedSubmissionSupabase = fakePromotionSupabase({
      product,
      approvedSubmissionRows: [],
      specRowsByTable: { product_mask_specs: [{ product_id: "product-1" }] },
      updateResult: { id: "product-1", updated_at: "2026-06-17T11:00:00.000Z" },
    })

    await assert.rejects(
      () =>
        promoteProductById({
          supabase: noApprovedSubmissionSupabase,
          productId: "product-1",
          confirm: true,
          reviewer: "Nick",
          notes: null,
        }),
      /approved intake submission/,
    )
    assert.equal(noApprovedSubmissionSupabase.updateCalls.length, 0)

    const successSupabase = fakePromotionSupabase({
      product,
      approvedSubmissionRows: [{ id: "submission-1", approved_product_id: "product-1" }],
      specRowsByTable: { product_mask_specs: [{ product_id: "product-1" }] },
      updateResult: { id: "product-1", updated_at: "2026-06-17T11:00:00.000Z" },
    })

    const result = await promoteProductById({
      supabase: successSupabase,
      productId: "product-1",
      confirm: true,
      reviewer: "Nick",
      notes: "Ready",
    })

    assert.equal(result.next_recommendation_state, true)
    assert.equal(result.promoted_at, "2026-06-17T11:00:00.000Z")
    assert.deepEqual(successSupabase.updateCalls[0]?.patch, {
      is_chaarlie_recommended: true,
      updated_at: successSupabase.updateCalls[0]?.patch.updated_at,
    })
  })
})

function fakePromotionSupabase(params: {
  product: Record<string, unknown>
  approvedSubmissionRows?: Record<string, unknown>[]
  specRowsByTable: Record<string, unknown[]>
  updateResult: Record<string, unknown> | null
}) {
  const updateCalls: Array<{ patch: Record<string, unknown>; filters: Record<string, unknown> }> =
    []
  const client = {
    updateCalls,
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let patch: Record<string, unknown> | null = null
      const query = {
        select: () => query,
        update: (nextPatch: Record<string, unknown>) => {
          patch = nextPatch
          return query
        },
        eq: (key: string, value: unknown) => {
          filters[key] = value
          return query
        },
        limit: () => query,
        maybeSingle: async () => {
          if (table !== "products") {
            return { data: null, error: new Error(`unexpected maybeSingle table ${table}`) }
          }
          if (patch) {
            updateCalls.push({ patch, filters })
            return { data: params.updateResult, error: null }
          }
          return { data: params.product, error: null }
        },
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({
            data:
              table === "product_submissions"
                ? (params.approvedSubmissionRows ?? [])
                : (params.specRowsByTable[table] ?? []),
            error: null,
          }).then(resolve),
      }
      return query
    },
  }

  return client as typeof client & Parameters<typeof promoteProductById>[0]["supabase"]
}

function fakeQueueSupabase(rows: ProductIntakeQueueRow[]) {
  const orderCalls: string[] = []
  const rangeCalls: Array<{ from: number; to: number }> = []
  const client = {
    orderCalls,
    rangeCalls,
    from(table: string) {
      assert.equal(table, "product_submissions")
      const eqFilters: Record<string, unknown> = {}
      const inFilters: Record<string, unknown[]> = {}
      const lteFilters: Record<string, string> = {}
      const gteFilters: Record<string, string> = {}
      let rangeValue: { from: number; to: number } | null = null
      const query = {
        select: () => query,
        order: (column: string) => {
          orderCalls.push(column)
          return query
        },
        eq: (key: string, value: unknown) => {
          eqFilters[key] = value
          return query
        },
        in: (key: string, value: unknown[]) => {
          inFilters[key] = value
          return query
        },
        lte: (key: string, value: string) => {
          lteFilters[key] = value
          return query
        },
        gte: (key: string, value: string) => {
          gteFilters[key] = value
          return query
        },
        range: (from: number, to: number) => {
          rangeCalls.push({ from, to })
          rangeValue = { from, to }
          return query
        },
        then: (resolve: (value: { data: ProductIntakeQueueRow[]; error: null }) => unknown) => {
          let data = [...rows]
          for (const [key, value] of Object.entries(eqFilters)) {
            data = data.filter((row) => (row as unknown as Record<string, unknown>)[key] === value)
          }
          for (const [key, values] of Object.entries(inFilters)) {
            data = data.filter((row) =>
              values.includes((row as unknown as Record<string, unknown>)[key]),
            )
          }
          for (const [key, value] of Object.entries(lteFilters)) {
            data = data.filter(
              (row) => String((row as unknown as Record<string, unknown>)[key]) <= value,
            )
          }
          for (const [key, value] of Object.entries(gteFilters)) {
            data = data.filter(
              (row) => String((row as unknown as Record<string, unknown>)[key]) >= value,
            )
          }
          if (rangeValue) data = data.slice(rangeValue.from, rangeValue.to + 1)
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return query
    },
  }

  return client as typeof client & Parameters<typeof loadQueueRows>[0]["supabase"]
}

async function withSilencedConsole(run: () => Promise<void>) {
  const originalLog = console.log
  try {
    console.log = () => {}
    await run()
  } finally {
    console.log = originalLog
  }
}

function notificationSubmission(
  patch: Partial<ProductSubmission>,
): Pick<
  ProductSubmission,
  | "id"
  | "user_id"
  | "source"
  | "source_conversation_id"
  | "user_product_usage_id"
  | "intake_method"
  | "category"
  | "frequency_range"
  | "front_image_path"
  | "barcode_image_path"
  | "status"
  | "brand_text"
  | "product_name_text"
  | "approved_product_id"
  | "user_facing_resolution_reason"
  | "user_facing_next_step"
  | "user_facing_missing_fields"
  | "notification_sent_at"
> {
  return {
    id: "submission-1",
    user_id: "user-1",
    user_product_usage_id: "usage-1",
    source: "chat",
    source_conversation_id: "conversation-1",
    intake_method: "manual",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: null,
    barcode_image_path: null,
    status: "approved",
    brand_text: "Garnier",
    product_name_text: "Hair Food Aloe",
    approved_product_id: "product-1",
    user_facing_resolution_reason: null,
    user_facing_next_step: null,
    user_facing_missing_fields: [],
    notification_sent_at: null,
    ...patch,
  }
}

test("review notifications explain approved products in user-facing German", () => {
  const message = buildProductIntakeReviewMessage(notificationSubmission({}))

  assert.match(message ?? "", /Gute Nachrichten/)
  assert.match(message ?? "", /Garnier Hair Food Aloe/)
  assert.match(message ?? "", /Routine/)
})

test("approved review notifications resolve stale AgentV2 product intake context", () => {
  const previousState: AgentV2ConversationStateV2 = {
    ...createDefaultAgentV2ConversationState(),
    agent_v2: {
      ...createDefaultAgentV2ConversationState().agent_v2,
      active_product_contexts: [
        {
          status: "pending_review",
          product_id: null,
          submission_id: "submission-1",
          category: "shampoo",
          brand_text: "L'Oréal Paris Elvital",
          product_name_text: "Glycolic Gloss Shampoo",
          display_name: "L'Oréal Paris Elvital Glycolic Gloss Shampoo",
          original_user_message: "passt das L'Oréal Paris Elvital Shampoo Glycolic Gloss zu mir?",
          source: "product_intake_submission",
          updated_at: "2026-07-03T13:25:00.000Z",
        },
      ],
      active_resolved_product_context: null,
    },
  }

  const transition = buildAgentV2ProductIntakeReviewStateTransition({
    previousState,
    submission: notificationSubmission({
      id: "submission-1",
      category: "shampoo",
      brand_text: "L'Oréal Paris Elvital",
      product_name_text: "Glycolic Gloss Shampoo",
      approved_product_id: "prod-loreal-glycolic",
      status: "approved",
    }),
    nowIso: "2026-07-03T16:18:00.000Z",
  })

  assert.ok(transition)
  assert.equal(transition.reason, "product_intake_review_resolved_context")
  assert.deepEqual(transition.changed_fields, [
    "agent_v2.active_product_contexts",
    "agent_v2.active_resolved_product_context",
  ])
  assert.deepEqual(transition.next_state.agent_v2.active_product_contexts, [
    {
      status: "resolved",
      product_id: "prod-loreal-glycolic",
      submission_id: "submission-1",
      category: "shampoo",
      brand_text: "L'Oréal Paris Elvital",
      product_name_text: "Glycolic Gloss Shampoo",
      display_name: "L'Oréal Paris Elvital Glycolic Gloss Shampoo",
      original_user_message: "passt das L'Oréal Paris Elvital Shampoo Glycolic Gloss zu mir?",
      source: "product_intake_submission",
      updated_at: "2026-07-03T16:18:00.000Z",
    },
  ])
  assert.equal(
    transition.next_state.agent_v2.active_resolved_product_context?.product_id,
    "prod-loreal-glycolic",
  )
})

test("approved review notifications remove matching stale intake context without submission id", () => {
  const previousState: AgentV2ConversationStateV2 = {
    ...createDefaultAgentV2ConversationState(),
    agent_v2: {
      ...createDefaultAgentV2ConversationState().agent_v2,
      active_product_contexts: [
        {
          status: "pending_review",
          product_id: null,
          submission_id: null,
          category: "shampoo",
          brand_text: null,
          product_name_text: "Glycolic Gloss Shampoo",
          display_name: "Glycolic Gloss Shampoo",
          original_user_message: "passt das L'Oréal Paris Elvital Shampoo Glycolic Gloss zu mir?",
          source: "product_intake_submission",
          updated_at: "2026-07-03T13:25:00.000Z",
        },
      ],
      active_resolved_product_context: null,
    },
  }

  const transition = buildAgentV2ProductIntakeReviewStateTransition({
    previousState,
    submission: notificationSubmission({
      id: "submission-1",
      category: "shampoo",
      brand_text: "L'Oréal Paris Elvital",
      product_name_text: "Glycolic Gloss Shampoo",
      approved_product_id: "prod-loreal-glycolic",
      status: "approved",
    }),
    nowIso: "2026-07-03T16:18:00.000Z",
  })

  assert.ok(transition)
  assert.deepEqual(transition.next_state.agent_v2.active_product_contexts, [
    {
      status: "resolved",
      product_id: "prod-loreal-glycolic",
      submission_id: "submission-1",
      category: "shampoo",
      brand_text: "L'Oréal Paris Elvital",
      product_name_text: "Glycolic Gloss Shampoo",
      display_name: "L'Oréal Paris Elvital Glycolic Gloss Shampoo",
      original_user_message: "passt das L'Oréal Paris Elvital Shampoo Glycolic Gloss zu mir?",
      source: "product_intake_submission",
      updated_at: "2026-07-03T16:18:00.000Z",
    },
  ])
  assert.equal(
    transition.next_state.agent_v2.active_resolved_product_context?.product_id,
    "prod-loreal-glycolic",
  )
})

test("review notifications include actionable missing-info and rejection reasons", () => {
  const needsInfo = buildProductIntakeReviewMessage(
    notificationSubmission({
      status: "needs_more_info",
      approved_product_id: null,
      user_facing_resolution_reason: "Die Vorderseite ist zu unscharf.",
      user_facing_next_step: "Bitte lade ein schärferes Foto hoch.",
    }),
  )
  const rejected = buildProductIntakeReviewMessage(
    notificationSubmission({
      status: "rejected",
      approved_product_id: null,
      user_facing_resolution_reason: "Das Bild zeigt kein erkennbares Haarprodukt.",
      user_facing_next_step: "Bitte starte eine neue Produktprüfung.",
    }),
  )

  assert.match(needsInfo ?? "", /Vorderseite ist zu unscharf/)
  assert.match(needsInfo ?? "", /schärferes Foto/)
  assert.match(rejected ?? "", /leider nicht sicher/)
  assert.match(rejected ?? "", /kein erkennbares Haarprodukt/)
})

test("needs-more-info notifications include a prefilled follow-up intake offer", () => {
  const context = buildProductIntakeReviewRagContext(
    notificationSubmission({
      status: "needs_more_info",
      approved_product_id: null,
      intake_method: "photo",
      category: "mask",
      frequency_range: "weekly_3_4x",
      front_image_path: "user/submission/front.jpg",
      barcode_image_path: "user/submission/barcode.jpg",
      user_facing_missing_fields: ["Vorderseitenfoto", "Produktname"],
    }),
  )

  assert.equal(context.product_intake_review.submission_id, "submission-1")
  assert.equal(context.product_intake_offer?.reason, "needs_more_info")
  assert.equal(context.product_intake_offer?.existing_usage_id, "usage-1")
  assert.equal(context.product_intake_offer?.frequency_range, "weekly_3_4x")
  assert.equal(context.product_intake_offer?.intake_method, "photo")
  assert.equal(
    context.product_intake_offer?.committed_front_image_path,
    "user/submission/front.jpg",
  )
  assert.deepEqual(context.product_intake_offer?.missing_fields, [
    "Vorderseitenfoto",
    "Produktname",
  ])
})

test("needs-more-info notifications ignore malformed missing fields", () => {
  const context = buildProductIntakeReviewRagContext(
    notificationSubmission({
      status: "needs_more_info",
      approved_product_id: null,
      user_facing_missing_fields: [
        " Produktname ",
        "",
        { field: "barcode" },
        42,
        "Barcodefoto",
      ] as unknown as string[],
    }),
  )

  assert.deepEqual(context.product_intake_offer?.missing_fields, ["Produktname", "Barcodefoto"])
})

test("approval derives suitable thicknesses from category spec operations", () => {
  assert.deepEqual(
    deriveSuitableThicknessesFromSpecOperations([
      {
        type: "upsert",
        table: "product_conditioner_specs",
        rows: [
          { product_id: "p1", thickness: "fine", protein_moisture_balance: "snaps" },
          { product_id: "p1", thickness: "normal", protein_moisture_balance: "snaps" },
          { product_id: "p1", thickness: "fine", protein_moisture_balance: "stretches_stays" },
        ],
      },
      {
        type: "upsert",
        table: "product_conditioner_rerank_specs",
        rows: [{ product_id: "p1", weight: "medium" }],
      },
    ] as never),
    ["fine", "normal"],
  )

  assert.deepEqual(
    deriveSuitableThicknessesFromSpecOperations([
      {
        type: "upsert",
        table: "product_leave_in_eligibility",
        rows: [
          { product_id: "p2", thickness: "coarse", need_bucket: "repair" },
          { product_id: "p2", thickness: "invalid-value", need_bucket: "repair" },
        ],
      },
    ] as never),
    ["coarse"],
  )

  assert.deepEqual(
    deriveSuitableThicknessesFromSpecOperations([
      {
        type: "upsert",
        table: "product_mask_specs",
        rows: [{ product_id: "p3", weight: "light" }],
      },
    ] as never),
    [],
  )
})
