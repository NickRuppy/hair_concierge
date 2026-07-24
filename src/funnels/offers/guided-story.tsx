"use client"

import { Check, ShieldCheck } from "lucide-react"

import { GuidedStoryAnalysis } from "@/components/quiz/guided-story-analysis"
import { GuidedStoryRoutine } from "@/components/quiz/guided-story-routine"
import { GuidedStorySupport } from "@/components/quiz/guided-story-support"
import { OfferFaq, GUIDED_STORY_FAQ_IDS } from "@/components/quiz/offer-faq"
import {
  GUIDED_STORY_OFFER_REVISION,
  OfferTrackingProvider,
} from "@/components/quiz/offer-tracking-provider"
import { useGuidedStoryFlow } from "@/components/quiz/use-guided-story-flow"
import type { FunnelOfferVariantProps } from "@/funnels/types"
import { buildQuizGuidedStoryPreview } from "@/lib/quiz/guided-story-preview"

export default function GuidedStoryOfferVariant({
  entryContext,
  focusRoutine = false,
  focusTarget = null,
  leadId,
  name,
  offerTracking,
  offerVariant,
  pricingSlot,
  quizAnswers,
}: FunnelOfferVariantProps) {
  const preview = buildQuizGuidedStoryPreview(quizAnswers)
  const flow = useGuidedStoryFlow({ focusRoutine, focusTarget })

  return (
    <OfferTrackingProvider
      key={`${offerTracking?.funnelEventId ?? leadId ?? "anonymous"}:${entryContext}:${offerVariant}:${focusRoutine}:${focusTarget ?? "normal"}`}
      entryContext={entryContext}
      focusRoutine={focusRoutine}
      leadId={leadId}
      offerRevision={GUIDED_STORY_OFFER_REVISION}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
      revealedThrough={flow.revealedThrough}
      revealGeneration={flow.revealGeneration}
      trackingIdentity={{
        conditionerModuleId: preview.analytics.conditionerModuleId,
        needLane: preview.analytics.needLane,
        shampooModuleId: preview.analytics.shampooModuleId,
        suggestedCategory: preview.analytics.suggestedCategory,
      }}
    >
      <div className="min-h-screen bg-background text-foreground">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-[560px] items-center justify-between gap-3 px-5 py-3">
            <strong className="font-header text-[20px] font-medium text-[var(--brand-plum-darkest)]">
              chaarlie
            </strong>
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-plum)]">
              Deine Haaranalyse
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[560px] px-5 pt-14">
          <GuidedStoryAnalysis
            name={name}
            onContinue={() => flow.reveal(2)}
            preview={preview}
            quizAnswers={quizAnswers}
          />

          {flow.isRevealed(2) ? (
            <GuidedStoryRoutine
              onContinue={() => flow.reveal(3)}
              onStart={() => flow.reveal(4)}
              preview={preview}
            />
          ) : null}

          {flow.isRevealed(3) ? (
            <GuidedStorySupport onContinue={() => flow.reveal(4)} preview={preview} />
          ) : null}

          {flow.isRevealed(4) ? (
            <>
              <section
                id="pricing"
                data-offer-section="pricing"
                className="scroll-mt-5 border-t border-border py-10"
              >
                {focusRoutine ? (
                  <p className="mb-4 rounded-[12px] bg-[var(--brand-plum-ice)] px-3 py-2 text-center text-[12px] font-bold text-[var(--brand-plum)]">
                    Weiter mit deiner Routine
                  </p>
                ) : null}
                <h2
                  id="guided-story-chapter-4-heading"
                  tabIndex={-1}
                  className="text-center font-header text-[34px] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] outline-none"
                >
                  Wähle, wie lange Chaarlie dich begleiten soll.
                </h2>
                <p className="mx-auto mt-3 max-w-[42ch] text-center text-[14px] leading-[1.6] text-muted-foreground">
                  Deine persönliche Routine, Chat und Tagebuch sind in jeder Laufzeit enthalten.
                </p>
                <div className="mt-6">{pricingSlot}</div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-[#2D9F5E]" aria-hidden="true" />
                    14 Tage Geld zurück
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-[#2D9F5E]" aria-hidden="true" />
                    Zum Laufzeitende kündbar
                  </span>
                </div>
              </section>

              <OfferFaq faqIds={GUIDED_STORY_FAQ_IDS} />
            </>
          ) : null}
        </main>
      </div>
    </OfferTrackingProvider>
  )
}
