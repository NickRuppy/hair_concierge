import { create } from "zustand"
import { clearQuizDraft, loadQuizDraft, saveQuizDraft } from "./draft"
import { reconcilePrimaryConcern } from "./primary-concern"
import { getQuizStepOrder, normalizeQuizStepForPackage } from "./screen-order"
import type { QuizStep, LeadCaptureMode, LeadCaptureSubStep, QuizAnswers, LeadData } from "./types"

interface QuizState {
  step: QuizStep
  leadCaptureSubStep: LeadCaptureSubStep
  leadCaptureMode: LeadCaptureMode
  answers: QuizAnswers
  lead: LeadData
  leadId: string | null
  /** Funnel package the running quiz belongs to; `null` = organic. */
  funnelPackageKey: string | null

  goNext: () => void
  goBack: () => void
  setAnswer: (key: keyof QuizAnswers, value: string | string[] | boolean | undefined) => void
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
  clearDraft: () => void
  reset: () => void
}

// The screen sequence is a function of the funnel package the quiz runs under;
// organic traffic keeps the sequence it has always had.
function nextStep(current: QuizStep, packageKey: string | null): QuizStep {
  const order = getQuizStepOrder(packageKey)
  const idx = order.indexOf(current)
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : current
}

function prevStep(current: QuizStep, packageKey: string | null): QuizStep {
  const order = getQuizStepOrder(packageKey)
  const idx = order.indexOf(current)
  return idx > 0 ? order[idx - 1] : current
}

const initialState = {
  // step 2 is the first actual question (hair_texture). Step 1 used to be
  // an in-app "Quiz starten" landing; that role moved to the marketing
  // landing at /, so we skip it.
  step: 2 as QuizStep,
  leadCaptureSubStep: "name" as LeadCaptureSubStep,
  leadCaptureMode: "regular" as LeadCaptureMode,
  answers: {} as QuizAnswers,
  lead: { name: "", email: "", marketingConsent: false } as LeadData,
  leadId: null as string | null,
  funnelPackageKey: null as string | null,
}

export const useQuizStore = create<QuizState>((set, get) => ({
  ...initialState,

  goNext: () => {
    const current = get()
    const step = nextStep(current.step, current.funnelPackageKey)
    set({ step })

    if (step === 14) {
      clearQuizDraft()
      return
    }

    saveQuizDraft({
      step,
      answers: get().answers,
      funnelPackageKey: current.funnelPackageKey,
    })
  },
  goBack: () => set((s) => ({ step: prevStep(s.step, s.funnelPackageKey) })),

  setAnswer: (key, value) =>
    set((s) => {
      const nextAnswers = { ...s.answers } as QuizAnswers
      if (value === undefined) {
        delete (nextAnswers as Record<string, unknown>)[key]
      } else {
        ;(nextAnswers as Record<string, unknown>)[key] = value
      }
      // A changed concern selection drops a main-problem pick it no longer contains (F1).
      if (key === "concerns") {
        const primaryConcern = reconcilePrimaryConcern(
          nextAnswers.concerns ?? [],
          nextAnswers.primary_concern,
        )
        if (primaryConcern === undefined) delete nextAnswers.primary_concern
      }

      return { answers: nextAnswers }
    }),

  setLeadField: (key, value) => set((s) => ({ lead: { ...s.lead, [key]: value } })),

  setLeadId: (id) => set({ leadId: id }),
  setLeadCaptureSubStep: (sub) => set({ leadCaptureSubStep: sub }),
  setPartnerLeadIdentity: ({ name, email }) =>
    set((state) => ({
      leadCaptureMode: "partner",
      leadCaptureSubStep: "consent",
      lead: { ...state.lead, name, email },
    })),
  // The discovery-call analogue: the enrollment owns the identity, so the quiz
  // jumps straight to consent and the lead route re-validates the address.
  setDiscoveryLeadIdentity: ({ name, email }) =>
    set((state) => ({
      leadCaptureMode: "discovery",
      leadCaptureSubStep: "consent",
      lead: { ...state.lead, name, email },
    })),
  setRegularLeadCapture: () => set({ leadCaptureMode: "regular" }),
  setStep: (step) => set({ step }),
  // The signed funnel cookie is authoritative, including when it resolves to no
  // package: a quiz without attribution has to behave organically.
  // A screen the new package does not run (a scan insert after a client
  // navigation without attribution) falls back to its preceding question, so no
  // question can be skipped.
  setFunnelPackageKey: (key) =>
    set((s) => ({ funnelPackageKey: key, step: normalizeQuizStepForPackage(s.step, key) })),
  // The browser bootstrap is a fallback for a request that carried no readable
  // cookie, so it must never overwrite a server-resolved package.
  fillFunnelPackageKeyIfMissing: (key) =>
    set((s) => (s.funnelPackageKey === null ? { funnelPackageKey: key } : s)),
  restoreDraft: () => {
    const draft = loadQuizDraft()
    if (!draft) return false

    // The draft holds quiz progress only. The funnel package belongs to the
    // running session and survives a restore (see `reset` below) — a draft
    // saved under another package keeps its answers but resumes on a screen the
    // running package actually has.
    set((s) => ({
      ...initialState,
      funnelPackageKey: s.funnelPackageKey,
      step: normalizeQuizStepForPackage(draft.step, s.funnelPackageKey),
      answers: draft.answers,
    }))
    return true
  },
  clearDraft: () => clearQuizDraft(),
  reset: () => {
    clearQuizDraft()
    // A moderator fresh start drops another person's answers, not the funnel
    // package this browser was attributed to.
    set((s) => ({ ...initialState, funnelPackageKey: s.funnelPackageKey }))
  },
}))
