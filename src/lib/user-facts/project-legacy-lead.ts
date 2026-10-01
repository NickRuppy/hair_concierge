import { buildLegacyQuizStage1Source } from "@/lib/personal-plan/input"
import { DIAGNOSTIC_CONCERNS, type DiagnosticConcern } from "@/lib/quiz/diagnostic-input"
import type { QuizAnswers } from "@/lib/quiz/types"

import { UnsupportedUserFactsSourceError, diagnosticsV1Schema, toTakenAt } from "./schema"
import type { DiagnosticsV1 } from "./schema"

export type ProjectLegacyLeadInput = {
  leadId: string
  quizAnswers: QuizAnswers
  /** `leads.created_at` — stored as `source.takenAt` (F1). */
  takenAt?: string | null
}

export type ProjectLegacyLeadResult = {
  diagnostics: DiagnosticsV1
}

/**
 * Projects a legacy German-keyed lead (`leads.quiz_answers`) into native-vocabulary
 * `DiagnosticsV1`. Legacy leads have no reflective quiz context, so there is no
 * `QuizContextV1` output. `diagnostics.source.raw` stores the BUILT Stage-1 source object
 * (`buildLegacyQuizStage1Source`'s result), because that is the object Stage-1 hashes — the
 * German answers themselves stay in `leads.quiz_answers`.
 *
 * Controller ruling (task 5a fix round 1, 2026-09-15, finding I2): a legacy lead missing one or
 * more of the 7 scalar diagnostics no longer throws — it returns PARTIAL diagnostics carrying
 * only the fields the built legacy source has (the four array fields are never `undefined`;
 * `buildLegacyQuizStage1Source` always defaults them to `[]`). Partial stored diagnostics are
 * legal (the schema ruling that made every field but `source` optional on `diagnosticsV1Schema`);
 * completeness is enforced at the Stage-1 boundary instead (`toStage1Source` throws
 * `UserFactsIncompleteError` for an EDITED emission missing a required field), and today's
 * pre-PR1 writer linked such leads with a sparse profile too — payment/activation call sites
 * must keep working for an incomplete legacy lead. This function throws
 * `UnsupportedUserFactsSourceError` ONLY when `quizAnswers` is not a usable record at all, i.e.
 * `buildLegacyQuizStage1Source` itself cannot run.
 */
/** The two legacy quiz concern codes whose diagnostic equivalent has a different name —
 * mirrors `LEGACY_CONCERN_TO_DIAGNOSTIC` in `personal-plan-quiz/offer-adapter.ts`, which is
 * how `buildLegacyQuizStage1Source` builds `currentConcerns`; every other legacy code is
 * already a diagnostic concern. */
const LEGACY_PRIMARY_CONCERN_ALIASES: Partial<Record<string, DiagnosticConcern>> = {
  dryness: "dry_lengths",
  frizz: "frizz_flyaways",
}

/**
 * The lead's explicit main-problem pick (main #611, `quiz_answers.primary_concern`) in the
 * native diagnostic vocabulary — only while it is one of the projected `currentConcerns`
 * (a stale pick is dropped, never rejected). A single selected concern without a pick stays
 * absent: the derived `hair_profiles.primary_concern` column resolves "her only concern"
 * itself, so the stored fact is exactly what she stated.
 *
 * Carried as a stored fact only: the Stage-1 legacy source (`source.raw`) is untouched,
 * because `buildLegacyQuizStage1Source` does not carry it.
 */
function legacyPrimaryConcern(
  quizAnswers: QuizAnswers,
  currentConcerns: readonly string[],
): DiagnosticConcern | undefined {
  const pick = (quizAnswers as { primary_concern?: unknown }).primary_concern
  if (typeof pick !== "string") return undefined
  const mapped =
    LEGACY_PRIMARY_CONCERN_ALIASES[pick] ??
    ((DIAGNOSTIC_CONCERNS as readonly string[]).includes(pick)
      ? (pick as DiagnosticConcern)
      : undefined)
  return mapped && currentConcerns.includes(mapped) ? mapped : undefined
}

/**
 * The lead's „Etwas anderes“ note (`quiz_answers.concerns_other_text`) as the stored fact
 * `currentConcernsOtherText`, bounded like every other writer of it (trimmed, blank dropped,
 * 50 characters — `normalizeConcernOtherText` in `quiz/normalization.ts`, the quiz draft's
 * `trim().slice(0, 50)`). A stored fact only, like the main-problem pick:
 * `buildLegacyQuizStage1Source` does not carry it, so `source.raw` is untouched (fix round 6, I5).
 */
function legacyConcernsOtherText(quizAnswers: QuizAnswers): string | undefined {
  const note = (quizAnswers as { concerns_other_text?: unknown }).concerns_other_text
  if (typeof note !== "string") return undefined
  const trimmed = note.trim()
  return trimmed ? trimmed.slice(0, 50) : undefined
}

/**
 * The volume direction the lead stated herself (fix round 11, owner ruling plan §3 "the stored
 * direction is kept"): an older quiz asked „Mehr Volumen“ / „Weniger Volumen“ as the legacy goals
 * `volume` / `less_volume`, which both collapse onto the native `volume_balance` — so the
 * direction is kept as `volumeDirection` and never re-derived from hair type. Both stated:
 * "volume" wins, the `deriveDesiredVolumeFromGoals` tie rule. The quiz's own `volume_balance`
 * card states no direction (hair type decides). Only while the projected goals carry
 * `volume_balance`.
 *
 * `buildLegacyQuizStage1Source` carries only `volume_balance`, so `source.raw` cannot tell the
 * direction: it is kept in `statedOutsideRaw` too, so a re-link still tells a changed quiz apart.
 */
function legacyVolumeDirection(
  quizAnswers: QuizAnswers,
  goals: readonly string[] | undefined,
): "more" | "less" | undefined {
  if (!goals?.includes("volume_balance")) return undefined
  const stated = (quizAnswers as { goals?: unknown }).goals
  if (!Array.isArray(stated)) return undefined
  if (stated.includes("volume")) return "more"
  if (stated.includes("less_volume")) return "less"
  return undefined
}

export function projectLegacyLeadToFacts(input: ProjectLegacyLeadInput): ProjectLegacyLeadResult {
  let legacySource: ReturnType<typeof buildLegacyQuizStage1Source>
  try {
    legacySource = buildLegacyQuizStage1Source({
      leadId: input.leadId,
      answers: input.quizAnswers,
    })
  } catch (cause) {
    throw new UnsupportedUserFactsSourceError(
      `Unable to project legacy lead ${input.leadId} into diagnostics facts`,
      cause,
    )
  }

  const answers = legacySource.answers
  const takenAt = toTakenAt(input.takenAt)
  const primaryConcern = legacyPrimaryConcern(input.quizAnswers, answers.currentConcerns ?? [])
  const currentConcernsOtherText = legacyConcernsOtherText(input.quizAnswers)
  const volumeDirection = legacyVolumeDirection(input.quizAnswers, answers.goals)
  const diagnostics = diagnosticsV1Schema.parse({
    texture: answers.texture,
    thickness: answers.thickness,
    density: answers.density,
    hairLength: answers.hairLength,
    hairSurface: answers.hairSurface,
    elasticResponse: answers.elasticResponse,
    chemicalTreatments: answers.chemicalTreatments,
    scalpOiliness: answers.scalpOiliness,
    scalpConcerns: answers.scalpConcerns,
    goals: answers.goals,
    ...(volumeDirection ? { volumeDirection } : {}),
    currentConcerns: answers.currentConcerns,
    ...(primaryConcern ? { primaryConcern } : {}),
    ...(currentConcernsOtherText ? { currentConcernsOtherText } : {}),
    source: {
      kind: "legacy_quiz",
      version: 1,
      leadId: input.leadId,
      raw: legacySource,
      ...(takenAt ? { takenAt } : {}),
      statedOutsideRaw: {
        primaryConcern: primaryConcern ?? null,
        currentConcernsOtherText: currentConcernsOtherText ?? null,
        // Absent when she stated none, so a source projected before fix round 11 reads the same.
        ...(volumeDirection ? { volumeDirection } : {}),
      },
    },
  })

  return { diagnostics }
}
