import type { SupabaseClient } from "@supabase/supabase-js"

import { buildStage3EntryContext } from "./stage2-entry-adapter"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { cleanProductDisplayName } from "@/lib/product-identity"
import {
  parseProposedProductPortfolio,
  type PersonalPlanCategory,
  type Stage3ProductDraft,
} from "./contracts"
import type { Stage3ProductionPersistence } from "./production-persistence-gateway"
import { normalizeOwnedProductSearchQuery } from "./inventory-search"
import { createStage3Draft } from "./state-machine"
import {
  loadStage3AuthorityFactBundle,
  loadStage3HeatCarrierCoverage,
  loadStage3RecommendationCandidates,
} from "./authority/catalog-facts"
import { Stage3AuthoritySnapshotError } from "./authority/snapshot"
import { effectiveStage3CategoryDecisions } from "./product-load-resolution"
import { semanticHash } from "@/lib/personal-plan/routine/canonicalize"
import { isPersonalPlanStage3CompleteCatalogEnabled } from "@/lib/personal-plan/release"

type AdminClient = SupabaseClient

/** Server-only adapter for the Stage-3 service primitives. */
export function createSupabaseStage3ProductionPersistence(
  client: AdminClient,
  options: { completeCatalogEnabled?: boolean } = {},
): Stage3ProductionPersistence {
  const completeCatalogEnabled =
    options.completeCatalogEnabled ?? isPersonalPlanStage3CompleteCatalogEnabled()
  const recommendationCandidateCache = new Map<
    string,
    ReturnType<typeof loadStage3RecommendationCandidates>
  >()
  const heatCarrierCoverageCache = new Map<
    string,
    ReturnType<typeof loadStage3HeatCarrierCoverage>
  >()
  async function loadRequirements(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }) {
    const { data: refined, error: refinedError } = await client
      .from("personal_plan_need_versions")
      .select("id,output_snapshot")
      .eq("id", input.refinedVersionId)
      .eq("personal_plan_id", input.personalPlanId)
      .eq("user_id", input.userId)
      .eq("kind", "refined")
      .maybeSingle()
    if (refinedError || !refined) throw new Error("stage3_refined_need_unavailable")
    return buildStage3EntryContext(refined.output_snapshot as InitialNeedPlanSnapshot, {
      personalPlanId: input.personalPlanId,
      refinedVersionId: input.refinedVersionId,
    })
  }

  return {
    async loadOrCreate(input) {
      const context = await loadRequirements(input)
      const seed = createStage3Draft({
        draftId: "pending-sql-assignment",
        userId: input.userId,
        personalPlanId: input.personalPlanId,
        refinedVersionId: input.refinedVersionId,
        requirements: context.orderedCategories,
        authoritySnapshot: context.authoritySnapshot,
        now: new Date().toISOString(),
      })
      const { data, error } = await client.rpc("personal_plan_create_or_load_product_draft", {
        p_user_id: input.userId,
        p_personal_plan_id: input.personalPlanId,
        p_refined_need_version_id: input.refinedVersionId,
        p_contract_version: context.schemaVersion,
        p_category_authority_versions: Object.fromEntries(
          context.orderedCategories.map((item) => [item.category, item.authorityVersion]),
        ),
        p_payload: draftPayload(seed),
      })
      if (error || !data) throw new Error("stage3_draft_create_failed")
      if (typeof data === "object" && "outcome" in data) {
        if (String(data.outcome) === "stale_source") {
          throw new Stage3AuthoritySnapshotError("stale_refined_source")
        }
        throw new Error("stage3_draft_create_rejected")
      }
      return { draft: mapStage3Draft(data), requirements: context.orderedCategories }
    },
    async save(input) {
      const { data, error } = await client.rpc("personal_plan_save_product_draft", {
        p_user_id: input.userId,
        p_draft_id: input.draftId,
        p_expected_revision: input.expectedRevision,
        p_pass: input.draft.pass,
        p_cursor: {
          categoryCursor: input.draft.categoryCursor,
          completedCaptureCategories: input.draft.completedCaptureCategories,
          completedDecisionKeys: input.draft.completedDecisionKeys,
        },
        p_payload: draftPayload(input.draft),
      })
      if (error || !data) throw new Error("stage3_draft_save_failed")
      const outcome = String((data as Record<string, unknown>).outcome)
      if (outcome !== "saved" && outcome !== "revision_conflict" && outcome !== "stale_source")
        throw new Error("stage3_draft_save_rejected")
      if (outcome === "stale_source") {
        // The guarded RPC intentionally does not disclose an obsolete draft.
        // The production gateway turns this into a restart from the current
        // refined source, so keep the locally supplied draft only to satisfy
        // the narrow persistence contract.
        return { outcome, draft: input.draft } as const
      }
      const draft = mapStage3Draft((data as Record<string, unknown>).draft ?? data)
      return { outcome, draft } as
        | { outcome: "saved"; draft: Stage3ProductDraft }
        | { outcome: "revision_conflict"; draft: Stage3ProductDraft }
        | { outcome: "stale_source"; draft: Stage3ProductDraft }
    },
    async resolveNeedRevision(input) {
      const { data, error } = await client.rpc("personal_plan_resolve_stage3_need_revision_v1", {
        p_user_id: input.userId,
        p_draft_id: input.draftId,
        p_expected_revision: input.expectedRevision,
        p_expected_proposal_fingerprint: input.expectedProposalFingerprint,
        p_action: input.action,
        p_pass: input.draft.pass,
        p_cursor: {
          categoryCursor: input.draft.categoryCursor,
          completedCaptureCategories: input.draft.completedCaptureCategories,
          completedDecisionKeys: input.draft.completedDecisionKeys,
        },
        p_category_authority_versions: input.draft.authorityVersions,
        p_payload: draftPayload(input.draft),
      })
      if (error || !data) throw new Error("stage3_need_revision_resolve_failed")
      const outcome = String((data as Record<string, unknown>).outcome)
      if (outcome !== "saved" && outcome !== "revision_conflict" && outcome !== "stale_source") {
        throw new Error("stage3_need_revision_resolve_rejected")
      }
      if (outcome === "stale_source") return { outcome, draft: input.draft } as const
      return {
        outcome,
        draft: mapStage3Draft((data as Record<string, unknown>).draft ?? data),
      } as
        | { outcome: "saved"; draft: Stage3ProductDraft }
        | { outcome: "revision_conflict"; draft: Stage3ProductDraft }
        | { outcome: "stale_source"; draft: Stage3ProductDraft }
    },
    async search(input) {
      const query = normalizeOwnedProductSearchQuery(input.query)
      const { data, error } = await client.rpc("personal_plan_search_assessment_products_v2", {
        p_user_id: input.userId,
        p_category: input.category,
        p_query: query,
        p_limit: 8,
        p_context: input.assessmentContext,
      })
      if (error) throw new Error("stage3_catalog_search_failed")

      const rows = Array.isArray(data) ? data : []
      const candidates = rows.map((raw) => mapAssessmentSearchCandidate(raw, input.category, query))
      return {
        requestToken: input.requestToken,
        query,
        category: input.category,
        candidates,
        totalCapped: rows.some(
          (row) => row && typeof row === "object" && row.total_capped === true,
        ),
      }
    },
    async resolveOwnedCatalogProduct(input) {
      const { data: candidate, error: candidateError } = await client
        .from("products")
        .select(
          "id,brand,name,image_url,category_key,origin,is_active,lifecycle_status,product_line:product_lines(canonical_name)",
        )
        .eq("id", input.candidateId)
        .eq("category_key", input.category)
        .maybeSingle()
      if (
        candidateError ||
        !candidate ||
        candidate.is_active !== true ||
        candidate.lifecycle_status !== "active"
      )
        return null
      if (candidate.origin === "user_submitted") {
        const { data: owned, error: ownedError } = await client
          .from("user_products")
          .select("id")
          .eq("user_id", input.userId)
          .eq("catalog_product_id", input.candidateId)
          .eq("category", input.category)
          .eq("identity_status", "matched")
          .eq("ownership_status", "owned")
          .maybeSingle()
        if (ownedError || !owned) return null
      }
      const { data, error } = await client.rpc("personal_plan_create_or_reuse_user_product", {
        p_user_id: input.userId,
        p_category: input.category,
        p_catalog_product_id: candidate.id,
      })
      if (error || !data || data.outcome !== "ready" || !data.userProduct) {
        throw new Error("stage3_owned_product_create_failed")
      }
      const owned = data.userProduct as Record<string, unknown>
      const productLine = readProductLineName(candidate.product_line)
      return {
        userProductId: String(owned.id),
        productId: String(owned.catalog_product_id),
        displayName: canonicalCatalogCompleteIdentity(candidate, productLine),
        imageUrl: typeof candidate.image_url === "string" ? candidate.image_url : null,
        category: owned.category as never,
      }
    },
    async loadCurrentCatalogProduct(input) {
      const { data: owned, error: ownedError } = await client
        .from("user_products")
        .select("id,catalog_product_id,category,identity_status,ownership_status")
        .eq("id", input.userProductId)
        .eq("user_id", input.userId)
        .eq("catalog_product_id", input.productId)
        .eq("category", input.category)
        .maybeSingle()
      if (
        ownedError ||
        !owned ||
        owned.identity_status !== "matched" ||
        owned.ownership_status !== "owned"
      ) {
        return null
      }
      const { data: product, error: productError } = await client
        .from("products")
        .select(
          "id,brand,name,image_url,category_key,is_active,lifecycle_status,product_line:product_lines(canonical_name)",
        )
        .eq("id", input.productId)
        .eq("category_key", input.category)
        .maybeSingle()
      if (
        productError ||
        !product ||
        product.is_active !== true ||
        product.lifecycle_status !== "active"
      ) {
        return null
      }
      return {
        userProductId: String(owned.id),
        productId: String(product.id),
        displayName: canonicalCatalogCompleteIdentity(
          product,
          readProductLineName(product.product_line),
        ),
        imageUrl: typeof product.image_url === "string" ? product.image_url : null,
        category: owned.category as PersonalPlanCategory,
      }
    },
    async resolveOwnedPendingProduct(input) {
      const { data: owned, error: ownedError } = await client
        .from("user_products")
        .select("id,category,identity_status,ownership_status,brand_text,product_name_text")
        .eq("id", input.userProductId)
        .eq("user_id", input.userId)
        .eq("category", input.category)
        .maybeSingle()
      if (
        ownedError ||
        !owned ||
        owned.ownership_status !== "owned" ||
        (owned.identity_status !== "pending_review" && owned.identity_status !== "needs_more_info")
      )
        return null
      const { data: submission, error: submissionError } = await client
        .from("product_submissions")
        .select("id,user_product_id,user_id,category,status")
        .eq("id", input.submissionId)
        .eq("user_product_id", input.userProductId)
        .eq("user_id", input.userId)
        .eq("category", input.category)
        .maybeSingle()
      if (
        submissionError ||
        !submission ||
        !["pending_review", "researching", "ready_for_review", "needs_more_info"].includes(
          String(submission.status),
        )
      )
        return null
      const displayName = [owned.brand_text, owned.product_name_text]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .trim()
      if (!displayName) return null
      return {
        userProductId: String(owned.id),
        submissionId: String(submission.id),
        displayName,
        reviewStatus: owned.identity_status,
        category: owned.category as PersonalPlanCategory,
      }
    },
    async loadRequirements(input) {
      return (await loadRequirements(input)).orderedCategories
    },
    async loadCompletedPortfolio(input) {
      const { data, error } = await client
        .from("personal_plan_portfolio_versions")
        .select("snapshot")
        .eq("source_product_draft_id", input.draftId)
        .eq("user_id", input.userId)
        .maybeSingle()
      if (error) throw new Error("stage3_portfolio_load_failed")
      return data?.snapshot ? (data.snapshot as never) : null
    },
    async loadCompletionReceipt(input) {
      const portfolioResult = await client
        .from("personal_plan_portfolio_versions")
        .select("id,snapshot")
        .eq("source_product_draft_id", input.draftId)
        .eq("user_id", input.userId)
        .maybeSingle()
      if (portfolioResult.error) {
        throw new Error("stage3_completion_receipt_load_failed")
      }
      if (!portfolioResult.data?.snapshot || !portfolioResult.data.id) return null
      const routineResult = await client
        .from("personal_plan_routine_versions")
        .select("id")
        .eq("source_portfolio_version_id", portfolioResult.data.id)
        .eq("user_id", input.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (routineResult.error) throw new Error("stage3_completion_receipt_load_failed")
      if (!routineResult.data?.id) return null
      const { data: proposal, error: proposalError } = await client
        .from("personal_plan_routine_proposals")
        .select("id")
        .eq("candidate_routine_version_id", routineResult.data.id)
        .eq("user_id", input.userId)
        .limit(1)
        .maybeSingle()
      if (proposalError) throw new Error("stage3_completion_receipt_load_failed")
      const portfolio = parseProposedProductPortfolio(portfolioResult.data.snapshot, {
        includeV4: true,
      })
      return {
        portfolio: {
          ...portfolio,
          portfolioVersionId: String(portfolioResult.data.id),
        },
        productPortfolioVersionId: String(portfolioResult.data.id),
        routineVersionId: String(routineResult.data.id),
        routineProposalId: proposal?.id ? String(proposal.id) : null,
      }
    },
    async loadRefinedNeedSnapshot(input) {
      const { data, error } = await client
        .from("personal_plan_need_versions")
        .select("output_snapshot")
        .eq("id", input.refinedVersionId)
        .eq("personal_plan_id", input.personalPlanId)
        .eq("user_id", input.userId)
        .eq("kind", "refined")
        .maybeSingle()
      if (error || !data?.output_snapshot) throw new Error("stage3_refined_need_unavailable")
      return data.output_snapshot as InitialNeedPlanSnapshot
    },
    async loadSourceRevision(input) {
      const { data, error } = await client
        .from("personal_plans")
        .select("source_revision")
        .eq("id", input.personalPlanId)
        .eq("user_id", input.userId)
        .maybeSingle()
      if (error || !data) throw new Error("stage3_plan_source_unavailable")
      return Number(data.source_revision)
    },
    async loadCurrentRefinedVersionId(input) {
      const { data, error } = await client
        .from("personal_plans")
        .select("current_refined_need_version_id")
        .eq("id", input.personalPlanId)
        .eq("user_id", input.userId)
        .maybeSingle()
      if (error || !data) throw new Error("stage3_plan_source_unavailable")
      return data.current_refined_need_version_id
        ? String(data.current_refined_need_version_id)
        : null
    },
    async loadAuthorityFacts(input) {
      const categoryDecision = effectiveStage3CategoryDecisions(input.draft).find(
        (decision) => decision.category === input.subject.category,
      )
      const cacheKey = semanticHash({
        category: input.subject.category,
        role: input.subject.role,
        hairThickness: input.context.hairThickness,
        authorityVersion: input.draft.authorityVersions[input.subject.category],
        categoryDecision: categoryDecision ?? null,
      })
      let recommendationCandidates = recommendationCandidateCache.get(cacheKey)
      if (!recommendationCandidates) {
        recommendationCandidates = loadStage3RecommendationCandidates(client, {
          draft: input.draft,
          subject: input.subject,
          context: input.context,
          categoryDecision,
          completeCatalog: completeCatalogEnabled,
        })
        recommendationCandidateCache.set(cacheKey, recommendationCandidates)
      }
      const heatCacheKey = semanticHash({
        draftId: input.draft.draftId,
        revision: input.draft.revision,
        products: input.draft.products,
        roleAssignments: input.draft.roleAssignments,
        heatRoutes: input.heatRoutes,
      })
      let heatCarrierCoverage = heatCarrierCoverageCache.get(heatCacheKey)
      if (!heatCarrierCoverage) {
        heatCarrierCoverage = loadStage3HeatCarrierCoverage(client, input.draft, input.heatRoutes)
        heatCarrierCoverageCache.set(heatCacheKey, heatCarrierCoverage)
      }
      const [resolvedRecommendationCandidates, resolvedHeatCarrierCoverage] = await Promise.all([
        recommendationCandidates,
        heatCarrierCoverage,
      ])
      return loadStage3AuthorityFactBundle(client, {
        draft: input.draft,
        subject: input.subject,
        heatRoutes: input.heatRoutes,
        context: input.context,
        categoryDecision,
        recommendationCandidates: resolvedRecommendationCandidates,
        heatCarrierCoverage: resolvedHeatCarrierCoverage,
        candidateCatalogComplete: completeCatalogEnabled,
      })
    },
    async loadDraft(input) {
      const { data, error } = await client
        .from("personal_plan_product_drafts")
        .select("*")
        .eq("id", input.draftId)
        .eq("user_id", input.userId)
        .maybeSingle()
      if (error) throw new Error("stage3_draft_load_failed")
      return data ? mapStage3Draft(data) : null
    },
  }
}

function mapAssessmentSearchCandidate(raw: unknown, category: PersonalPlanCategory, query: string) {
  const row = raw as Record<string, unknown>
  const brandName = typeof row.brand_name === "string" ? row.brand_name : null
  const productLine = typeof row.product_line_name === "string" ? row.product_line_name : null
  const rawName = typeof row.product_name === "string" ? row.product_name : ""
  const saleableName = cleanProductDisplayName(rawName, { brand: brandName, productLine })
  const displayName = [productLine, saleableName].filter(Boolean).join(" ").trim() || rawName
  const assessmentStatus =
    row.assessment_status === "ready" ? ("ready" as const) : ("pending_analysis" as const)
  const assessmentReasonCodes = Array.isArray(row.assessment_reason_codes)
    ? row.assessment_reason_codes.filter(
        (code): code is "missing_required_spec" | "missing_application_protocol" =>
          code === "missing_required_spec" || code === "missing_application_protocol",
      )
    : []
  const label = `${brandName ?? ""} ${displayName}`.trim().toLocaleLowerCase()

  return {
    candidateId: String(row.product_id),
    productId: String(row.product_id),
    displayName,
    category,
    brandName,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    confidence: label === query.toLocaleLowerCase() ? ("exact" as const) : ("likely" as const),
    assessmentStatus,
    assessmentReasonCodes,
  }
}

function readProductLineName(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object") return null
  const canonicalName = (row as Record<string, unknown>).canonical_name
  return typeof canonicalName === "string" && canonicalName.trim() ? canonicalName.trim() : null
}

function canonicalCatalogDisplayName(
  product: { name: unknown; brand: unknown },
  productLine: string | null,
) {
  const rawName = String(product.name ?? "").trim()
  const brand = typeof product.brand === "string" ? product.brand : null
  const saleableName = cleanProductDisplayName(rawName, { brand, productLine })
  return [productLine, saleableName].filter(Boolean).join(" ").trim() || rawName
}

function canonicalCatalogCompleteIdentity(
  product: { name: unknown; brand: unknown },
  productLine: string | null,
) {
  const title = canonicalCatalogDisplayName(product, productLine)
  const brand = typeof product.brand === "string" ? product.brand.trim() : ""
  if (!brand || title.toLocaleLowerCase().startsWith(brand.toLocaleLowerCase())) return title
  return `${brand} ${title}`
}

function draftPayload(draft: Stage3ProductDraft) {
  const payload: Record<string, unknown> = { ...draft }
  for (const key of [
    "draftId",
    "userId",
    "personalPlanId",
    "refinedVersionId",
    "revision",
    "status",
    "createdAt",
    "updatedAt",
  ]) {
    delete payload[key]
  }
  return payload
}

function mapStage3Draft(raw: unknown): Stage3ProductDraft {
  const row = raw as Record<string, unknown>
  const payload = (row.payload ?? row) as Record<string, unknown>
  return {
    ...payload,
    schemaVersion: Number(payload.schemaVersion ?? row.contract_version ?? 1) as 1,
    status: String(row.status ?? payload.status ?? "active") as Stage3ProductDraft["status"],
    authorityVersions: (row.category_authority_versions ??
      payload.authorityVersions ??
      {}) as Stage3ProductDraft["authorityVersions"],
    draftId: String(row.id ?? payload.draftId),
    userId: String(row.user_id ?? payload.userId),
    personalPlanId: String(row.personal_plan_id ?? payload.personalPlanId),
    refinedVersionId: String(row.refined_need_version_id ?? payload.refinedVersionId),
    staleRefinedVersionId: (payload.staleRefinedVersionId ?? null) as string | null,
    revision: Number(row.revision ?? payload.revision ?? 0),
    pass: String(row.pass ?? payload.pass ?? "product_capture") as Stage3ProductDraft["pass"],
    categoryCursor: ((row.cursor as Record<string, unknown> | null)?.categoryCursor ??
      payload.categoryCursor ??
      null) as string | null,
    products: (payload.products ?? []) as Stage3ProductDraft["products"],
    roleAssignments: (payload.roleAssignments ?? []) as Stage3ProductDraft["roleAssignments"],
    uncoveredRoles: (payload.uncoveredRoles ?? []) as Stage3ProductDraft["uncoveredRoles"],
    decisions: (payload.decisions ?? []) as Stage3ProductDraft["decisions"],
    orderedCategories: (payload.orderedCategories ?? []) as Stage3ProductDraft["orderedCategories"],
    completedCaptureCategories: ((row.cursor as Record<string, unknown> | null)
      ?.completedCaptureCategories ??
      payload.completedCaptureCategories ??
      []) as Stage3ProductDraft["completedCaptureCategories"],
    completedDecisionKeys: ((row.cursor as Record<string, unknown> | null)?.completedDecisionKeys ??
      payload.completedDecisionKeys ??
      []) as string[],
    createdAt: String(row.created_at ?? payload.createdAt),
    updatedAt: String(row.updated_at ?? payload.updatedAt),
    authoritySnapshot: payload.authoritySnapshot as Stage3ProductDraft["authoritySnapshot"],
    inventoryAuthority: payload.inventoryAuthority as Stage3ProductDraft["inventoryAuthority"],
    inventoryDispositions:
      payload.inventoryDispositions as Stage3ProductDraft["inventoryDispositions"],
  }
}
