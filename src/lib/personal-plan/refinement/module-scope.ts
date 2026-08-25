import { getStage2ModulePathStates, getStage2QuestionModule } from "./question-path"
import type { Stage2RefinementSession } from "./session"
import {
  STAGE2_MODULES,
  type Stage2Module,
  type Stage2PathState,
  type Stage2QuestionId,
} from "./types"

/**
 * Module-scoped entry into the Stage-2 refinement flow (Task 2.4).
 *
 * The Feinschliff is no longer one linear run: the Routine banner and the
 * Profil tab hand the flow ONE module, and the flow walks only that module's
 * questions — in the unchanged canonical order, with unchanged per-question
 * save/resume semantics. Everything here is pure and deterministic; the
 * component layer only consumes it.
 */

export type Stage2ModuleEntryRequest = Stage2Module | "first_open"

export type Stage2RefineEntry =
  | { refine: false }
  | { refine: true; module: Stage2ModuleEntryRequest }

export function isStage2Module(value: unknown): value is Stage2Module {
  return typeof value === "string" && (STAGE2_MODULES as readonly string[]).includes(value)
}

/**
 * `/plan-start?refine=…`. `1` keeps its old meaning of "re-enter the
 * Feinschliff", now resolved to the FIRST OPEN module; `products` / `habits`
 * are the module deep links the banner and the Profil rows use.
 */
export function parseStage2RefineEntry(value: string | string[] | undefined): Stage2RefineEntry {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === "1") return { refine: true, module: "first_open" }
  if (isStage2Module(raw)) return { refine: true, module: raw }
  return { refine: false }
}

/** Restricts a resolved path to ONE module, preserving canonical order. */
export function scopeStage2PathToModule(
  path: Stage2PathState,
  stage2Module: Stage2Module,
): Stage2PathState {
  const belongs = (questionId: Stage2QuestionId) =>
    getStage2QuestionModule(questionId) === stage2Module
  const orderedQuestionIds = path.orderedQuestionIds.filter(belongs)
  const completedQuestionIds = path.completedQuestionIds.filter(belongs)
  return {
    orderedQuestionIds,
    requiredQuestionIds: path.requiredQuestionIds.filter(belongs),
    completedQuestionIds,
    firstUnresolvedQuestionId:
      orderedQuestionIds.find((questionId) => !completedQuestionIds.includes(questionId)) ?? null,
    prunedAnswerKeys: path.prunedAnswerKeys,
  }
}

/**
 * Narrows a session's PATH to one module and nothing else. `answers` and
 * `completedQuestionIds` stay whole on purpose: the local optimistic save
 * (`saveStage2SessionAnswer`) re-resolves the canonical contract from them, and
 * a truncated set would make it prune the other module's answers.
 */
export function scopeStage2SessionToModule(
  session: Stage2RefinementSession,
  stage2Module: Stage2Module | null,
): Stage2RefinementSession {
  if (!stage2Module) return session
  return { ...session, path: scopeStage2PathToModule(session.path, stage2Module) }
}

/**
 * The first module with an open question on the current path, in canonical
 * order (`products`, then `habits`). Null once every question is answered.
 *
 * Client-side truth is path completion, not answer provenance: the session
 * contract carries no provenance, and a draft whose questions were all filled
 * by direct acceptance is exactly the case that must fall back to the legacy
 * linear entry rather than to a module.
 */
export function firstOpenStage2Module(session: Stage2RefinementSession): Stage2Module | null {
  const states = getStage2ModulePathStates(
    session.path.orderedQuestionIds,
    session.path.completedQuestionIds,
  )
  return STAGE2_MODULES.find((stage2Module) => states[stage2Module].status === "open") ?? null
}

export function resolveStage2EntryModule(
  session: Stage2RefinementSession,
  requested: Stage2ModuleEntryRequest | null,
): Stage2Module | null {
  if (!requested) return null
  if (requested === "first_open") return firstOpenStage2Module(session)
  return requested
}

export type Stage2FlowEntryView = {
  mode: "invitation" | "resume" | "question" | "bridge"
  activeQuestionId: Stage2QuestionId | null
  status: "idle" | "completion_failed"
  liveMessage: string
  /** The caller must attach the session's completed handoff to the bridge. */
  bridge: boolean
}

/**
 * Where a flow entry lands, for an ALREADY module-scoped session.
 *
 * Handoff-consumption rule (Task 2.4 design decision): `module1HandedOff` is a
 * persistent "has ever handed off" fact and can therefore never arm the bridge
 * on its own. The Stage-3 bridge is armed exactly once, by the module
 * completion that happens in THIS session. Re-entering a module whose questions
 * are all answered — a reload after Stage-3 entry, or the banner pointing back
 * at it — is an edit visit: the module is walked again from its first question,
 * and the bridge stays disarmed until the user re-completes it.
 *
 * The legacy (unscoped) entry keeps today's behaviour unchanged, including the
 * "answers saved, handoff still open" retry state.
 */
export function resolveStage2FlowEntryView(input: {
  session: Stage2RefinementSession
  moduleScoped: boolean
  directEntry: boolean
}): Stage2FlowEntryView {
  const { session, moduleScoped, directEntry } = input
  if (session.status === "complete") {
    return {
      mode: "bridge",
      activeQuestionId: null,
      status: "idle",
      liveMessage: "",
      bridge: true,
    }
  }
  const firstUnresolvedQuestionId = session.path.firstUnresolvedQuestionId
  if (!firstUnresolvedQuestionId) {
    if (moduleScoped) {
      return {
        mode: "question",
        activeQuestionId: session.path.orderedQuestionIds[0] ?? null,
        status: "idle",
        liveMessage: "",
        bridge: false,
      }
    }
    return {
      mode: "question",
      activeQuestionId: session.path.orderedQuestionIds.at(-1) ?? null,
      status: "completion_failed",
      liveMessage: "Deine Antworten sind gespeichert. Die Übergabe ist noch offen.",
      bridge: false,
    }
  }
  return {
    mode: deriveStage2EntryMode(session, directEntry),
    activeQuestionId: firstUnresolvedQuestionId,
    status: "idle",
    liveMessage: "",
    bridge: false,
  }
}

/**
 * Invitation vs. resume vs. straight into the question — judged on the CURRENT
 * (possibly module-scoped) path, so a module the user has not started yet gets
 * its own fresh entry even when the other module is already answered.
 */
export function deriveStage2EntryMode(
  session: Stage2RefinementSession,
  directEntry: boolean,
): "invitation" | "resume" | "question" | "bridge" {
  if (session.status === "complete") return "bridge"
  if (session.path.completedQuestionIds.length > 0) return "resume"
  return directEntry ? "question" : "invitation"
}
