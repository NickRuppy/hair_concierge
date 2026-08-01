import { notFound } from "next/navigation"

import { QuizResultOfferPage } from "@/components/quiz/quiz-result-offer-page"
import {
  OfferPaymentOverlayLab,
  OfferPaymentPrewarmLab,
} from "@/components/checkout/offer-payment-overlay-lab"
import { PersonalPlanOffer } from "@/components/personal-plan-offer/personal-plan-offer"
import type { PersonalPlanOfferModel } from "@/components/personal-plan-offer/types"
import AppValueStackOfferVariant from "@/funnels/offers/app-value-stack"
import GuidedStoryOfferVariant from "@/funnels/offers/guided-story"
import GuidedStoryFounderLetterOfferVariant from "@/funnels/offers/guided-story-founder-letter"
import GuidedStoryLockedOfferVariant from "@/funnels/offers/guided-story-locked"
import GuidedStoryPotentialOfferVariant from "@/funnels/offers/guided-story-potential"
import { isOfferPageLabEnabled } from "@/lib/labs/offer-page-access"
import { buildPersonalPlanPreparedArtifact } from "@/lib/personal-plan-quiz/prepared-plan"
import { canonicalizePersonalPlanAnswers } from "@/lib/personal-plan-quiz/persistence"
import { APP_VALUE_STACK_CTA_LABEL } from "@/lib/quiz/app-value-stack-copy"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

const REVIEW_ANSWERS: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["natur"],
  goals: ["less_frizz", "moisture", "shine"],
}

const PERSONAL_PLAN_LEGACY_REVIEW_MODEL: PersonalPlanOfferModel = {
  planTitle: "Dein persönlicher Plan für gesundes, schönes welliges Haar",
  profileLine: "Basierend auf deiner Analyse für welliges, mittelstarkes Haar",
  planFitStatement:
    "Ein klarer Plan statt widersprüchlicher Tipps: Du bekommst eine feste Reihenfolge, die zu deinem Haar passt und im Alltag leicht nachvollziehbar bleibt.",
  diagnosticRows: [
    {
      id: "surface_manageability",
      title: "Oberfläche & Kämmbarkeit",
      todayLabel: "viel Potenzial",
      potentialLabel: "starke Basis",
      todaySegments: 1,
      potentialSegments: 3,
      summary:
        "Dein Plan bringt Pflege und Styling in eine Reihenfolge, die Frizz und Reibung reduziert.",
    },
    {
      id: "moisture_dryness",
      title: "Feuchtigkeit & Geschmeidigkeit",
      todayLabel: "gute Basis",
      potentialLabel: "starke Basis",
      todaySegments: 2,
      potentialSegments: 3,
      summary:
        "Dein Plan stimmt Pflegeintensität und Rhythmus auf geschmeidigere, ausgeglichenere Längen ab.",
    },
    {
      id: "definition",
      title: "Form & Definition",
      todayLabel: "gute Basis",
      potentialLabel: "starke Basis",
      todaySegments: 2,
      potentialSegments: 3,
      summary:
        "Dein Plan verbindet Pflege und Styling so, dass deine natürliche Struktur klarer zur Geltung kommt.",
    },
  ],
}

const PERSONAL_PLAN_REVIEW_MODEL = buildPersonalPlanPreparedArtifact(
  canonicalizePersonalPlanAnswers({
    texture: "wavy",
    thickness: "normal",
    density: "medium",
    goals: ["manageability_styling", "shine"],
    routineClarity: "trial_and_error",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["tangling", "low_shine", "dry_lengths"],
    concernRecurrence: { concernId: "tangling", frequency: "often" },
    hairLength: "long",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["lightened"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  }),
).publicOfferModel

function StaticPricingPreview() {
  return (
    <div className="space-y-3">
      {["Monatlich · 14,99 €", "Quartal · 34,99 €", "Jährlich · 99,99 €"].map((label, index) => (
        <div
          className={`rounded-[14px] border px-4 py-4 text-[14px] font-semibold ${
            index === 1
              ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
              : "border-border bg-white"
          }`}
          key={label}
        >
          {label}
        </div>
      ))}
      <div className="rounded-[12px] bg-[var(--brand-coral)] px-5 py-4 text-center text-[14px] font-bold text-white">
        {APP_VALUE_STACK_CTA_LABEL}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        14 Tage Geld-zurück-Garantie · Details in den Bedingungen
      </p>
    </div>
  )
}

export default async function OfferPageLab({
  searchParams,
}: {
  searchParams: Promise<{
    focus?: string
    pricingArm?: string
    pricingCatalog?: string
    scenario?: string
    variant?: string
  }>
}) {
  if (!isOfferPageLabEnabled(process.env)) notFound()

  const params = await searchParams
  const variant = params.variant ?? "app-value-stack"
  const narrative = buildQuizResultNarrative(REVIEW_ANSWERS)

  if (variant === "payment-overlay") {
    return <OfferPaymentOverlayLab />
  }

  if (variant === "payment-prewarm") {
    return <OfferPaymentPrewarmLab scenario={params.scenario} />
  }

  if (variant === "personal-plan") {
    const personalPlanOfferVariant =
      params.pricingArm === "one_time"
        ? "personal-plan-one-time-v1"
        : params.pricingArm === "membership"
          ? "personal-plan-v1"
          : undefined
    return (
      <PersonalPlanOffer
        disableCheckoutPrewarm
        entryContext="saved_result"
        isInternalTest
        leadId="11111111-1111-4111-8111-111111111111"
        model={
          params.scenario === "legacy"
            ? PERSONAL_PLAN_LEGACY_REVIEW_MODEL
            : PERSONAL_PLAN_REVIEW_MODEL
        }
        offerTracking={{
          funnelPackageKey: "personal-plan-lab",
          funnelSessionId: "22222222-2222-4222-8222-222222222222",
        }}
        offerVariant={personalPlanOfferVariant}
        pricingCatalog={
          params.pricingCatalog === "personal_plan_launch_v1"
            ? "personal_plan_launch_v1"
            : "standard"
        }
      />
    )
  }

  if (variant === "default") {
    return (
      <QuizResultOfferPage
        leadId={null}
        name="Lea"
        narrative={narrative}
        quizAnswers={REVIEW_ANSWERS}
      />
    )
  }

  if (
    variant === "guided-story" ||
    variant === "guided-story-locked" ||
    variant === "guided-story-founder-letter" ||
    variant === "guided-story-potential"
  ) {
    const GuidedStoryVariant =
      variant === "guided-story-locked"
        ? GuidedStoryLockedOfferVariant
        : variant === "guided-story-founder-letter"
          ? GuidedStoryFounderLetterOfferVariant
          : variant === "guided-story-potential"
            ? GuidedStoryPotentialOfferVariant
            : GuidedStoryOfferVariant

    return (
      <GuidedStoryVariant
        entryContext={params.focus === "routine" ? "routine_return" : "quiz_completion"}
        focusRoutine={params.focus === "routine"}
        focusTarget={params.focus === "unlock-plan" ? "unlock-plan" : null}
        leadId={null}
        name="Lea"
        narrative={narrative}
        offerVariant={variant}
        quizAnswers={REVIEW_ANSWERS}
        pricingSlot={<StaticPricingPreview />}
      />
    )
  }

  if (variant !== "app-value-stack") notFound()

  return (
    <AppValueStackOfferVariant
      entryContext="quiz_completion"
      leadId={null}
      name="Lea"
      narrative={narrative}
      offerVariant="app-value-stack"
      quizAnswers={REVIEW_ANSWERS}
      pricingSlot={<StaticPricingPreview />}
    />
  )
}
