import type {
  ApplicationDayTypeKey,
  ApplicationGuidanceProtocolV1,
  NormalizedApplicationInput,
  NormalizedRoutineItem,
  NormalizedUnresolvedRoutineItem,
  PersonalPlanCategory,
  SemanticRole,
} from "./contracts"
import { normalizedApplicationInputSchema } from "./contracts"
import {
  CANONICAL_APPLICATION_DAY_RULES,
  isAlwaysRelevantRoleForDay,
  routineItemsForDay,
} from "./day-type-registry"
import { heatProtectionNote } from "./german-copy"
import { requiresExactProductGuidance, resolveApplicationGuidance } from "./guidance-resolver"

export type CompiledProductStep = {
  stepKey: string
  action: "apply_product" | "wait" | "rinse" | "dry" | "tool" | "section"
  copyDe: string
}
export type CompiledProductlessStep = {
  kind: "state_transition"
  fromAnchor: string
  toAnchor: string
  copyDe: string
}
export type CompiledProductBlock = {
  productId: string
  productName: string
  category: PersonalPlanCategory
  roles: SemanticRole[]
  applicationInstanceKey: string
  anchor: string
  steps: CompiledProductStep[]
  noteDe: string | null
  status: "confirmed" | "provisional"
  provisionalReason?: "product_selection" | "application_review" | null
  heatEventIds?: string[]
}
export type CompiledUnresolvedProductBlock = {
  productId: string | null
  productName: string | null
  category: PersonalPlanCategory
  role: SemanticRole
  applicationInstanceKey: string
  status: "unresolved"
}
export type CompiledApplicationDayV1 = {
  key: ApplicationDayTypeKey
  productBlocks: CompiledProductBlock[]
  outerSequence: Array<
    | { kind: "product"; block: CompiledProductBlock }
    | { kind: "unresolved_product"; block: CompiledUnresolvedProductBlock }
    | CompiledProductlessStep
  >
  isPartial?: boolean
}
export type CompiledApplicationViewV1 = {
  days: CompiledApplicationDayV1[]
  failures: Array<{ dayType: ApplicationDayTypeKey; reason: string }>
}

type ResolvedItem = { item: NormalizedRoutineItem; protocol: ApplicationGuidanceProtocolV1 }
type UnresolvedPosition = {
  itemId: string
  productId: string | null
  productName: string | null
  category: PersonalPlanCategory
  role: SemanticRole
  routineOrder?: number
  applicationInstanceKey: string
}
type ApplicationAnchor = ApplicationGuidanceProtocolV1["sequence"]["anchor"]
type ConditionerRelationship = NonNullable<
  ApplicationGuidanceProtocolV1["protocolFacts"]["conditionerRelationship"]
>

const anchorOrder = [
  "pre_wash",
  "wet_cleanse",
  "post_cleanse_rinse_off",
  "post_rinse_towel_dry",
  "timed_treatment",
  "damp_leave_on",
  "dry_pre_heat",
  "heat_tool",
  "dry_finish",
]

function sortResolved(
  items: ResolvedItem[],
  anchorRanks: Map<ApplicationAnchor, number>,
  conditionerRelationship: ConditionerRelationship,
) {
  return [...items].sort((left, right) => {
    const anchor =
      (anchorRanks.get(left.protocol.sequence.anchor) ?? Number.MAX_SAFE_INTEGER) -
      (anchorRanks.get(right.protocol.sequence.anchor) ?? Number.MAX_SAFE_INTEGER)
    if (anchor !== 0) return anchor
    const leftIsConditioner = left.item.role === "condition"
    const rightIsConditioner = right.item.role === "condition"
    if (leftIsConditioner !== rightIsConditioner) {
      if (conditionerRelationship === "conditioner_before") return leftIsConditioner ? -1 : 1
      if (conditionerRelationship === "conditioner_after") return leftIsConditioner ? 1 : -1
    }
    const before = left.item.productId.localeCompare(right.item.productId)
    return before || left.item.itemId.localeCompare(right.item.itemId)
  })
}

function transitionCopy(fromAnchor: string, toAnchor: string) {
  if (toAnchor === "wet_cleanse") return "Haare gründlich mit Wasser anfeuchten."
  if (toAnchor === "post_rinse_towel_dry") return "Sanft mit einem Handtuch ausdrücken."
  if (toAnchor === "damp_leave_on") return "Im handtuchtrockenen Haar weitermachen."
  if (toAnchor === "dry_pre_heat") return "Das Haar vollständig trocknen lassen."
  if (toAnchor === "heat_tool") return "Das Styling-Tool wie geplant verwenden."
  return `Danach mit dem nächsten Schritt fortfahren.`
}

type AnchorOrdering =
  | { status: "ordered"; ranks: Map<ApplicationAnchor, number> }
  | { status: "ordering_cycle" | "anchor_conflict" }

function hasEquivalentVisibleSteps(
  left: readonly CompiledProductStep[],
  right: ApplicationGuidanceProtocolV1["steps"],
) {
  return (
    left.length === right.length &&
    left.every(
      (step, index) =>
        step.stepKey === right[index]?.stepKey &&
        step.action === right[index]?.action &&
        step.copyDe === right[index]?.copyTemplateDe,
    )
  )
}

function orderAnchors(
  items: readonly ResolvedItem[],
  conditionerRelationship: ConditionerRelationship,
): AnchorOrdering {
  const anchors = new Set<ApplicationAnchor>(items.map(({ protocol }) => protocol.sequence.anchor))
  const edges = new Map<ApplicationAnchor, ApplicationAnchor[]>()
  const indegree = new Map([...anchors].map((anchor) => [anchor, 0]))
  for (const { protocol } of items) {
    const anchor = protocol.sequence.anchor
    if (protocol.sequence.conflictsWith.some((conflict) => anchors.has(conflict))) {
      return { status: "anchor_conflict" }
    }
    for (const target of protocol.sequence.before) {
      if (anchors.has(target)) edges.set(anchor, [...(edges.get(anchor) ?? []), target])
    }
    for (const source of protocol.sequence.after) {
      if (anchors.has(source)) edges.set(source, [...(edges.get(source) ?? []), anchor])
    }
  }
  const treatmentAnchors = items
    .filter(
      ({ item, protocol }) =>
        item.role !== "condition" &&
        protocol.protocolFacts.conditionerRelationship === conditionerRelationship,
    )
    .map(({ protocol }) => protocol.sequence.anchor)
  const conditionerAnchors = items
    .filter(({ item }) => item.role === "condition")
    .map(({ protocol }) => protocol.sequence.anchor)
  if (
    conditionerRelationship === "conditioner_before" ||
    conditionerRelationship === "conditioner_after"
  ) {
    for (const treatmentAnchor of treatmentAnchors) {
      for (const conditionerAnchor of conditionerAnchors) {
        if (treatmentAnchor === conditionerAnchor) continue
        const source =
          conditionerRelationship === "conditioner_before" ? conditionerAnchor : treatmentAnchor
        const target =
          conditionerRelationship === "conditioner_before" ? treatmentAnchor : conditionerAnchor
        edges.set(source, [...(edges.get(source) ?? []), target])
      }
    }
  }
  for (const targets of edges.values()) {
    for (const target of new Set(targets)) indegree.set(target, (indegree.get(target) ?? 0) + 1)
  }
  const canonicalRank = (anchor: ApplicationAnchor) => anchorOrder.indexOf(anchor)
  const ready = [...anchors]
    .filter((anchor) => indegree.get(anchor) === 0)
    .sort((left, right) => canonicalRank(left) - canonicalRank(right))
  const ordered: ApplicationAnchor[] = []
  while (ready.length > 0) {
    const anchor = ready.shift() as ApplicationAnchor
    ordered.push(anchor)
    for (const target of new Set(edges.get(anchor) ?? [])) {
      indegree.set(target, (indegree.get(target) ?? 0) - 1)
      if (indegree.get(target) === 0) {
        ready.push(target)
        ready.sort((left, right) => canonicalRank(left) - canonicalRank(right))
      }
    }
  }
  if (ordered.length !== anchors.size) return { status: "ordering_cycle" }
  return { status: "ordered", ranks: new Map(ordered.map((anchor, index) => [anchor, index])) }
}

function compileDay(
  key: ApplicationDayTypeKey,
  items: readonly NormalizedRoutineItem[],
  unresolvedRoutineItems: readonly NormalizedUnresolvedRoutineItem[],
  profile: NormalizedApplicationInput["profile"],
  protocols: readonly ApplicationGuidanceProtocolV1[],
):
  | CompiledApplicationDayV1
  | "ordering_cycle"
  | "anchor_conflict"
  | "conditioner_relationship_conflict"
  | "product_guidance_conflict"
  | "incomplete_guidance"
  | null {
  if (key === "rest_day") return { key, productBlocks: [], outerSequence: [], isPartial: false }
  let resolved: ResolvedItem[] = []
  let unresolvedRelevantItems: UnresolvedPosition[] = unresolvedRoutineItems
    .filter(
      (item) =>
        CANONICAL_APPLICATION_DAY_RULES[key].acceptedRoles.includes(item.role) &&
        isAlwaysRelevantRoleForDay(key, item.role),
    )
    .map((item) => ({ ...item, productId: null, productName: null }))
  for (const item of routineItemsForDay(key, items)) {
    const hasCompatibleProtocol = protocols.some(
      (protocol) =>
        protocol.compatibleDayTypes.includes(key) &&
        (protocol.role === null || protocol.role === item.role) &&
        protocol.scope.category === item.category &&
        (protocol.scope.kind === "application_family" ||
          protocol.scope.productId === item.productId),
    )
    if (
      !hasCompatibleProtocol &&
      !isAlwaysRelevantRoleForDay(key, item.role) &&
      !requiresExactProductGuidance(item, key)
    )
      continue

    const result = resolveApplicationGuidance({
      item,
      dayType: key,
      profile,
      protocols: [...protocols],
    })
    if (result.status === "unresolved") {
      unresolvedRelevantItems.push({
        itemId: item.itemId,
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        role: item.role,
        routineOrder: item.routineOrder,
        applicationInstanceKey:
          item.applicationInstanceKey ?? `${item.productId}:unresolved:${item.itemId}`,
      })
      continue
    }
    resolved.push({ item, protocol: result.protocol })
  }
  const relationships = new Set(
    resolved
      .map(({ protocol }) => protocol.protocolFacts.conditionerRelationship)
      .filter(
        (relationship): relationship is ConditionerRelationship =>
          relationship !== null && relationship !== "not_applicable",
      ),
  )
  if (relationships.size > 1) return "conditioner_relationship_conflict"
  const conditionerRelationship = relationships.values().next().value ?? "not_applicable"
  const conditionerIsSuppressed =
    conditionerRelationship === "no_conditioner" ||
    conditionerRelationship === "replaces_conditioner"
  if (conditionerIsSuppressed) {
    resolved = resolved.filter(({ item }) => item.role !== "condition")
    unresolvedRelevantItems = unresolvedRelevantItems.filter((item) => item.role !== "condition")
  }
  if (
    (conditionerRelationship === "conditioner_before" ||
      conditionerRelationship === "conditioner_after") &&
    !resolved.some(({ item }) => item.role === "condition") &&
    !unresolvedRelevantItems.some((item) => item.role === "condition")
  ) {
    return "incomplete_guidance"
  }
  const requiredRoles = CANONICAL_APPLICATION_DAY_RULES[key].requiredRoles
  const relevantItems = [...resolved.map(({ item }) => item), ...unresolvedRelevantItems]
  if (!requiredRoles.some((role) => relevantItems.some((item) => item.role === role))) return null
  if (
    key === "intensive_care_day" &&
    !["cleanse", "intensive_care"].every((role) => relevantItems.some((item) => item.role === role))
  )
    return null
  if (resolved.length === 0) {
    return unresolvedRelevantItems.length > 0 ? "incomplete_guidance" : null
  }
  const anchorOrdering = orderAnchors(resolved, conditionerRelationship)
  if (anchorOrdering.status !== "ordered") return anchorOrdering.status
  const blocks = new Map<
    string,
    CompiledProductBlock & {
      guidanceKey: string
      scopeKind: "application_family" | "product"
      routineOrder?: number
    }
  >()
  for (const { item, protocol } of sortResolved(
    resolved,
    anchorOrdering.ranks,
    conditionerRelationship,
  )) {
    // Stage 4 assignment keys are role-specific. Merge one physical application
    // only when the product shares an anchor; separate heat events stay separate.
    const instanceKey =
      protocol.protocolFacts.reapplication === "each_separate_heat_event"
        ? (item.applicationInstanceKey ??
          `${item.productId}:${protocol.sequence.anchor}:${item.itemId}`)
        : `${item.productId}:${protocol.sequence.anchor}`
    const existing = blocks.get(instanceKey)
    if (existing) {
      const exact = protocol.scope.kind === "product"
      const existingExact = existing.scopeKind === "product"
      if (
        existing.guidanceKey !== protocol.guidanceKey &&
        existingExact === exact &&
        !hasEquivalentVisibleSteps(existing.steps, protocol.steps)
      ) {
        return "product_guidance_conflict"
      }
      if (exact && !existingExact) {
        existing.steps = protocol.steps.map((step) => ({
          stepKey: step.stepKey,
          action: step.action,
          copyDe: step.copyTemplateDe,
        }))
        existing.guidanceKey = protocol.guidanceKey
        existing.scopeKind = "product"
      }
      if (!existing.roles.includes(item.role)) existing.roles.push(item.role)
      if (item.heatEventId && !existing.heatEventIds?.includes(item.heatEventId)) {
        existing.heatEventIds = [...(existing.heatEventIds ?? []), item.heatEventId]
      }
      if (item.availability === "planned" || !item.executable) existing.status = "provisional"
      if (item.availability === "planned") existing.provisionalReason = "product_selection"
      else if (!item.executable && existing.provisionalReason !== "product_selection")
        existing.provisionalReason = "application_review"
      if (
        item.routineOrder !== undefined &&
        (existing.routineOrder === undefined || item.routineOrder < existing.routineOrder)
      ) {
        existing.routineOrder = item.routineOrder
      }
      continue
    }
    blocks.set(instanceKey, {
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      roles: [item.role],
      applicationInstanceKey: instanceKey,
      anchor: protocol.sequence.anchor,
      steps: protocol.steps.map((step) => ({
        stepKey: step.stepKey,
        action: step.action,
        copyDe: step.copyTemplateDe,
      })),
      noteDe: null,
      status: item.availability === "planned" || !item.executable ? "provisional" : "confirmed",
      provisionalReason:
        item.availability === "planned"
          ? "product_selection"
          : !item.executable
            ? "application_review"
            : null,
      heatEventIds: item.heatEventId ? [item.heatEventId] : [],
      guidanceKey: protocol.guidanceKey,
      scopeKind: protocol.scope.kind,
      routineOrder: item.routineOrder,
    })
  }
  const internalProductBlocks = [...blocks.values()]
  const publicProductBlock = (
    block: (typeof internalProductBlocks)[number],
  ): CompiledProductBlock => ({
    productId: block.productId,
    productName: block.productName,
    category: block.category,
    roles: [...block.roles].sort(),
    applicationInstanceKey: block.applicationInstanceKey,
    anchor: block.anchor,
    steps: block.steps,
    noteDe:
      block.roles.includes("leave_in") && block.roles.includes("heat_protection")
        ? heatProtectionNote()
        : null,
    status: block.status,
    provisionalReason: block.provisionalReason,
    heatEventIds: block.heatEventIds,
  })
  const productBlocks = internalProductBlocks.map(publicProductBlock)
  if (productBlocks.length === 0) return null
  const unresolvedBlocks = unresolvedRelevantItems.map((item) => ({
    block: {
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      role: item.role,
      applicationInstanceKey: item.applicationInstanceKey,
      status: "unresolved" as const,
    },
    routineOrder: item.routineOrder,
  }))
  const sequenceEntries = [
    ...internalProductBlocks.map((block, index) => ({
      kind: "product" as const,
      block: publicProductBlock(block),
      routineOrder: block.routineOrder,
      fallbackOrder: index,
    })),
    ...unresolvedBlocks.map(({ block, routineOrder }, index) => ({
      kind: "unresolved_product" as const,
      block,
      routineOrder,
      fallbackOrder: internalProductBlocks.length + index,
    })),
  ]
  if (sequenceEntries.every(({ routineOrder }) => routineOrder !== undefined)) {
    sequenceEntries.sort(
      (left, right) =>
        (left.routineOrder as number) - (right.routineOrder as number) ||
        left.fallbackOrder - right.fallbackOrder,
    )
  }
  let previousAnchor: string | null = null
  const outerSequence: CompiledApplicationDayV1["outerSequence"] = []
  for (const entry of sequenceEntries) {
    if (entry.kind === "unresolved_product") {
      outerSequence.push({ kind: "unresolved_product", block: entry.block })
      previousAnchor = null
      continue
    }
    const block = entry.block
    if (previousAnchor === null && block.anchor === "wet_cleanse") {
      outerSequence.push({
        kind: "state_transition",
        fromAnchor: "dry",
        toAnchor: "wet_cleanse",
        copyDe: "Haare gründlich mit Wasser anfeuchten.",
      })
    }
    if (previousAnchor !== null && previousAnchor !== block.anchor) {
      outerSequence.push({
        kind: "state_transition",
        fromAnchor: previousAnchor,
        toAnchor: block.anchor,
        copyDe: transitionCopy(previousAnchor, block.anchor),
      })
    }
    outerSequence.push({ kind: "product", block })
    previousAnchor = block.anchor
  }
  return {
    key,
    productBlocks,
    outerSequence,
    isPartial:
      unresolvedBlocks.length > 0 || productBlocks.some((block) => block.status === "provisional"),
  }
}

function materializeHeatOccurrences(
  items: readonly NormalizedRoutineItem[],
  profile: NormalizedApplicationInput["profile"],
): NormalizedRoutineItem[] {
  return items.flatMap((item) => {
    if (item.role !== "heat_protection") return [item]
    const events = profile.heatEvents
    const applicationState = item.catalogFacts.applicationState
    const reapplication = item.catalogFacts.reapplication
    if (
      !events ||
      events.length === 0 ||
      !["damp", "dry", "either"].includes(String(applicationState)) ||
      !["required", "optional", "not_stated"].includes(String(reapplication))
    ) {
      return [item]
    }
    const compatibleEvents = events.filter((event) => {
      if (applicationState === "damp") return event.route === "airflow_shaping"
      if (applicationState === "dry") return event.route === "direct_contact_heat"
      return true
    })
    if (compatibleEvents.length === 0) return [item]
    const selectedEvents =
      reapplication === "required"
        ? compatibleEvents
        : [
            compatibleEvents.find((event) => event.route === "direct_contact_heat") ??
              compatibleEvents[0]!,
          ]
    return selectedEvents.map((event) => {
      const family =
        applicationState === "damp"
          ? "damp_hair_protection"
          : applicationState === "dry"
            ? "dry_hair_protection"
            : event.route === "direct_contact_heat"
              ? "dry_hair_protection"
              : "damp_hair_protection"
      return {
        ...item,
        applicationInstanceKey: `${item.applicationInstanceKey ?? item.itemId}:${event.id}`,
        heatEventId: event.id,
        catalogFacts: {
          ...item.catalogFacts,
          heatEventRoute: event.route,
          heatEventTool: event.tool,
          formatResolution: { status: "resolved", applicationFamily: family },
        },
      }
    })
  })
}

export function compileApplicationView({
  input,
  protocols,
}: {
  input: NormalizedApplicationInput
  protocols: readonly ApplicationGuidanceProtocolV1[]
}): CompiledApplicationViewV1 {
  const parsed = normalizedApplicationInputSchema.parse(input)
  const routineItems = materializeHeatOccurrences(parsed.routineItems, parsed.profile)
  const days: CompiledApplicationDayV1[] = []
  const failures: CompiledApplicationViewV1["failures"] = []
  for (const definition of [...parsed.dayTypes].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  )) {
    const compiled = compileDay(
      definition.key,
      routineItems,
      parsed.unresolvedRoutineItems,
      parsed.profile,
      protocols,
    )
    if (compiled && typeof compiled !== "string") days.push(compiled)
    else if (definition.key !== "rest_day")
      failures.push({ dayType: definition.key, reason: compiled ?? "incomplete_day" })
  }
  if (!days.some((day) => day.key === "rest_day"))
    days.push({ key: "rest_day", productBlocks: [], outerSequence: [], isPartial: false })
  return { days, failures }
}
