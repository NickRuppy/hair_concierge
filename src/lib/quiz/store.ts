import { create } from "zustand"
import { clearQuizDraft, loadQuizDraft, saveQuizDraft } from "./draft"
import type { QuizStep, LeadCaptureSubStep, QuizAnswers, LeadData } from "./types"

interface QuizState {
  step: QuizStep
  leadCaptureSubStep: LeadCaptureSubStep
  answers: QuizAnswers
  lead: LeadData
  leadId: string | null
  aiInsight: string | null
  shareQuote: string | null
  isAnalyzing: boolean

  goNext: () => void
  goBack: () => void
  setAnswer: (key: keyof QuizAnswers, value: string | string[] | boolean | undefined) => void
  setLeadField: <K extends keyof LeadData>(key: K, value: LeadData[K]) => void
  setLeadId: (id: string) => void
  setAiInsight: (insight: string) => void
  setShareQuote: (quote: string) => void
  setIsAnalyzing: (v: boolean) => void
  setLeadCaptureSubStep: (sub: LeadCaptureSubStep) => void
  setStep: (step: QuizStep) => void
  restoreDraft: () => boolean
  clearDraft: () => void
  reset: () => void
}

const STEP_ORDER: QuizStep[] = [2, 3, 13, 4, 5, 7, 6, 8, 12, 9, 10, 11, 14]

function nextStep(current: QuizStep): QuizStep {
  const idx = STEP_ORDER.indexOf(current)
  return idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : current
}

function prevStep(current: QuizStep): QuizStep {
  const idx = STEP_ORDER.indexOf(current)
  return idx > 0 ? STEP_ORDER[idx - 1] : current
}

const initialState = {
  // step 2 is the first actual question (hair_texture). Step 1 used to be
  // an in-app "Quiz starten" landing; that role moved to the marketing
  // landing at /, so we skip it.
  step: 2 as QuizStep,
  leadCaptureSubStep: "name" as LeadCaptureSubStep,
  answers: {} as QuizAnswers,
  lead: { name: "", email: "", marketingConsent: false } as LeadData,
  leadId: null as string | null,
  aiInsight: null as string | null,
  shareQuote: null as string | null,
  isAnalyzing: false,
}

export const useQuizStore = create<QuizState>((set, get) => ({
  ...initialState,

  goNext: () => {
    const current = get()
    const step = nextStep(current.step)
    set({ step })

    if (step === 14) {
      clearQuizDraft()
      return
    }

    saveQuizDraft({ step, answers: get().answers })
  },
  goBack: () => set((s) => ({ step: prevStep(s.step) })),

  setAnswer: (key, value) =>
    set((s) => {
      const nextAnswers = { ...s.answers } as QuizAnswers
      if (value === undefined) {
        delete (nextAnswers as Record<string, unknown>)[key]
      } else {
        ;(nextAnswers as Record<string, unknown>)[key] = value
      }

      return { answers: nextAnswers }
    }),

  setLeadField: (key, value) => set((s) => ({ lead: { ...s.lead, [key]: value } })),

  setLeadId: (id) => set({ leadId: id }),
  setAiInsight: (insight) => set({ aiInsight: insight }),
  setShareQuote: (quote) => set({ shareQuote: quote }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setLeadCaptureSubStep: (sub) => set({ leadCaptureSubStep: sub }),
  setStep: (step) => set({ step }),
  restoreDraft: () => {
    const draft = loadQuizDraft()
    if (!draft) return false

    set({
      ...initialState,
      step: draft.step,
      answers: draft.answers,
    })
    return true
  },
  clearDraft: () => clearQuizDraft(),
  reset: () => {
    clearQuizDraft()
    set(initialState)
  },
}))
