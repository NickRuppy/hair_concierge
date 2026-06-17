import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildProductIntakeReviewMessage,
  buildProductIntakeReviewRagContext,
} from "../src/lib/product-intake/notifications"
import type { ProductSubmission } from "../src/lib/types"

const reviewMigration = readFileSync(
  "supabase/migrations/20260617120000_product_intake_review_workflow_functions.sql",
  "utf8",
)
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>
}
const linkExistingScript = readFileSync("scripts/product-intake/link-existing.ts", "utf8")
const requestInfoScript = readFileSync("scripts/product-intake/request-info.ts", "utf8")
const researchScript = readFileSync("scripts/product-intake/research.ts", "utf8")
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
    packageJson.scripts["products:intake:research"],
    "tsx scripts/product-intake/research.ts",
  )
  assert.equal(
    packageJson.scripts["products:intake:approve"],
    "tsx scripts/product-intake/approve.ts",
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

  assert.match(researchScript, /Refusing to update closed submission/)
  assert.match(researchScript, /\.eq\("status", submission\.status\)/)
  assert.match(researchScript, /error\?\.message \?\? "no row updated"/)
})

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
