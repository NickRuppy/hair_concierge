import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { DiscoveryIntakeItemView } from "@/components/discovery/intake/types"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import {
  DISCOVERY_PRODUCT_TYPES,
  DISCOVERY_USAGE_ROLES,
  isDiscoveryProductCategory,
  isDiscoveryProductType,
  type DiscoveryProductType,
  type DiscoveryUsageRole,
} from "@/lib/discovery/classify"
import {
  DISCOVERY_ITEM_FREQUENCIES,
  isDiscoveryItemFrequency,
  type DiscoveryItemFrequency,
} from "@/lib/discovery/frequency"
import { readDiscoveryHeatStyling, type DiscoveryHeatStylingV1 } from "@/lib/discovery/heat-styling"
import { filterScanEligibleProductIds } from "@/lib/scan/catalog-eligibility"
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

const INTAKE_COLUMNS = "id,enrollment_id,user_id,state,submitted_at,heat_styling"
/**
 * The linked catalog product is read alongside the row (FK `product_id` ->
 * `products`), so the checklist can show the same packshot and product line the
 * search row showed without storing a copy of either. Rows without a catalog product read it as null.
 */
const ITEM_COLUMNS =
  "id,intake_id,category,source,brand_text,product_name_text,barcode_identifier,product_id,product_submission_id,product_type,usage_role,frequency,created_at,catalog_product:products(image_url,product_line:product_lines(canonical_name))"

export type DiscoveryAdminClient = ReturnType<typeof createAdminClient>

export type DiscoveryIntake = {
  id: string
  enrollmentId: string
  userId: string
  state: "draft" | "submitted"
  submittedAt: string | null
  /**
   * Her „Hitze & Styling" answers (batch 7); `null` = not asked yet. A stored value that no
   * longer validates reads as `null` (asked again) rather than failing the page.
   */
  heatStyling?: DiscoveryHeatStylingV1 | null
}

export type DiscoveryIntakeItem = {
  id: string
  /**
   * Her USAGE (batch 5): the category she uses the product in. `null` = unknown
   * („Weiß ich nicht"). Legacy (tile-model) rows always carry one.
   */
  category: DiscoveryIntakeCategory | null
  source: DiscoveryIntakeItemSource
  brandText: string | null
  productNameText: string | null
  barcodeIdentifier: string | null
  productId: string | null
  productSubmissionId: string | null
  /**
   * What the product IS (batch 5, F1): from the catalog's `category_key` for a catalog
   * product, else the classifier's or her „Was ist das?" answer; `null` = unknown. Research
   * submissions are opened from it. Optional only so legacy fixtures stay valid — every
   * projection sets it. Batch 7 (D2): `styling` = a styling product, listed but never
   * evaluated (no usage, no research).
   */
  productType?: DiscoveryProductType | null
  /** The routine role of her usage, for the multi-role oil step and scalp oil (R9). */
  usageRole?: DiscoveryUsageRole | null
  /** How often she uses it (batch 7): `null` = not asked, `unknown` = „Weiß ich nicht". */
  frequency?: DiscoveryItemFrequency | null
  /**
   * Presentation of the linked catalog product, when the row was read with its join
   * (`loadDiscoveryIntakeItems`, the insert helpers). Display only — never identity.
   */
  catalog?: DiscoveryIntakeCatalogPresentation | null
}

export type DiscoveryIntakeCatalogPresentation = {
  imageUrl: string | null
  productLine: string | null
}

type IntakeRow = {
  id: string
  enrollment_id: string
  user_id: string
  state: string
  submitted_at: string | null
  heat_styling?: unknown
}

type ItemRow = {
  id: string
  intake_id: string
  category: string | null
  source: string
  brand_text: string | null
  product_name_text: string | null
  barcode_identifier: string | null
  product_id: string | null
  product_submission_id: string | null
  product_type?: string | null
  usage_role?: string | null
  frequency?: string | null
  created_at: string
  catalog_product?: CatalogProductRelation | CatalogProductRelation[] | null
}

type CatalogProductRelation = {
  image_url: string | null
  product_line?: { canonical_name: string | null } | { canonical_name: string | null }[] | null
}

/**
 * The insert payload, with every identity column written explicitly. The legacy (tile)
 * path writes neither `product_type` nor `usage_role` — exactly the rows it wrote before
 * the batch-5 migration.
 */
export type DiscoveryIntakeItemInsert = {
  intake_id: string
  category: DiscoveryIntakeCategory | null
  source: DiscoveryIntakeItemSource
  brand_text: string | null
  product_name_text: string | null
  barcode_identifier: string | null
  product_id: string | null
  product_submission_id: string | null
  product_type?: DiscoveryProductType | null
  usage_role?: DiscoveryUsageRole | null
  /** Batch 7: written only when the client sent one — a legacy write leaves it NULL. */
  frequency?: DiscoveryItemFrequency | null
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

// --- The flat-checklist capture contract (batch 5) -------------------------------

/**
 * What the flat checklist sends: the product (identity only — never a submission id: the
 * server opens research itself, AFTER her usage answer, F1), what she or the classifier
 * says it IS, and how she uses it.
 *
 * - `catalog_search` / `barcode`: a catalog product; its type is read from
 *   `products.category_key` (P2-6) and `productType` is ignored.
 * - `barcode_unknown` / `dm_search` / `name_research`: no catalog product yet. With a
 *   `productType` the server opens the research submission from it; with `null`
 *   („Weiß ich nicht") the item is stored with no type, no usage and no submission.
 */
export const discoveryIntakeProductCaptureSchema = z.discriminatedUnion("source", [
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
      brandText: brandTextSchema.nullish(),
      productNameText: productNameTextSchema.nullish(),
    })
    .strict(),
  z
    .object({
      source: z.literal("dm_search"),
      barcodeIdentifier: barcodeSchema,
      brandText: brandTextSchema.nullish(),
      productNameText: productNameTextSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("name_research"),
      brandText: brandTextSchema,
      productNameText: productNameTextSchema,
    })
    .strict(),
])

export type DiscoveryIntakeProductCapture = z.infer<typeof discoveryIntakeProductCaptureSchema>

/** Shape only; the category/role PAIR is checked by `isValidDiscoveryUsage` (400 `invalid_usage`). */
export const discoveryIntakeUsageSchema = z
  .object({
    category: discoveryIntakeCategorySchema,
    role: z.enum(DISCOVERY_USAGE_ROLES).nullable(),
  })
  .strict()

/** What a product IS: the ten categories plus the non-evaluated `styling` marker (batch 7, D2). */
export const discoveryIntakeProductTypeSchema = z.enum(DISCOVERY_PRODUCT_TYPES)

/** „Wie oft nutzt du es?" (batch 7): the `ProductFrequency` values plus `unknown`. */
export const discoveryIntakeFrequencySchema = z.enum(DISCOVERY_ITEM_FREQUENCIES)

export const discoveryIntakeProductBodySchema = z
  .object({
    capture: discoveryIntakeProductCaptureSchema,
    productType: discoveryIntakeProductTypeSchema.nullish(),
    usage: discoveryIntakeUsageSchema.nullable(),
    /** Optional so the pre-batch-7 checklist keeps adding products (stored NULL = not asked). */
    frequency: discoveryIntakeFrequencySchema.optional(),
  })
  .strict()

/**
 * `PATCH …/items/<id>`: every key optional, at least one present. An absent key leaves its
 * column as it is — `{ frequency }` alone changes only the frequency; `usage: null` still
 * means „Weiß ich nicht" (batch 5).
 */
export const discoveryIntakeUsagePatchSchema = z
  .object({
    usage: discoveryIntakeUsageSchema.nullable().optional(),
    productType: discoveryIntakeProductTypeSchema.optional(),
    frequency: discoveryIntakeFrequencySchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.usage !== undefined || body.productType !== undefined || body.frequency !== undefined,
  )

/** The flat-checklist capture's identity columns (type, usage and submission are added by the route). */
export function discoveryIntakeProductIdentity(capture: DiscoveryIntakeProductCapture): {
  source: DiscoveryIntakeItemSource
  brand_text: string | null
  product_name_text: string | null
  barcode_identifier: string | null
  product_id: string | null
} {
  return {
    source: capture.source,
    brand_text: orNull("brandText" in capture ? capture.brandText : null),
    product_name_text: orNull("productNameText" in capture ? capture.productNameText : null),
    barcode_identifier: orNull("barcodeIdentifier" in capture ? capture.barcodeIdentifier : null),
    product_id: orNull("productId" in capture ? capture.productId : null),
  }
}

/**
 * An item whose product type nobody knows yet: no type, no catalog product, no research.
 * Only such an item may be given a type by the participant (PATCH), and it may not carry a
 * usage without one — a usage alone would make it look like a legacy row to research (F1).
 */
export function isDiscoveryIntakeItemTypeOpen(
  item: Pick<DiscoveryIntakeItem, "productType" | "productId" | "productSubmissionId">,
): boolean {
  return (
    (item.productType ?? null) === null &&
    item.productId === null &&
    item.productSubmissionId === null
  )
}

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

// --- Server-side validation of the ids the client supplies -------------------

/**
 * `product_id` and `product_submission_id` arrive from the browser. Zod proves they
 * are UUID-shaped and `buildDiscoveryIntakeItemRow` proves the COMBINATION is one the
 * table accepts — neither proves the ids point at anything, and the table's own FKs
 * are no help either: `product_id` references `products(id)` and
 * `product_submission_id` is unconstrained, so any live product id and any submission
 * id at all would be stored happily.
 *
 * Two things therefore have to be re-established here, per write:
 *
 * 1. The product exists and is the one the identify endpoint would have answered with
 *    — active and not disposition-quarantined (`filterScanEligibleProductIds`, the
 *    same call `POST /api/beratung/identify` makes).
 * 2. The submission exists AND belongs to this participant.
 *
 * On that second point, the ownership column is worth naming precisely. A scan
 * submission is anchorless: `submitScanProductIntake`
 * (`src/lib/product-intake/submissions.ts`) writes `user_product_usage_id: null` and
 * `user_product_id: null`, so there is no row tying it to anything the participant
 * owns and the usual anchor other intake surfaces follow is simply not there. But
 * `product_submissions.user_id` IS written, as the calling user — and the checklist's
 * own `POST /api/scan/submit` calls run as the participant — so that column is the
 * ownership check, and the read below is scoped on it.
 *
 * A submission belonging to someone else is refused as `unknown_submission`, not as a
 * separate "forbidden" code: to THIS intake it is simply not a submission that exists.
 * Scoping the query rather than comparing after the fact is what makes that true by
 * construction — a foreign row never comes back at all.
 *
 * What is deliberately NOT checked is that the catalog category matches the item's.
 * An intake item lives under the SHELF SLOT the participant opened, and the T3 design
 * accepted that this can diverge from what the catalog says the product is:
 *
 *  - catalog search is not category-scoped, so any hit can be filed anywhere;
 *  - `POST /api/beratung/identify` ignores category entirely and answers pure identity;
 *  - the research sheet's category grid records what the product ACTUALLY is, because
 *    that answer belongs to the submission a reviewer will catalogue from — while a
 *    legacy (tile-era) checklist row stayed under the tile the participant opened. Flat
 *    checklist rows keep product type and usage apart (`product_type` vs `category`).
 *
 * Divergence is therefore a legitimate capture, not a bad request, and it is already
 * carried downstream rather than dropped: `loadParticipantVerdicts` resolves such an
 * item to the typed `target_mismatch` state, which the cockpit renders as „Der Katalog
 * führt das Produkt in einer anderen Kategorie." Refusing it here would 422 an ordinary
 * capture and — on the research paths — orphan the `product_submissions` row that
 * `POST /api/scan/submit` had already created.
 */
export type DiscoveryIntakeIdentityRefusal = "unknown_product" | "unknown_submission"

export type DiscoveryIntakeIdentityCheck =
  | { ok: true }
  | { ok: false; reason: DiscoveryIntakeIdentityRefusal }

export type DiscoveryIntakeIdentityDependencies = {
  filterEligibleProductIds: (
    client: DiscoveryAdminClient,
    productIds: readonly string[],
  ) => Promise<Set<string>>
  /**
   * Existence AND ownership in one answer: the read is scoped to the account, so a
   * submission belonging to someone else is indistinguishable from a missing one.
   * The submission's own category is deliberately not returned — nothing may branch
   * on it here (see the contract above).
   */
  submissionBelongsToUser: (
    client: DiscoveryAdminClient,
    submissionId: string,
    userId: string,
  ) => Promise<boolean>
}

export async function discoverySubmissionBelongsToUser(
  client: DiscoveryAdminClient,
  submissionId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("product_submissions")
    .select("id")
    // The ownership predicate, in the query rather than after it: a submission that
    // belongs to another account never comes back, so it cannot be distinguished from
    // a missing one — which is exactly the answer this intake should get.
    .eq("id", submissionId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export const defaultDiscoveryIntakeIdentityDependencies: DiscoveryIntakeIdentityDependencies = {
  filterEligibleProductIds: (client, productIds) =>
    filterScanEligibleProductIds(client as unknown as SupabaseClient, productIds),
  submissionBelongsToUser: discoverySubmissionBelongsToUser,
}

export async function checkDiscoveryIntakeItemIdentity(
  input: {
    productId: string | null
    productSubmissionId: string | null
    /** The signed-in participant, from the guard — never from the request body. */
    userId: string
  },
  client: DiscoveryAdminClient,
  deps: DiscoveryIntakeIdentityDependencies = defaultDiscoveryIntakeIdentityDependencies,
): Promise<DiscoveryIntakeIdentityCheck> {
  if (input.productId) {
    const eligible = await deps.filterEligibleProductIds(client, [input.productId])
    if (!eligible.has(input.productId)) return { ok: false, reason: "unknown_product" }
  }

  if (input.productSubmissionId) {
    // Missing, or owned by someone else — the scoped read cannot tell them apart, and
    // to this intake they are the same answer.
    const owned = await deps.submissionBelongsToUser(
      client,
      input.productSubmissionId,
      input.userId,
    )
    if (!owned) return { ok: false, reason: "unknown_submission" }
  }

  return { ok: true }
}

// --- Projections -------------------------------------------------------------

/** A stored heat answer that no longer validates is not asked yet (`null`), never a failure. */
export const projectDiscoveryHeatStyling = readDiscoveryHeatStyling

function projectIntake(row: IntakeRow): DiscoveryIntake {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    userId: row.user_id,
    state: row.state === "submitted" ? "submitted" : "draft",
    submittedAt: row.submitted_at,
    heatStyling: projectDiscoveryHeatStyling(row.heat_styling),
  }
}

/**
 * The one projection every browser-bound intake item goes through — the checklist
 * page's initial list and the items route's 201 body alike.
 *
 * `productId` / `productSubmissionId` stay on the server: the checklist never renders
 * them, and the cockpit reads them straight from the table. One function so the two
 * surfaces cannot drift into disagreeing about that boundary. From the linked product
 * the browser gets presentation only: its packshot and its product line.
 */
export function toDiscoveryIntakeItemView(item: DiscoveryIntakeItem): DiscoveryIntakeItemView {
  return {
    id: item.id,
    category: item.category,
    source: item.source,
    brandText: item.brandText,
    productNameText: item.productNameText,
    barcodeIdentifier: item.barcodeIdentifier,
    imageUrl: item.catalog?.imageUrl ?? null,
    productLine: item.catalog?.productLine ?? null,
    // Only when set, so a legacy (tile) row projects exactly as before.
    ...(item.productType ? { productType: item.productType } : {}),
    ...(item.usageRole ? { usageRole: item.usageRole } : {}),
    ...(item.frequency ? { frequency: item.frequency } : {}),
  }
}

function nonEmpty(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

function projectCatalogPresentation(
  relation: ItemRow["catalog_product"],
): DiscoveryIntakeCatalogPresentation | null {
  const product = Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null)
  if (!product) return null
  const line = Array.isArray(product.product_line)
    ? (product.product_line[0] ?? null)
    : (product.product_line ?? null)
  return { imageUrl: nonEmpty(product.image_url), productLine: nonEmpty(line?.canonical_name) }
}

/** The row-to-domain projection, join included. Exported for tests. */
export function projectDiscoveryIntakeItemRow(row: ItemRow): DiscoveryIntakeItem {
  return {
    id: row.id,
    category: (row.category ?? null) as DiscoveryIntakeCategory | null,
    source: row.source as DiscoveryIntakeItemSource,
    brandText: row.brand_text,
    productNameText: row.product_name_text,
    barcodeIdentifier: row.barcode_identifier,
    productId: row.product_id,
    productSubmissionId: row.product_submission_id,
    // The styling marker (D2) is kept — it is what keeps the item out of „Kategorie offen".
    productType: isDiscoveryProductType(row.product_type) ? row.product_type : null,
    usageRole: (row.usage_role ?? null) as DiscoveryUsageRole | null,
    frequency: isDiscoveryItemFrequency(row.frequency) ? row.frequency : null,
    catalog: projectCatalogPresentation(row.catalog_product),
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
  return ((data as ItemRow[] | null) ?? []).map(projectDiscoveryIntakeItemRow)
}

/**
 * A category is either „benutze ich nicht" OR a non-empty product list — never
 * both. Rather than leaving that to the UI, every write clears the answer it
 * replaces: adding a product drops a standing `none` row, and answering `none`
 * drops the products.
 *
 * `exceptItemId` exists because the items route now inserts BEFORE it clears (so a
 * failed insert cannot leave the category empty): the replacement is already in the
 * table when this runs, and a `none` answer's clear would otherwise delete the very
 * row it was called to make exclusive.
 */
export async function clearDiscoveryIntakeCategory(
  input: {
    intakeId: string
    category: DiscoveryIntakeCategory
    sources?: DiscoveryIntakeItemSource[]
    exceptItemId?: string
  },
  client: DiscoveryAdminClient,
): Promise<void> {
  let query = client
    .from(ITEMS_TABLE)
    .delete()
    .eq("intake_id", input.intakeId)
    .eq("category", input.category)
  if (input.sources) query = query.in("source", input.sources)
  if (input.exceptItemId) query = query.neq("id", input.exceptItemId)
  const { error } = await query
  if (error) throw error
}

/**
 * The self-heal for the one state insert-before-clear can leave behind: a category
 * that carries a „benutze ich nicht" row AND products, because the clear after a
 * successful insert failed or the request died between the two.
 *
 * Products win. A `none` row asserts only an absence and is one tap to restore; a
 * product row is something the participant actually captured, and the T-1 routine is
 * built from it. Run immediately before the intake is frozen, so what Nick reads on
 * the call is never self-contradictory.
 */
export async function clearDiscoveryIntakeCoexistingNone(
  input: { intakeId: string; items: Pick<DiscoveryIntakeItem, "category" | "source">[] },
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntakeCategory[]> {
  const withProducts = new Set(
    input.items.filter((item) => item.source !== "none").map((item) => item.category),
  )
  const contradicted = [
    ...new Set(
      input.items
        .filter((item) => item.source === "none" && withProducts.has(item.category))
        .map((item) => item.category)
        // A `none` row always has a category (migration CHECK); the filter only narrows.
        .filter((category): category is DiscoveryIntakeCategory => category !== null),
    ),
  ]
  if (contradicted.length === 0) return []
  const { error } = await client
    .from(ITEMS_TABLE)
    .delete()
    .eq("intake_id", input.intakeId)
    .eq("source", "none")
    .in("category", contradicted)
  if (error) throw error
  return contradicted
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
  return projectDiscoveryIntakeItemRow(inserted)
}

/** Scoped to the caller's own intake: an item id from another intake reads nothing. */
export async function loadDiscoveryIntakeItem(
  input: { intakeId: string; itemId: string },
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntakeItem | null> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .select(ITEM_COLUMNS)
    .eq("intake_id", input.intakeId)
    .eq("id", input.itemId)
    .maybeSingle()
  if (error) throw error
  const row = (data as ItemRow | null) ?? null
  return row ? projectDiscoveryIntakeItemRow(row) : null
}

/** Only the columns present are written (batch 7: a frequency-only PATCH leaves the usage). */
export type DiscoveryIntakeItemUsageUpdate = {
  category?: DiscoveryIntakeCategory | null
  usage_role?: DiscoveryUsageRole | null
  /**
   * Only when the participant answered „Was ist das?" for a type-open item — or corrected a
   * spray answer (heat protectant ↔ leave-in ↔ styling, `expectedProductType`).
   */
  product_type?: DiscoveryProductType
  /** `null` only on a spray correction: the old research link goes with the old type. */
  product_id?: string | null
  product_submission_id?: string | null
  frequency?: DiscoveryItemFrequency
}

/**
 * Scoped to the caller's intake. When the update gives the item a type, the row must still
 * be type-open — re-stated as predicates, so a concurrent write that already typed it is
 * never overwritten. A spray correction instead compares-and-sets on the type she corrected
 * (`expectedProductType`). `null` = no row matched (gone, foreign, or typed meanwhile).
 */
export async function updateDiscoveryIntakeItemUsage(
  input: {
    intakeId: string
    itemId: string
    update: DiscoveryIntakeItemUsageUpdate
    expectedProductType?: DiscoveryProductType | null
  },
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntakeItem | null> {
  let query = client
    .from(ITEMS_TABLE)
    .update(input.update)
    .eq("intake_id", input.intakeId)
    .eq("id", input.itemId)
    .neq("source", "none")
  if (input.expectedProductType !== undefined) {
    query =
      input.expectedProductType === null
        ? query.is("product_type", null)
        : query.eq("product_type", input.expectedProductType)
  } else if (input.update.product_type) {
    query = query.is("product_type", null).is("product_id", null).is("product_submission_id", null)
  }
  const { data, error } = await query.select(ITEM_COLUMNS).maybeSingle()
  if (error) throw error
  const row = (data as ItemRow | null) ?? null
  return row ? projectDiscoveryIntakeItemRow(row) : null
}

/**
 * The product type the catalog files a product under (P2-6). A key outside the ten
 * supported categories is no type (`null`).
 */
export async function loadDiscoveryCatalogProductType(
  client: DiscoveryAdminClient,
  productId: string,
): Promise<DiscoveryIntakeCategory | null> {
  const { data, error } = await client
    .from("products")
    .select("category_key")
    .eq("id", productId)
    .maybeSingle()
  if (error) throw error
  const key = (data as { category_key: string | null } | null)?.category_key ?? null
  return isDiscoveryProductCategory(key) ? key : null
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

/**
 * `PUT /api/beratung/intake/heat-styling`'s write: a compare-and-set on the draft state, so a
 * write racing the submit either lands before the freeze or not at all. `null` = no draft row
 * matched (submitted meanwhile, or gone) — the route answers 409.
 */
export async function saveDiscoveryIntakeHeatStyling(
  input: { intakeId: string; heatStyling: DiscoveryHeatStylingV1 },
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntake | null> {
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .update({ heat_styling: input.heatStyling })
    .eq("id", input.intakeId)
    .eq("state", "draft")
    .select(INTAKE_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row = (data as IntakeRow | null) ?? null
  return row ? projectIntake(row) : null
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

export type DiscoveryIntakeConfirmedSubmit =
  | { outcome: "submitted"; submittedAt: string; confirmedNone: DiscoveryIntakeCategory[] }
  | { outcome: "not_draft" | "no_products" | "not_found" }

/**
 * „Stimmt so – abschicken" (R6): ONE call to `discovery_intake_submit_confirming_none`
 * (migration 20260924120000), which — under a lock on the intake row — inserts a `none` row
 * for every category without a product and marks the intake submitted. A product whose
 * usage is unknown counts as a product but answers no category.
 */
export async function submitDiscoveryIntakeConfirmingNone(
  intakeId: string,
  client: DiscoveryAdminClient,
): Promise<DiscoveryIntakeConfirmedSubmit> {
  const { data, error } = await client.rpc("discovery_intake_submit_confirming_none", {
    target_intake_id: intakeId,
  })
  if (error) throw error
  const result = (data ?? {}) as {
    outcome?: string
    submitted_at?: string
    confirmed_none?: string[]
  }
  switch (result.outcome) {
    case "submitted":
      if (!result.submitted_at) throw new Error("Discovery submit returned no timestamp")
      return {
        outcome: "submitted",
        submittedAt: result.submitted_at,
        confirmedNone: (result.confirmed_none ?? []).filter(isDiscoveryProductCategory),
      }
    case "not_draft":
    case "no_products":
    case "not_found":
      return { outcome: result.outcome }
    default:
      throw new Error(`Discovery submit returned an unknown outcome: ${String(result.outcome)}`)
  }
}

// --- Completeness ------------------------------------------------------------

/** Every one of the ten categories must carry an answer — a product or „none". */

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
