import "server-only"

import { loadDiscoveryCallSheet, type DiscoveryCallSheet } from "../call-sheet"
import {
  buildDiscoveryCockpitView,
  loadDiscoveryCockpitModel,
  type DiscoveryCallIntake,
  type DiscoveryCockpitAdminClient,
  type DiscoveryCockpitModel,
  type DiscoveryCockpitView,
} from "../cockpit"
import { buildDiscoveryQuizAnswers, type DiscoveryQuizAnswers } from "../quiz-answers"
import { loadDiscoveryQuizLead } from "../quiz-lead"
import { consultSourceHash } from "./hash"
import { assembleConsultInput, type ConsultInput } from "./input"

/**
 * The consult brief's source (consult-agent T3): the ONE way its input is assembled and
 * fingerprinted. The generate route stamps `source_hash` from here, and the page's stale check
 * (T4) must compare against the same function — any second assembly (e.g. without the quiz)
 * would hash differently and mark every brief stale.
 */

export type ConsultBriefSource = { input: ConsultInput; sourceHash: string }

/**
 * Pure: the page already holds every part (model, view, quiz answers, call sheet), so T4 calls
 * this directly — no second read. `quiz` is `buildDiscoveryQuizAnswers(lead)`; only a ready
 * one contributes (her concerns + stated main problem).
 */
export function consultBriefSource(parts: {
  model: DiscoveryCockpitModel
  view: DiscoveryCockpitView
  quiz: DiscoveryQuizAnswers | null
  callSheet: Pick<DiscoveryCallSheet, "baselineScore"> | null
}): ConsultBriefSource {
  const quiz = parts.quiz?.status === "ready" ? parts.quiz : null
  const input = assembleConsultInput(
    { view: parts.view, model: parts.model, quiz },
    parts.callSheet ? { baselineScore: parts.callSheet.baselineScore } : null,
  )
  return { input, sourceHash: consultSourceHash(input) }
}

export type ConsultBriefSourceDependencies = {
  loadModel: typeof loadDiscoveryCockpitModel
  loadQuizLead: typeof loadDiscoveryQuizLead
  loadCallSheet: typeof loadDiscoveryCallSheet
}

const DEFAULTS: ConsultBriefSourceDependencies = {
  loadModel: loadDiscoveryCockpitModel,
  loadQuizLead: loadDiscoveryQuizLead,
  loadCallSheet: loadDiscoveryCallSheet,
}

export type LoadedConsultBriefSource =
  | ({ status: "ready"; callSheet: DiscoveryCallSheet | null } & ConsultBriefSource)
  | { status: "no_usable_source" | "temporarily_unavailable" }

/**
 * Server-side: reads everything the page reads for one enrollment (quiz lead, cockpit model,
 * call sheet) and assembles through `consultBriefSource`. A failed read THROWS — unlike the
 * page, which degrades: a brief generated from a partial read would carry a hash the full
 * page never produces.
 */
export async function loadConsultBriefSource(
  admin: DiscoveryCockpitAdminClient,
  intake: Pick<DiscoveryCallIntake, "id" | "enrollmentId" | "userId">,
  overrides: Partial<ConsultBriefSourceDependencies> = {},
): Promise<LoadedConsultBriefSource> {
  const deps = { ...DEFAULTS, ...overrides }
  const lead = await deps.loadQuizLead(admin, intake.userId)
  const model = await deps.loadModel(admin, { intakeId: intake.id, userId: intake.userId })
  if (model.status !== "ready") return { status: model.status }
  const callSheet = await deps.loadCallSheet(intake.enrollmentId, admin)
  const source = consultBriefSource({
    model,
    view: buildDiscoveryCockpitView(model),
    quiz: buildDiscoveryQuizAnswers(lead),
    callSheet,
  })
  return { status: "ready", callSheet, ...source }
}
