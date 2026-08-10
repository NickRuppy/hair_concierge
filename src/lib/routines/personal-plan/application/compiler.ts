import type {
  ApplicationDayTypeKey,
  ApplicationGuidanceProtocolV1,
  NormalizedApplicationInput,
  NormalizedRoutineItem,
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
}
export type CompiledApplicationDayV1 = {
  key: ApplicationDayTypeKey
  productBlocks: CompiledProductBlock[]
  outerSequence: Array<{ kind: "product"; block: CompiledProductBlock } | CompiledProductlessStep>
}
export type CompiledApplicationViewV1 = {
  days: CompiledApplicationDayV1[]
  failures: Array<{ dayType: ApplicationDayTypeKey; reason: string }>
}

type ResolvedItem = { item: NormalizedRoutineItem; protocol: ApplicationGuidanceProtocolV1 }
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
  if (key === "rest_day") return { key, productBlocks: [], outerSequence: [] }
  let resolved: ResolvedItem[] = []
  const unresolvedRelevantItems: NormalizedRoutineItem[] = []
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
      unresolvedRelevantItems.push(item)
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
  if (
    unresolvedRelevantItems.some((item) => !(conditionerIsSuppressed && item.role === "condition"))
  ) {
    return "incomplete_guidance"
  }
  if (conditionerIsSuppressed) {
    resolved = resolved.filter(({ item }) => item.role !== "condition")
  }
  if (
    (conditionerRelationship === "conditioner_before" ||
      conditionerRelationship === "conditioner_after") &&
    !resolved.some(({ item }) => item.role === "condition")
  ) {
    return "incomplete_guidance"
  }
  const requiredRoles = CANONICAL_APPLICATION_DAY_RULES[key].requiredRoles
  if (!requiredRoles.some((role) => resolved.some((entry) => entry.item.role === role))) return null
  if (
    key === "intensive_care_day" &&
    !["cleanse", "intensive_care"].every((role) =>
      resolved.some((entry) => entry.item.role === role),
    )
  )
    return null
  const anchorOrdering = orderAnchors(resolved, conditionerRelationship)
  if (anchorOrdering.status !== "ordered") return anchorOrdering.status
  const blocks = new Map<
    string,
    CompiledProductBlock & { guidanceKey: string; scopeKind: "application_family" | "product" }
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
      guidanceKey: protocol.guidanceKey,
      scopeKind: protocol.scope.kind,
    })
  }
  const productBlocks = [...blocks.values()].map((block) => ({
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
  }))
  if (productBlocks.length === 0) return null
  let previousAnchor: string | null = null
  const outerSequence: CompiledApplicationDayV1["outerSequence"] = []
  for (const block of productBlocks) {
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
  return { key, productBlocks, outerSequence }
}

export function compileApplicationView({
  input,
  protocols,
}: {
  input: NormalizedApplicationInput
  protocols: readonly ApplicationGuidanceProtocolV1[]
}): CompiledApplicationViewV1 {
  const parsed = normalizedApplicationInputSchema.parse(input)
  const days: CompiledApplicationDayV1[] = []
  const failures: CompiledApplicationViewV1["failures"] = []
  for (const definition of [...parsed.dayTypes].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  )) {
    const compiled = compileDay(definition.key, parsed.routineItems, parsed.profile, protocols)
    if (compiled && typeof compiled !== "string") days.push(compiled)
    else if (definition.key !== "rest_day")
      failures.push({ dayType: definition.key, reason: compiled ?? "incomplete_day" })
  }
  if (!days.some((day) => day.key === "rest_day"))
    days.push({ key: "rest_day", productBlocks: [], outerSequence: [] })
  return { days, failures }
}
