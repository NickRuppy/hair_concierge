import "server-only"

import type { RoutinePayloadV1 } from "./contracts"
import { effectiveRoutineCadenceCopyDe } from "./cadence"
import { adaptCatalogApplicationFacts } from "@/lib/routines/personal-plan/application/catalog-facts"
import type {
  ApplicationGuidanceProtocolV1,
  NormalizedProfile,
  NormalizedRoutineItem,
  NormalizedUnresolvedRoutineItem,
} from "@/lib/routines/personal-plan/application/contracts"
import {
  adaptReviewedProductApplicationPointersV2,
  adaptReviewedProductApplicationProtocols,
  type ReviewedProductApplicationProtocolRow,
} from "@/lib/routines/personal-plan/application/product-protocol-adapter"
import type { ProductApplicationPointerV2 } from "@/lib/routines/personal-plan/application/contracts-v2"
import type { PersonalPlanStage5ContractVersion } from "@/lib/personal-plan/stage5-access"

const semanticRoleByRoutineRole = {
  shampoo_everyday: "cleanse",
  shampoo_dandruff: "cleanse",
  conditioner_rinse_out: "condition",
  post_wash_leave_in: "leave_in",
  pre_heat_application: "heat_protection",
  intensive_conditioning_mask: "intensive_care",
  pre_wash_fibre_treatment: "bond_repair",
  leave_on_fibre_conditioning: "leave_in",
  dry_finish: "finish",
  residue_reset: "reset_cleanse",
  mineral_reset: "reset_cleanse",
  root_refresh_bridge: "refresh",
  pre_heat_protection: "heat_protection",
  specialized_bond_treatment: "bond_repair",
  scalp_comfort: "scalp_care",
  scalp_flake_oil_adjunct: "scalp_care",
  density_claim_tonic: "scalp_care",
  scalp_exfoliant: "scalp_care",
} as const

type ProductRow = {
  id: string
  image_url: string | null
  category: string | null
  category_key: string | null
  is_active: boolean
  lifecycle_status: string
  product_leave_in_specs?: unknown[] | object
  product_bondbuilder_specs?: unknown[] | object
  product_mask_specs?: unknown[] | object
  product_oil_specs?: unknown[] | object
  product_heat_protectant_specs?: unknown[] | object
  product_scalp_care_specs?: unknown[] | object
  product_dry_shampoo_specs?: unknown[] | object
}
type Query = {
  select(columns: string): Query
  eq(column: string, value: string | boolean): Query
  in(column: string, values: string[]): Promise<{ data: unknown[] | null; error: unknown }>
  maybeSingle(): Promise<{ data: unknown; error: unknown }>
}
export type ApplicationRoutineReadClient = { from(table: string): Query }
const PRODUCT_SELECT =
  "id,image_url,category,category_key,is_active,lifecycle_status,product_leave_in_specs(format,roles,provides_heat_protection,heat_protection_max_c,heat_activation_required,application_stage),product_bondbuilder_specs(application_mode,treatment_mode,product_format,usage_protocol),product_mask_specs(weight,concentration,balance_direction),product_oil_specs(provides_heat_protection),product_heat_protectant_specs(provides_heat_protection),product_scalp_care_specs(primary_role,presentation_format,rinse_mode),product_dry_shampoo_specs(format)"
const PRODUCT_PROTOCOL_SELECT =
  "product_id,category,role,guidance_payload,application_state,reapplication,source_url,source_text,updated_at"
const PRODUCT_PROTOCOL_V2_SELECT =
  "product_id,category,role,guidance_payload_v2,application_state,reapplication,source_url,updated_at"
const first = <T>(value: unknown): T | null =>
  Array.isArray(value)
    ? value.length === 1
      ? (value[0] as T)
      : null
    : value && typeof value === "object"
      ? (value as T)
      : null
const provenance = (facts: Record<string, unknown>) =>
  Object.fromEntries(Object.keys(facts).map((key) => [key, "catalog_spec" as const]))

function factsFor(category: string, row: ProductRow) {
  if (category === "leave_in") {
    const spec = first<{
      format: "spray" | "milk" | "lotion" | "cream" | "serum"
      roles: string[]
      provides_heat_protection: boolean
      heat_protection_max_c: number | null
      heat_activation_required: boolean
      application_stage: string[]
    }>(row.product_leave_in_specs)
    return spec
      ? adaptCatalogApplicationFacts({ category: "leave_in", spec })
      : { facts: {}, provenance: {} }
  }
  if (category === "bondbuilder") {
    const spec = first<{
      application_mode: "pre_shampoo" | "post_wash_leave_in"
      treatment_mode: "rinse_out" | "leave_in"
      product_format: "cream_treatment" | "primer_treatment" | "leave_in_mask" | "spray_treatment"
      usage_protocol:
        | "olaplex_3plus"
        | "olaplex_0_booster"
        | "olaplex_3_legacy"
        | "k18_leave_in"
        | "epres_spray"
    }>(row.product_bondbuilder_specs)
    return spec
      ? adaptCatalogApplicationFacts({ category: "bondbuilder", spec })
      : { facts: {}, provenance: {} }
  }
  if (category === "dry_shampoo") {
    const spec = first<{ format: "aerosol_spray" | "powder" | "foam_or_liquid" }>(
      row.product_dry_shampoo_specs,
    )
    return spec
      ? adaptCatalogApplicationFacts({ category: "dry_shampoo", spec })
      : { facts: {}, provenance: {} }
  }
  const spec =
    category === "mask"
      ? first<Record<string, unknown>>(row.product_mask_specs)
      : category === "oil"
        ? first<Record<string, unknown>>(row.product_oil_specs)
        : category === "heat_protectant"
          ? first<Record<string, unknown>>(row.product_heat_protectant_specs)
          : category === "scalp_care"
            ? first<Record<string, unknown>>(row.product_scalp_care_specs)
            : null
  return spec ? { facts: spec, provenance: provenance(spec) } : { facts: {}, provenance: {} }
}

/** Owner-scoped active Routine in, verified catalog identities and exact Heat guidance out. */
export async function adaptAcceptedActiveRoutineForApplication(input: {
  client: ApplicationRoutineReadClient
  activeVersion: { id: string; payload: RoutinePayloadV1 }
  contractVersion?: PersonalPlanStage5ContractVersion
}): Promise<{
  routineVersionId: string
  planId: string
  routineItems: NormalizedRoutineItem[]
  unresolvedRoutineItems: NormalizedUnresolvedRoutineItem[]
  exactGuidanceProtocols: ApplicationGuidanceProtocolV1[]
  applicationPointersV2?: ProductApplicationPointerV2[]
}> {
  const contractVersion = input.contractVersion ?? 1
  const includedItems = input.activeVersion.payload.items
    .map((item, routineOrder) => ({ item, routineOrder }))
    .filter(({ item }) => item.state.inclusion === "included")
  const candidates = includedItems.filter(
    ({ item }) =>
      (item.product.kind === "owned" && item.state.availability === "owned") ||
      (item.product.kind === "planned" &&
        item.state.availability === "planned" &&
        item.product.productId !== null),
  )
  const unresolvedRoutineItems = includedItems.flatMap(
    ({ item, routineOrder }): NormalizedUnresolvedRoutineItem[] => {
      const unresolvedIdentity =
        (item.product.kind === "planned" &&
          item.state.availability === "planned" &&
          item.product.productId === null) ||
        (item.product.kind === "pending_review" && item.state.availability === "pending_review") ||
        (item.product.kind === "none" && item.state.availability === "none")
      if (!unresolvedIdentity) return []
      return [
        {
          itemId: item.itemKey,
          category: item.category,
          role: semanticRoleByRoutineRole[item.role],
          routineOrder,
          applicationInstanceKey: item.assignmentKey,
        },
      ]
    },
  )
  const productIds = [
    ...new Set(
      candidates.map(({ item }) =>
        item.product.kind === "owned" || item.product.kind === "planned"
          ? (item.product.productId ?? "")
          : "",
      ),
    ),
  ].filter(Boolean)
  if (!productIds.length)
    return {
      routineVersionId: input.activeVersion.id,
      planId: input.activeVersion.payload.planId,
      routineItems: [],
      unresolvedRoutineItems,
      exactGuidanceProtocols: [],
      applicationPointersV2: [],
    }
  const { data, error } = await input.client
    .from("products")
    .select(PRODUCT_SELECT)
    .in("id", productIds)
  if (error) throw error
  const products = new Map(((data ?? []) as ProductRow[]).map((row) => [row.id, row]))
  let protocolRows: ReviewedProductApplicationProtocolRow[] = []
  if (productIds.length > 0) {
    const result = await input.client
      .from("product_application_protocols")
      .select(contractVersion === 2 ? PRODUCT_PROTOCOL_V2_SELECT : PRODUCT_PROTOCOL_SELECT)
      .in("product_id", productIds)
    if (result.error) throw result.error
    protocolRows = (result.data ?? []) as ReviewedProductApplicationProtocolRow[]
  }
  const routineItems = candidates.map(({ item, routineOrder }) => {
    if (item.product.kind !== "owned" && item.product.kind !== "planned") {
      throw new Error("accepted_routine_product_identity_unavailable")
    }
    const productId = item.product.productId
    if (!productId) throw new Error("accepted_routine_product_identity_unavailable")
    const product = products.get(productId)
    const category = product?.category_key ?? product?.category
    if (
      !product ||
      !product.is_active ||
      product.lifecycle_status !== "active" ||
      category !== item.category
    ) {
      throw new Error("accepted_routine_product_unavailable")
    }
    const adapted = factsFor(category, product)
    const reviewedProtocol = protocolRows.find(
      (row) => row.product_id === product.id && row.role === "pre_heat_protection",
    )
    const catalogFacts = reviewedProtocol
      ? {
          ...adapted.facts,
          applicationState: reviewedProtocol.application_state,
          reapplication: reviewedProtocol.reapplication,
        }
      : adapted.facts
    return {
      itemId: item.itemKey,
      productId: product.id,
      productName: item.product.displayName,
      imageUrl: product.image_url,
      category: item.category,
      role: semanticRoleByRoutineRole[item.role],
      sourceRoutineRole: item.role,
      effectiveCadenceDe: effectiveRoutineCadenceCopyDe({
        recommended: item.cadence?.recommended ?? null,
        userOverride:
          typeof item.cadence?.userOverride === "string" ? item.cadence.userOverride : null,
        resolved: item.cadence?.resolved,
        role: item.role,
        displayKey: item.cadence?.displayKey,
      }),
      inclusion: "included" as const,
      availability: item.product.kind === "owned" ? ("owned" as const) : ("planned" as const),
      executable: item.executable,
      // The accepted payload is already sorted by Stage 4's global category +
      // role order. `roleOrder` alone is category-local and cannot preserve an
      // unresolved product's physical position across categories.
      routineOrder,
      applicationInstanceKey: item.assignmentKey,
      catalogFacts,
      catalogFactProvenance: adapted.provenance,
    }
  })
  return {
    routineVersionId: input.activeVersion.id,
    planId: input.activeVersion.payload.planId,
    routineItems,
    unresolvedRoutineItems,
    exactGuidanceProtocols:
      contractVersion === 1 ? adaptReviewedProductApplicationProtocols(protocolRows) : [],
    applicationPointersV2:
      contractVersion === 2 ? adaptReviewedProductApplicationPointersV2(protocolRows) : [],
  }
}

export async function loadImmutableRoutineProfile(input: {
  client: ApplicationRoutineReadClient
  userId: string
  planId: string
  refinedVersionId: string
}): Promise<NormalizedProfile> {
  const { data, error } = await input.client
    .from("personal_plan_need_versions")
    .select("output_snapshot")
    .eq("id", input.refinedVersionId)
    .eq("user_id", input.userId)
    .eq("personal_plan_id", input.planId)
    .eq("kind", "refined")
    .maybeSingle()
  if (error || !data || typeof data !== "object") throw error ?? new Error("refined_need_not_found")
  const snapshot = (data as { output_snapshot?: unknown }).output_snapshot
  const profile =
    snapshot && typeof snapshot === "object" && "profile" in snapshot
      ? (snapshot as { profile?: { hair?: unknown } }).profile
      : undefined
  const hair = profile?.hair
  if (!hair || typeof hair !== "object") return {}
  const source = hair as Record<string, unknown>
  const events =
    snapshot && typeof snapshot === "object" && "assessments" in snapshot
      ? (snapshot as { assessments?: { heatExposure?: { events?: unknown } } }).assessments
          ?.heatExposure?.events
      : undefined
  const routes = Array.isArray(events)
    ? events
        .map((event) =>
          event && typeof event === "object" ? (event as { route?: unknown }).route : undefined,
        )
        .filter((route): route is string => typeof route === "string")
    : []
  const heatEvents = Array.isArray(events)
    ? events.flatMap((event) => {
        if (!event || typeof event !== "object") return []
        const candidate = event as { id?: unknown; tool?: unknown; route?: unknown }
        if (
          typeof candidate.id !== "string" ||
          ![
            "hair_dryer",
            "dryer_brush",
            "straightener",
            "curling_iron",
            "hot_air_styler",
            "other",
          ].includes(String(candidate.tool)) ||
          !["airflow_shaping", "direct_contact_heat"].includes(String(candidate.route))
        ) {
          return []
        }
        return [
          {
            id: candidate.id,
            tool: candidate.tool as NonNullable<NormalizedProfile["heatEvents"]>[number]["tool"],
            route: candidate.route as NonNullable<NormalizedProfile["heatEvents"]>[number]["route"],
          },
        ]
      })
    : []
  const dryingRoute = routes.includes("direct_contact_heat")
    ? "heat_tool"
    : routes.includes("airflow_shaping")
      ? "blow_dry"
      : undefined
  return {
    length: ["short", "medium", "long"].includes(String(source.length))
      ? (source.length as NormalizedProfile["length"])
      : undefined,
    density: ["low", "medium", "high"].includes(String(source.density))
      ? (source.density as NormalizedProfile["density"])
      : undefined,
    thickness: ["fine", "normal", "coarse"].includes(String(source.thickness))
      ? (source.thickness as NormalizedProfile["thickness"])
      : undefined,
    dryingRoute,
    ...(heatEvents.length > 0 ? { heatEvents } : {}),
  }
}
