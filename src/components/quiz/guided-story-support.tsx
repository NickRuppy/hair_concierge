"use client"

import { useEffect } from "react"

import { GuidedStoryChatDemo } from "@/components/quiz/guided-story-chat-demo"
import { GuidedStoryTrackerProof } from "@/components/quiz/guided-story-tracker-proof"
import { Button } from "@/components/ui/button"
import { selectGuidedStoryChatExchange } from "@/lib/quiz/guided-story-chat"
import type { QuizGuidedStoryPreview } from "@/lib/quiz/guided-story-preview"
import { warmOfferStripe } from "@/lib/stripe/offer-client-loader"

const TESTIMONIALS = [
  {
    initials: "L",
    name: "L.",
    quote: "Im Chat hat das Antworten super geklappt. Auch die Produktempfehlung fand ich gut.",
  },
  {
    initials: "A",
    name: "A.",
    quote:
      "Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.",
  },
] as const

export function GuidedStorySupport({
  onContinue,
  preview,
}: {
  onContinue: () => void
  preview: QuizGuidedStoryPreview
}) {
  const exchange = selectGuidedStoryChatExchange(preview)

  useEffect(() => {
    warmOfferStripe()
  }, [])

  return (
    <section id="guided-story-support" className="scroll-mt-5 border-t border-border py-9">
      <h2
        id="guided-story-chapter-3-heading"
        tabIndex={-1}
        className="font-header text-[30px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)] outline-none"
      >
        Deine Routine steht. Doch im Alltag dranzubleiben, ist nicht immer leicht.
      </h2>
      <p className="mt-4 text-[15px] leading-[1.65] text-muted-foreground">
        Chaarlie hilft dir dabei: mit Antworten auf deine Fragen und einem Tagebuch, mit dem du
        deine Routine im Blick behältst und deinen Zielen näherkommst.
      </p>

      <section className="mt-7" data-offer-section="product_story_chat">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
          Chat
        </p>
        <h3 className="mb-4 mt-2 font-header text-[26px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
          Frag Chaarlie, wenn etwas unklar ist.
        </h3>
        <GuidedStoryChatDemo exchange={exchange} />
      </section>

      <GuidedStoryTrackerProof preview={preview} />

      <section className="mt-10" data-offer-section="testimonials">
        <div
          className="overflow-hidden rounded-[26px] border border-[var(--brand-plum-light)]/55 bg-[var(--brand-plum-ice)]/70 px-5 py-8 text-center shadow-[0_24px_55px_-48px_rgba(var(--brand-plum-rgb),0.7)] sm:px-8 sm:py-10"
          data-testid="guided-story-testimonial-proof"
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            Erfahrungen mit Chaarlie
          </p>
          <h3 className="mx-auto mt-2 max-w-[42rem] font-header text-[26px] font-medium leading-[1.2] text-[var(--brand-plum-darkest)]">
            Auch andere lassen sich von Chaarlie auf dem Weg zu gesünderem, schönerem Haar
            begleiten.
          </h3>

          <div className="mt-7 grid md:grid-cols-2">
            {TESTIMONIALS.map((testimonial, index) => (
              <figure
                key={testimonial.name}
                className={`flex min-h-[188px] flex-col items-center justify-between px-1 py-6 text-center sm:px-5 md:py-2 ${
                  index === 0
                    ? "border-b border-[var(--brand-plum-light)]/70 md:border-b-0 md:border-r"
                    : ""
                }`}
              >
                <blockquote className="max-w-[28rem] text-[15px] leading-[1.65] text-[var(--brand-plum-darkest)]">
                  „{testimonial.quote}“
                </blockquote>
                <figcaption className="mt-6 flex items-center justify-center gap-3 text-left">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-plum)] text-[12px] font-semibold text-white"
                  >
                    {testimonial.initials}
                  </span>
                  <span className="leading-snug">
                    <span className="block text-[13px] font-semibold text-[var(--brand-plum-darkest)]">
                      {testimonial.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">Chaarlie-Kundin</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="mt-7 rounded-[18px] bg-[var(--brand-plum-ice)]/60 p-4 text-center">
          <p className="text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
            Bereit für deinen Weg zu gesünderem, schönerem Haar?
          </p>
          <Button
            className="mt-3 bg-[var(--brand-coral)] text-white hover:bg-[var(--brand-coral-dark)]"
            data-offer-cta="support_continue"
            data-offer-destination="pricing"
            data-offer-source-section="testimonials"
            onClick={onContinue}
            type="button"
          >
            Ja, mit Chaarlie starten
          </Button>
        </div>
      </section>
    </section>
  )
}
