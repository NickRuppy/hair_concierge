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

/**
 * How the flow was entered — the distinction the direct-accept cohort depends on.
 *
 * `explicit` is a real module deep link (banner / Profil row). `first_open` is the
 * plain `?refine=1` re-entry, which resolves to a module only while one is open.
 * `none` is the legacy linear entry.
 */
export type Stage2ModuleScope = "none" | "explicit" | "first_open"

export function resolveStage2ModuleScope(
  requested: Stage2ModuleEntryRequest | null | undefined,
  resolvedModule: Stage2Module | null,
): Stage2ModuleScope {
  if (!resolvedModule || !requested) return "none"
  return requested === "first_open" ? "first_open" : "explicit"
}

/**
 * Where "leave the Feinschliff" goes. An explicitly requested module was entered
 * from the Routine banner or the Profil tab, so its exit belongs back on
 * `/routine`; `first_open` and legacy entries keep today's Idealplan exit.
 */
export function stage2SecondaryExitDestination(
  requested: Stage2ModuleEntryRequest | null | undefined,
): "routine" | "stage1" {
  return requested && requested !== "first_open" ? "routine" : "stage1"
}

/**
 * A module-scoped session carries a TRUNCATED path. It drives this flow's own
 * view state and must never leave it: a host that stores it as its Stage-2 seed
 * would remount on a path that is missing the other module's questions and read
 * that as "all answered, handoff still open".
 */
export function hostSessionFor(
  unscoped: Stage2RefinementSession | null | undefined,
  view: Stage2RefinementSession,
): Stage2RefinementSession {
  return unscoped ?? view
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
 * A COMPLETE draft is the direct-accept cohort: every question is answered, but
 * by the assumption resolver rather than by the user. An explicit module deep
 * link must therefore still open that module's first question — otherwise the
 * banner and the Profil rows are inert for exactly the people they exist for.
 * The first save reopens the draft server-side. `first_open` and the legacy
 * entry keep returning today's bridge, which is what the `?refine=1` nudge
 * cohort relies on.
 */
export function resolveStage2FlowEntryView(input: {
  session: Stage2RefinementSession
  moduleScope: Stage2ModuleScope
  directEntry: boolean
}): Stage2FlowEntryView {
  const { session, moduleScope, directEntry } = input
  const moduleScoped = moduleScope !== "none"
  if (session.status === "complete" && moduleScope !== "explicit") {
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
    // An EXPLICIT module entry is a post-accept surface hop, not a funnel
    // chapter: the user tapped a Routine banner or a Profil row and already
    // has the full app nav. Field test 26.08.2026 — the invitation and resume
    // shells read as funnel ceremony there, so an explicit module always opens
    // its first open question directly. `first_open` and the legacy linear
    // entry keep the creation funnel's chapter screens.
    mode: moduleScope === "explicit" ? "question" : deriveStage2EntryMode(session, directEntry),
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
