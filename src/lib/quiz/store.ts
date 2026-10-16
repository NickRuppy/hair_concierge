import { create } from "zustand"

import { clearQuizDraft, loadQuizDraft, saveQuizDraft } from "./draft"
import { initialQuizJourneyState, reduceQuizJourney, type QuizJourneyState } from "./journey-state"
import type { LeadCaptureSubStep, LeadData, QuizAnswers, QuizStep } from "./types"

interface QuizState extends QuizJourneyState {
  goNext: () => void
  goBack: () => void
  setAnswer: (key: keyof QuizAnswers, value: string | string[] | boolean | undefined) => void
  setAnswers: (changes: Partial<QuizAnswers>) => void
  commitAnswersAndAdvance: (changes: Partial<QuizAnswers>) => void
  setLeadField: <K extends keyof LeadData>(key: K, value: LeadData[K]) => void
  setLeadId: (id: string) => void
  setLeadCaptureSubStep: (sub: LeadCaptureSubStep) => void
  setPartnerLeadIdentity: (identity: { name: string; email: string }) => void
  setDiscoveryLeadIdentity: (identity: { name: string; email: string }) => void
  setRegularLeadCapture: () => void
  setStep: (step: QuizStep) => void
  setFunnelPackageKey: (key: string | null) => void
  fillFunnelPackageKeyIfMissing: (key: string | null) => void
  restoreDraft: () => boolean
  initializeMigration: (input: { step: QuizStep; answers: QuizAnswers }) => void
  initializeReturn: () => void
  clearDraft: () => void
  reset: () => void
}

function persistForwardProgress(state: Pick<QuizState, "step" | "answers" | "funnelPackageKey">) {
  if (state.step === 14) {
    clearQuizDraft()
    return
  }
  saveQuizDraft(state)
}

export const useQuizStore = create<QuizState>((set, get) => {
  const apply = (event: Parameters<typeof reduceQuizJourney>[1]) => {
    const next = reduceQuizJourney(get(), event)
    set(next)
    return next
  }

  return {
    ...initialQuizJourneyState,

    goNext: () => persistForwardProgress(apply({ type: "next" })),
    goBack: () => {
      apply({ type: "back" })
    },
    setAnswer: (key, value) => {
      apply({ type: "answer", key, value })
    },
    setAnswers: (changes) => {
      apply({ type: "answers", changes })
    },
    commitAnswersAndAdvance: (changes) =>
      persistForwardProgress(apply({ type: "answersAndAdvance", changes })),

    setLeadField: (key, value) => {
      apply({ type: "setLeadField", key, value })
    },
    setLeadId: (leadId) => {
      apply({ type: "setLeadId", leadId })
    },
    setLeadCaptureSubStep: (subStep) => {
      apply({ type: "setLeadCaptureSubStep", subStep })
    },
    setPartnerLeadIdentity: (identity) => {
      apply({ type: "setPartnerLeadIdentity", identity })
    },
    setDiscoveryLeadIdentity: (identity) => {
      apply({ type: "setDiscoveryLeadIdentity", identity })
    },
    setRegularLeadCapture: () => {
      apply({ type: "setRegularLeadCapture" })
    },
    setStep: (step) => {
      apply({ type: "setStep", step })
    },
    setFunnelPackageKey: (key) => {
      apply({ type: "setFunnelPackageKey", key })
    },
    fillFunnelPackageKeyIfMissing: (key) => {
      apply({ type: "fillFunnelPackageKeyIfMissing", key })
    },
    restoreDraft: () => {
      const draft = loadQuizDraft()
      if (!draft) return false
      apply({ type: "restore", step: draft.step, answers: draft.answers })
      return true
    },
    initializeMigration: (input) => {
      apply({ type: "initializeMigration", ...input })
    },
    initializeReturn: () => {
      apply({ type: "initializeReturn" })
    },
    clearDraft: () => clearQuizDraft(),
    reset: () => {
      clearQuizDraft()
      apply({ type: "reset" })
    },
  }
})
