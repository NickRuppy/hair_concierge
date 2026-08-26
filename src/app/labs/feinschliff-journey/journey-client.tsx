"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Stage2PreviewClient } from "@/app/labs/personal-plan-stage-2/preview-client"
import { PlanStartCustomerJourney } from "@/components/personal-plan-start/plan-start-flow"
import type { PlanStartReadyViewModel } from "@/components/personal-plan-start/plan-start-flow"
import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import { HairProfileSection } from "@/components/profile/hair-profile-section"
import { RoutinePage } from "@/components/routine/personal-plan"
import { createFixtureStage3Gateway } from "@/lib/personal-plan/products/fixture-gateway"
import type { Stage3EntryContext } from "@/lib/personal-plan/products/contracts"
import { developmentStage3Analytics } from "@/lib/personal-plan/products/stage3-development-analytics"
import { buildHairProfileSection } from "@/lib/personal-plan/refinement/hair-profile-section"

import {
  DEMO_PERSONAL_PLAN_ID,
  DEMO_REFINED_VERSION_ID,
  PORTFOLIO_PRESENTATION_RESOLVED,
  PORTFOLIO_PRESENTATION_WITH_DEFERRAL,
  ROUTINE_VIEW_RESOLVED,
  ROUTINE_VIEW_WITH_DEFERRED_MASK,
  refinementStatus,
} from "./fixtures"

/**
 * The fork-free Feinschliff journey, end to end, on fixtures.
 *
 * Idealplan → (fixture accept) → Routine → Modul 1 (Produkte) → Stage-3
 * Produkt-Check → Routine (Toast + Modul-2-Banner) → Modul 2 (Gewohnheiten) →
 * Routine (Toast, kein Banner) → Haarprofil 4/4.
 *
 * Every screen is the REAL production component; this file only owns the state
 * machine and the fixture wiring. Dev-only (`page.tsx` gates it).
 */

type Step =
  | { name: "idealplan" }
  | { name: "routine"; phase: RoutinePhase }
  | { name: "module-products" }
  | { name: "stage3" }
  | { name: "module-habits" }
  | { name: "hair-profile" }

/** Which of the three Routine states the mockup defines is on screen. */
type RoutinePhase = "after-accept" | "after-products" | "after-habits"

const ACCEPT_ENDPOINT = "/api/personal-plan/accept-ideal-plan"

export function FeinschliffJourneyClient({
  plan,
  stage3EntryContext,
}: {
  plan: PlanStartReadyViewModel
  stage3EntryContext: Stage3EntryContext | null
}) {
  const [step, setStep] = useState<Step>({ name: "idealplan" })
  const [bannerDismissed, setBannerDismissed] = useState<Record<RoutinePhase, boolean>>({
    "after-accept": false,
    "after-products": false,
    "after-habits": false,
  })
  const [toastVisible, setToastVisible] = useState(false)
  const stage3Gateway = useMemo(() => createFixtureStage3Gateway({ searchDelayMs: 0 }), [])

  // The Idealplan CTA posts to the real accept route. There is no injectable
  // accept port on `PlanStartCustomerJourney`, and the brief forbids production
  // changes — so the demo answers that ONE endpoint locally and delegates every
  // other request untouched. Scoped to this dev-only page's lifetime.
  useEffect(() => {
    const originalFetch = window.fetch
    const patched: typeof window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url
      if (url.includes(ACCEPT_ENDPOINT)) {
        return new Response(
          JSON.stringify({
            status: "accepted",
            personalPlanId: DEMO_PERSONAL_PLAN_ID,
            refinedVersionId: DEMO_REFINED_VERSION_ID,
            productDraftId: "demo-product-draft",
            productPortfolioVersionId: "demo-portfolio-version",
            next: { stage: 4, href: "/routine" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      return originalFetch(input, init)
    }
    window.fetch = patched
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const openRoutine = useCallback((phase: RoutinePhase, withToast: boolean) => {
    setToastVisible(withToast)
    setStep({ name: "routine", phase })
  }, [])

  const restart = useCallback(() => {
    setBannerDismissed({
      "after-accept": false,
      "after-products": false,
      "after-habits": false,
    })
    setToastVisible(false)
    setStep({ name: "idealplan" })
  }, [])

  if (step.name === "idealplan") {
    return (
      <DemoShell onRestart={restart}>
        <PlanStartCustomerJourney
          initialPlan={plan}
          initialJourney={{ stage: "stage1", directAcceptanceAvailable: true }}
          personalPlanId={DEMO_PERSONAL_PLAN_ID}
          reloadServerFrontier={() => undefined}
          replaceRoute={() => openRoutine("after-accept", false)}
        />
      </DemoShell>
    )
  }

  if (step.name === "module-products") {
    return (
      <DemoShell onRestart={restart}>
        <Stage2PreviewClient
          scenario="module-products"
          autoHandoff
          onHandoff={() => setStep({ name: "stage3" })}
          onModuleComplete={() => setStep({ name: "stage3" })}
        />
      </DemoShell>
    )
  }

  if (step.name === "stage3") {
    if (!stage3EntryContext) {
      return (
        <DemoShell onRestart={restart}>
          <UnavailableStep
            title="Produkt-Check nicht verfügbar"
            detail="Der Fixture-Idealplan konnte keinen Stage-3-Einstieg erzeugen."
            onContinue={() => openRoutine("after-products", true)}
          />
        </DemoShell>
      )
    }
    return (
      <DemoShell onRestart={restart}>
        <Stage3ProductsFlow
          entryContext={stage3EntryContext}
          draftId={`fixture-stage3-${DEMO_REFINED_VERSION_ID}`}
          userId="fixture-user"
          analytics={developmentStage3Analytics}
          gateway={stage3Gateway}
          searchDebounceMs={0}
          stageEntrance
          onBackToRefinement={() => openRoutine("after-products", true)}
          onOpenRoutine={() => openRoutine("after-products", true)}
        />
      </DemoShell>
    )
  }

  if (step.name === "module-habits") {
    return (
      <DemoShell onRestart={restart}>
        <Stage2PreviewClient
          scenario="module-habits"
          autoHandoff
          onHandoff={() => openRoutine("after-habits", true)}
          onModuleComplete={() => openRoutine("after-habits", true)}
        />
      </DemoShell>
    )
  }

  if (step.name === "hair-profile") {
    return (
      <DemoShell onRestart={restart}>
        <main className="mx-auto w-full max-w-[430px] px-3 py-6 sm:max-w-[560px] sm:px-5">
          <button
            type="button"
            onClick={() => openRoutine("after-habits", false)}
            className="mb-4 text-[13px] font-bold text-[var(--brand-plum)] underline underline-offset-4"
          >
            Zurück zur Routine
          </button>
          <HairProfileSection view={buildHairProfileSection({ status: STATUS_ALL_DONE })} />
        </main>
      </DemoShell>
    )
  }

  const { phase } = step
  const resolved = phase !== "after-accept"
  const bannerModule =
    phase === "after-accept" ? "products" : phase === "after-products" ? "habits" : null

  return (
    <DemoShell onRestart={restart}>
      <RoutinePage
        view={resolved ? ROUTINE_VIEW_RESOLVED : ROUTINE_VIEW_WITH_DEFERRED_MASK}
        portfolioPresentation={
          resolved ? PORTFOLIO_PRESENTATION_RESOLVED : PORTFOLIO_PRESENTATION_WITH_DEFERRAL
        }
        refinementBanner={
          bannerModule && !bannerDismissed[phase]
            ? {
                module: bannerModule,
                completedSteps: bannerModule === "products" ? 2 : 3,
                totalSteps: 4,
              }
            : null
        }
        onDismissRefinementBanner={() =>
          setBannerDismissed((current) => ({ ...current, [phase]: true }))
        }
        onRefineFromBanner={() =>
          setStep(
            bannerModule === "products" ? { name: "module-products" } : { name: "module-habits" },
          )
        }
        showPlanUpdatedToast={toastVisible}
        onDismissPlanUpdatedToast={() => setToastVisible(false)}
      />
      {phase === "after-habits" ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={() => setStep({ name: "hair-profile" })}
            className="pointer-events-auto rounded-full border border-[#ddd2ef] bg-white/95 px-4 py-2 text-[13px] font-bold text-[var(--brand-plum-darkest)] shadow-sm backdrop-blur"
          >
            Haarprofil ansehen
          </button>
        </div>
      ) : null}
    </DemoShell>
  )
}

const STATUS_ALL_DONE = refinementStatus("complete", "complete")

/**
 * Labs chrome. Deliberately a small corner icon: every step of the real
 * journey owns the full screen, several with a sticky bottom CTA, so anything
 * larger would cover product copy the demo exists to show.
 */
function DemoShell({ children, onRestart }: { children: React.ReactNode; onRestart: () => void }) {
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={onRestart}
        title="Labs · Demo neu starten"
        aria-label="Labs · Demo neu starten"
        className="fixed bottom-2 right-2 z-50 grid h-8 w-8 place-items-center rounded-full border border-border bg-white/80 text-[13px] text-muted-foreground opacity-60 backdrop-blur transition hover:opacity-100"
      >
        ⟲
      </button>
    </div>
  )
}

function UnavailableStep({
  title,
  detail,
  onContinue,
}: {
  title: string
  detail: string
  onContinue: () => void
}) {
  return (
    <main className="mx-auto w-full max-w-[430px] px-3 py-10 sm:max-w-[560px] sm:px-5">
      <h1 className="font-header text-[23px] leading-[1.14] text-[#291a43]">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-5 rounded-full bg-[var(--brand-coral)] px-[18px] py-2.5 text-[13.5px] font-extrabold text-white"
      >
        Weiter zur Routine
      </button>
    </main>
  )
}
