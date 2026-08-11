import type { SupabaseClient } from "@supabase/supabase-js"

import { buildStage3EntryContext } from "./stage2-entry-adapter"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import type { Stage3ProductDraft } from "./contracts"
import type { Stage3ProductionPersistence } from "./production-persistence-gateway"
import { searchOwnedProductCatalog, type CatalogProductRecord } from "./inventory-search"
import { createStage3Draft } from "./state-machine"
import { loadStage3AuthorityFactBundle } from "./authority/catalog-facts"
import { Stage3AuthoritySnapshotError } from "./authority/snapshot"

type AdminClient = SupabaseClient

/** Server-only adapter for the Stage-3 service primitives. */
export function createSupabaseStage3ProductionPersistence(
  client: AdminClient,
): Stage3ProductionPersistence {
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
    async search(input) {
      return searchOwnedProductCatalog({
        category: input.category,
        query: input.query,
        requestToken: input.requestToken,
        catalog: {
          async listActiveProducts(category) {
            const { data, error } = await client
              .from("products")
              .select(
                "id,brand,name,image_url,is_active,lifecycle_status,is_chaarlie_recommended,sort_order,category_key",
              )
              .eq("category_key", category)
            if (error) throw new Error("stage3_catalog_search_failed")
            return (data ?? []).map(
              (row) =>
                ({
                  id: String(row.id),
                  category,
                  brandName: typeof row.brand === "string" ? row.brand : null,
                  displayName: String(row.name),
                  imageUrl: typeof row.image_url === "string" ? row.image_url : null,
                  active: row.is_active === true,
                  lifecycleStatus:
                    typeof row.lifecycle_status === "string" ? row.lifecycle_status : null,
                  recommended:
                    typeof row.is_chaarlie_recommended === "boolean"
                      ? row.is_chaarlie_recommended
                      : null,
                  sortOrder: typeof row.sort_order === "number" ? row.sort_order : null,
                }) satisfies CatalogProductRecord,
            )
          },
        },
      })
    },
    async resolveOwnedCatalogProduct(input) {
      const { data: candidate, error: candidateError } = await client
        .from("products")
        .select("id,name,image_url,category_key,is_active,lifecycle_status")
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
      const { data, error } = await client.rpc("personal_plan_create_or_reuse_user_product", {
        p_user_id: input.userId,
        p_category: input.category,
        p_catalog_product_id: candidate.id,
      })
      if (error || !data || data.outcome !== "ready" || !data.userProduct) {
        throw new Error("stage3_owned_product_create_failed")
      }
      const owned = data.userProduct as Record<string, unknown>
      return {
        userProductId: String(owned.id),
        productId: String(owned.catalog_product_id),
        displayName: String(candidate.name),
        imageUrl: typeof candidate.image_url === "string" ? candidate.image_url : null,
        category: owned.category as never,
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
      return loadStage3AuthorityFactBundle(client, {
        draft: input.draft,
        subject: input.subject,
        heatRoutes: input.heatRoutes,
        context: input.context,
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
  }
}
