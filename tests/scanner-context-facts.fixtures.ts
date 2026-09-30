import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { hashPersonalPlanNeedVersionInput } from "../src/lib/personal-plan/persistence"
import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import type { PersonalPlanQuizSubmissionEnvelope } from "../src/lib/personal-plan-quiz/types"
import { buildProfileDataFromPersonalPlanCanonicalProfile } from "../src/lib/quiz/link-to-profile"
import type { ScannerSourceRead } from "../src/lib/scan/scanner-context"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { mergeDiagnosticsPatch } from "../src/lib/user-facts/hand-edit"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import type { DiagnosticsV1, FieldProvenanceValue } from "../src/lib/user-facts/schema"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Shared fixtures of the scanner facts-compatibility suite (clean switch, scanner regression):
 * paid v3 envelopes, the paid-plan read the scanner sees, and a fake `scanner_profile_edit_publish`
 * that does what the door does (merge the facts patch, derive the columns from the document).
 */

export type Envelope = PersonalPlanQuizSubmissionEnvelope

export function envelope(patch: Record<string, unknown>): Envelope {
  const copy = structuredClone(COMPLETE_V3_PLAN_ENVELOPE) as Envelope & {
    answers: Record<string, unknown>
  }
  Object.assign(copy.answers, patch)
  for (const key of Object.keys(patch)) if (patch[key] === undefined) delete copy.answers[key]
  return copy
}

/** The paid cases the investigation reproduced (names kept for traceability). */
export const PAID_VARIANTS: Record<string, Envelope> = {
  V0_fixture_split_ends: envelope({}),
  V1_control_dry_damage: envelope({ currentConcerns: ["dry_lengths", "hair_damage"] }),
  V2_single_concern_nopick: envelope({
    currentConcerns: ["hair_damage"],
    concernRecurrence: { concernId: "hair_damage", frequency: "often" },
  }),
  V3_two_concerns_pick: envelope({
    currentConcerns: ["dry_lengths", "hair_damage"],
    primaryConcern: "hair_damage",
  }),
  V4_oily_scalp: envelope({
    currentConcerns: ["dry_lengths", "hair_damage"],
    scalpOiliness: "oily",
  }),
  V5_four_concerns: envelope({
    currentConcerns: ["breakage", "dry_lengths", "frizz_flyaways", "tangling"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
  }),
  V7_frizz: envelope({ currentConcerns: ["dry_lengths", "frizz_flyaways"] }),
  V8_low_shine_no_goal: envelope({
    goals: ["moisture"],
    currentConcerns: ["dry_lengths", "low_shine"],
  }),
  V9_goals_manageability: envelope({
    goals: ["manageability_styling"],
    currentConcerns: ["dry_lengths", "hair_damage"],
  }),
  V10_hair_loss: envelope({
    currentConcerns: ["dry_lengths", "hair_loss_or_thinning"],
    concernRecurrence: { concernId: "hair_loss_or_thinning", frequency: "often" },
  }),
  V11_four_plus_low_shine: envelope({
    currentConcerns: ["breakage", "dry_lengths", "frizz_flyaways", "tangling", "low_shine"],
    concernRecurrence: { concernId: "low_shine", frequency: "often" },
  }),
  V12_neutral_volume_only: envelope({
    texture: "straight",
    thickness: "normal",
    density: "medium",
    goals: ["volume_balance"],
    currentConcerns: ["hair_damage", "dry_lengths"],
  }),
  V13_volume_plus_moisture_split: envelope({
    texture: "straight",
    thickness: "normal",
    density: "medium",
    goals: ["volume_balance", "moisture"],
    currentConcerns: ["split_ends"],
    concernRecurrence: undefined,
  }),
  V14_multi_scalp_concerns: envelope({
    scalpOiliness: "oily",
    scalpConcerns: ["irritated", "oily_dandruff"],
  }),
}

/** A paid plan's current initial need version for `env`, as `scanner_context_read_source` returns it. */
export function paidRead(
  env: unknown,
  profile: Record<string, unknown> | null,
  extra: Partial<ScannerSourceRead> = {},
): ScannerSourceRead {
  const computed = computeNeedPlan({
    rawEnvelope: env,
    artifactId: "initial",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "1970-01-01T00:00:00.000Z",
  })
  if (computed.status !== "ready") throw new Error(`fixture not computable: ${computed.status}`)
  return {
    userId: "owner",
    sourceRevision: "1",
    profileRevision: "1",
    profile,
    plan: {
      id: "plan",
      current_initial_need_version_id: "initial",
      current_refined_need_version_id: null,
    },
    initial: {
      id: "initial",
      user_id: "owner",
      personal_plan_id: "plan",
      kind: "initial",
      input_snapshot: env,
      output_snapshot: computed.snapshot,
      schema_version: 1,
      computation_version: "stage1-v1",
      input_hash: hashPersonalPlanNeedVersionInput({
        schemaVersion: 1,
        computationVersion: "stage1-v1",
        inputSnapshot: env as never,
      }),
    },
    refined: null,
    refinements: [],
    leads: [],
    ...extra,
  }
}

/** The legacy columns the pre-switch account link wrote for a paid buyer (offer adapter). */
export function mainEraColumns(env: Envelope): Record<string, unknown> {
  const adapted = adaptPersonalPlanAnswersForOffer(env.answers).answers
  const columns = buildProfileDataFromPersonalPlanCanonicalProfile({
    modelVersion: "x",
    ...adapted,
  } as never) as Record<string, unknown>
  if (!adapted.scalp_condition) columns.scalp_condition = null
  return columns
}

/** A profile row with a facts document: the document, what the door derives from it, provenance. */
export function factsRow(
  diagnostics: DiagnosticsV1,
  options: {
    base?: Record<string, unknown>
    fields?: Record<string, FieldProvenanceValue>
    editedAt?: string
  } = {},
): Record<string, unknown> {
  return {
    ...(options.base ?? {}),
    ...deriveDiagnosticsColumns(diagnostics),
    diagnostics,
    facts_provenance: {
      diagnostics: {
        source: { kind: "personal_plan_artifact", id: "artifact" },
        schemaVersion: 1,
        at: "2026-09-01T00:00:00.000Z",
        ...(options.editedAt ? { editedAt: options.editedAt } : {}),
        ...(options.fields ? { fields: options.fields } : {}),
      },
    },
    facts_revision: 1,
  }
}

/** A backfilled paid buyer: the facts projected from her paid envelope, door-derived columns. */
export function backfilledRow(env: unknown): Record<string, unknown> {
  return factsRow(
    projectArtifactToFacts({ envelope: env, artifactId: "a", leadId: "l" }).diagnostics,
  )
}

/** A fake `scanner_profile_edit_publish` / receipt / read pair, doing what the door does. */
export function publishHarness(initial: ScannerSourceRead) {
  let read = initial
  const published: Record<string, any>[] = []
  return {
    published,
    get read() {
      return read
    },
    rpc: async (name: string, args: Record<string, any>) => {
      if (name === "scanner_profile_edit_receipt") return { data: null, error: null }
      if (name === "scanner_context_read_source") return { data: read, error: null }
      if (name !== "scanner_profile_edit_publish") throw new Error(`unexpected rpc ${name}`)
      published.push(args)
      const profileRevision = String(Number(read.profileRevision) + 1)
      const stored = parseUserFactsRow("owner", read.profile ?? {})
      const patch = args.p_facts.diagnostics.patch
      const diagnostics =
        Object.keys(patch).length === 0 && stored.diagnostics
          ? stored.diagnostics
          : mergeDiagnosticsPatch(stored.diagnostics, patch)
      const oldFields = stored.provenance.diagnostics?.fields ?? {}
      const fields: Record<string, unknown> = {
        ...oldFields,
        ...(args.p_facts.diagnostics.provenance.fields ?? {}),
      }
      for (const [key, value] of Object.entries(patch)) if (value === null) delete fields[key]
      const provenance = { ...args.p_facts.diagnostics.provenance }
      delete provenance.fields
      if (Object.keys(fields).length > 0) provenance.fields = fields
      const profile = {
        ...read.profile,
        ...deriveDiagnosticsColumns(diagnostics),
        diagnostics,
        facts_provenance: { diagnostics: provenance },
      }
      const result = {
        outcome: "ready",
        profileRevision,
        contextRevision: `context-${profileRevision}`,
        profile,
        quizAnswers: args.p_quiz_answers,
        context: {
          input_snapshot: args.p_input_snapshot,
          output_snapshot: args.p_output_snapshot,
          source_hash: args.p_source_hash,
          snapshot_source: args.p_snapshot_source,
        },
      }
      read = {
        ...read,
        profile,
        profileRevision,
        sourceRevision: String(Number(read.sourceRevision) + 1),
        edit: {
          profileRevision,
          quizAnswers: args.p_quiz_answers,
          profile,
          input: args.p_input_snapshot,
        },
      }
      return { data: result, error: null }
    },
  }
}
