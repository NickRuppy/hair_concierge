import type { Stage3DecisionSubject } from "@/lib/personal-plan/products/contracts"

export type OilReviewGroup = {
  /** The subject whose screen anchors the group (first pending oil subject). */
  anchor: Stage3DecisionSubject
  /** All pending oil subjects of the same subjectKind, anchor included, in review order. */
  members: Stage3DecisionSubject[]
  /** True when members share one recommended/captured product proposition; false → "Empfehlungen für alle N einplanen" copy. */
  uniformProposition: boolean
}

/**
 * Derives the group of pending oil subjects that should collapse into one review
 * screen anchored on `anchorKey`. Returns null when the anchor is not an oil
 * category subject, is an inventory disposition, or fewer than two pending oil
 * members of the anchor's subjectKind exist (the single-oil use case keeps
 * today's classic screen).
 */
export function deriveOilReviewGroup(
  subjects: Stage3DecisionSubject[],
  pendingDecisionKeys: ReadonlySet<string>,
  anchorKey: string,
  propositionByDecisionKey: ReadonlyMap<string, string | null>,
): OilReviewGroup | null {
  const anchor = subjects.find((subject) => subject.decisionKey === anchorKey)
  if (!anchor) return null
  if (anchor.category !== "oil") return null
  if (anchor.subjectKind === "inventory_disposition") return null
  if (!pendingDecisionKeys.has(anchorKey)) return null

  const members = subjects.filter(
    (subject) =>
      subject.category === anchor.category &&
      subject.subjectKind === anchor.subjectKind &&
      pendingDecisionKeys.has(subject.decisionKey),
  )

  if (members.length < 2) return null

  const propositions = members.map(
    (member) => propositionByDecisionKey.get(member.decisionKey) ?? null,
  )
  const uniformProposition = propositions.every((proposition) => proposition === propositions[0])

  return { anchor, members, uniformProposition }
}

/**
 * Counts review steps with the current oil group collapsed into a single step.
 * `groupedOilKeys` is the CURRENT group membership (decision keys of subjects
 * still inside the group) — members that have left the group (e.g. after being
 * deselected) must be passed as ordinary, ungrouped subjects and will count
 * individually.
 */
export function groupedReviewCounts(
  subjects: Stage3DecisionSubject[],
  decisionKey: string,
  groupedOilKeys: ReadonlySet<string>,
): { position: number; total: number } {
  const countedKeys: string[] = []
  let groupCounted = false

  for (const subject of subjects) {
    if (groupedOilKeys.has(subject.decisionKey)) {
      if (!groupCounted) {
        countedKeys.push(subject.decisionKey)
        groupCounted = true
      }
      continue
    }
    countedKeys.push(subject.decisionKey)
  }

  const total = countedKeys.length

  const representativeKey = groupedOilKeys.has(decisionKey)
    ? (subjects.find((subject) => groupedOilKeys.has(subject.decisionKey))?.decisionKey ??
      decisionKey)
    : decisionKey

  const position = countedKeys.indexOf(representativeKey) + 1

  return { position, total }
}
