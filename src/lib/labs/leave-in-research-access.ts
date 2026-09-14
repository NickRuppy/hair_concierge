import "server-only"

import { readFileSync } from "node:fs"
import path, { join } from "node:path"
import { z } from "zod"

import {
  readLeaveInLabReviewState,
  saveLeaveInLabReviewState,
  updateLeaveInReworkQueue,
  withLeaveInReviewPersistenceRollback,
  type LeaveInLabProductReviewState,
  type LeaveInLabReviewDecision,
} from "@/lib/leave-in-research/review-state"

type Environment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV">>

const ARTIFACT_DIRECTORY = join(process.cwd(), "data/research/leave-in-inci/v1.0")
const FIXTURE_FILE = "lab-fixture.json"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)

const adjudicationSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    note: z.string().trim().min(1),
    source: z.string().trim().min(1),
  })
  .strict()

const echoSchema = z
  .object({
    field: z.string().trim().min(1),
    value: z.string(),
    label: z.string().trim().min(1),
  })
  .strict()

const propertySchema = z
  .object({
    path: z.string().trim().min(1),
    group: z.enum(["g0", "dimension", "hinweise", "care_direction", "profile"]),
    label: z.string().trim().min(1),
    value: z.string(),
    rawValue: z.unknown(),
    confidence: z.string().nullable(),
    evidenceLevel: z.string().nullable(),
    evidenceScope: z.string().nullable(),
    informational: z.boolean(),
    echo: echoSchema.nullable(),
    // One- or two-sentence compression of `rationale`, written into the fixture
    // by scripts/leave-in-research/build-lab-fixture.mjs. Never empty: a property
    // whose rationale is missing carries the explicit German gap string instead.
    reasoningShort: z.string().trim().min(1).max(260),
    rationale: z.string().nullable(),
    rationaleSource: z.string().trim().min(1),
    rationaleExtractionGap: z.boolean(),
    observations: z.array(z.string()),
    counterSignals: z.array(z.string()),
    derivedFrom: z.array(z.string()),
    reviewNote: z.string().nullable(),
    adjudication: adjudicationSchema.nullable(),
  })
  .strict()

const claimSchema = z
  .object({
    claimText: z.string(),
    claimType: z.string().nullable(),
    authorityTier: z.string().nullable(),
    tierBasis: z.string().nullable(),
    domain: z.string().nullable(),
    url: z.string().nullable(),
    date: z.string().nullable(),
    createsClaim: z.boolean().nullable(),
    note: z.string().nullable(),
  })
  .strict()

const productSchema = z
  .object({
    productId: z.string().trim().min(1),
    slot: z.number().int().positive(),
    // Batch 1: the 13 gold-set calibration products (calibration-packet.json
    // + reference-key-v4). Batch 2: the 6 unseen-product-test products
    // (unseen-test/lane-a + unseen-packet.json). See
    // scripts/leave-in-research/build-unseen-products.mjs.
    batch: z.enum(["gold-set", "unseen-test"]),
    brand: z.string().trim().min(1),
    productName: z.string().trim().min(1),
    archetypeRole: z.string().trim().min(1),
    identity: z
      .object({
        gtin: z.string().nullable(),
        gtinCandidates: z.unknown(),
        market: z.string(),
        packSize: z.string(),
        identityStatus: z.string(),
        rawInci: z.string(),
        normalizedIngredients: z.array(z.string()),
        directionsOfUse: z.string().nullable(),
        directionsStatus: z.string(),
        directionsSource: z.unknown(),
        // T12: application_stage is identity data, not a §7 dimension or a
        // profile row (ROLE is removed entirely). null on the two excluded
        // records (slots 7, 12), which emit no identity capture beyond G0.
        applicationStage: z
          .object({
            value: z.array(z.string()),
            evidenceLevel: z.string(),
            evidenceScope: z.string(),
            sourceTier: z.string(),
            basis: z.array(z.object({ stage: z.string(), quote: z.string() }).strict()),
            note: z.string().nullable(),
          })
          .strict()
          .nullable(),
        claims: z.array(claimSchema),
        claimsStatus: z.string(),
        knownConflicts: z.array(z.unknown()),
        remainingGap: z.string().nullable(),
        sourceUrls: z.array(z.unknown()),
        tailMarker: z.unknown(),
        fingerprints: z
          .object({ rawInciSha256: hashSchema, formulaFingerprintSha256: hashSchema })
          .strict(),
      })
      .strict(),
    g0: z
      .object({
        state: z.string().trim().min(1),
        outOfCategory: z.boolean(),
        rationale: z.string().trim().min(1),
        informationalOnly: z.boolean(),
        profileNote: z.string().nullable(),
      })
      .strict(),
    reviewRouting: z
      .object({
        reviewStatus: z.string(),
        routed: z.boolean(),
        triggers: z.array(z.string()),
        triggerBasis: z.array(z.object({ trigger: z.string(), basis: z.string() }).strict()),
      })
      .strict(),
    uncertainFields: z.array(z.string()),
    cautionsDe: z.array(z.string()),
    properties: z.array(propertySchema).min(1),
    propertyFingerprints: z.record(z.string(), hashSchema),
    productFingerprint: hashSchema,
  })
  .strict()

const fixtureSchema = z
  .object({
    schemaVersion: z.literal("leave-in-inci-lab-fixture-v2"),
    keyVersion: z.string().trim().min(1),
    derivedFromRun: z.string().trim().min(1),
    standardVersion: z.string().trim().min(1),
    modelVersion: z.string().trim().min(1),
    packetVersion: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
    stopCondition: z.string().trim().min(1),
    conventions: z.record(z.string(), z.unknown()),
    openAdjudications: z.array(adjudicationSchema),
    products: z.array(productSchema).min(1),
  })
  .strict()

export type LeaveInResearchFixture = z.infer<typeof fixtureSchema>
export type LeaveInResearchProperty = z.infer<typeof propertySchema> & {
  humanReviewStatus: LeaveInResearchPropertyReviewStatus
}
export type LeaveInResearchReviewStatus = "needs_review" | "rework_open" | "approved" | "excluded"
export type LeaveInResearchPropertyReviewStatus = "unreviewed" | "rework_open" | "approved"

export type LeaveInResearchQueueItem = {
  productId: string
  slot: number
  batch: "gold-set" | "unseen-test"
  productName: string
  brandName: string
  archetypeRole: string
  market: string
  packSize: string
  gtin: string | null
  g0State: string
  statusLabel: string
  summary: string
  uncertainFields: string[]
  cautionsDe: string[]
  excluded: boolean
  categoryBoundaryStatus: "eligible" | "excluded_product_form"
  reviewStatus: LeaveInResearchReviewStatus
  priorityGroup: "priority" | "standard" | "boundary"
  openProperties: number
  propertyCount: number
  openAdjudicationIds: string[]
  staleReview: boolean
  lastReviewDecision: LeaveInLabReviewDecision | null
}

export type LeaveInResearchProductDetail = LeaveInResearchQueueItem & {
  identity: z.infer<typeof productSchema>["identity"]
  g0: z.infer<typeof productSchema>["g0"]
  reviewRouting: z.infer<typeof productSchema>["reviewRouting"]
  properties: LeaveInResearchProperty[]
  propertyStatuses: Record<string, LeaveInResearchPropertyReviewStatus>
  propertyFingerprints: Record<string, string>
  productFingerprint: string
  formulaFingerprint: string
  standardVersion: string
  keyVersion: string
  canApproveProduct: boolean
  canApproveBoundary: boolean
  reviewBlockers: string[]
}

export type LeaveInResearchLabData = {
  meta: {
    keyVersion: string
    derivedFromRun: string
    standardVersion: string
    modelVersion: string
    packetVersion: string
    generatedAt: string
    stopCondition: string
  }
  summary: {
    products: number
    inCategory: number
    excluded: number
    rationaleGaps: number
    reviewCounts: {
      approved: number
      reworkOpen: number
      needsReview: number
      excluded: number
    }
  }
  openAdjudications: LeaveInResearchFixture["openAdjudications"]
  queueItems: LeaveInResearchQueueItem[]
  initialDetail: LeaveInResearchProductDetail
}

export type LeaveInResearchReviewInput =
  | { action: "approve_property"; itemId: string; propertyPath: string; comment?: string }
  | { action: "request_rework"; itemId: string; propertyPath: string; comment: string }
  | { action: "approve_product"; itemId: string; comment?: string }
  | { action: "approve_boundary"; itemId: string; comment?: string }

export type LeaveInResearchReviewResult =
  | {
      status: "accepted"
      item: LeaveInResearchProductDetail
      reviewDecision: LeaveInLabReviewDecision
    }
  | { status: "blocked"; item: LeaveInResearchProductDetail; blockers: string[] }
  | { status: "not_found"; error: string }
  | { status: "persistence_failed"; error: string }

function loadFixture(): LeaveInResearchFixture {
  const raw = JSON.parse(readFileSync(join(ARTIFACT_DIRECTORY, FIXTURE_FILE), "utf8")) as unknown
  const fixture = fixtureSchema.parse(raw)
  const ids = fixture.products.map((product) => product.productId)
  if (new Set(ids).size !== ids.length)
    throw new Error("Leave-In fixture contains duplicate product IDs")
  for (const product of fixture.products) {
    const paths = product.properties.map((property) => property.path)
    if (new Set(paths).size !== paths.length)
      throw new Error(`Leave-In fixture repeats a property path on ${product.productId}`)
    for (const propertyPath of paths) {
      if (!product.propertyFingerprints[propertyPath])
        throw new Error(
          `Leave-In fixture is missing a fingerprint for ${product.productId}.${propertyPath}`,
        )
    }
    if (Object.keys(product.propertyFingerprints).length !== paths.length)
      throw new Error(`Leave-In fixture fingerprints do not match ${product.productId} properties`)
    const adjudicationIds = new Set(fixture.openAdjudications.map((entry) => entry.id))
    for (const property of product.properties) {
      if (property.adjudication && !adjudicationIds.has(property.adjudication.id))
        throw new Error(
          `Leave-In fixture references an unknown adjudication on ${product.productId}.${property.path}`,
        )
    }
  }
  return fixture
}

let fixtureCache: LeaveInResearchFixture | undefined

function getFixture(): LeaveInResearchFixture {
  fixtureCache ??= loadFixture()
  return fixtureCache
}

export function isLeaveInResearchLabEnabled(environment: Environment = process.env): boolean {
  return environment.NODE_ENV === "development"
}

function reviewStatePath(): string | null {
  const override = process.env.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH?.trim()
  if (override) return path.resolve(override)
  if (process.env.NODE_ENV !== "development") return null
  return join(ARTIFACT_DIRECTORY, "lab-review-state.json")
}

function reworkQueuePath(): string | null {
  const override = process.env.LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH?.trim()
  if (override) return path.resolve(override)
  const reviewOverride = process.env.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH?.trim()
  if (reviewOverride) return join(path.dirname(path.resolve(reviewOverride)), "rework-queue.json")
  if (process.env.NODE_ENV !== "development") return null
  return join(ARTIFACT_DIRECTORY, "rework-queue.json")
}

function statusLabelFor(
  reviewStatus: LeaveInResearchReviewStatus,
  excluded: boolean,
  staleReview: boolean,
): string {
  if (reviewStatus === "approved") return "freigegeben"
  if (reviewStatus === "rework_open") return "in Nacharbeit"
  if (reviewStatus === "excluded") return "ausgeschlossen"
  if (staleReview) return "erneut prüfen"
  return excluded ? "ausgeschlossen" : "offen"
}

function buildDetail(
  product: LeaveInResearchFixture["products"][number],
  fixture: LeaveInResearchFixture,
  stored: LeaveInLabProductReviewState | undefined,
): LeaveInResearchProductDetail {
  const excluded = product.g0.outOfCategory
  const categoryBoundaryStatus = excluded ? "excluded_product_form" : "eligible"
  const formulaFingerprint = product.identity.fingerprints.formulaFingerprintSha256
  const staleReview = stored
    ? !(
        stored.formulaFingerprint === formulaFingerprint &&
        stored.productFingerprint === product.productFingerprint &&
        stored.standardVersion === fixture.standardVersion &&
        stored.boundary === categoryBoundaryStatus
      )
    : false

  const propertyStatuses = Object.fromEntries(
    product.properties.map((property) => {
      const storedFingerprint = stored?.propertyFingerprints[property.path]
      const matches = storedFingerprint === product.propertyFingerprints[property.path]
      return [
        property.path,
        matches
          ? ((stored?.propertyStatuses[property.path] ??
              "unreviewed") as LeaveInResearchPropertyReviewStatus)
          : ("unreviewed" as LeaveInResearchPropertyReviewStatus),
      ]
    }),
  ) as Record<string, LeaveInResearchPropertyReviewStatus>

  const properties: LeaveInResearchProperty[] = product.properties.map((property) => ({
    ...property,
    humanReviewStatus: propertyStatuses[property.path] ?? "unreviewed",
  }))

  const statusValues = Object.values(propertyStatuses)
  const hasOpenRework = statusValues.includes("rework_open")
  const allApproved = statusValues.every((status) => status === "approved")

  let reviewStatus: LeaveInResearchReviewStatus = "needs_review"
  if (stored && !staleReview && stored.reviewStatus === "excluded" && excluded)
    reviewStatus = "excluded"
  else if (stored && !staleReview && stored.reviewStatus === "approved" && allApproved)
    reviewStatus = "approved"
  else if (hasOpenRework) reviewStatus = "rework_open"

  const openProperties = statusValues.filter((status) => status !== "approved").length
  const reviewBlockers: string[] = []
  if (hasOpenRework)
    reviewBlockers.push(
      "Mindestens eine Eigenschaft ist in Nacharbeit. Erst lösen oder freigeben, dann das Produkt freigeben.",
    )

  const openAdjudicationIds = [
    ...new Set(
      properties
        .filter((property) => property.adjudication !== null)
        .map((property) => property.adjudication!.id),
    ),
  ]

  const queue: LeaveInResearchQueueItem = {
    productId: product.productId,
    slot: product.slot,
    batch: product.batch,
    productName: product.productName,
    brandName: product.brand,
    archetypeRole: product.archetypeRole,
    market: product.identity.market,
    packSize: product.identity.packSize,
    gtin: product.identity.gtin,
    g0State: product.g0.state,
    statusLabel: statusLabelFor(reviewStatus, excluded, staleReview),
    summary: product.g0.rationale,
    uncertainFields: product.uncertainFields,
    cautionsDe: product.cautionsDe,
    excluded,
    categoryBoundaryStatus,
    reviewStatus,
    priorityGroup: excluded
      ? "boundary"
      : openAdjudicationIds.length > 0 || product.uncertainFields.length > 0
        ? "priority"
        : "standard",
    openProperties,
    propertyCount: properties.length,
    openAdjudicationIds,
    staleReview,
    lastReviewDecision: stored?.decisions.at(-1) ?? null,
  }

  return {
    ...queue,
    identity: product.identity,
    g0: product.g0,
    reviewRouting: product.reviewRouting,
    properties,
    propertyStatuses,
    propertyFingerprints: product.propertyFingerprints,
    productFingerprint: product.productFingerprint,
    formulaFingerprint,
    standardVersion: fixture.standardVersion,
    keyVersion: fixture.keyVersion,
    canApproveProduct: !excluded && reviewStatus !== "approved" && !hasOpenRework,
    canApproveBoundary: excluded && reviewStatus !== "excluded",
    reviewBlockers,
  }
}

function reviewedDetails(): LeaveInResearchProductDetail[] {
  const fixture = getFixture()
  const statePath = reviewStatePath()
  const stored = statePath ? readLeaveInLabReviewState(statePath) : null
  return fixture.products.map((product) =>
    buildDetail(
      product,
      fixture,
      stored?.products.find((entry) => entry.productId === product.productId),
    ),
  )
}

function queueItemFromDetail(detail: LeaveInResearchProductDetail): LeaveInResearchQueueItem {
  return {
    productId: detail.productId,
    slot: detail.slot,
    batch: detail.batch,
    productName: detail.productName,
    brandName: detail.brandName,
    archetypeRole: detail.archetypeRole,
    market: detail.market,
    packSize: detail.packSize,
    gtin: detail.gtin,
    g0State: detail.g0State,
    statusLabel: detail.statusLabel,
    summary: detail.summary,
    uncertainFields: [...detail.uncertainFields],
    cautionsDe: [...detail.cautionsDe],
    excluded: detail.excluded,
    categoryBoundaryStatus: detail.categoryBoundaryStatus,
    reviewStatus: detail.reviewStatus,
    priorityGroup: detail.priorityGroup,
    openProperties: detail.openProperties,
    propertyCount: detail.propertyCount,
    openAdjudicationIds: [...detail.openAdjudicationIds],
    staleReview: detail.staleReview,
    lastReviewDecision: detail.lastReviewDecision,
  }
}

export function getLeaveInResearchLabData(): LeaveInResearchLabData {
  const fixture = getFixture()
  const details = reviewedDetails()
  const initialDetail = details[0]
  if (!initialDetail) throw new Error("Leave-In fixture contains no products")
  return {
    meta: {
      keyVersion: fixture.keyVersion,
      derivedFromRun: fixture.derivedFromRun,
      standardVersion: fixture.standardVersion,
      modelVersion: fixture.modelVersion,
      packetVersion: fixture.packetVersion,
      generatedAt: fixture.generatedAt,
      stopCondition: fixture.stopCondition,
    },
    summary: {
      products: details.length,
      inCategory: details.filter((detail) => !detail.excluded).length,
      excluded: details.filter((detail) => detail.excluded).length,
      rationaleGaps: details.reduce(
        (total, detail) =>
          total + detail.properties.filter((property) => property.rationaleExtractionGap).length,
        0,
      ),
      reviewCounts: {
        approved: details.filter((detail) => detail.reviewStatus === "approved").length,
        reworkOpen: details.filter((detail) => detail.reviewStatus === "rework_open").length,
        needsReview: details.filter((detail) => detail.reviewStatus === "needs_review").length,
        excluded: details.filter((detail) => detail.reviewStatus === "excluded").length,
      },
    },
    openAdjudications: fixture.openAdjudications,
    queueItems: details.map(queueItemFromDetail),
    initialDetail,
  }
}

export function getLeaveInResearchProductDetail(
  productId: string,
): LeaveInResearchProductDetail | null {
  return reviewedDetails().find((detail) => detail.productId === productId) ?? null
}

export const leaveInResearchReviewRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve_property"),
      itemId: z.string().trim().min(1),
      propertyPath: z.string().trim().min(1),
      comment: z.string().trim().min(1).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("request_rework"),
      itemId: z.string().trim().min(1),
      propertyPath: z.string().trim().min(1),
      comment: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve_product"),
      itemId: z.string().trim().min(1),
      comment: z.string().trim().min(1).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve_boundary"),
      itemId: z.string().trim().min(1),
      comment: z.string().trim().min(1).optional(),
    })
    .strict(),
])

function reviewSnapshot(
  item: LeaveInResearchProductDetail,
  reviewStatus: LeaveInResearchReviewStatus,
  propertyStatuses: Record<string, LeaveInResearchPropertyReviewStatus>,
) {
  return {
    productId: item.productId,
    formulaFingerprint: item.formulaFingerprint,
    productFingerprint: item.productFingerprint,
    standardVersion: item.standardVersion,
    boundary: item.categoryBoundaryStatus,
    reviewStatus,
    propertyStatuses,
    propertyFingerprints: item.propertyFingerprints,
  }
}

export function reviewLeaveInResearchItem(
  input: LeaveInResearchReviewInput,
): LeaveInResearchReviewResult {
  const item = getLeaveInResearchProductDetail(input.itemId)
  if (!item) return { status: "not_found", error: "Leave-In-Research-Eintrag nicht gefunden." }

  if (input.action === "approve_boundary" && !item.canApproveBoundary) {
    return {
      status: "blocked",
      item,
      blockers: item.excluded
        ? ["Dieser G0-Ausschluss ist bereits bestätigt."]
        : ["Nur ein G0-Produktform-Ausschluss kann bestätigt werden."],
    }
  }
  if (input.action === "approve_product" && !item.canApproveProduct) {
    return {
      status: "blocked",
      item,
      blockers: item.excluded
        ? ["Ein ausgeschlossenes Produkt wird über die G0-Bestätigung abgeschlossen."]
        : item.reviewBlockers.length > 0
          ? item.reviewBlockers
          : ["Dieses Produkt ist bereits freigegeben."],
    }
  }
  if (input.action === "approve_property" || input.action === "request_rework") {
    if (!item.properties.some((property) => property.path === input.propertyPath))
      return { status: "not_found", error: "Leave-In-Eigenschaft nicht gefunden." }
    if (
      input.action === "approve_property" &&
      item.propertyStatuses[input.propertyPath] === "approved"
    )
      return { status: "blocked", item, blockers: ["Diese Eigenschaft ist bereits freigegeben."] }
  }

  let reviewStatus: LeaveInResearchReviewStatus = item.reviewStatus
  let propertyStatuses = { ...item.propertyStatuses }
  if (input.action === "approve_product") {
    propertyStatuses = Object.fromEntries(
      item.properties.map((property) => [property.path, "approved" as const]),
    )
    reviewStatus = "approved"
  } else if (input.action === "approve_boundary") {
    propertyStatuses.g0 = "approved"
    reviewStatus = "excluded"
  } else if (input.action === "request_rework") {
    propertyStatuses[input.propertyPath] = "rework_open"
    reviewStatus = "rework_open"
  } else {
    propertyStatuses[input.propertyPath] = "approved"
    reviewStatus = Object.values(propertyStatuses).includes("rework_open")
      ? "rework_open"
      : "needs_review"
  }

  const statePath = reviewStatePath()
  if (!statePath)
    return {
      status: "persistence_failed",
      error: "Die Review-Entscheidung ist nur im lokalen Development-Lab speicherbar.",
    }

  try {
    const queuePath = reworkQueuePath()
    return withLeaveInReviewPersistenceRollback(
      [statePath, ...(queuePath ? [queuePath] : [])],
      () => {
        const decision = saveLeaveInLabReviewState({
          filePath: statePath,
          snapshot: reviewSnapshot(item, reviewStatus, propertyStatuses),
          decision: {
            action: input.action,
            propertyPath: "propertyPath" in input ? input.propertyPath : null,
            comment: input.comment?.trim() || null,
          },
        })
        if (queuePath && input.action === "request_rework") {
          updateLeaveInReworkQueue({
            filePath: queuePath,
            operation: "open",
            entry: {
              productId: item.productId,
              productName: `${item.brandName} ${item.productName}`,
              propertyPath: input.propertyPath,
              comment: input.comment,
              formulaFingerprint: item.formulaFingerprint,
              productFingerprint: item.productFingerprint,
              propertyFingerprint: item.propertyFingerprints[input.propertyPath]!,
              standardVersion: item.standardVersion,
            },
          })
        } else if (queuePath && input.action === "approve_property") {
          updateLeaveInReworkQueue({
            filePath: queuePath,
            operation: "resolve",
            productId: item.productId,
            propertyPath: input.propertyPath,
          })
        } else if (queuePath) {
          updateLeaveInReworkQueue({
            filePath: queuePath,
            operation: "resolve",
            productId: item.productId,
          })
        }
        const persisted = getLeaveInResearchProductDetail(item.productId)
        if (!persisted)
          throw new Error("Gespeicherter Review-Eintrag konnte nicht neu geladen werden.")
        return { status: "accepted", item: persisted, reviewDecision: decision }
      },
    )
  } catch (error) {
    return {
      status: "persistence_failed",
      error:
        error instanceof Error
          ? `Review konnte nicht dauerhaft gespeichert werden: ${error.message}`
          : "Review konnte nicht dauerhaft gespeichert werden.",
    }
  }
}
