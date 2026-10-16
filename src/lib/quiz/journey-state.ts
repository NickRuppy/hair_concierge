import { reconcilePrimaryConcern } from "./primary-concern"
import { getQuizStepOrder, normalizeQuizStepForPackage } from "./screen-order"
import type { LeadCaptureMode, LeadCaptureSubStep, LeadData, QuizAnswers, QuizStep } from "./types"

export type QuizJourneyPosition = {
  step: QuizStep
  leadCaptureSubStep: LeadCaptureSubStep
}

export type QuizJourneyTransition = {
  id: number
  kind: "forward" | "back" | "restore" | "init" | "reset" | "package"
  from: QuizJourneyPosition
  to: QuizJourneyPosition
}

export type QuizJourneyState = {
  step: QuizStep
  leadCaptureSubStep: LeadCaptureSubStep
  leadCaptureMode: LeadCaptureMode
  answers: QuizAnswers
  lead: LeadData
  leadId: string | null
  funnelPackageKey: string | null
  navigationRevision: number
  transition: QuizJourneyTransition | null
}

export const initialQuizJourneyState: QuizJourneyState = {
  // Step 2 is the first actual question. The landing moved to the marketing page.
  step: 2,
  leadCaptureSubStep: "name",
  leadCaptureMode: "regular",
  answers: {},
  lead: { name: "", email: "", marketingConsent: false },
  leadId: null,
  funnelPackageKey: null,
  navigationRevision: 0,
  transition: null,
}

export type QuizJourneyEvent =
  | { type: "answer"; key: keyof QuizAnswers; value: string | string[] | boolean | undefined }
  | { type: "answers"; changes: Partial<QuizAnswers> }
  | { type: "answersAndAdvance"; changes: Partial<QuizAnswers> }
  | { type: "next" }
  | { type: "back" }
  | { type: "setStep"; step: QuizStep }
  | { type: "setLeadCaptureSubStep"; subStep: LeadCaptureSubStep }
  | { type: "setLeadField"; key: keyof LeadData; value: LeadData[keyof LeadData] }
  | { type: "setLeadId"; leadId: string }
  | { type: "setPartnerLeadIdentity"; identity: { name: string; email: string } }
  | { type: "setDiscoveryLeadIdentity"; identity: { name: string; email: string } }
  | { type: "setRegularLeadCapture" }
  | { type: "setFunnelPackageKey"; key: string | null }
  | { type: "fillFunnelPackageKeyIfMissing"; key: string | null }
  | { type: "restore"; step: QuizStep; answers: QuizAnswers }
  | { type: "initializeMigration"; step: QuizStep; answers: QuizAnswers }
  | { type: "initializeReturn" }
  | { type: "reset" }

function position(
  state: Pick<QuizJourneyState, "step" | "leadCaptureSubStep">,
): QuizJourneyPosition {
  return { step: state.step, leadCaptureSubStep: state.leadCaptureSubStep }
}

function nextStep(current: QuizStep, packageKey: string | null): QuizStep {
  const order = getQuizStepOrder(packageKey)
  const index = order.indexOf(current)
  return index >= 0 && index < order.length - 1 ? order[index + 1] : current
}

function previousStep(current: QuizStep, packageKey: string | null): QuizStep {
  const order = getQuizStepOrder(packageKey)
  const index = order.indexOf(current)
  return index > 0 ? order[index - 1] : current
}

function applyAnswerChanges(answers: QuizAnswers, changes: Partial<QuizAnswers>): QuizAnswers {
  const next = { ...answers } as QuizAnswers
  for (const [key, value] of Object.entries(changes) as [
    keyof QuizAnswers,
    QuizAnswers[keyof QuizAnswers],
  ][]) {
    if (value === undefined) {
      delete (next as Record<string, unknown>)[key]
    } else {
      ;(next as Record<string, unknown>)[key] = value
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, "concerns")) {
    const primaryConcern = reconcilePrimaryConcern(next.concerns ?? [], next.primary_concern)
    if (primaryConcern === undefined) delete next.primary_concern
  }
  return next
}

function withTransition(
  state: QuizJourneyState,
  next: Omit<QuizJourneyState, "navigationRevision" | "transition">,
  kind: QuizJourneyTransition["kind"],
): QuizJourneyState {
  const navigationRevision = state.navigationRevision + 1
  return {
    ...next,
    navigationRevision,
    transition: { id: navigationRevision, kind, from: position(state), to: position(next) },
  }
}

function leadDirection(from: LeadCaptureSubStep, to: LeadCaptureSubStep): "forward" | "back" {
  const order: LeadCaptureSubStep[] = ["name", "email", "consent"]
  return order.indexOf(to) < order.indexOf(from) ? "back" : "forward"
}

/** Pure owner for all quiz navigation and answer mutations. */
export function reduceQuizJourney(
  state: QuizJourneyState,
  event: QuizJourneyEvent,
): QuizJourneyState {
  switch (event.type) {
    case "answer":
      return {
        ...state,
        answers: applyAnswerChanges(state.answers, {
          [event.key]: event.value,
        } as Partial<QuizAnswers>),
      }
    case "answers":
      return { ...state, answers: applyAnswerChanges(state.answers, event.changes) }
    case "answersAndAdvance": {
      const answers = applyAnswerChanges(state.answers, event.changes)
      return withTransition(
        state,
        { ...state, answers, step: nextStep(state.step, state.funnelPackageKey) },
        "forward",
      )
    }
    case "next":
      return withTransition(
        state,
        { ...state, step: nextStep(state.step, state.funnelPackageKey) },
        "forward",
      )
    case "back":
      return withTransition(
        state,
        { ...state, step: previousStep(state.step, state.funnelPackageKey) },
        "back",
      )
    case "setStep":
      return withTransition(state, { ...state, step: event.step }, "restore")
    case "setLeadCaptureSubStep":
      return withTransition(
        state,
        { ...state, leadCaptureSubStep: event.subStep },
        leadDirection(state.leadCaptureSubStep, event.subStep),
      )
    case "setLeadField":
      return { ...state, lead: { ...state.lead, [event.key]: event.value } }
    case "setLeadId":
      return { ...state, leadId: event.leadId }
    case "setPartnerLeadIdentity":
      return withTransition(
        state,
        {
          ...state,
          leadCaptureMode: "partner",
          leadCaptureSubStep: "consent",
          lead: { ...state.lead, ...event.identity },
        },
        "init",
      )
    case "setDiscoveryLeadIdentity":
      return withTransition(
        state,
        {
          ...state,
          leadCaptureMode: "discovery",
          leadCaptureSubStep: "consent",
          lead: { ...state.lead, ...event.identity },
        },
        "init",
      )
    case "setRegularLeadCapture":
      return state.leadCaptureMode === "regular"
        ? state
        : withTransition(state, { ...state, leadCaptureMode: "regular" }, "init")
    case "setFunnelPackageKey": {
      if (state.funnelPackageKey === event.key) return state
      return withTransition(
        state,
        {
          ...state,
          funnelPackageKey: event.key,
          step: normalizeQuizStepForPackage(state.step, event.key),
        },
        "package",
      )
    }
    case "fillFunnelPackageKeyIfMissing":
      return state.funnelPackageKey !== null || event.key === null
        ? state
        : withTransition(state, { ...state, funnelPackageKey: event.key }, "package")
    case "restore":
      return withTransition(
        state,
        {
          ...initialQuizJourneyState,
          funnelPackageKey: state.funnelPackageKey,
          step: normalizeQuizStepForPackage(event.step, state.funnelPackageKey),
          answers: event.answers,
        },
        "restore",
      )
    case "initializeMigration":
      return withTransition(
        state,
        {
          ...state,
          step: event.step,
          answers: event.answers,
          leadCaptureSubStep: "name",
          lead: { name: "", email: "", marketingConsent: false },
          leadId: null,
        },
        "init",
      )
    case "initializeReturn":
      return withTransition(
        state,
        {
          ...state,
          step: 2,
          answers: {},
          leadCaptureSubStep: "name",
          leadCaptureMode: "regular",
          lead: { name: "", email: "", marketingConsent: false },
          leadId: null,
        },
        "init",
      )
    case "reset":
      return withTransition(
        state,
        { ...initialQuizJourneyState, funnelPackageKey: state.funnelPackageKey },
        "reset",
      )
  }
}
