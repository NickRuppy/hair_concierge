import "server-only"

import { z } from "zod"

import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

import { loadDiscoveryEnrollmentForUser, type DiscoveryEnrollment } from "./enrollment"

/**
 * The participant checklist's WRITE model over `public.discovery_intakes` and
 * `public.discovery_intake_items` (migration 20260922120000).
 *
 * Both tables are service-only, so every statement here runs on the admin client
 * — the same doctrine `public.scan_wishlist` established. Nothing in this module
 * may be reached without `resolveDiscoveryIntakeContext` first proving, per
 * request, that the caller is the signed-in owner of an unrevoked enrollment:
 * middleware gates on the JWT stamp alone, which a revocation does not
 * invalidate until the token refreshes.
 *
 * Read models for the admin cockpit live in `load-*.ts` (T4) — not here.
 */

export const DISCOVERY_INTAKE_CATEGORIES = SUPPORTED_PRODUCT_CATEGORY_KEYS
export type DiscoveryIntakeCategory = (typeof SUPPORTED_PRODUCT_CATEGORY_KEYS)[number]

/** Mirrors the migration's `source` CHECK exactly. */
export const DISCOVERY_INTAKE_ITEM_SOURCES = [
  "catalog_search",
  "barcode",
  "barcode_unknown",
  "dm_search",
  "name_research",
  "none",
] as const
export type DiscoveryIntakeItemSource = (typeof DISCOVERY_INTAKE_ITEM_SOURCES)[number]

const INTAKES_TABLE = "discovery_intakes"
const ITEMS_TABLE = "discovery_intake_items"

const INTAKE_COLUMNS = "id,enrollment_id,user_id,state,submitted_at"
const ITEM_COLUMNS =
  "id,intake_id,category,source,brand_text,product_name_text,barcode_identifier,product_id,product_submission_id,created_at"

export type DiscoveryAdminClient = ReturnType<typeof createAdminClient>

export type DiscoveryIntake = {
  id: string
  enrollmentId: string
  userId: string
  state: "draft" | "submitted"
  submittedAt: string | null
}

export type DiscoveryIntakeItem = {
  id: string
  category: DiscoveryIntakeCategory
  source: DiscoveryIntakeItemSource
  brandText: string | null
  productNameText: string | null
  barcodeIdentifier: string | null
  productId: string | null
  productSubmissionId: string | null
}

type IntakeRow = {
  id: string
  enrollment_id: string
  user_id: string
  state: string
  submitted_at: string | null
}

type ItemRow = {
  id: string
  intake_id: string
  category: string
  source: string
  brand_text: string | null
  product_name_text: string | null
  barcode_identifier: string | null
  product_id: string | null
  product_submission_id: string | null
  created_at: string
}

/** The insert payload, with every identity column written explicitly. */
export type DiscoveryIntakeItemInsert = {
  intake_id: string
  category: DiscoveryIntakeCategory
  source: DiscoveryIntakeItemSource
  brand_text: string | null
  product_name_text: string | null
  barcode_identifier: string | null
  product_id: string | null
  product_submission_id: string | null
}

// --- The capture contract ----------------------------------------------------

const uuidSchema = z.string().uuid()
// `discovery_intake_items.barcode_identifier`'s own CHECK, mirrored so a bad value
// is a 400 rather than a constraint violation surfacing as a 503.
const barcodeSchema = z.string().regex(/^[0-9]{8,14}$/)
const brandTextSchema = z.string().trim().min(1).max(200)
const productNameTextSchema = z.string().trim().min(1).max(240)

export const discoveryIntakeCategorySchema = z.enum(DISCOVERY_INTAKE_CATEGORIES)

/**
 * What the checklist client declares it captured. One variant per `source`, and
 * the variant itself carries the identity the migration's
 * `discovery_intake_items_captured_has_identity` CHECK demands:
 *
 * - `catalog_search` / `barcode` — a catalog product the server already resolved
 *   (search route, or `POST /api/beratung/identify`).
 * - `barcode_unknown` — a scan our catalog does not know. The barcode itself is
 *   the identity; the research submission it opened is attached when there is one.
 * - `dm_search` / `name_research` — a `POST /api/scan/submit` outcome. BOTH
 *   shapes are accepted: `200 {kind:"already_in_catalog", productId}` and
 *   `202 {kind:"pending_submission", submissionId}`.
 *
 * `brandText`/`productNameText` are carried in EVERY captured variant — including
 * the ones that resolved to a `product_id`. The cockpit must be able to render
 * what the participant actually said they own even if the catalog row is later
 * deactivated (the FK is `ON DELETE SET NULL`).
 */
export const discoveryIntakeCaptureSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("catalog_search"),
      productId: uuidSchema,
      brandText: brandTextSchema.nullish(),
      productNameText: productNameTextSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("barcode"),
      productId: uuidSchema,
      barcodeIdentifier: barcodeSchema,
      brandText: brandTextSchema.nullish(),
      productNameText: productNameTextSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("barcode_unknown"),
      barcodeIdentifier: barcodeSchema,
      productId: uuidSchema.nullish(),
      productSubmissionId: uuidSchema.nullish(),
      brandText: brandTextSchema.nullish(),
      productNameText: productNameTextSchema.nullish(),
    })
    .strict(),
  z
    .object({
      source: z.literal("dm_search"),
      barcodeIdentifier: barcodeSchema,
      productId: uuidSchema.nullish(),
      productSubmissionId: uuidSchema.nullish(),
      brandText: brandTextSchema.nullish(),
      productNameText: productNameTextSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("name_research"),
      productId: uuidSchema.nullish(),
      productSubmissionId: uuidSchema.nullish(),
      brandText: brandTextSchema,
      productNameText: productNameTextSchema,
    })
    .strict(),
  // „benutze ich nicht" is an explicit answer that carries nothing — the
  // migration's `discovery_intake_items_none_is_empty` CHECK enforces the same.
  z.object({ source: z.literal("none") }).strict(),
])

export type DiscoveryIntakeCapture = z.infer<typeof discoveryIntakeCaptureSchema>

export const discoveryIntakeItemBodySchema = z
  .object({
    category: discoveryIntakeCategorySchema,
    capture: discoveryIntakeCaptureSchema,
  })
  .strict()

export type DiscoveryIntakeItemBuildResult =
  | { ok: true; row: DiscoveryIntakeItemInsert }
  | { ok: false; reason: "missing_identity" }

function orNull<T>(value: T | null | undefined): T | null {
  return value ?? null
}

/**
 * The one place a capture becomes a row. Every column is set explicitly so a new
 * `source` cannot silently inherit another variant's identity, and the
 * `captured_has_identity` CHECK is re-stated here in code: a `dm_search` or
 * `name_research` capture whose submit outcome carried neither a `productId` nor
 * a `submissionId` is rejected as a 400 instead of reaching Postgres as a 503.
 */
export function buildDiscoveryIntakeItemRow(
  intakeId: string,
  category: DiscoveryIntakeCategory,
  capture: DiscoveryIntakeCapture,
): DiscoveryIntakeItemBuildResult {
  const base = {
    intake_id: intakeId,
    category,
    source: capture.source,
  }

  if (capture.source === "none") {
    return {
      ok: true,
      row: {
        ...base,
        brand_text: null,
        product_name_text: null,
        barcode_identifier: null,
        product_id: null,
        product_submission_id: null,
      },
    }
  }

  const row: DiscoveryIntakeItemInsert = {
    ...base,
    brand_text: orNull("brandText" in capture ? capture.brandText : null),
    product_name_text: orNull("productNameText" in capture ? capture.productNameText : null),
    barcode_identifier: orNull("barcodeIdentifier" in capture ? capture.barcodeIdentifier : null),
    product_id: orNull("productId" in capture ? capture.productId : null),
    product_submission_id: orNull(
      "productSubmissionId" in capture ? capture.productSubmissionId : null,
    ),
  }

  if (
    row.product_id === null &&
    row.product_submission_id === null &&
    row.barcode_identifier === null &&
    row.product_name_text === null
  ) {
    return { ok: false, reason: "missing_identity" }
  }
  return { ok: true, row }
}

// --- Projections -------------------------------------------------------------

function projectIntake(row: IntakeRow): DiscoveryIntake {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    userId: row.user_id,
    state: row.state === "submitted" ? "submitted" : "draft",
    submittedAt: row.submitted_at,
  }
}

function projectItem(row: ItemRow): DiscoveryIntakeItem {
  return {
    id: row.id,
    category: row.category as DiscoveryIntakeCategory,
    source: row.source as DiscoveryIntakeItemSource,
    brandText: row.brand_text,
    productNameText: row.product_name_text,
    barcodeIdentifier: row.barcode_identifier,
    productId: row.product_id,
    productSubmissionId: row.product_submission_id,
  }
}

// --- Persistence -------------------------------------------------------------

export async function loadDiscoveryIntake(
  enrollmentId: string,
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntake | null> {
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .select(INTAKE_COLUMNS)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()
  if (error) throw error
  const row = (data as IntakeRow | null) ?? null
  return row ? projectIntake(row) : null
}

/**
 * `discovery_intakes.enrollment_id` is UNIQUE, so two concurrent first visits
 * cannot both insert: the loser reads back the winner's row rather than failing
 * the page.
 */
export async function getOrCreateDiscoveryIntake(
  input: { enrollmentId: string; userId: string },
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntake> {
  const existing = await loadDiscoveryIntake(input.enrollmentId, client)
  if (existing) return existing

  const { data, error } = await client
    .from(INTAKES_TABLE)
    .insert({ enrollment_id: input.enrollmentId, user_id: input.userId })
    .select(INTAKE_COLUMNS)
    .maybeSingle()
  if (error) {
    const raced = await loadDiscoveryIntake(input.enrollmentId, client)
    if (raced) return raced
    throw error
  }
  const row = (data as IntakeRow | null) ?? null
  if (!row) throw new Error("Discovery intake could not be created")
  return projectIntake(row)
}

export async function loadDiscoveryIntakeItems(
  intakeId: string,
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntakeItem[]> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .select(ITEM_COLUMNS)
    .eq("intake_id", intakeId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
  if (error) throw error
  return ((data as ItemRow[] | null) ?? []).map(projectItem)
}

/**
 * A category is either „benutze ich nicht" OR a non-empty product list — never
 * both. Rather than leaving that to the UI, every write clears the answer it
 * replaces: adding a product drops a standing `none` row, and answering `none`
 * drops the products. (It also keeps
 * `discovery_intake_items_one_none_per_category` from ever being hit.)
 */
export async function clearDiscoveryIntakeCategory(
  input: {
    intakeId: string
    category: DiscoveryIntakeCategory
    sources?: DiscoveryIntakeItemSource[]
  },
  client: DiscoveryAdminClient,
): Promise<void> {
  let query = client
    .from(ITEMS_TABLE)
    .delete()
    .eq("intake_id", input.intakeId)
    .eq("category", input.category)
  if (input.sources) query = query.in("source", input.sources)
  const { error } = await query
  if (error) throw error
}

export async function insertDiscoveryIntakeItem(
  row: DiscoveryIntakeItemInsert,
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntakeItem> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .insert(row)
    .select(ITEM_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const inserted = (data as ItemRow | null) ?? null
  if (!inserted) throw new Error("Discovery intake item could not be stored")
  return projectItem(inserted)
}

/** Scoped to the caller's own intake: an item id from another intake deletes nothing. */
export async function deleteDiscoveryIntakeItem(
  input: { intakeId: string; itemId: string },
  client: DiscoveryAdminClient,
): Promise<boolean> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .delete()
    .eq("intake_id", input.intakeId)
    .eq("id", input.itemId)
    .select("id")
  if (error) throw error
  return ((data as Array<{ id: string }> | null) ?? []).length > 0
}

export async function submitDiscoveryIntake(
  intakeId: string,
  client: DiscoveryAdminClient,
  now: () => string = () => new Date().toISOString(),
): Promise<DiscoveryIntake> {
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .update({ state: "submitted", submitted_at: now() })
    .eq("id", intakeId)
    .eq("state", "draft")
    .select(INTAKE_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row = (data as IntakeRow | null) ?? null
  if (!row) throw new Error("Discovery intake is not in draft state")
  return projectIntake(row)
}

// --- Completeness ------------------------------------------------------------

/** Every one of the ten categories must carry an answer — a product or „none". */
export function missingDiscoveryIntakeCategories(
  items: Pick<DiscoveryIntakeItem, "category">[],
): DiscoveryIntakeCategory[] {
  const answered = new Set(items.map((item) => item.category))
  return DISCOVERY_INTAKE_CATEGORIES.filter((category) => !answered.has(category))
}

export function isDiscoveryIntakeComplete(items: Pick<DiscoveryIntakeItem, "category">[]): boolean {
  return missingDiscoveryIntakeCategories(items).length === 0
}

// --- The per-request guard ---------------------------------------------------

export type DiscoveryIntakeContext =
  | { status: "unauthenticated" }
  | { status: "not_enrolled" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | {
      status: "ready"
      userId: string
      enrollment: DiscoveryEnrollment
      intake: DiscoveryIntake
      admin: DiscoveryAdminClient
    }

export type DiscoveryIntakeContextDependencies = {
  getUserId: () => Promise<string | null>
  loadEnrollment: (userId: string) => Promise<DiscoveryEnrollment | null>
  createAdminClient: () => DiscoveryAdminClient
  getOrCreateIntake: typeof getOrCreateDiscoveryIntake
}

const defaultContextDependencies: DiscoveryIntakeContextDependencies = {
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadEnrollment: (userId) => loadDiscoveryEnrollmentForUser(userId),
  createAdminClient,
  getOrCreateIntake: getOrCreateDiscoveryIntake,
}

/**
 * The guard every intake surface runs, in this order:
 *
 * 1. a session (401),
 * 2. `loadDiscoveryEnrollmentForUser` — `revoked_at IS NULL` AND
 *    `claimed_user_id = userId`, re-read per request (404 when it answers
 *    nothing, which is what a revoked participant now gets),
 * 3. ownership: no DB constraint links `discovery_intakes.user_id` to the
 *    enrollment's `claimed_user_id`, so the pairing is enforced HERE (403).
 *
 * Only then is the service-role client handed out.
 */
export async function resolveDiscoveryIntakeContext(
  overrides: Partial<DiscoveryIntakeContextDependencies> = {},
): Promise<DiscoveryIntakeContext> {
  const deps = { ...defaultContextDependencies, ...overrides }
  try {
    const userId = await deps.getUserId()
    if (!userId) return { status: "unauthenticated" }

    const enrollment = await deps.loadEnrollment(userId)
    if (!enrollment) return { status: "not_enrolled" }
    // Defence in depth: the loader already filters on `claimed_user_id`, but the
    // pairing this module relies on must never rest on a single call site.
    if (enrollment.claimedUserId !== userId) return { status: "forbidden" }

    const admin = deps.createAdminClient()
    const intake = await deps.getOrCreateIntake(
      { enrollmentId: enrollment.enrollmentId, userId },
      admin,
    )
    if (intake.userId !== userId) return { status: "forbidden" }

    return { status: "ready", userId, enrollment, intake, admin }
  } catch (error) {
    console.error("[discovery] intake context resolution failed:", error)
    return { status: "unavailable" }
  }
}
