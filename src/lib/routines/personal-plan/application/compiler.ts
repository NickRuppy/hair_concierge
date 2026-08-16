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
  imageUrl?: string | null
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
  reason?: NormalizedUnresolvedRoutineItem["reason"]
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
  reason?: NormalizedUnresolvedRoutineItem["reason"]
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

function productBlockIncludesAnchorPreparation(block: CompiledProductBlock) {
  if (block.anchor === "wet_cleanse") {
    return block.steps.some(({ stepKey, action }) => stepKey === "wet" && action === "section")
  }
  if (block.anchor === "damp_leave_on") {
    return block.steps.some(
      ({ stepKey, action }) => stepKey === "towel-dry" && action === "section",
    )
  }
  return false
}

type AnchorOrdering =
  | { status: "ordered"; ranks: Map<ApplicationAnchor, number> }
  | {
      status: "ordering_cycle" | "anchor_conflict"
      involvedAnchors: Set<ApplicationAnchor>
    }

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

function dryBetweenWashSteps(
  block: {
    steps: CompiledProductStep[]
    sourceItems: NormalizedRoutineItem[]
  },
  profile: NormalizedApplicationInput["profile"],
): CompiledProductStep[] {
  const format = block.sourceItems
    .map((item) => item.catalogFacts.format)
    .find((value): value is string => typeof value === "string")
  const oilWeight = block.sourceItems
    .map((item) => item.catalogFacts.weight)
    .find((value): value is string => typeof value === "string")
  const isOil = block.sourceItems.some((item) => item.category === "oil")
  const dryArea = block.sourceItems.some(
    (item) => item.catalogFacts.applicationArea === "hair_ends",
  )
    ? "trockene Spitzen"
    : "trockene Längen und Spitzen"
  const easilyWeighedDown = profile.thickness === "fine" || profile.density === "low"
  const copyDe = isOil
    ? `Mit 1 Tropfen oder einer sehr kleinen Menge beginnen, vollständig zwischen den Handflächen verteilen und nur in ${dryArea} streichen.${easilyWeighedDown || oilWeight === "rich" ? ` Bei ${easilyWeighedDown ? "feinem oder wenig dichtem Haar" : "einem reichhaltigen Öl"}${easilyWeighedDown && oilWeight === "rich" ? " beziehungsweise einem reichhaltigen Öl" : ""} besonders sparsam dosieren.` : " Nur bei Bedarf ergänzen."}`
    : format === "cream"
      ? `Eine sehr kleine Menge vollständig zwischen den Handflächen verreiben und nur in ${dryArea} drücken.${easilyWeighedDown ? " Bei feinem oder wenig dichtem Haar besonders sparsam dosieren." : " Nur bei Bedarf ergänzen."}`
      : format === "spray"
        ? easilyWeighedDown
          ? `Eine sehr kleine Menge zuerst in die Hände sprühen und gezielt über ${dryArea} streichen. Besonders sparsam dosieren.`
          : `Sparsam über ${dryArea} sprühen und mit den Händen gleichmäßig verteilen. Nur bei Bedarf ergänzen.`
        : format === "milk" || format === "lotion"
          ? `Eine sehr kleine Menge in den Händen verteilen und gezielt in ${dryArea} einarbeiten. Nur bei Bedarf ergänzen.`
          : format === "serum"
            ? `Eine sehr kleine Menge in den Händen verteilen und gezielt über ${dryArea} streichen. Nur bei Bedarf ergänzen.`
            : `Mit einer sehr kleinen Menge in ${dryArea} beginnen und nur bei Bedarf ergänzen.`
  let adapted = false
  return block.steps.map((step) => {
    if (adapted || step.action !== "apply_product") return step
    adapted = true
    return { ...step, copyDe }
  })
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
    const activeConflicts = protocol.sequence.conflictsWith.filter((conflict) =>
      anchors.has(conflict),
    )
    if (activeConflicts.length > 0) {
      return {
        status: "anchor_conflict",
        involvedAnchors: new Set([anchor, ...activeConflicts]),
      }
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
  if (ordered.length !== anchors.size)
    return {
      status: "ordering_cycle",
      involvedAnchors: new Set([...anchors].filter((anchor) => !ordered.includes(anchor))),
    }
  return { status: "ordered", ranks: new Map(ordered.map((anchor, index) => [anchor, index])) }
}

function unresolvedPosition(item: NormalizedRoutineItem): UnresolvedPosition {
  return {
    itemId: item.itemId,
    productId: item.productId,
    productName: item.productName,
    category: item.category,
    role: item.role,
    routineOrder: item.routineOrder,
    applicationInstanceKey:
      item.applicationInstanceKey ?? `${item.productId}:unresolved:${item.itemId}`,
  }
}

function addUnresolvedPosition(positions: UnresolvedPosition[], item: NormalizedRoutineItem): void {
  const unresolved = unresolvedPosition(item)
  if (
    !positions.some(
      (existing) =>
        existing.productId === unresolved.productId &&
        existing.applicationInstanceKey === unresolved.applicationInstanceKey,
    )
  ) {
    positions.push(unresolved)
  }
}

function unresolvedOnlyDay(
  key: ApplicationDayTypeKey,
  positions: readonly UnresolvedPosition[],
): CompiledApplicationDayV1 {
  const outerSequence = [...positions]
    .sort(
      (left, right) =>
        (left.routineOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.routineOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.applicationInstanceKey.localeCompare(right.applicationInstanceKey),
    )
    .map((item) => ({
      kind: "unresolved_product" as const,
      block: {
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        role: item.role,
        applicationInstanceKey: item.applicationInstanceKey,
        status: "unresolved" as const,
        reason: item.reason,
      },
    }))
  return { key, productBlocks: [], outerSequence, isPartial: true }
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
    const supportedApplicationDayTypes = item.catalogFacts.supportedApplicationDayTypes
    if (
      Array.isArray(supportedApplicationDayTypes) &&
      !supportedApplicationDayTypes.includes(key)
    ) {
      continue
    }
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
      addUnresolvedPosition(unresolvedRelevantItems, item)
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
  if (relationships.size > 1) {
    const conflicting = resolved.filter(({ protocol }) => {
      const relationship = protocol.protocolFacts.conditionerRelationship
      return relationship !== null && relationship !== "not_applicable"
    })
    for (const { item } of conflicting) addUnresolvedPosition(unresolvedRelevantItems, item)
    const conflictedItemIds = new Set(conflicting.map(({ item }) => item.itemId))
    resolved = resolved.filter(({ item }) => !conflictedItemIds.has(item.itemId))
  }
  let conditionerRelationship =
    relationships.size > 1
      ? ("not_applicable" as const)
      : (relationships.values().next().value ?? "not_applicable")
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
    const imposing = resolved.filter(
      ({ protocol }) =>
        protocol.protocolFacts.conditionerRelationship === "conditioner_before" ||
        protocol.protocolFacts.conditionerRelationship === "conditioner_after",
    )
    for (const { item } of imposing) addUnresolvedPosition(unresolvedRelevantItems, item)
    const imposingIds = new Set(imposing.map(({ item }) => item.itemId))
    resolved = resolved.filter(({ item }) => !imposingIds.has(item.itemId))
    conditionerRelationship = "not_applicable"
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
    return unresolvedRelevantItems.length > 0
      ? unresolvedOnlyDay(key, unresolvedRelevantItems)
      : null
  }
  let anchorOrdering = orderAnchors(resolved, conditionerRelationship)
  while (anchorOrdering.status !== "ordered") {
    const involvedAnchors = anchorOrdering.involvedAnchors
    const isolated = resolved.filter(({ protocol }) =>
      involvedAnchors.has(protocol.sequence.anchor),
    )
    if (isolated.length === 0) return anchorOrdering.status
    for (const { item } of isolated) addUnresolvedPosition(unresolvedRelevantItems, item)
    const isolatedIds = new Set(isolated.map(({ item }) => item.itemId))
    resolved = resolved.filter(({ item }) => !isolatedIds.has(item.itemId))
    if (resolved.length === 0) return unresolvedOnlyDay(key, unresolvedRelevantItems)
    anchorOrdering = orderAnchors(resolved, conditionerRelationship)
  }
  const blocks = new Map<
    string,
    CompiledProductBlock & {
      guidanceKey: string
      scopeKind: "application_family" | "product"
      routineOrder?: number
      sourceItems: NormalizedRoutineItem[]
      applicationFamilies: string[]
    }
  >()
  const conflictedInstanceKeys = new Set<string>()
  for (const { item, protocol } of sortResolved(
    resolved,
    anchorOrdering.ranks,
    conditionerRelationship,
  )) {
    // Stage 4 assignment keys are role-specific. Merge one physical application
    // only when the product shares an anchor; separate heat events stay separate.
    const baseInstanceKey =
      protocol.protocolFacts.reapplication === "each_separate_heat_event"
        ? (item.applicationInstanceKey ??
          `${item.productId}:${protocol.sequence.anchor}:${item.itemId}`)
        : `${item.productId}:${protocol.sequence.anchor}`
    const existingAtBase = blocks.get(baseInstanceKey)
    const distinctRoleAtSharedAnchor =
      existingAtBase !== undefined &&
      !existingAtBase.roles.includes(item.role) &&
      existingAtBase.guidanceKey !== protocol.guidanceKey &&
      !hasEquivalentVisibleSteps(existingAtBase.steps, protocol.steps)
    const instanceKey = distinctRoleAtSharedAnchor
      ? `${baseInstanceKey}:${item.role}`
      : baseInstanceKey
    if (conflictedInstanceKeys.has(instanceKey)) {
      addUnresolvedPosition(unresolvedRelevantItems, item)
      continue
    }
    const existing = blocks.get(instanceKey)
    if (existing) {
      const exact = protocol.scope.kind === "product"
      const existingExact = existing.scopeKind === "product"
      if (
        existing.guidanceKey !== protocol.guidanceKey &&
        existingExact === exact &&
        !hasEquivalentVisibleSteps(existing.steps, protocol.steps)
      ) {
        for (const sourceItem of existing.sourceItems)
          addUnresolvedPosition(unresolvedRelevantItems, sourceItem)
        addUnresolvedPosition(unresolvedRelevantItems, item)
        blocks.delete(instanceKey)
        conflictedInstanceKeys.add(instanceKey)
        continue
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
      if (!existing.applicationFamilies.includes(protocol.applicationFamily)) {
        existing.applicationFamilies.push(protocol.applicationFamily)
      }
      existing.sourceItems.push(item)
      if (item.heatEventId && !existing.heatEventIds?.includes(item.heatEventId)) {
        existing.heatEventIds = [...(existing.heatEventIds ?? []), item.heatEventId]
      }
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
      imageUrl: item.imageUrl ?? null,
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
      // A selected catalog product is instantly a full routine member: product
      // blocks always compile confirmed, regardless of purchase/executable state.
      status: "confirmed",
      provisionalReason: null,
      heatEventIds: item.heatEventId ? [item.heatEventId] : [],
      guidanceKey: protocol.guidanceKey,
      scopeKind: protocol.scope.kind,
      routineOrder: item.routineOrder,
      sourceItems: [item],
      applicationFamilies: [protocol.applicationFamily],
    })
  }
  let internalProductBlocks = [...blocks.values()]
  if (key === "refresh_day" || key === "between_wash_care_day") {
    const betweenWashFamilies = new Set(["between_wash_dry_care", "between_wash_damp_refresh"])
    const grouped = new Map<string, typeof internalProductBlocks>()
    for (const block of internalProductBlocks) {
      if (
        block.applicationFamilies.length === 1 &&
        betweenWashFamilies.has(block.applicationFamilies[0]!)
      ) {
        grouped.set(block.productId, [...(grouped.get(block.productId) ?? []), block])
      }
    }
    const consumed = new Set<string>()
    const replacements = new Map<string, (typeof internalProductBlocks)[number]>()
    for (const candidates of grouped.values()) {
      const families = new Set(candidates.flatMap((candidate) => candidate.applicationFamilies))
      if (
        candidates.length !== 2 ||
        !families.has("between_wash_dry_care") ||
        !families.has("between_wash_damp_refresh")
      ) {
        continue
      }
      const dry = candidates.find((candidate) =>
        candidate.applicationFamilies.includes("between_wash_dry_care"),
      )!
      const damp = candidates.find((candidate) =>
        candidate.applicationFamilies.includes("between_wash_damp_refresh"),
      )!
      const primary = dry.category === "oil" ? dry : damp
      consumed.add(dry.applicationInstanceKey)
      consumed.add(damp.applicationInstanceKey)
      replacements.set(primary.applicationInstanceKey, {
        ...primary,
        applicationInstanceKey: `${primary.productId}:between-wash-methods`,
        steps:
          dry.category === "oil"
            ? [
                {
                  stepKey: "method-dry",
                  action: "section",
                  copyDe: "Auf trockenem Haar (empfohlen)",
                },
                ...dryBetweenWashSteps(dry, profile),
                {
                  stepKey: "method-damp",
                  action: "section",
                  copyDe: "Nach leichtem Anfeuchten",
                },
                ...damp.steps,
              ]
            : [
                {
                  stepKey: "method-damp",
                  action: "section",
                  copyDe: "Nach dem Anfeuchten (empfohlen)",
                },
                ...damp.steps,
                { stepKey: "method-dry", action: "section", copyDe: "Auf trockenem Haar" },
                ...dryBetweenWashSteps(dry, profile),
              ],
        roles: [...new Set([...dry.roles, ...damp.roles])],
        sourceItems: [...dry.sourceItems, ...damp.sourceItems],
        applicationFamilies: ["between_wash_dry_care", "between_wash_damp_refresh"],
        routineOrder:
          dry.routineOrder === undefined
            ? damp.routineOrder
            : damp.routineOrder === undefined
              ? dry.routineOrder
              : Math.min(dry.routineOrder, damp.routineOrder),
      })
    }
    internalProductBlocks = internalProductBlocks.flatMap((block) => {
      const replacement = replacements.get(block.applicationInstanceKey)
      if (replacement) return [replacement]
      return consumed.has(block.applicationInstanceKey) ? [] : [block]
    })
  }
  const publicProductBlock = (
    block: (typeof internalProductBlocks)[number],
  ): CompiledProductBlock => ({
    productId: block.productId,
    productName: block.productName,
    imageUrl: block.imageUrl ?? null,
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
  if (productBlocks.length === 0)
    return unresolvedRelevantItems.length > 0
      ? unresolvedOnlyDay(key, unresolvedRelevantItems)
      : null
  const unresolvedBlocks = unresolvedRelevantItems.map((item) => ({
    block: {
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      role: item.role,
      applicationInstanceKey: item.applicationInstanceKey,
      status: "unresolved" as const,
      reason: item.reason,
    },
    routineOrder: item.routineOrder,
  }))
  const resolvedSequenceEntries = internalProductBlocks.map((block, index) => ({
    kind: "product" as const,
    block: publicProductBlock(block),
    routineOrder: block.routineOrder,
    fallbackOrder: index,
  }))
  const unresolvedSequenceEntries = unresolvedBlocks
    .map(({ block, routineOrder }, index) => ({
      kind: "unresolved_product" as const,
      block,
      routineOrder,
      fallbackOrder: internalProductBlocks.length + index,
    }))
    .sort(
      (left, right) =>
        (left.routineOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.routineOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.fallbackOrder - right.fallbackOrder,
    )
  const unresolvedByInsertionIndex = new Map<number, typeof unresolvedSequenceEntries>()
  for (const entry of unresolvedSequenceEntries) {
    const insertionIndex =
      entry.routineOrder === undefined
        ? resolvedSequenceEntries.length
        : internalProductBlocks.filter(
            (block) => block.routineOrder !== undefined && block.routineOrder < entry.routineOrder!,
          ).length
    unresolvedByInsertionIndex.set(insertionIndex, [
      ...(unresolvedByInsertionIndex.get(insertionIndex) ?? []),
      entry,
    ])
  }
  const sequenceEntries = resolvedSequenceEntries.flatMap((entry, index) => [
    ...(unresolvedByInsertionIndex.get(index) ?? []),
    entry,
  ])
  sequenceEntries.push(...(unresolvedByInsertionIndex.get(resolvedSequenceEntries.length) ?? []))
  let previousAnchor: string | null = null
  const outerSequence: CompiledApplicationDayV1["outerSequence"] = []
  for (const entry of sequenceEntries) {
    if (entry.kind === "unresolved_product") {
      outerSequence.push({ kind: "unresolved_product", block: entry.block })
      continue
    }
    const block = entry.block
    const includesAnchorPreparation = productBlockIncludesAnchorPreparation(block)
    if (previousAnchor === null && block.anchor === "wet_cleanse" && !includesAnchorPreparation) {
      outerSequence.push({
        kind: "state_transition",
        fromAnchor: "dry",
        toAnchor: "wet_cleanse",
        copyDe: "Haare gründlich mit Wasser anfeuchten.",
      })
    }
    if (previousAnchor !== null && previousAnchor !== block.anchor && !includesAnchorPreparation) {
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
    // Product blocks always compile confirmed now, so only genuinely unresolved
    // slots (no product chosen, or a demoted catalog identity) make a day partial.
    isPartial: unresolvedBlocks.length > 0,
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
