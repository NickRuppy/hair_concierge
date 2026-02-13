import { create } from "zustand"
import type { QuizStep, LeadCaptureSubStep, QuizAnswers, LeadData } from "./types"

interface QuizState {
  step: QuizStep
  leadCaptureSubStep: LeadCaptureSubStep
  answers: QuizAnswers
  lead: LeadData
  leadId: string | null
  aiInsight: string | null
  isAnalyzing: boolean

  goNext: () => void
  goBack: () => void
  setAnswer: (key: keyof QuizAnswers, value: string | string[]) => void
  setLeadField: <K extends keyof LeadData>(key: K, value: LeadData[K]) => void
  setLeadId: (id: string) => void
  setAiInsight: (insight: string) => void
  setIsAnalyzing: (v: boolean) => void
  setLeadCaptureSubStep: (sub: LeadCaptureSubStep) => void
  setStep: (step: QuizStep) => void
  reset: () => void
}

const STEP_ORDER: QuizStep[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14]

function nextStep(current: QuizStep): QuizStep {
  const idx = STEP_ORDER.indexOf(current)
  return idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : current
}

function prevStep(current: QuizStep): QuizStep {
  const idx = STEP_ORDER.indexOf(current)
  return idx > 0 ? STEP_ORDER[idx - 1] : current
}

const initialState = {
  step: 1 as QuizStep,
  leadCaptureSubStep: "name" as LeadCaptureSubStep,
  answers: {} as QuizAnswers,
  lead: { name: "", email: "", marketingConsent: false } as LeadData,
  leadId: null as string | null,
  aiInsight: null as string | null,
  isAnalyzing: false,
}

export const useQuizStore = create<QuizState>((set) => ({
  ...initialState,

  goNext: () => set((s) => ({ step: nextStep(s.step) })),
  goBack: () => set((s) => ({ step: prevStep(s.step) })),

  setAnswer: (key, value) =>
    set((s) => ({ answers: { ...s.answers, [key]: value } })),

  setLeadField: (key, value) =>
    set((s) => ({ lead: { ...s.lead, [key]: value } })),

  setLeadId: (id) => set({ leadId: id }),
  setAiInsight: (insight) => set({ aiInsight: insight }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setLeadCaptureSubStep: (sub) => set({ leadCaptureSubStep: sub }),
  setStep: (step) => set({ step }),
  reset: () => set(initialState),
}))
