import {
  routinePayloadV1Schema,
  routineProposalDeltaV1Schema,
  type PersonalPlanRoutineView,
  type RoutinePayloadV1,
  type RoutineProductPresentation,
} from "./contracts"
import {
  loadActiveRoutineCatalogProductPresentation,
  loadVerifiedLeaveOnOilHeatProtectionProductIds,
  loadOwnerRefinedNeedSnapshot,
  loadOwnerPendingRoutineProposal,
  loadOwnerRoutinePlan,
  loadOwnerRoutineVersion,
  type PersonalPlanRoutineReadClient,
  type RefinedNeedSnapshotRow,
} from "./repository"
import {
  asToolViewNeedSnapshot,
  buildToolView,
  type ToolFactsSource,
  type ToolRoutineSection,
} from "../tools/read-view"

type RefinedSnapshotLoader = (
  planId: string,
  refinedVersionId: string,
) => Promise<RefinedNeedSnapshotRow | null>

function exactCatalogProductIds(payloads: readonly (RoutinePayloadV1 | null)[]): string[] {
  const ids = new Set<string>()
  for (const payload of payloads) {
    for (const item of payload?.items ?? []) {
      if (item.product.kind === "owned" || item.product.kind === "planned") {
        if (item.product.productId) ids.add(item.product.productId)
      }
    }
  }
  return [...ids]
}

function uniqueCategoryOrder(payload: RoutinePayloadV1): string[] | null {
  const categories = payload.intent.categories.map((category) => category.category)
  return new Set(categories).size === categories.length ? categories : null
}

function renderedOrder(snapshot: unknown): string[] | null {
  if (!snapshot || typeof snapshot !== "object") return null
  const value = (snapshot as { renderedOrder?: unknown }).renderedOrder
  if (!Array.isArray(value) || !value.every((category) => typeof category === "string")) return null
  return new Set(value).size === value.length ? value : null
}

async function hasMatchingSourceCategoryOrder(input: {
  client: PersonalPlanRoutineReadClient
  userId: string
  planId: string
  payloads: readonly RoutinePayloadV1[]
  loadRefined?: RefinedSnapshotLoader
}): Promise<boolean> {
  const byRefinedVersionId = new Map(
    input.payloads.map((payload) => [payload.source.refinedVersionId, payload]),
  )
  const checks = await Promise.all(
    [...byRefinedVersionId.entries()].map(async ([refinedVersionId, payload]) => {
      const source = input.loadRefined
        ? await input.loadRefined(input.planId, refinedVersionId)
        : await loadOwnerRefinedNeedSnapshot(
            input.client,
            input.userId,
            input.planId,
            refinedVersionId,
          )
      const expected = source ? renderedOrder(source.output_snapshot) : null
      const actual = uniqueCategoryOrder(payload)
      return Boolean(
        expected &&
        actual &&
        expected.length === actual.length &&
        expected.every((category, index) => category === actual[index]),
      )
    }),
  )
  return checks.every(Boolean)
}

async function loadProductPresentation(input: {
  client: PersonalPlanRoutineReadClient
  payloads: readonly (RoutinePayloadV1 | null)[]
}): Promise<RoutineProductPresentation> {
  const productIds = exactCatalogProductIds(input.payloads)
  if (productIds.length === 0) return { catalogProducts: [] }
  try {
    const rows = await loadActiveRoutineCatalogProductPresentation(input.client, productIds)
    const requested = new Set(productIds)
    const oilProductIds = rows
      .filter((row) => (row.category_key ?? row.category) === "oil")
      .map((row) => row.id)
    let verifiedLeaveOnHeatProtectionIds = new Set<string>()
    try {
      verifiedLeaveOnHeatProtectionIds = await loadVerifiedLeaveOnOilHeatProtectionProductIds(
        input.client,
        oilProductIds,
      )
    } catch {
      // Presentation enrichment must not make a frozen Routine unavailable.
      // If live capability facts cannot be proven, omit the confirmation.
    }
    return {
      catalogProducts: rows
        .filter((row) => requested.has(row.id))
        .map((row) => ({
          productId: row.id,
          displayName: typeof row.name === "string" && row.name.trim() ? row.name : null,
          imageUrl:
            typeof row.image_url === "string" && row.image_url.trim() ? row.image_url : null,
          verifiedLeaveOnHeatProtection: verifiedLeaveOnHeatProtectionIds.has(row.id),
        })),
    }
  } catch {
    return { catalogProducts: [] }
  }
}

export type RoutineViewToolsInput = {
  /** The member's facts (`loadToolFactsSource`). Passed only while the Tools rollout is on. */
  loadFacts: (userId: string) => Promise<ToolFactsSource>
}

export async function loadPersonalPlanRoutineView(input: {
  client: PersonalPlanRoutineReadClient
  userId: string
  enabled: boolean
  includePendingProposal?: boolean
  /**
   * Hair Tools rollout on: compose the read-time `toolSection` next to the routine payload.
   * Absent (off): no facts read, the view is exactly today's.
   */
  tools?: RoutineViewToolsInput
}): Promise<PersonalPlanRoutineView | { status: "no_personal_plan" }> {
  // The facts read does not depend on the plan, so it runs alongside the routine reads.
  const facts = input.tools
    ? input.tools.loadFacts(input.userId).catch(() => null)
    : Promise.resolve(null)
  // Tools on: one refined-snapshot read per version per request — the category-order check and
  // the tool section share it. Tools off: the reads stay exactly as they were.
  const refinedSnapshots = new Map<string, Promise<RefinedNeedSnapshotRow | null>>()
  const loadRefined: RefinedSnapshotLoader = (planId, refinedVersionId) => {
    if (!input.tools) {
      return loadOwnerRefinedNeedSnapshot(input.client, input.userId, planId, refinedVersionId)
    }
    const key = `${planId}:${refinedVersionId}`
    let pending = refinedSnapshots.get(key)
    if (!pending) {
      pending = loadOwnerRefinedNeedSnapshot(input.client, input.userId, planId, refinedVersionId)
      refinedSnapshots.set(key, pending)
    }
    return pending
  }
  const view = await loadRoutineView(input, loadRefined)
  if (!input.tools || view.status === "no_personal_plan") return view
  const toolSection = await composeRoutineToolSection(view, await facts, loadRefined)
  return toolSection ? { ...view, toolSection } : view
}

/**
 * The Routine's `Deine Tools`, derived from the member's current facts and the refined need
 * snapshot the shown routine was compiled from. The routine payload is read, never extended.
 * Any missing input or engine failure yields no section — the Routine itself is unaffected.
 */
async function composeRoutineToolSection(
  view: PersonalPlanRoutineView,
  facts: ToolFactsSource | null,
  loadRefined: RefinedSnapshotLoader,
): Promise<ToolRoutineSection | null> {
  const payload =
    view.status === "proposal" ? view.pendingProposal?.candidate : view.activeVersion?.payload
  if (!payload || !facts) return null
  try {
    const refined = await loadRefined(view.personalPlanId, payload.source.refinedVersionId)
    const needSnapshot = asToolViewNeedSnapshot(refined?.output_snapshot)
    if (!needSnapshot) return null
    return (
      buildToolView({
        careHabits: facts.careHabits,
        fieldProvenance: facts.fieldProvenance,
        needSnapshot,
        routine: payload,
        hasOptionalPage: false,
        toolsEnabled: true,
      })?.routineSection ?? null
    )
  } catch {
    return null
  }
}

async function loadRoutineView(
  input: {
    client: PersonalPlanRoutineReadClient
    userId: string
    enabled: boolean
    includePendingProposal?: boolean
  },
  loadRefined: RefinedSnapshotLoader,
): Promise<PersonalPlanRoutineView | { status: "no_personal_plan" }> {
  const plan = await loadOwnerRoutinePlan(input.client, input.userId)
  if (!plan) return { status: "no_personal_plan" }
  const shouldLoadProposal =
    input.enabled &&
    input.includePendingProposal !== false &&
    Boolean(plan.pending_routine_proposal_id)
  const [active, proposal] = await Promise.all([
    plan.active_routine_version_id
      ? loadOwnerRoutineVersion(input.client, input.userId, plan.id, plan.active_routine_version_id)
      : null,
    shouldLoadProposal
      ? loadOwnerPendingRoutineProposal(
          input.client,
          input.userId,
          plan.id,
          plan.pending_routine_proposal_id!,
        )
      : null,
  ])
  const activeVersion = active
    ? { id: active.id, payload: routinePayloadV1Schema.parse(active.payload) }
    : null
  const viewBase = async () => ({
    personalPlanId: plan.id,
    planRevision: plan.revision,
    sourceRevision: plan.source_revision,
    activeVersion,
    productPresentation: await loadProductPresentation({
      client: input.client,
      payloads: [activeVersion?.payload ?? null],
    }),
  })
  const incompleteView = () => ({
    personalPlanId: plan.id,
    planRevision: plan.revision,
    sourceRevision: plan.source_revision,
    status: "personal_plan_incomplete" as const,
    activeVersion: null,
    pendingProposal: null,
    productPresentation: { catalogProducts: [] },
  })
  const repairRequiredView = (routineVersion: { id: string; payload: RoutinePayloadV1 }) => ({
    personalPlanId: plan.id,
    planRevision: plan.revision,
    sourceRevision: plan.source_revision,
    status: "authority_repair_required" as const,
    activeVersion: null,
    pendingProposal: null,
    repair: {
      routineVersionId: routineVersion.id,
      refinedVersionId: routineVersion.payload.source.refinedVersionId,
      href: `/plan-start?repairRoutineVersionId=${encodeURIComponent(routineVersion.id)}`,
    },
    productPresentation: { catalogProducts: [] },
  })
  if (!input.enabled)
    return {
      ...(await viewBase()),
      status: activeVersion ? "active" : "stage4_not_available",
      pendingProposal: null,
    }
  const activeMatchesImmutableSource = activeVersion
    ? await hasMatchingSourceCategoryOrder({
        client: input.client,
        userId: input.userId,
        planId: plan.id,
        payloads: [activeVersion.payload],
        loadRefined,
      })
    : true
  if (activeVersion && !activeMatchesImmutableSource) {
    // A corrective successor is safe to review even though the frozen active
    // Routine is not. Prefer it over sending the user through repair again.
    if (proposal) {
      const candidate = await loadOwnerRoutineVersion(
        input.client,
        input.userId,
        plan.id,
        proposal.candidate_routine_version_id,
      )
      if (candidate) {
        const candidatePayload = routinePayloadV1Schema.parse(candidate.payload)
        if (
          await hasMatchingSourceCategoryOrder({
            client: input.client,
            userId: input.userId,
            planId: plan.id,
            payloads: [candidatePayload],
            loadRefined,
          })
        ) {
          return {
            status: "proposal",
            personalPlanId: plan.id,
            planRevision: plan.revision,
            sourceRevision: plan.source_revision,
            activeVersion,
            productPresentation: await loadProductPresentation({
              client: input.client,
              payloads: [activeVersion.payload, candidatePayload],
            }),
            pendingProposal: {
              id: proposal.id,
              candidateVersionId: proposal.candidate_routine_version_id,
              sourceRevision: proposal.source_revision,
              delta: routineProposalDeltaV1Schema.parse(proposal.delta),
              candidate: candidatePayload,
            },
          }
        }
      }
    }
    return repairRequiredView(activeVersion)
  }
  if (!shouldLoadProposal)
    return {
      ...(await viewBase()),
      status: activeVersion ? "active" : "personal_plan_incomplete",
      pendingProposal: null,
    }
  if (!proposal)
    return {
      ...(await viewBase()),
      status: activeVersion ? "active" : "personal_plan_incomplete",
      pendingProposal: null,
    }
  const candidate = await loadOwnerRoutineVersion(
    input.client,
    input.userId,
    plan.id,
    proposal.candidate_routine_version_id,
  )
  if (!candidate)
    return {
      ...(await viewBase()),
      status: activeVersion ? "active" : "personal_plan_incomplete",
      pendingProposal: null,
    }
  const candidatePayload = routinePayloadV1Schema.parse(candidate.payload)
  if (
    !(await hasMatchingSourceCategoryOrder({
      client: input.client,
      userId: input.userId,
      planId: plan.id,
      payloads: [candidatePayload],
      loadRefined,
    }))
  ) {
    return incompleteView()
  }
  const productPresentation = await loadProductPresentation({
    client: input.client,
    payloads: [activeVersion?.payload ?? null, candidatePayload],
  })
  return {
    status: activeVersion ? "active" : "proposal",
    personalPlanId: plan.id,
    planRevision: plan.revision,
    sourceRevision: plan.source_revision,
    activeVersion,
    productPresentation,
    pendingProposal: {
      id: proposal.id,
      candidateVersionId: proposal.candidate_routine_version_id,
      sourceRevision: proposal.source_revision,
      delta: routineProposalDeltaV1Schema.parse(proposal.delta),
      candidate: candidatePayload,
    },
  }
}

export async function loadPersonalPlanActiveRoutineVersion(input: {
  client: PersonalPlanRoutineReadClient
  userId: string
  planId: string
  activeRoutineVersionId: string
}): Promise<{ id: string; payload: ReturnType<typeof routinePayloadV1Schema.parse> } | null> {
  const active = await loadOwnerRoutineVersion(
    input.client,
    input.userId,
    input.planId,
    input.activeRoutineVersionId,
  )
  if (!active) return null
  const payload = routinePayloadV1Schema.parse(active.payload)
  const matchesImmutableSource = await hasMatchingSourceCategoryOrder({
    client: input.client,
    userId: input.userId,
    planId: input.planId,
    payloads: [payload],
  })
  return matchesImmutableSource ? { id: active.id, payload } : null
}
