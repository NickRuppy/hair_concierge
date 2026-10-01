import type { Stage2AnswerProvenance, Stage2QuestionId } from "@/lib/personal-plan/refinement/types"
import { STAGE2_ANSWER_PROVENANCE_VALUES } from "@/lib/personal-plan/refinement/types"

import { careHabitsV1Schema, type CareHabitsV1, type FieldProvenanceValue } from "../schema"

/**
 * Pure resolution of the immutable Stage-2 head a user's `care_habits` must be backfilled
 * from (plan §4a F24/F25), and of the per-answer provenance that head can PROVE (F27).
 * Operates on pre-loaded rows only — the script does the bounded loading.
 *
 * Traversal: `personal_plans.current_refined_need_version_id` is the head. A Stage-3 need
 * revision is `kind='refined'` like a Stage-2 one and is identified ONLY by its
 * `computation_version`; it carries no answers, so it is walked back to the Stage-2 version
 * whose `output_snapshot.inputHash` equals its own `input_snapshot.refinedInputHash`, among
 * the siblings sharing its `parent_need_version_id` (exactly the link
 * `personal_plan_resolve_stage3_need_revision_v1` writes). A Stage-3 revision may itself
 * revise another Stage-3 revision, so the walk repeats until it lands on a non-Stage-3
 * version (bounded by the sibling set, with a visited guard).
 *
 * Provenance (F27), attributed only when provable:
 *  - a draft whose `result_refined_need_version_id` IS this version: its `answer_provenance`
 *    is frozen by the completion -> `"completed_draft"`.
 *  - else a draft holding a module receipt for this version at `projectedAtRevision ===
 *    draft.revision`: the draft has not been edited since it projected -> `"receipt_at_current_revision"`.
 *  - else every answered question becomes `"unknown_historical"`. No guessing.
 *
 * Receipt path, fix round 2 (P2): a module projection's snapshot carries the user's answers
 * UNION the assumption resolver's fills, so its `completedQuestionIds` names questions the
 * draft never asked. Defaulting a missing provenance entry to `"user"` there would import a
 * resolver assumption as a user fact. Per answered question id the verdict is therefore:
 * the draft's own `answer_provenance` entry if present; else `"user"` only when the id is in
 * the DRAFT's `completed_question_ids` (the snapshot's list is not evidence); else
 * `"assumed"` — the projection filled it. The completed-draft path keeps its frozen map
 * (its provenance covers exactly the answers the completion froze), and the
 * `unknown_historical` fallback is untouched.
 *
 * R1: answers ALWAYS come from the immutable version, never from the draft — an unprojected
 * Feinschliff edit stays in the draft.
 */

/** `personal_plan_resolve_stage3_need_revision_v1` (migration 20260813124500) writes exactly
 * this literal as the Stage-3 need revision's `computation_version`. */
export const STAGE3_COMPUTATION_VERSION = "stage3.product_load_refined_snapshot.v1"

export type BackfillPlanRow = {
  id: string
  current_refined_need_version_id: string | null
}

export type BackfillNeedVersionRow = {
  id: string
  kind: string
  parent_need_version_id: string | null
  computation_version: string
  input_snapshot: unknown
  output_snapshot: unknown
}

export type BackfillDraftRow = {
  id: string
  revision: number
  answer_provenance: unknown
  /** The draft's OWN completed list — the only provable evidence that the user answered a
   * question, as opposed to a projection's assumption resolver having filled it in. */
  completed_question_ids: unknown
  module_projections: unknown
  result_refined_need_version_id: string | null
}

export type Stage2HeadProvenanceSource =
  | "completed_draft"
  | "receipt_at_current_revision"
  | "unknown_historical"

export type ResolvedStage2Head =
  | { kind: "none" }
  | { kind: "unresolvable"; reason: string }
  | {
      kind: "refined"
      version: BackfillNeedVersionRow
      answers: CareHabitsV1
      completedQuestionIds: string[]
      /** Per-question-id provenance, the F27 verdict for this head. */
      provenance: Record<string, FieldProvenanceValue>
      /** The EFFECTIVE per-question verdict for the proving draft (empty for
       * `unknown_historical`), passed straight to `toFieldProvenance` by `plan-row.ts` so the
       * question-id -> field table is never duplicated. On the receipt path it is the raw map
       * completed with an explicit `"user"`/`"assumed"` for every answered id, so
       * `toFieldProvenance`'s missing-entry default can never attribute a resolver fill to
       * the user. */
      answerProvenance: Stage2AnswerProvenance
      provenanceSource: Stage2HeadProvenanceSource
      draftId: string | null
    }

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readAnswerProvenance(value: unknown): Stage2AnswerProvenance {
  const record = readRecord(value)
  if (!record) return {}
  const provenance: Record<string, string> = {}
  for (const [questionId, entry] of Object.entries(record)) {
    if (typeof entry === "string" && STAGE2_ANSWER_PROVENANCE_VALUES.includes(entry as never)) {
      provenance[questionId] = entry
    }
  }
  return provenance as Stage2AnswerProvenance
}

/** True when this draft holds a module receipt for `versionId` that is still current, i.e.
 * the draft has NOT been edited since the projection (`projectedAtRevision === revision`). */
function hasCurrentReceiptFor(draft: BackfillDraftRow, versionId: string): boolean {
  const projections = readRecord(draft.module_projections)
  if (!projections) return false
  for (const entry of Object.values(projections)) {
    const receipt = readRecord(entry)
    if (!receipt) continue
    if (
      receipt.needVersionId === versionId &&
      typeof receipt.projectedAtRevision === "number" &&
      receipt.projectedAtRevision === draft.revision
    ) {
      return true
    }
  }
  return false
}

type Stage2Traversal = { ok: true; version: BackfillNeedVersionRow } | { ok: false; reason: string }

function walkToStage2Head(
  head: BackfillNeedVersionRow,
  needVersions: readonly BackfillNeedVersionRow[],
): Stage2Traversal {
  let current = head
  const visited = new Set<string>([current.id])

  while (current.computation_version === STAGE3_COMPUTATION_VERSION) {
    const snapshot = readRecord(current.input_snapshot)
    const refinedInputHash = snapshot?.refinedInputHash
    if (typeof refinedInputHash !== "string" || refinedInputHash.length === 0) {
      return { ok: false, reason: `stage3_head_without_refined_input_hash (${current.id})` }
    }

    const sibling = needVersions.find(
      (candidate) =>
        candidate.id !== current.id &&
        candidate.parent_need_version_id === current.parent_need_version_id &&
        readRecord(candidate.output_snapshot)?.inputHash === refinedInputHash,
    )
    if (!sibling) {
      return {
        ok: false,
        reason: `stage2_sibling_not_found (stage3 ${current.id}, refinedInputHash ${refinedInputHash})`,
      }
    }
    if (visited.has(sibling.id)) {
      return { ok: false, reason: `stage3_back_link_cycle (${sibling.id})` }
    }
    visited.add(sibling.id)
    current = sibling
  }

  return { ok: true, version: current }
}

export function resolveStage2Head(input: {
  plan: BackfillPlanRow | null
  needVersions: readonly BackfillNeedVersionRow[]
  drafts: readonly BackfillDraftRow[]
}): ResolvedStage2Head {
  const headId = input.plan?.current_refined_need_version_id ?? null
  if (!headId) return { kind: "none" }

  const head = input.needVersions.find((version) => version.id === headId)
  if (!head) {
    return { kind: "unresolvable", reason: `current_refined_need_version_missing (${headId})` }
  }

  const traversal = walkToStage2Head(head, input.needVersions)
  if (!traversal.ok) return { kind: "unresolvable", reason: traversal.reason }
  const version = traversal.version

  const snapshot = readRecord(version.input_snapshot)
  if (!snapshot || snapshot.answers === undefined) {
    return { kind: "unresolvable", reason: `stage2_head_without_answers (${version.id})` }
  }

  const parsedAnswers = careHabitsV1Schema.safeParse(snapshot.answers)
  if (!parsedAnswers.success) {
    const fields = parsedAnswers.error.issues
      .map((issue) => issue.path.join("."))
      .filter((path) => path.length > 0)
    return {
      kind: "unresolvable",
      reason: `stage2_head_answers_invalid (${version.id}): ${fields.join(", ") || "root"}`,
    }
  }

  const completedQuestionIds = Array.isArray(snapshot.completedQuestionIds)
    ? snapshot.completedQuestionIds.filter((id): id is string => typeof id === "string")
    : []

  const completedDraft = input.drafts.find(
    (draft) => draft.result_refined_need_version_id === version.id,
  )
  const receiptDraft = completedDraft
    ? undefined
    : input.drafts.find((draft) => hasCurrentReceiptFor(draft, version.id))
  const provingDraft = completedDraft ?? receiptDraft ?? null

  const provenanceSource: Stage2HeadProvenanceSource = completedDraft
    ? "completed_draft"
    : receiptDraft
      ? "receipt_at_current_revision"
      : "unknown_historical"

  const rawAnswerProvenance = provingDraft
    ? readAnswerProvenance(provingDraft.answer_provenance)
    : {}

  // Fix round 2 (P2): only the receipt path needs completing — the completed draft's map was
  // frozen against its own answers, and `unknown_historical` attributes nothing at all.
  const draftCompletedIds = new Set(
    receiptDraft && Array.isArray(receiptDraft.completed_question_ids)
      ? receiptDraft.completed_question_ids.filter((id): id is string => typeof id === "string")
      : [],
  )
  const answerProvenance: Stage2AnswerProvenance =
    provenanceSource === "receipt_at_current_revision"
      ? Object.fromEntries(
          completedQuestionIds.map((questionId) => [
            questionId,
            rawAnswerProvenance[questionId as Stage2QuestionId] ??
              (draftCompletedIds.has(questionId) ? "user" : "assumed"),
          ]),
        )
      : rawAnswerProvenance

  const provenance: Record<string, FieldProvenanceValue> = {}
  for (const questionId of completedQuestionIds) {
    provenance[questionId] =
      provenanceSource === "unknown_historical"
        ? "unknown_historical"
        : answerProvenance[questionId as Stage2QuestionId] === "assumed"
          ? "assumed"
          : "user"
  }

  return {
    kind: "refined",
    version,
    answers: parsedAnswers.data,
    completedQuestionIds,
    provenance,
    answerProvenance,
    provenanceSource,
    draftId: provingDraft?.id ?? null,
  }
}
