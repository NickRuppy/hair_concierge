import { createHash } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { PlanCategoryTarget } from "@/lib/personal-plan/types"

import { CATEGORY_ROLE_POLICIES } from "../authorities"
import type { PersonalPlanCategory, Stage3DecisionSubject, Stage3ProductDraft } from "../contracts"
import { expectedShampooBucket } from "./categories/shampoo"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
  Stage3EvaluationContext,
} from "./contracts"

type AdminClient = SupabaseClient
type Row = Record<string, unknown>
type ShampooTarget = Extract<PlanCategoryTarget, { category: "shampoo" }>
type ConditionerTarget = Extract<PlanCategoryTarget, { category: "conditioner" }>
type CategorySelectionContext = {
  hairThickness: string
  role: Stage3DecisionSubject["role"]
  shampooTarget: ShampooTarget | null
  conditionerTarget: ConditionerTarget | null
}

export type Stage3AuthorityFactBundle = Pick<
  Stage3AuthorityInput,
  "productFacts" | "recommendationCandidates" | "heatCarrierCoverage"
>

export async function loadStage3AuthorityFactBundle(
  client: AdminClient,
  input: {
    draft: Stage3ProductDraft
    subject: Stage3DecisionSubject
    heatRoutes: string[]
    context: Stage3EvaluationContext
  },
): Promise<Stage3AuthorityFactBundle> {
  const selectionContext: CategorySelectionContext = {
    hairThickness: input.context.hairThickness,
    role: input.subject.role,
    shampooTarget: signedShampooTarget(input.draft, input.subject.category),
    conditionerTarget: signedConditionerTarget(input.draft, input.subject.category),
  }
  const captured = input.subject.capturedProductId
    ? input.draft.products.find(
        (product) => product.capturedProductId === input.subject.capturedProductId,
      )
    : null
  const productId =
    captured?.identity.kind === "catalog_product" ? captured.identity.productId : null

  const productFacts = productId
    ? await loadOneProduct(client, input.subject.category, productId, selectionContext)
    : null
  const recommendationCandidates = await loadRecommendationCandidates(
    client,
    input.subject.category,
    selectionContext,
  )
  const heatCarrierCoverage = await resolveHeatCarrierCoverage(
    client,
    input.draft,
    input.heatRoutes,
  )

  return {
    productFacts,
    recommendationCandidates,
    heatCarrierCoverage,
  } as Stage3AuthorityFactBundle
}

async function loadRecommendationCandidates(
  client: AdminClient,
  category: PersonalPlanCategory,
  selectionContext: CategorySelectionContext,
): Promise<Stage3CategoryProductFacts[]> {
  const { data, error } = await client
    .from("products")
    .select(
      "id,name,category_key,is_active,lifecycle_status,is_chaarlie_recommended,suitable_thicknesses,updated_at,sort_order,price_eur,purchase_link_status",
    )
    .eq("category_key", category)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .eq("is_chaarlie_recommended", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(12)
  if (error) throw new Error("stage3_authority_catalog_unavailable")
  const facts = await Promise.all(
    (data ?? []).map((row) =>
      normalizeProductFacts(client, category, row as Row, selectionContext),
    ),
  )
  return facts
    .filter((value): value is Stage3CategoryProductFacts => value !== null)
    .sort(compareRecommendationFacts)
}

async function loadOneProduct(
  client: AdminClient,
  category: PersonalPlanCategory,
  productId: string,
  selectionContext: CategorySelectionContext,
): Promise<Stage3CategoryProductFacts | null> {
  const { data, error } = await client
    .from("products")
    .select(
      "id,name,category_key,is_active,lifecycle_status,is_chaarlie_recommended,suitable_thicknesses,updated_at,price_eur,purchase_link_status",
    )
    .eq("id", productId)
    .eq("category_key", category)
    .maybeSingle()
  if (error) throw new Error("stage3_authority_catalog_unavailable")
  return data ? normalizeProductFacts(client, category, data as Row, selectionContext) : null
}

async function normalizeProductFacts(
  client: AdminClient,
  category: PersonalPlanCategory,
  product: Row,
  selectionContext: CategorySelectionContext,
): Promise<Stage3CategoryProductFacts | null> {
  const productId = text(product.id)
  if (!productId || product.category_key !== category) return null
  const [spec, protocols] = await Promise.all([
    loadCategorySpec(client, category, productId, selectionContext),
    loadProtocols(client, category, productId),
  ])
  const common = {
    productId,
    displayName: text(product.name) ?? productId,
    category,
    isActive: product.is_active === true,
    lifecycleStatus: text(product.lifecycle_status),
    recommendable:
      product.is_active === true &&
      product.lifecycle_status === "active" &&
      product.is_chaarlie_recommended === true,
    suitableThicknesses: textArray(product.suitable_thicknesses),
    // V1 has no user-specific reaction authority. Absence of a recorded
    // reaction is therefore a known non-exclusion, rather than missing data.
    knownReaction: false,
    protocols,
    catalogSortOrder: numberOrNull(product.sort_order),
    priceEur: numberOrNull(product.price_eur),
    purchaseLinkStatus:
      product.purchase_link_status === "available" || product.purchase_link_status === "unavailable"
        ? product.purchase_link_status
        : null,
  }
  const withoutFingerprint = { ...common, spec }
  return {
    ...withoutFingerprint,
    factFingerprint: fingerprint(withoutFingerprint),
  } as Stage3CategoryProductFacts
}

async function loadCategorySpec(
  client: AdminClient,
  category: PersonalPlanCategory,
  productId: string,
  selectionContext: CategorySelectionContext,
): Promise<Stage3CategoryProductFacts["spec"]> {
  switch (category) {
    case "shampoo": {
      const rows = await many(client, "product_shampoo_specs", productId)
      return selectShampooSpec(rows, selectionContext)
    }
    case "conditioner": {
      const [base, rerank] = await Promise.all([
        many(client, "product_conditioner_specs", productId),
        one(client, "product_conditioner_rerank_specs", productId),
      ])
      const selected = selectConditionerSpec(base, selectionContext)
      return {
        thickness: selected?.thickness ?? null,
        proteinMoistureBalance: selected?.proteinMoistureBalance ?? null,
        weight: text(rerank?.weight),
        repairSupportLevel: text(rerank?.repair_level),
        balanceDirection: text(rerank?.balance_direction),
      }
    }
    case "leave_in": {
      const row = await one(client, "product_leave_in_specs", productId)
      return {
        format: text(row?.format),
        weight: text(row?.weight),
        careDirection: null,
        repairSupportLevel: null,
        roles: textArray(row?.roles),
        providesHeatProtection: booleanOrNull(row?.provides_heat_protection),
        careBenefits: textArray(row?.care_benefits),
        applicationStages: textArray(row?.application_stage),
      }
    }
    case "heat_protectant": {
      const row = await one(client, "product_heat_protectant_specs", productId)
      return {
        format: text(row?.format),
        providesHeatProtection: booleanOrNull(row?.provides_heat_protection),
      }
    }
    case "oil": {
      const [row, eligibility] = await Promise.all([
        one(client, "product_oil_specs", productId),
        many(client, "product_oil_eligibility", productId),
      ])
      const roleSupport: Record<string, boolean> = {}
      for (const item of eligibility) {
        const purpose = text(item.oil_purpose)
        if (purpose === "pre_wash_oiling") roleSupport.pre_wash_fibre_treatment = true
        if (purpose === "styling_finish" || purpose === "light_finish") {
          roleSupport.dry_finish = true
        }
      }
      return {
        roleSupport,
        weight: null,
        providesHeatProtection: booleanOrNull(row?.provides_heat_protection),
      }
    }
    case "mask": {
      const row = await one(client, "product_mask_specs", productId)
      return {
        weight: text(row?.weight),
        careDirection: text(row?.balance_direction),
        repairSupportLevel: null,
        functionalBenefits: null,
      }
    }
    case "scalp_care": {
      const row = await one(client, "product_scalp_care_specs", productId)
      return {
        primaryRole: text(row?.primary_role),
        presentationFormat: text(row?.presentation_format),
        rinseMode: text(row?.rinse_mode),
      }
    }
    case "dry_shampoo": {
      const row = await one(client, "product_dry_shampoo_specs", productId)
      return {
        primaryEffect: text(row?.primary_effect),
        hairColorFit: text(row?.hair_color_fit),
        scalpSensitivityFit: text(row?.scalp_sensitivity_fit),
        format: text(row?.format),
      }
    }
    case "bondbuilder": {
      const [row, relationships] = await Promise.all([
        one(client, "product_bondbuilder_specs", productId),
        loadOutgoingProductRelationships(client, productId),
      ])
      return {
        applicationMode: text(row?.application_mode),
        treatmentMode: text(row?.treatment_mode),
        productFormat: text(row?.product_format),
        usageProtocol: text(row?.usage_protocol),
        relationship: classifyBondbuilderRelationship(relationships),
      }
    }
    case "deep_cleansing_shampoo": {
      const row = await one(client, "product_deep_cleansing_shampoo_specs", productId)
      const resetFocus = text(row?.reset_focus)
      const supportedResetRoles =
        resetFocus === "product_sebum_buildup"
          ? (["residue_reset"] as const)
          : resetFocus === "metal_mineral_hard_water"
            ? (["mineral_reset"] as const)
            : resetFocus === "broad_spectrum_detox"
              ? (["residue_reset", "mineral_reset"] as const)
              : null
      return {
        supportedResetRoles: supportedResetRoles ? [...supportedResetRoles] : null,
        scalpTypeFocus: text(row?.scalp_type_focus),
        colorTreatedSuitability: text(row?.color_treated_suitability),
      }
    }
  }
}

async function loadProtocols(
  client: AdminClient,
  category: PersonalPlanCategory,
  productId: string,
) {
  const [{ data: rawProtocols, error: protocolError }, { data: guidance, error: guidanceError }] =
    await Promise.all([
      client
        .from("product_application_protocols")
        .select(
          "role,application_stage,application_state,placement,contact_time_seconds,rinse_action,reapplication,source_label,source_url,updated_at",
        )
        .eq("product_id", productId),
      client
        .from("application_guidance_protocols")
        .select("id,role_key,protocol_version,verified_at,updated_at")
        .eq("product_id", productId)
        .eq("scope_kind", "product")
        .eq("status", "active")
        .eq("locale", "de"),
    ])
  if (protocolError || guidanceError) throw new Error("stage3_authority_protocol_unavailable")
  const protocolRows = (rawProtocols ?? []) as Row[]
  const guidanceRows = (guidance ?? []) as Row[]
  const roles = new Set<string>(CATEGORY_ROLE_POLICIES[category].allowedRoles)
  if (category === "leave_in" || category === "oil") roles.add("pre_heat_protection")

  return [...roles].map((role) => {
    const guidanceRow = guidanceRows.find((row) => row.role_key === role || row.role_key === null)
    if (guidanceRow) {
      return {
        role: role as never,
        status: "verified_complete" as const,
        fingerprint: fingerprint(guidanceRow),
      }
    }
    const sourceRole = role === "pre_heat_application" ? "pre_heat_protection" : role
    const row = protocolRows.find((candidate) => candidate.role === sourceRole)
    if (!row) return { role: role as never, status: "missing" as const, fingerprint: null }
    const complete =
      sourceRole === "pre_heat_protection"
        ? Boolean(row.application_state && row.reapplication)
        : Boolean(
            row.application_stage &&
            row.placement &&
            (row.rinse_action || row.contact_time_seconds),
          )
    return {
      role: role as never,
      status: complete ? ("verified_complete" as const) : ("verified_incomplete" as const),
      fingerprint: fingerprint(row),
    }
  })
}

async function resolveHeatCarrierCoverage(
  client: AdminClient,
  draft: Stage3ProductDraft,
  heatRoutes: string[],
): Promise<Stage3AuthorityFactBundle["heatCarrierCoverage"]> {
  for (const category of ["leave_in", "oil", "heat_protectant"] as const) {
    const assignedIds = new Set(
      draft.roleAssignments
        .filter((assignment) => assignment.category === category)
        .map((assignment) => assignment.capturedProductId),
    )
    for (const captured of draft.products) {
      if (
        !assignedIds.has(captured.capturedProductId) ||
        captured.identity.kind !== "catalog_product"
      ) {
        continue
      }
      const facts = await loadOneProduct(client, category, captured.identity.productId, {
        hairThickness: "",
        role: "pre_heat_protection",
        shampooTarget: null,
        conditionerTarget: null,
      })
      if (!facts || !facts.isActive || facts.lifecycleStatus !== "active") continue
      const capability =
        facts.category === "leave_in" ||
        facts.category === "oil" ||
        facts.category === "heat_protectant"
          ? facts.spec.providesHeatProtection
          : false
      const protocol = facts.protocols.find(
        (item) => item.role === "pre_heat_protection" || item.role === "pre_heat_application",
      )
      if (capability === true && protocol?.status === "verified_complete") {
        return { carrierCategory: category, verifiedRoutes: [...heatRoutes] }
      }
    }
  }
  return { carrierCategory: null, verifiedRoutes: [] }
}

async function one(client: AdminClient, table: string, productId: string): Promise<Row | null> {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("product_id", productId)
    .maybeSingle()
  if (error) throw new Error("stage3_authority_spec_unavailable")
  return data ? (data as Row) : null
}

async function many(client: AdminClient, table: string, productId: string): Promise<Row[]> {
  const { data, error } = await client.from(table).select("*").eq("product_id", productId)
  if (error) throw new Error("stage3_authority_spec_unavailable")
  return (data ?? []) as Row[]
}

async function loadOutgoingProductRelationships(
  client: AdminClient,
  productId: string,
): Promise<Row[]> {
  const { data, error } = await client
    .from("product_relationships")
    .select("relationship_type")
    .eq("source_product_id", productId)
  if (error) throw new Error("stage3_authority_spec_unavailable")
  return (data ?? []) as Row[]
}

export function classifyBondbuilderRelationship(
  relationships: ReadonlyArray<{ relationship_type?: unknown }>,
): "standalone" | "add_on" {
  return relationships.some((relationship) => relationship.relationship_type === "add_on_for")
    ? "add_on"
    : "standalone"
}

function signedConditionerTarget(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
): ConditionerTarget | null {
  if (category !== "conditioner") return null
  const target = draft.authoritySnapshot?.categoryDecisions.find(
    (decision) => decision.category === "conditioner",
  )?.target
  return target?.category === "conditioner" ? target : null
}

function signedShampooTarget(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
): ShampooTarget | null {
  if (category !== "shampoo") return null
  const target = draft.authoritySnapshot?.categoryDecisions.find(
    (decision) => decision.category === "shampoo",
  )?.target
  return target?.category === "shampoo" ? target : null
}

function selectShampooSpec(
  rows: Row[],
  context: CategorySelectionContext,
): {
  thickness: string | null
  shampooBucket: string | null
  scalpRoute: string | null
  cleansingIntensity: string | null
} {
  const empty = {
    thickness: null,
    shampooBucket: null,
    scalpRoute: null,
    cleansingIntensity: null,
  }
  if (!context.shampooTarget) return empty
  const expectedBucket = expectedShampooBucket({
    role: context.role,
    target: context.shampooTarget,
  })
  if (!expectedBucket) return empty
  const matches = rows
    .filter(
      (row) =>
        text(row.thickness) === context.hairThickness &&
        text(row.shampoo_bucket) === expectedBucket &&
        text(row.scalp_route) === context.shampooTarget?.scalpRoute,
    )
    .map((row) => ({
      thickness: text(row.thickness),
      shampooBucket: text(row.shampoo_bucket),
      scalpRoute: text(row.scalp_route),
      cleansingIntensity: text(row.cleansing_intensity),
    }))
  return singleSemanticMatch(matches) ?? empty
}

function selectConditionerSpec(
  rows: Row[],
  context: CategorySelectionContext,
): { thickness: string | null; proteinMoistureBalance: string | null } | null {
  if (!context.conditionerTarget) return null
  const matches = rows
    .filter(
      (row) =>
        text(row.thickness) === context.hairThickness &&
        conditionerBalance(row.protein_moisture_balance) ===
          context.conditionerTarget?.careDirection,
    )
    .map((row) => ({
      thickness: text(row.thickness),
      proteinMoistureBalance: conditionerBalance(row.protein_moisture_balance),
    }))
  return singleSemanticMatch(matches)
}

function singleSemanticMatch<T extends object>(matches: T[]): T | null {
  const canonical = new Map(matches.map((match) => [JSON.stringify(sortValue(match)), match]))
  if (canonical.size !== 1) return null
  return [...canonical.values()][0] ?? null
}

function conditionerBalance(value: unknown): "protein" | "moisture" | "balanced" | null {
  switch (value) {
    case "stretches_stays":
    case "protein":
      return "protein"
    case "snaps":
    case "moisture":
      return "moisture"
    case "stretches_bounces":
    case "balanced":
      return "balanced"
    default:
      return null
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function textArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function compareRecommendationFacts(
  left: Stage3CategoryProductFacts,
  right: Stage3CategoryProductFacts,
): number {
  const leftOrder = left.catalogSortOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = right.catalogSortOrder ?? Number.MAX_SAFE_INTEGER
  return (
    leftOrder - rightOrder ||
    left.displayName.localeCompare(right.displayName, "de") ||
    left.productId.localeCompare(right.productId)
  )
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(sortValue(value)))
    .digest("hex")
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Row)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  )
}
