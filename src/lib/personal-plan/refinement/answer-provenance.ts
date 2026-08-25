import type { Stage2AnswerProvenance, Stage2QuestionId } from "./types"

/**
 * Per-answer provenance derivation and write-path helpers. Pure/deterministic
 * — no I/O. See `types.ts` for the `Stage2AnswerProvenance` shape and
 * `direct-acceptance/accept.ts` / `persistence/stage2-refinement-service.ts`
 * for the two write paths that produce it.
 */

/** The direct-acceptance synthetic write: every default answer it wrote is `assumed`. */
export function buildAssumedAnswerProvenance(
  completedQuestionIds: readonly Stage2QuestionId[],
): Stage2AnswerProvenance {
  const provenance: Stage2AnswerProvenance = {}
  for (const id of completedQuestionIds) provenance[id] = "assumed"
  return provenance
}

/**
 * Drops provenance entries for ids no longer in the completed set. A path
 * change (e.g. answering `current_product_categories` away from dry shampoo)
 * can remove a previously-completed id like `dry_shampoo_visible_hair_color`
 * from the canonical path; its stale provenance entry must not survive to be
 * misread if that id becomes completed again on a different branch later.
 */
export function pruneAnswerProvenance(
  provenance: Stage2AnswerProvenance,
  completedQuestionIds: readonly Stage2QuestionId[],
): Stage2AnswerProvenance {
  const keep = new Set(completedQuestionIds)
  const pruned: Stage2AnswerProvenance = {}
  for (const id of Object.keys(provenance) as Stage2QuestionId[]) {
    if (keep.has(id)) pruned[id] = provenance[id]
  }
  return pruned
}

/**
 * The normal Stage-2 `saveAnswer` write: marks the just-answered question id
 * `user` (overwriting any prior `assumed` value — the user answering a
 * question that previously held a synthetic default is the exact moment it
 * stops being assumed) and prunes entries the resulting path change dropped.
 */
export function applyUserAnswerProvenance(input: {
  previous: Stage2AnswerProvenance
  answeredQuestionId: Stage2QuestionId
  completedQuestionIds: readonly Stage2QuestionId[]
}): Stage2AnswerProvenance {
  const next: Stage2AnswerProvenance = { ...input.previous, [input.answeredQuestionId]: "user" }
  return pruneAnswerProvenance(next, input.completedQuestionIds)
}

/**
 * Read path: ids answered directly by the user. Progress ("X von 4") and
 * module status must derive from this set only — never from
 * `completedQuestionIds`, which also counts auto-accepted defaults, or an
 * auto-accepted user would read as "everything answered".
 *
 * A completed id with no provenance entry is legacy data written before this
 * column existed, predating the `assumed` concept entirely — it defaults to
 * `user` so old real progress is never silently downgraded to "assumed".
 */
export function userAnsweredQuestionIds(
  completedQuestionIds: readonly Stage2QuestionId[],
  provenance: Stage2AnswerProvenance,
): Stage2QuestionId[] {
  return completedQuestionIds.filter((id) => (provenance[id] ?? "user") === "user")
}

/**
 * Read path: ids answered by the user OR assumed via auto-accept defaults
 * (user ∪ assumed). Projection completeness derives from this set. Every
 * completed id carries a provenance value today (`user`, `assumed`, or the
 * legacy-missing default of `user`), so this is exactly the completed set —
 * kept as an explicit named derivation so call sites read as intent, not as
 * an incidental array pass-through.
 */
export function effectiveAnsweredQuestionIds(
  completedQuestionIds: readonly Stage2QuestionId[],
): Stage2QuestionId[] {
  return [...completedQuestionIds]
}
