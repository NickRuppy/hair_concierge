import { notFound } from "next/navigation"

import {
  OfferPaymentOverlayLab,
  OfferPaymentColdCheckoutLab,
} from "@/components/checkout/offer-payment-overlay-lab"
import { PersonalPlanOffer } from "@/components/personal-plan-offer/personal-plan-offer"
import type { PersonalPlanOfferModel } from "@/components/personal-plan-offer/types"
import OrganicPlanOfferVariant from "@/funnels/offers/organic-plan-v1"
import { WelcomeClient } from "@/app/welcome/welcome-client"
import { isOfferPageLabEnabled } from "@/lib/labs/offer-page-access"
import { ModeratorAccountEntry } from "@/app/test/haarplan/konto/moderator-account-entry"
import FunnelPersonalPlanQuizLandingVariant from "@/funnels/landing/personal-plan-quiz"
import { buildPersonalPlanPreparedArtifact } from "@/lib/personal-plan-quiz/prepared-plan"
import { canonicalizePersonalPlanAnswers } from "@/lib/personal-plan-quiz/persistence"
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
        Plan sichern
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
    expressElements?: string
    overlay?: string
    pricingArm?: string
    pricingCatalog?: string
    scenario?: string
    variant?: string
  }>
}) {
  if (!isOfferPageLabEnabled(process.env)) notFound()

  const params = await searchParams
  const variant = params.variant ?? "organic-plan"
  const narrative = buildQuizResultNarrative(REVIEW_ANSWERS)

  // These interactive fixtures must never send quiz data to the normal
  // production-backed local environment or a connected preview database.
  if (
    (variant === "moderator-account" ||
      variant === "moderator-quiz" ||
      params.scenario === "moderator") &&
    (process.env.NODE_ENV !== "development" ||
      !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""))
  )
    notFound()

  if (variant === "moderator-account") {
    return <ModeratorAccountEntry campaignId="33333333-3333-4333-8333-333333333333" />
  }
  if (variant === "moderator-quiz") {
    return (
      <FunnelPersonalPlanQuizLandingVariant
        personalPlanFieldTest
        moderatorQuiz={{ scope: "local-moderator-review", email: "moderator@example.com" }}
      />
    )
  }

  if (variant === "payment-overlay") {
    return <OfferPaymentOverlayLab />
  }

  if (variant === "payment-cold-checkout") {
    return <OfferPaymentColdCheckoutLab scenario={params.scenario} />
  }

  if (variant === "payment-welcome") {
    return (
      <WelcomeClient
        activationSource={{
          provider: "paypal",
          purchaseKind: "one_time",
          token: "payment-welcome-lab-token",
        }}
        email="lea@example.com"
        purchase={null}
      />
    )
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
        checkoutPresentationFixture={{
          expressElements: params.expressElements !== "off",
          overlay: params.overlay !== "off",
        }}
        entryContext="saved_result"
        fieldTest={params.scenario === "field-test" || params.scenario === "moderator"}
        moderatorTest={params.scenario === "moderator"}
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

  if (variant !== "organic-plan" && variant !== "organic-plan-v1") notFound()

  return (
    <OrganicPlanOfferVariant
      entryContext="quiz_completion"
      leadId={params.scenario === "moderator" ? "11111111-1111-4111-8111-111111111111" : null}
      name="Lea"
      narrative={narrative}
      offerVariant="organic-plan-v1"
      quizAnswers={REVIEW_ANSWERS}
      pricingSlot={<StaticPricingPreview />}
      regularFieldTest={
        params.scenario === "moderator"
          ? {
              accessDurationHours: 2160,
              activationApiPath: "/api/personal-plan/field-test/moderator/activate-organic",
              identityMode: "email_bound",
            }
          : params.scenario === "field-test"
            ? {
                accessDurationHours: 168,
                activationApiPath: "/api/quiz/field-test/activate",
              }
            : null
      }
    />
  )
}
