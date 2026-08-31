import type { SupabaseClient } from "@supabase/supabase-js"

import { buildStage3EntryContext } from "./stage2-entry-adapter"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { cleanProductDisplayName } from "@/lib/product-identity"
import {
  mapLegacyRefinementPrefill,
  type LegacyCatalogMatch,
  type LegacyProductUsageRow,
  type LegacyRefinementPrefillInput,
} from "@/lib/personal-plan/legacy-prefill"
import {
  createStage3OptionalInventorySeedDraft,
  filterStage3ExactInventory,
} from "./legacy-inventory-entry"
import type { Stage3DraftResponse } from "./gateway"
import {
  parseProposedProductPortfolio,
  stage3LegacyPrefillHintsSchema,
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
import { isPersonalPlanStage3ThumbnailsEnabled } from "@/lib/personal-plan/release"

type AdminClient = SupabaseClient
type Stage3OptionalMigrationState = {
  legacyPrefillEligible: boolean
  stage3InventoryConsumed: boolean
}

export async function openSupabaseStage3OptionalInventory(
  client: AdminClient,
  input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  },
  options: { thumbnailsEnabled?: boolean; now?: () => string } = {},
): Promise<Stage3DraftResponse> {
  const loadGeneric = () => openGenericStage3Draft(client, input, options)
  const migrationState = await loadStage3OptionalMigrationState(client, input)
  if (!migrationState.legacyPrefillEligible || migrationState.stage3InventoryConsumed) {
    return loadGeneric()
  }

  const context = await loadOptionalStage3EntryContext(client, input)
  if (!(await hasProductsModuleHandoff(client, input))) {
    throw new Stage3AuthoritySnapshotError("stale_refined_source")
  }

  if (await hasCurrentStage3Draft(client, input)) {
    return openOptionalInventoryWithRpc(client, {
      input,
      context,
      exactInventory: [],
      payload: draftPayload(
        createStage3Draft({
          draftId: "pending-sql-assignment",
          userId: input.userId,
          personalPlanId: input.personalPlanId,
          refinedVersionId: input.refinedVersionId,
          requirements: context.orderedCategories,
          authoritySnapshot: context.authoritySnapshot,
          now: options.now?.() ?? new Date().toISOString(),
        }),
      ),
      sourceFingerprint: "legacy-prefill-v1:skipped-existing-stage3",
      sourceIds: [],
    })
  }

  const prefill = mapLegacyRefinementPrefill(
    await loadLegacyInventoryPrefillInput(client, input.userId),
  )
  const seed = createStage3OptionalInventorySeedDraft({
    draftId: "pending-sql-assignment",
    userId: input.userId,
    personalPlanId: input.personalPlanId,
    refinedVersionId: input.refinedVersionId,
    requirements: context.orderedCategories,
    authoritySnapshot: context.authoritySnapshot,
    prefill,
    now: options.now?.() ?? new Date().toISOString(),
  })
  const exactInventory = filterStage3ExactInventory({
    prefill,
    orderedCategories: context.orderedCategories.map((requirement) => requirement.category),
  })
  return openOptionalInventoryWithRpc(client, {
    input,
    context,
    exactInventory,
    payload: draftPayload(seed),
    sourceFingerprint: prefill.sourceFingerprint,
    sourceIds: prefill.sourceIds,
  })
}

async function openGenericStage3Draft(
  client: AdminClient,
  input: { userId: string; personalPlanId: string; refinedVersionId: string },
  options: { thumbnailsEnabled?: boolean },
): Promise<Stage3DraftResponse> {
  const persistence = createSupabaseStage3ProductionPersistence(client, {
    thumbnailsEnabled: options.thumbnailsEnabled,
  })
  const loaded = await persistence.loadOrCreate(input)
  return { status: loaded.draft.status, ...loaded }
}

async function openOptionalInventoryWithRpc(
  client: AdminClient,
  args: {
    input: { userId: string; personalPlanId: string; refinedVersionId: string }
    context: Awaited<ReturnType<typeof loadOptionalStage3EntryContext>>
    exactInventory: unknown[]
    payload: Record<string, unknown>
    sourceFingerprint: string
    sourceIds: string[]
  },
): Promise<Stage3DraftResponse> {
  const { data, error } = await client.rpc("personal_plan_open_optional_inventory_v1", {
    p_user_id: args.input.userId,
    p_personal_plan_id: args.input.personalPlanId,
    p_refined_need_version_id: args.input.refinedVersionId,
    p_contract_version: args.context.schemaVersion,
    p_category_authority_versions: Object.fromEntries(
      args.context.orderedCategories.map((item) => [item.category, item.authorityVersion]),
    ),
    p_payload: args.payload,
    p_exact_inventory: args.exactInventory,
    p_source_fingerprint: args.sourceFingerprint,
    p_source_ids: args.sourceIds,
  })
  if (error || !data) throw new Error("stage3_optional_inventory_open_failed")
  const outcome = typeof data === "object" ? String((data as Record<string, unknown>).outcome) : ""
  if (outcome === "stale_source") {
    throw new Stage3AuthoritySnapshotError("stale_refined_source")
  }
  if (outcome !== "ready") throw new Error("stage3_optional_inventory_open_rejected")
  const draft = mapStage3Draft((data as Record<string, unknown>).draft)
  return { status: draft.status, draft, requirements: args.context.orderedCategories }
}

/** Server-only adapter for the Stage-3 service primitives. */
export function createSupabaseStage3ProductionPersistence(
  client: AdminClient,
  options: { thumbnailsEnabled?: boolean } = {},
): Stage3ProductionPersistence {
  const thumbnailsEnabled = options.thumbnailsEnabled ?? isPersonalPlanStage3ThumbnailsEnabled()
  const recommendationCandidateCache = new Map<
    string,
    ReturnType<typeof loadStage3RecommendationCandidates>
  >()
  const heatCarrierCoverageCache = new Map<
    string,
    ReturnType<typeof loadStage3HeatCarrierCoverage>
  >()
  async function loadEntryContext(input: {
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

  async function loadRequirements(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }) {
    return (await loadEntryContext(input)).orderedCategories
  }

  return {
    async loadOrCreate(input) {
      const context = await loadEntryContext(input)
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
    async refreshAuthorityDraft(input) {
      const context = await loadEntryContext(input)
      const refreshedDraft = buildAuthorityRefreshDraft(input.draft, context.authoritySnapshot)
      const payload = draftPayload(refreshedDraft)
      const cursor = {
        categoryCursor: refreshedDraft.categoryCursor,
        completedCaptureCategories: refreshedDraft.completedCaptureCategories,
        completedDecisionKeys: refreshedDraft.completedDecisionKeys,
      }
      const { data, error } = await client.rpc("personal_plan_refresh_product_draft_authority", {
        p_user_id: input.userId,
        p_draft_id: input.draftId,
        p_expected_revision: input.expectedRevision,
        p_contract_version: refreshedDraft.schemaVersion,
        p_category_authority_versions: refreshedDraft.authorityVersions,
        p_pass: refreshedDraft.pass,
        p_cursor: cursor,
        p_payload: payload,
      })
      if (error || !data) throw new Error("stage3_authority_refresh_failed")
      const outcome = String((data as Record<string, unknown>).outcome)
      if (outcome === "stale_source") return { outcome, draft: refreshedDraft } as const
      if (!["saved", "completed", "revision_conflict"].includes(outcome)) {
        throw new Error("stage3_authority_refresh_rejected")
      }
      return {
        outcome,
        draft: mapStage3Draft((data as Record<string, unknown>).draft ?? data),
      } as
        | { outcome: "saved"; draft: Stage3ProductDraft }
        | { outcome: "completed"; draft: Stage3ProductDraft }
        | { outcome: "revision_conflict"; draft: Stage3ProductDraft }
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
      const { data, error } = await client.rpc(
        thumbnailsEnabled
          ? "personal_plan_search_assessment_products_v3"
          : "personal_plan_search_assessment_products_v2",
        {
          p_user_id: input.userId,
          p_category: input.category,
          p_query: query,
          p_limit: 8,
          p_context: input.assessmentContext,
        },
      )
      if (error) throw new Error("stage3_catalog_search_failed")

      const rows = Array.isArray(data) ? data : []
      const candidates = rows.map((raw) =>
        mapAssessmentSearchCandidate(raw, input.category, query, thumbnailsEnabled),
      )
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
          "id,brand,name,image_url,thumbnail_image_url,category_key,origin,is_active,lifecycle_status,product_line:product_lines(canonical_name)",
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
        ...(thumbnailsEnabled
          ? {
              thumbnailImageUrl:
                typeof candidate.thumbnail_image_url === "string"
                  ? candidate.thumbnail_image_url
                  : null,
            }
          : {}),
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
          "id,brand,name,image_url,thumbnail_image_url,category_key,is_active,lifecycle_status,product_line:product_lines(canonical_name)",
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
        ...(thumbnailsEnabled
          ? {
              thumbnailImageUrl:
                typeof product.thumbnail_image_url === "string"
                  ? product.thumbnail_image_url
                  : null,
            }
          : {}),
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
      return loadRequirements(input)
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

export function buildAuthorityRefreshDraft(
  draft: Stage3ProductDraft,
  currentSnapshot: NonNullable<Stage3ProductDraft["authoritySnapshot"]>,
): Stage3ProductDraft {
  const authorityVersions = Object.fromEntries(
    Object.keys(draft.authorityVersions).map((category) => [
      category,
      currentSnapshot.authorityVersions[category as PersonalPlanCategory],
    ]),
  ) as Stage3ProductDraft["authorityVersions"]
  const productLoadResolution = draft.productLoadResolution
    ? {
        ...draft.productLoadResolution,
        authorityVersions: Object.fromEntries(
          Object.keys(draft.productLoadResolution.authorityVersions).map((category) => [
            category,
            currentSnapshot.authorityVersions[category as PersonalPlanCategory],
          ]),
        ),
        requirements: draft.productLoadResolution.requirements.map((requirement) => ({
          ...requirement,
          authorityVersion: currentSnapshot.authorityVersions[requirement.category],
        })),
      }
    : undefined
  return {
    ...draft,
    authorityVersions,
    authoritySnapshot: currentSnapshot,
    ...(productLoadResolution ? { productLoadResolution } : {}),
    decisions: [],
    completedDecisionKeys: [],
    pass: draft.pass === "ready_for_routine" ? "product_decisions" : draft.pass,
  }
}

async function loadStage3OptionalMigrationState(
  client: AdminClient,
  input: { userId: string; personalPlanId: string },
): Promise<Stage3OptionalMigrationState> {
  const { data, error } = await client
    .from("personal_plans")
    .select("enrollment_purchase_source_id,legacy_prefill_v1")
    .eq("id", input.personalPlanId)
    .eq("user_id", input.userId)
    .maybeSingle()
  if (error) throw new Error("stage3_optional_plan_read_failed")
  const receipt = (data as Record<string, unknown> | null)?.legacy_prefill_v1
  const stage3InventoryConsumed =
    Boolean(receipt && typeof receipt === "object" && !Array.isArray(receipt)) &&
    "stage3Inventory" in (receipt as Record<string, unknown>)
  if (stage3InventoryConsumed) return { legacyPrefillEligible: false, stage3InventoryConsumed }
  const enrollmentId = fieldString(data, "enrollment_purchase_source_id")
  if (!enrollmentId) {
    return { legacyPrefillEligible: false, stage3InventoryConsumed }
  }
  const { data: enrollment, error: enrollmentError } = await client
    .from("personal_plan_migration_enrollments")
    .select("id")
    .eq("id", enrollmentId)
    .eq("user_id", input.userId)
    .eq("status", "ready")
    .maybeSingle()
  if (enrollmentError) throw new Error("stage3_migration_enrollment_read_failed")
  return { legacyPrefillEligible: Boolean(enrollment?.id), stage3InventoryConsumed }
}

async function loadOptionalStage3EntryContext(
  client: AdminClient,
  input: { userId: string; personalPlanId: string; refinedVersionId: string },
) {
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

async function hasProductsModuleHandoff(
  client: AdminClient,
  input: { userId: string; personalPlanId: string; refinedVersionId: string },
): Promise<boolean> {
  const { data, error } = await client
    .from("personal_plan_refinement_drafts")
    .select("id")
    .eq("user_id", input.userId)
    .eq("personal_plan_id", input.personalPlanId)
    .eq("module_projections->products->>needVersionId", input.refinedVersionId)
    .eq("module_projections->products->>stage3Handoff", "true")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error("stage3_optional_handoff_read_failed")
  return Boolean(data?.id)
}

async function hasCurrentStage3Draft(
  client: AdminClient,
  input: { userId: string; personalPlanId: string; refinedVersionId: string },
): Promise<boolean> {
  const { data, error } = await client
    .from("personal_plan_product_drafts")
    .select("id")
    .eq("user_id", input.userId)
    .eq("personal_plan_id", input.personalPlanId)
    .eq("refined_need_version_id", input.refinedVersionId)
    .in("status", ["active", "completed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error("stage3_optional_current_draft_read_failed")
  return Boolean(data?.id)
}

async function loadLegacyInventoryPrefillInput(
  client: AdminClient,
  userId: string,
): Promise<LegacyRefinementPrefillInput> {
  const { data: usage, error: usageError } = await client
    .from("user_product_usage")
    .select("id,category,product_name,frequency_range,product_id")
    .eq("user_id", userId)
  if (usageError) throw new Error("stage3_legacy_usage_read_failed")

  const usageRows = coerceLegacyUsageRows(usage)
  const catalogMatches = await loadLegacyCatalogMatches(client, userId, usageRows)
  return {
    profile: {},
    usageRows: usageRows.map((row) => ({
      id: row.id,
      category: row.category,
      productName: row.productName,
      frequencyRange: row.frequencyRange,
      catalogMatch: row.productId ? (catalogMatches.get(row.productId) ?? null) : null,
    })),
  }
}

async function loadLegacyCatalogMatches(
  client: AdminClient,
  userId: string,
  usageRows: Array<LegacyProductUsageRow & { productId?: string | null }>,
): Promise<Map<string, LegacyCatalogMatch>> {
  const ids = Array.from(
    new Set(usageRows.flatMap((row) => (row.productId ? [row.productId] : []))),
  )
  if (ids.length === 0) return new Map()
  const { data, error } = await client
    .from("products")
    .select(
      "id,category_key,brand,name,image_url,thumbnail_image_url,origin,is_active,lifecycle_status,product_line:product_lines(canonical_name)",
    )
    .in("id", ids)
  if (error) throw new Error("stage3_legacy_catalog_read_failed")
  const [ownedMatches, excludedCatalogIds] = await Promise.all([
    loadExistingOwnedCatalogIdentitySet(client, userId, ids),
    loadExcludedCatalogProductSet(client, ids),
  ])
  const rows = Array.isArray(data) ? data : []
  const matches = new Map<string, LegacyCatalogMatch>()
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const id = fieldString(record, "id")
    const category = fieldString(record, "category_key")
    if (!id || !category) continue
    matches.set(id, {
      productId: id,
      category,
      displayName: canonicalCatalogCompleteIdentity(
        { name: record.name, brand: record.brand },
        readProductLineName(record.product_line),
      ),
      eligible:
        record.is_active === true &&
        record.lifecycle_status === "active" &&
        !excludedCatalogIds.has(id) &&
        (record.origin === "curated" || ownedMatches.has(`${category}:${id}`)),
    })
  }
  return matches
}

async function loadExcludedCatalogProductSet(
  client: AdminClient,
  productIds: string[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set()
  const { data, error } = await client
    .from("personal_plan_product_search_dispositions")
    .select("product_id")
    .in("product_id", productIds)
  if (error) throw new Error("stage3_legacy_disposition_read_failed")
  const rows = Array.isArray(data) ? data : []
  return new Set(
    rows.flatMap((row) => {
      const productId = fieldString(row, "product_id")
      return productId ? [productId] : []
    }),
  )
}

async function loadExistingOwnedCatalogIdentitySet(
  client: AdminClient,
  userId: string,
  productIds: string[],
): Promise<Set<string>> {
  const { data, error } = await client
    .from("user_products")
    .select("category,catalog_product_id")
    .eq("user_id", userId)
    .eq("identity_status", "matched")
    .eq("ownership_status", "owned")
    .in("catalog_product_id", productIds)
  if (error) throw new Error("stage3_legacy_owned_identity_read_failed")
  const rows = Array.isArray(data) ? data : []
  return new Set(
    rows.flatMap((row) => {
      if (!row || typeof row !== "object") return []
      const category = fieldString(row, "category")
      const productId = fieldString(row, "catalog_product_id")
      return category && productId ? [`${category}:${productId}`] : []
    }),
  )
}

function coerceLegacyUsageRows(
  value: unknown,
): Array<LegacyProductUsageRow & { productId?: string | null }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return []
    const record = row as Record<string, unknown>
    const id = fieldString(record, "id")
    const category = fieldString(record, "category")
    if (!id || !category) return []
    return [
      {
        id,
        category,
        productName: fieldString(record, "product_name"),
        frequencyRange: fieldString(record, "frequency_range"),
        productId: fieldString(record, "product_id"),
      },
    ]
  })
}

function fieldString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

function mapAssessmentSearchCandidate(
  raw: unknown,
  category: PersonalPlanCategory,
  query: string,
  thumbnailsEnabled: boolean,
) {
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
    ...(thumbnailsEnabled
      ? {
          thumbnailImageUrl:
            typeof row.thumbnail_image_url === "string" ? row.thumbnail_image_url : null,
        }
      : {}),
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
  const { legacyPrefillHints: rawLegacyPrefillHints, ...payloadWithoutLegacyPrefillHints } = payload
  const draft: Stage3ProductDraft = {
    ...payloadWithoutLegacyPrefillHints,
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
    productLoadResolution:
      payload.productLoadResolution as Stage3ProductDraft["productLoadResolution"],
  }
  const legacyPrefillHints = parseStage3LegacyPrefillHints(rawLegacyPrefillHints)
  return legacyPrefillHints ? { ...draft, legacyPrefillHints } : draft
}

function parseStage3LegacyPrefillHints(value: unknown): Stage3ProductDraft["legacyPrefillHints"] {
  if (value === undefined) return undefined
  const parsed = stage3LegacyPrefillHintsSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
