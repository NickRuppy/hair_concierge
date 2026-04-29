import {
  buildRecommendationEngineRuntimeForChat,
  getLeaveInMissingProfileFields,
  getOilMissingProfileFields,
  getShampooMissingProfileFields,
  selectBondbuilderProductsWithEngine,
  selectConditionerProductsWithEngine,
  selectDeepCleansingShampooProductsWithEngine,
  selectDryShampooProductsWithEngine,
  selectLeaveInProductsWithEngine,
  selectMaskProductsWithEngine,
  selectOilProductsWithEngine,
  selectPeelingProductsWithEngine,
  selectShampooProductsWithEngine,
} from "@/lib/recommendation-engine"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import type { RecommendationEngineRuntime } from "@/lib/recommendation-engine/runtime"
import type { CategoryDecision } from "@/lib/recommendation-engine/types"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type { UserMemoryContext } from "@/lib/rag/user-memory"
import type { HairProfile, ShampooRecommendationMetadata } from "@/lib/types"
import type {
  ActiveProfileSignalField,
  AgentActiveProfileSignal,
  AgentConcern,
  AgentUserJob,
} from "@/lib/agent/orchestrator/route-packet"
import type { SelectableProductCategory } from "@/lib/agent/contracts"
import { SHAMPOO_BUCKET_LABELS } from "@/lib/shampoo/constants"
import { HAIR_THICKNESS_LABELS, SCALP_CONDITION_LABELS, SCALP_TYPE_LABELS } from "@/lib/vocabulary"

export type { SelectableProductCategory } from "@/lib/agent/contracts"
export type SelectProductsDecision =
  | "recommended"
  | "needs_more_info"
  | "not_recommended"
  | "no_catalog_match"

export type ProductResponsePolicy =
  | "recommend"
  | "explain_then_recommend"
  | "redirect_to_better_lever"
  | "caution_without_products"
  | "needs_more_info"
  | "no_catalog_match"

export interface SelectProductsRouteContext {
  userJob?: AgentUserJob | null
  concerns?: AgentConcern[] | null
  requestedGoal?: "shine" | null
  activeProfileSignals?: AgentActiveProfileSignal[] | null
}

export type ProductClaimEvidence = "product_spec" | "category_decision" | "profile_match"

export interface SupportedProductClaim {
  field:
    | ActiveProfileSignalField
    | "shampoo_bucket"
    | "scalp_route"
    | "cleansing_intensity"
    | "fit_status"
  value: string
  evidence: ProductClaimEvidence
  label: string
}

export interface UnsupportedRequestedSignal {
  field: ActiveProfileSignalField
  value: string
  reason: "no_structured_product_data" | "not_a_shampoo_fit_axis" | "safety_caution"
  user_message: string
}

export interface SelectedProductResult {
  rank: number
  product_id: string
  name: string
  brand: string | null
  fit_reason: string
  caveat: string | null
  supported_claims: SupportedProductClaim[]
  unsupported_requested_signals: UnsupportedRequestedSignal[]
}

export interface SelectedProductsMissingInfo {
  key:
    | "thickness"
    | "scalp_type"
    | "scalp_condition"
    | "hair_texture"
    | "density"
    | "care_signal"
    | "styling_signal"
    | "oil_purpose"
    | "protein_moisture_balance"
    | "recommendation_goal"
  label:
    | "Haardicke"
    | "Kopfhaut-Typ"
    | "Kopfhaut-Beschwerden"
    | "Haarmuster"
    | "Haardichte"
    | "Pflegebedarf"
    | "Styling-Kontext"
    | "Oel-Zweck"
    | "Protein-/Feuchtigkeitsbalance"
    | "Einsatzziel"
  blocking: boolean
  detail: string
}

export interface SelectedProductsProjection {
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  product_response_policy: ProductResponsePolicy
  policy_reason: string
  profile_basis: string[]
  category_guidance: string
  products: SelectedProductResult[]
  comparison_facts: Record<string, string[]> | null
  missing_info: SelectedProductsMissingInfo[]
  unsupported_requested_signals: UnsupportedRequestedSignal[]
}

export interface SelectProductsToolResult {
  projection: SelectedProductsProjection
  products: MatchedProduct[]
  effectiveHairProfile: HairProfile | null
  runtime: RecommendationEngineRuntime
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))]
}

function projectDisplayableProduct(
  product: MatchedProduct,
  rank: number,
  routeContext: SelectProductsRouteContext | null = null,
): SelectedProductResult {
  const meta = product.recommendation_meta
  const caveat = mapDisplayableCaveat(meta?.tradeoffs?.[0] ?? null)
  const supportedClaims = buildSupportedProductClaims(product)
  const unsupportedRequestedSignals =
    meta?.category === "shampoo"
      ? buildUnsupportedRequestedSignals(routeContext?.activeProfileSignals ?? [], supportedClaims)
      : []

  return {
    rank,
    product_id: product.id,
    name: product.name,
    brand: product.brand,
    fit_reason: buildDisplayableFitReason(product),
    caveat,
    supported_claims: supportedClaims,
    unsupported_requested_signals: unsupportedRequestedSignals,
  }
}

function mapDisplayableCaveat(caveat: string | null): string | null {
  if (!caveat) return null

  if (/^fallback:/i.test(caveat.trim())) {
    return caveat
  }

  const normalized = caveat.trim().toLocaleLowerCase("de-DE")
  if (
    normalized === "weicht vom aktuellen kopfhaut-fokus ab." ||
    normalized === "weicht vom aktuellen kopfhaut-fokus ab" ||
    (/weicht.*kopfhaut-fokus/.test(normalized) && !/fallback/.test(normalized))
  ) {
    return "Passt nicht exakt zum abgeleiteten Shampoo-Fokus. Nur als Fallback zeigen, wenn keine ausreichenden sicheren Treffer verfuegbar sind."
  }

  return caveat
}

function buildComparisonFacts(products: MatchedProduct[]): Record<string, string[]> | null {
  if (products.length < 2) {
    return null
  }

  return Object.fromEntries(
    products.map((product) => [product.id, buildProductComparisonFacts(product)]),
  )
}

function isFallbackCaveat(caveat: string | null | undefined): boolean {
  return /^fallback:/i.test(caveat?.trim() ?? "")
}

const SHAMPOO_SCALP_ROUTE_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["matched_scalp_route"]>,
  string
> = {
  oily: "fettig/dehydriert",
  balanced: "ausgeglichen",
  dry: "trocken",
  dandruff: "Schuppen",
  dry_flakes: "trockene Schueppchen",
  irritated: "irritiert",
}

const SHAMPOO_CLEANSING_INTENSITY_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["cleansing_intensity"]>,
  string
> = {
  gentle: "sanft",
  regular: "normal",
  clarifying: "klaerend",
}

const SHAMPOO_FIT_STATUS_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstuetzender Treffer",
  mismatch: "weicht ab",
  unknown: "Daten unvollstaendig",
  not_applicable: "nicht anwendbar",
}

const SHAMPOO_THICKNESS_FIT_PHRASES = {
  fine: "feines Haar",
  normal: "mitteldickes Haar",
  coarse: "kraeftiges Haar",
} as const

const SHAMPOO_SCALP_ROUTE_FIT_PHRASES: Record<
  NonNullable<ShampooRecommendationMetadata["matched_scalp_route"]>,
  string
> = {
  oily: "schnell fettenden Kopfhaut-Fokus",
  balanced: "ausgeglichenen Kopfhaut-Fokus",
  dry: "trockenen Kopfhaut-Fokus",
  dandruff: "Schuppen-Fokus",
  dry_flakes: "trockene-Schueppchen-Fokus",
  irritated: "irritierten Kopfhaut-Fokus",
}

const SHAMPOO_FIT_STATUS_PREFIXES: Record<
  NonNullable<ShampooRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstuetzender Treffer",
  mismatch: "Schwaecherer Treffer",
  unknown: "Treffer mit unvollstaendigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

function buildDisplayableFitReason(product: MatchedProduct): string {
  const meta = product.recommendation_meta

  if (meta?.category === "shampoo") {
    return buildShampooDisplayableFitReason(meta)
  }

  return meta?.top_reasons?.[0] ?? "Passt von den verfuegbaren Optionen am besten."
}

function buildShampooDisplayableFitReason(meta: ShampooRecommendationMetadata): string {
  const prefix = meta.fit_status
    ? (SHAMPOO_FIT_STATUS_PREFIXES[meta.fit_status] ?? "Treffer")
    : "Treffer"
  const thickness = meta.matched_profile.thickness
    ? (SHAMPOO_THICKNESS_FIT_PHRASES[meta.matched_profile.thickness] ??
      `${meta.matched_profile.thickness} Haar`)
    : null
  const scalp = meta.matched_scalp_route
    ? (SHAMPOO_SCALP_ROUTE_FIT_PHRASES[meta.matched_scalp_route] ?? null)
    : meta.matched_bucket
      ? `${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket} Kopfhaut-Fokus`
      : null
  const intensity = meta.cleansing_intensity
    ? (SHAMPOO_CLEANSING_INTENSITY_LABELS[meta.cleansing_intensity] ?? meta.cleansing_intensity)
    : null
  const fitParts = uniqueNonEmpty([thickness, scalp])
  const fitText = fitParts.length > 0 ? ` fuer ${fitParts.join(" und ")}` : ""
  const intensityText = intensity ? `; Reinigungsintensitaet: ${intensity}` : ""

  return `${prefix}${fitText}${intensityText}.`
}

function buildProductComparisonFacts(product: MatchedProduct): string[] {
  const meta = product.recommendation_meta

  if (meta?.category === "shampoo") {
    return buildShampooComparisonFacts(meta)
  }

  return uniqueNonEmpty(meta?.top_reasons ?? []).slice(0, 3)
}

function buildShampooComparisonFacts(meta: ShampooRecommendationMetadata): string[] {
  const fallback = meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"

  return uniqueNonEmpty([
    meta.matched_bucket
      ? `Kopfhaut-Fokus: ${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket}`
      : null,
    meta.matched_scalp_route
      ? `Kopfhaut-Route: ${
          SHAMPOO_SCALP_ROUTE_LABELS[meta.matched_scalp_route] ?? meta.matched_scalp_route
        }`
      : null,
    meta.cleansing_intensity
      ? `Reinigungsintensitaet: ${
          SHAMPOO_CLEANSING_INTENSITY_LABELS[meta.cleansing_intensity] ?? meta.cleansing_intensity
        }`
      : null,
    meta.fit_status
      ? `Fit: ${SHAMPOO_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
      : null,
    `Fallback: ${fallback ? "ja" : "nein"}`,
  ])
}

function buildClaim(
  field: SupportedProductClaim["field"],
  value: string | null | undefined,
  evidence: ProductClaimEvidence,
  label: string | null | undefined,
): SupportedProductClaim | null {
  if (!value) return null

  return {
    field,
    value,
    evidence,
    label: label ?? value,
  }
}

function buildSupportedProductClaims(product: MatchedProduct): SupportedProductClaim[] {
  const meta = product.recommendation_meta

  if (meta?.category !== "shampoo") {
    return []
  }

  return uniqueClaims([
    buildClaim(
      "thickness",
      meta.matched_profile.thickness,
      "product_spec",
      meta.matched_profile.thickness
        ? `Haardicke: ${
            HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ?? meta.matched_profile.thickness
          }`
        : null,
    ),
    buildClaim(
      "scalp_route",
      meta.matched_scalp_route,
      "product_spec",
      meta.matched_scalp_route
        ? `Kopfhaut-Route: ${
            SHAMPOO_SCALP_ROUTE_LABELS[meta.matched_scalp_route] ?? meta.matched_scalp_route
          }`
        : null,
    ),
    buildClaim(
      "shampoo_bucket",
      meta.matched_bucket,
      "product_spec",
      meta.matched_bucket
        ? `Kopfhaut-Fokus: ${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket}`
        : null,
    ),
    buildClaim(
      "cleansing_intensity",
      meta.cleansing_intensity,
      "product_spec",
      meta.cleansing_intensity
        ? `Reinigungsintensitaet: ${
            SHAMPOO_CLEANSING_INTENSITY_LABELS[meta.cleansing_intensity] ?? meta.cleansing_intensity
          }`
        : null,
    ),
    buildClaim(
      "fit_status",
      meta.fit_status,
      "category_decision",
      meta.fit_status
        ? `Fit: ${SHAMPOO_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
        : null,
    ),
  ])
}

function uniqueClaims(claims: Array<SupportedProductClaim | null>): SupportedProductClaim[] {
  const seen = new Set<string>()
  const result: SupportedProductClaim[] = []

  for (const claim of claims) {
    if (!claim) continue
    const key = `${claim.field}:${claim.value}:${claim.evidence}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(claim)
  }

  return result
}

function signalHasSupportedClaim(
  signal: AgentActiveProfileSignal,
  claims: readonly SupportedProductClaim[],
): boolean {
  if (signal.field === "thickness") {
    return claims.some((claim) => claim.field === "thickness" && claim.value === signal.value)
  }

  if (signal.field === "scalp_type") {
    return claims.some(
      (claim) =>
        claim.field === "scalp_route" &&
        ((signal.value === "balanced" && claim.value === "balanced") ||
          (signal.value === "oily" && claim.value === "oily") ||
          (signal.value === "dry" && claim.value === "dry")),
    )
  }

  if (signal.field === "scalp_condition" && signal.value === "irritated") {
    return claims.some(
      (claim) =>
        (claim.field === "scalp_route" && claim.value === "irritated") ||
        (claim.field === "shampoo_bucket" && claim.value === "irritationen"),
    )
  }

  if (signal.field === "scalp_condition" && signal.value === "dandruff") {
    return claims.some(
      (claim) =>
        (claim.field === "scalp_route" && claim.value === "dandruff") ||
        (claim.field === "shampoo_bucket" && claim.value === "schuppen"),
    )
  }

  return false
}

function userMessageForUnsupportedSignal(signal: AgentActiveProfileSignal): string {
  if (signal.field === "chemical_treatment" && signal.value === "colored") {
    return "Zum Farbschutz habe ich aktuell keine sichere Produktangabe. Fuer deine Kopfhaut und Haardicke passen diese Optionen trotzdem."
  }

  if (signal.field === "chemical_treatment" && signal.value === "bleached") {
    return "Zu blondiertem Haar habe ich bei diesen Shampoos aktuell keine sichere Spezialangabe. Fuer deine Kopfhaut und Haardicke passen diese Optionen trotzdem."
  }

  if (signal.field === "scalp_condition" && signal.value === "irritated") {
    return "Zur empfindlichen Kopfhaut habe ich bei diesen Produkten keine sichere Spezialangabe. Ich bewerte sie deshalb vor allem nach Kopfhaut-Fokus, Haardicke und Reinigungsintensitaet."
  }

  return "Zu einem Teil deiner Anfrage habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den belegten Fit-Daten."
}

function buildUnsupportedRequestedSignals(
  activeSignals: readonly AgentActiveProfileSignal[],
  supportedClaims: readonly SupportedProductClaim[],
): UnsupportedRequestedSignal[] {
  const unsupported: UnsupportedRequestedSignal[] = []

  for (const signal of activeSignals) {
    if (signal.selection_effect !== "qualifier") continue
    if (signalHasSupportedClaim(signal, supportedClaims)) continue

    unsupported.push({
      field: signal.field,
      value: signal.value,
      reason: "no_structured_product_data",
      user_message: userMessageForUnsupportedSignal(signal),
    })
  }

  return uniqueUnsupportedSignals(unsupported)
}

function uniqueUnsupportedSignals(
  signals: readonly UnsupportedRequestedSignal[],
): UnsupportedRequestedSignal[] {
  const seen = new Set<string>()
  const result: UnsupportedRequestedSignal[] = []

  for (const signal of signals) {
    const key = `${signal.field}:${signal.value}:${signal.reason}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(signal)
  }

  return result
}

function buildShampooMissingInfo(
  field: ReturnType<typeof getShampooMissingProfileFields>[number],
): SelectedProductsMissingInfo {
  switch (field) {
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Shampoo-Auswahl nicht sinnvoll eingegrenzt werden.",
      }
    case "scalp_type":
      return {
        key: field,
        label: "Kopfhaut-Typ",
        blocking: true,
        detail: "Es fehlt noch dein Kopfhaut-Typ fuer die Shampoo-Auswahl.",
      }
    case "scalp_condition":
      return {
        key: field,
        label: "Kopfhaut-Beschwerden",
        blocking: true,
        detail: "Es fehlen noch aktuelle Kopfhaut-Beschwerden fuer die Shampoo-Auswahl.",
      }
  }
}

function buildConditionerMissingInfo(
  field: "thickness" | "protein_moisture_balance",
): SelectedProductsMissingInfo {
  switch (field) {
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Conditioner-Auswahl nicht sinnvoll eingegrenzt werden.",
      }
    case "protein_moisture_balance":
      return {
        key: field,
        label: "Protein-/Feuchtigkeitsbalance",
        blocking: false,
        detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance fuer die Conditioner-Auswahl.",
      }
  }
}

function buildLeaveInMissingInfo(
  field: ReturnType<typeof getLeaveInMissingProfileFields>[number],
): SelectedProductsMissingInfo {
  switch (field) {
    case "hair_texture":
      return {
        key: field,
        label: "Haarmuster",
        blocking: false,
        detail: "Es fehlt noch dein Haarmuster fuer die Leave-in-Auswahl.",
      }
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Es fehlt noch deine Haardicke fuer die Leave-in-Auswahl.",
      }
    case "density":
      return {
        key: field,
        label: "Haardichte",
        blocking: false,
        detail: "Es fehlt noch deine Haardichte fuer die Leave-in-Auswahl.",
      }
    case "care_signal":
      return {
        key: field,
        label: "Pflegebedarf",
        blocking: false,
        detail: "Es fehlt noch dein Pflegebedarf fuer die Leave-in-Auswahl.",
      }
    case "styling_signal":
      return {
        key: field,
        label: "Styling-Kontext",
        blocking: false,
        detail: "Es fehlt noch dein Styling-Kontext fuer die Leave-in-Auswahl.",
      }
  }
}

function buildOilMissingInfo(
  field: ReturnType<typeof getOilMissingProfileFields>[number],
): SelectedProductsMissingInfo {
  switch (field) {
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Es fehlt noch deine Haardicke fuer die Oel-Auswahl.",
      }
    case "oil_purpose":
      return {
        key: field,
        label: "Oel-Zweck",
        blocking: false,
        detail: "Es fehlt noch dein Oel-Zweck fuer die Oel-Auswahl.",
      }
  }
}

function deriveGenericMissingInfo(hairProfile: HairProfile | null): SelectedProductsMissingInfo[] {
  if (!hairProfile?.thickness) {
    return [
      {
        key: "thickness",
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Auswahl nicht sinnvoll eingegrenzt werden.",
      },
    ]
  }

  return []
}

function deriveConditionerMissingProfileFields(
  hairProfile: HairProfile | null,
): Array<"thickness" | "protein_moisture_balance"> {
  const missing: Array<"thickness" | "protein_moisture_balance"> = []

  if (!hairProfile?.thickness) {
    missing.push("thickness")
  }

  if (!hairProfile?.protein_moisture_balance) {
    missing.push("protein_moisture_balance")
  }

  return missing
}

function deriveMissingInfoForEmptySelection(params: {
  category: SelectableProductCategory | null
  explicitCategoryProvided: boolean
  hairProfile: HairProfile | null
  runtime: RecommendationEngineRuntime | null
}): SelectedProductsMissingInfo[] {
  const { category, explicitCategoryProvided, hairProfile, runtime } = params

  switch (category) {
    case "shampoo":
      return getShampooMissingProfileFields(hairProfile).map(buildShampooMissingInfo)
    case "conditioner":
      return deriveConditionerMissingProfileFields(hairProfile).map(buildConditionerMissingInfo)
    case "leave_in":
      if (!runtime) {
        return deriveGenericMissingInfo(hairProfile)
      }

      return getLeaveInMissingProfileFields({ runtime, hairProfile }).map(buildLeaveInMissingInfo)
    case "oil":
      if (!runtime) {
        return deriveGenericMissingInfo(hairProfile)
      }

      return getOilMissingProfileFields({ runtime, hairProfile }).map(buildOilMissingInfo)
    default:
      return explicitCategoryProvided ? [] : deriveGenericMissingInfo(hairProfile)
  }
}

function getCategoryDecision(
  runtime: RecommendationEngineRuntime | null,
  category: SelectableProductCategory | null,
): CategoryDecision | null {
  if (!runtime || !category) return null

  switch (category) {
    case "shampoo":
      return runtime.categories.shampoo
    case "conditioner":
      return runtime.categories.conditioner
    case "leave_in":
      return runtime.categories.leaveIn
    case "mask":
      return runtime.categories.mask
    case "oil":
      return runtime.categories.oil
    case "bondbuilder":
      return runtime.categories.bondbuilder
    case "deep_cleansing_shampoo":
      return runtime.categories.deepCleansingShampoo
    case "dry_shampoo":
      return runtime.categories.dryShampoo
    case "peeling":
      return runtime.categories.peeling
  }
}

function buildProfileBasis(
  hairProfile: HairProfile | null,
  category: SelectableProductCategory | null,
): string[] {
  if (!hairProfile) return []

  if (category === "shampoo") {
    return uniqueNonEmpty([
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.scalp_type
        ? `Kopfhaut: ${SCALP_TYPE_LABELS[hairProfile.scalp_type] ?? hairProfile.scalp_type}`
        : null,
      hairProfile.scalp_condition
        ? `Kopfhaut-Beschwerden: ${
            SCALP_CONDITION_LABELS[hairProfile.scalp_condition] ?? hairProfile.scalp_condition
          }`
        : null,
    ])
  }

  return uniqueNonEmpty([
    hairProfile.thickness
      ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
      : null,
  ])
}

function deriveDecision(params: {
  products: MatchedProduct[]
  category: SelectableProductCategory | null
  categoryDecision: CategoryDecision | null
  missingInfo: SelectedProductsMissingInfo[]
  routeContext?: SelectProductsRouteContext | null
}): SelectProductsDecision {
  const { products, category, categoryDecision, missingInfo, routeContext } = params

  if (category === "shampoo" && categoryDecision && !categoryDecision.relevant) {
    return "not_recommended"
  }

  if (isDryLengthOnlyShampooQuestion(category, routeContext)) {
    return "not_recommended"
  }

  if (
    isScalpSymptomShampooQuestion(category, routeContext) ||
    isShineShampooQuestion(category, routeContext) ||
    isFrizzShampooQuestion(category, routeContext)
  ) {
    return "not_recommended"
  }

  if (products.length === 0 && missingInfo.some((item) => item.blocking)) {
    return "needs_more_info"
  }

  if (products.length === 0) {
    return "no_catalog_match"
  }

  return "recommended"
}

function hasConcern(
  routeContext: SelectProductsRouteContext | null | undefined,
  concern: AgentConcern,
): boolean {
  return routeContext?.concerns?.includes(concern) ?? false
}

function isDryLengthOnlyShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  if (category !== "shampoo" || !hasConcern(routeContext, "dry_lengths")) {
    return false
  }

  return !(
    hasConcern(routeContext, "oily_roots") ||
    hasConcern(routeContext, "dandruff_or_flakes") ||
    hasConcern(routeContext, "irritation")
  )
}

function isShineShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  return category === "shampoo" && routeContext?.requestedGoal === "shine"
}

function isFrizzShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  if (category !== "shampoo" || !hasConcern(routeContext, "frizz")) {
    return false
  }

  return !(
    hasConcern(routeContext, "oily_roots") ||
    hasConcern(routeContext, "dandruff_or_flakes") ||
    hasConcern(routeContext, "irritation")
  )
}

function isScalpSymptomShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  return (
    category === "shampoo" &&
    (hasConcern(routeContext, "dandruff_or_flakes") || hasConcern(routeContext, "irritation"))
  )
}

function buildProductResponsePolicy(params: {
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  routeContext?: SelectProductsRouteContext | null
}): { product_response_policy: ProductResponsePolicy; policy_reason: string } {
  const { category, decision, routeContext } = params

  if (decision === "needs_more_info") {
    return {
      product_response_policy: "needs_more_info",
      policy_reason: "Fuer diese Produktauswahl fehlt noch eine entscheidende Profilinformation.",
    }
  }

  if (decision === "no_catalog_match") {
    return {
      product_response_policy: "no_catalog_match",
      policy_reason:
        "Die Kategorie kann passen, aber der aktuelle Katalog liefert keinen sicheren Treffer.",
    }
  }

  if (category === "shampoo" && isScalpSymptomShampooQuestion(category, routeContext)) {
    return {
      product_response_policy: "caution_without_products",
      policy_reason:
        "Juckreiz, Reizung oder wiederkehrende Schuppen brauchen eine vorsichtige Einordnung; danach koennen passende Anti-Schuppen- oder empfindliche-Kopfhaut-Optionen ausgewaehlt werden.",
    }
  }

  if (
    category === "shampoo" &&
    (isDryLengthOnlyShampooQuestion(category, routeContext) ||
      isShineShampooQuestion(category, routeContext) ||
      isFrizzShampooQuestion(category, routeContext))
  ) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Anfrage betrifft vor allem Laengen, Haaroberflaeche oder Stylingtechnik; Shampoo ist nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist.",
    }
  }

  if (category === "shampoo" && hasConcern(routeContext, "oily_roots")) {
    return {
      product_response_policy: "explain_then_recommend",
      policy_reason:
        "Ein schnell fettender Ansatz ist kopfhautnah; Shampoo kann helfen, aber Auftrag, Menge und optionaler zweiter Waschgang gehoeren zur Antwort.",
    }
  }

  if (decision === "not_recommended") {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason: "Diese Kategorie ist fuer die aktuelle Anfrage nicht der wichtigste Hebel.",
    }
  }

  return {
    product_response_policy: "recommend",
    policy_reason:
      category === "shampoo"
        ? "Shampoo wird primaer ueber Kopfhaut-Fokus und Haardicke entschieden."
        : "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten.",
  }
}

function buildCategoryGuidance(params: {
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  categoryDecision: CategoryDecision | null
  routeContext?: SelectProductsRouteContext | null
}): string {
  const { category, decision, categoryDecision, routeContext } = params

  if (category === "shampoo") {
    if (isScalpSymptomShampooQuestion(category, routeContext)) {
      return "Juckreiz, Reizung oder wiederkehrende Schuppen sind nicht nur ein normales kosmetisches Shampoo-Thema. Wenn es stark ist oder anhaelt, sollte es professionell oder dermatologisch abgeklaert werden. Stelle Shampoo nicht als medizinische Loesung dar; frage knapp, ob der Fokus eher Schuppen-Reduktion oder gereizte/empfindliche Kopfhaut ist, und sage, dass danach passende Shampoo-Optionen ausgewaehlt werden koennen."
    }

    if (isDryLengthOnlyShampooQuestion(category, routeContext)) {
      return "Trockene Laengen sind meist kein Shampoo-first Problem. Shampoo sollte vor allem die Kopfhaut reinigen; die Laengen brauchen eher Schutz, Conditioner oder Leave-in."
    }

    if (isShineShampooQuestion(category, routeContext)) {
      return "Mehr Glanz entsteht meist ueber Pflege, Oberflaeche und Stylingtechnik. Shampoo ist dafuer nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }

    if (isFrizzShampooQuestion(category, routeContext)) {
      return "Frizz ist meist ein Laengen-, Pflege- oder Stylingthema. Shampoo ist dafuer nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }

    if (decision === "not_recommended") {
      return "Shampoo ist fuer diese Anfrage gerade nicht der wichtigste Hebel."
    }

    if (decision === "needs_more_info") {
      return "Fuer eine Shampoo-Auswahl brauchen wir mindestens Haardicke und einen Kopfhaut-Fokus."
    }

    if (decision === "no_catalog_match") {
      return "Shampoo passt als Kategorie, aber der aktuelle Katalog liefert keinen sicheren Treffer fuer diesen Kopfhaut-Fokus."
    }

    const shampooDecision = categoryDecision?.category === "shampoo" ? categoryDecision : null
    const bucket = shampooDecision?.targetProfile?.shampooBucket
    const label = bucket ? SHAMPOO_BUCKET_LABELS[bucket] : null

    if (hasConcern(routeContext, "oily_roots")) {
      return label
        ? `Ein fettender Ansatz ist ein Shampoo-Thema: Die Auswahl folgt dem Kopfhaut-Fokus ${label} und deiner Haardicke.`
        : "Ein fettender Ansatz ist ein Shampoo-Thema; die Auswahl folgt Kopfhaut-Fokus und Haardicke."
    }

    return label
      ? `Shampoo ist hier der richtige Hebel: Die Auswahl folgt dem Kopfhaut-Fokus ${label} und deiner Haardicke.`
      : "Shampoo ist hier der richtige Hebel, gesteuert ueber Kopfhaut-Fokus und Haardicke."
  }

  if (decision === "not_recommended") {
    return "Diese Kategorie ist fuer die aktuelle Anfrage wahrscheinlich nicht der beste Hebel."
  }

  if (decision === "needs_more_info") {
    return "Fuer diese Produktauswahl fehlt noch eine wirklich entscheidende Information."
  }

  if (decision === "no_catalog_match") {
    return "Die Kategorie kann passen, aber der aktuelle Katalog liefert keinen sicheren Treffer."
  }

  return "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten."
}

export function projectSelectedProducts(
  products: MatchedProduct[],
  hairProfile: HairProfile | null = null,
  category: SelectableProductCategory | null = null,
  runtime: RecommendationEngineRuntime | null = null,
  routeContext: SelectProductsRouteContext | null = null,
): SelectedProductsProjection {
  const topProduct = products[0] ?? null
  const resolvedCategory: SelectableProductCategory | null =
    category ?? topProduct?.recommendation_meta?.category ?? null
  const categoryDecision = getCategoryDecision(runtime, resolvedCategory)
  const missing_info = (
    products.length === 0
      ? deriveMissingInfoForEmptySelection({
          category: resolvedCategory,
          explicitCategoryProvided: category !== null,
          hairProfile,
          runtime,
        })
      : []
  ).filter((item) => item.blocking)
  const decision = deriveDecision({
    products,
    category: resolvedCategory,
    categoryDecision,
    missingInfo: missing_info,
    routeContext,
  })
  const productPolicy = buildProductResponsePolicy({
    category: resolvedCategory,
    decision,
    routeContext,
  })
  const displayableProducts = decision === "recommended" ? products.slice(0, 3) : []
  const projectedProducts = displayableProducts.map((product, index) =>
    projectDisplayableProduct(product, index + 1, routeContext),
  )

  return {
    category: resolvedCategory,
    decision,
    product_response_policy: productPolicy.product_response_policy,
    policy_reason: productPolicy.policy_reason,
    profile_basis: buildProfileBasis(hairProfile, resolvedCategory),
    category_guidance: buildCategoryGuidance({
      category: resolvedCategory,
      decision,
      categoryDecision,
      routeContext,
    }),
    products: projectedProducts,
    comparison_facts: buildComparisonFacts(displayableProducts),
    missing_info,
    unsupported_requested_signals: uniqueUnsupportedSignals(
      projectedProducts.flatMap((product) => product.unsupported_requested_signals),
    ),
  }
}

function unsupportedCategory(category: string): never {
  throw new Error(`Unsupported product category: ${category}`)
}

async function runCategoryEngine(params: {
  category: SelectableProductCategory
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
}): Promise<MatchedProduct[]> {
  const { category, message, hairProfile, routineItems } = params

  switch (category) {
    case "shampoo":
      return selectShampooProductsWithEngine({ message, hairProfile, routineItems })
    case "conditioner":
      return selectConditionerProductsWithEngine({ message, hairProfile, routineItems })
    case "leave_in":
      return selectLeaveInProductsWithEngine({ message, hairProfile, routineItems })
    case "mask":
      return selectMaskProductsWithEngine({ message, hairProfile, routineItems })
    case "oil":
      return selectOilProductsWithEngine({ message, hairProfile, routineItems })
    case "bondbuilder":
      return selectBondbuilderProductsWithEngine({ message, hairProfile, routineItems })
    case "deep_cleansing_shampoo":
      return selectDeepCleansingShampooProductsWithEngine({ message, hairProfile, routineItems })
    case "dry_shampoo":
      return selectDryShampooProductsWithEngine({ message, hairProfile, routineItems })
    case "peeling":
      return selectPeelingProductsWithEngine({ message, hairProfile, routineItems })
    default:
      unsupportedCategory(String(category))
  }
}

function applyShampooActiveOverrides(
  hairProfile: HairProfile | null,
  activeSignals: readonly AgentActiveProfileSignal[],
): HairProfile | null {
  if (!hairProfile) return null

  const next: HairProfile = { ...hairProfile }

  for (const signal of activeSignals) {
    if (signal.selection_effect !== "override" && signal.selection_effect !== "caution") {
      continue
    }

    if (
      signal.field === "thickness" &&
      (signal.value === "fine" || signal.value === "normal" || signal.value === "coarse")
    ) {
      next.thickness = signal.value
    }

    if (
      signal.field === "scalp_type" &&
      (signal.value === "oily" || signal.value === "balanced" || signal.value === "dry")
    ) {
      next.scalp_type = signal.value
      if (signal.selection_effect === "override") {
        next.scalp_condition = null
      }
    }

    if (
      signal.field === "scalp_condition" &&
      (signal.value === "dandruff" || signal.value === "dry_flakes" || signal.value === "irritated")
    ) {
      next.scalp_condition = signal.value
    }
  }

  return next
}

function applyActiveProfileOverrides(params: {
  category: SelectableProductCategory
  hairProfile: HairProfile | null
  activeSignals: readonly AgentActiveProfileSignal[]
}): HairProfile | null {
  if (params.category === "shampoo") {
    return applyShampooActiveOverrides(params.hairProfile, params.activeSignals)
  }

  return params.hairProfile
}

export function createSelectProductsTool(
  options: {
    onResult?: (result: SelectProductsToolResult) => void
  } = {},
) {
  return async function selectProductsTool(params: {
    category: SelectableProductCategory
    message: string
    hairProfile: HairProfile | null
    memoryContext: UserMemoryContext
    routineItems: PersistenceRoutineItemRow[]
    userJob?: AgentUserJob | null
    concerns?: AgentConcern[] | null
    requestedGoal?: "shine" | null
    activeProfileSignals?: AgentActiveProfileSignal[] | null
  }): Promise<SelectedProductsProjection> {
    const {
      category,
      message,
      hairProfile,
      memoryContext,
      routineItems,
      userJob,
      concerns,
      requestedGoal,
      activeProfileSignals,
    } = params
    const effectiveHairProfile = applyActiveProfileOverrides({
      category,
      hairProfile,
      activeSignals: activeProfileSignals ?? [],
    })
    const runtime = buildRecommendationEngineRuntimeForChat({
      hairProfile: effectiveHairProfile,
      routineItems,
      productCategory: category,
      message,
    })
    const products = await runCategoryEngine({
      category,
      message,
      hairProfile: effectiveHairProfile,
      routineItems,
    })
    const constrainedProducts = applyProductMemoryConstraints(products, memoryContext)
    const projection = projectSelectedProducts(
      constrainedProducts,
      effectiveHairProfile,
      category,
      runtime,
      {
        userJob,
        concerns,
        requestedGoal,
        activeProfileSignals,
      },
    )

    options.onResult?.({
      projection,
      products: constrainedProducts,
      effectiveHairProfile,
      runtime,
    })

    return projection
  }
}
