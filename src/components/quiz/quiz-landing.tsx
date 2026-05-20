"use client"

import Link from "next/link"
import Image from "next/image"
import { CheckCircle2, Droplet, Sparkles, Star } from "lucide-react"
import { useQuizStore } from "@/lib/quiz/store"
import { Button } from "@/components/ui/button"
import { tomHannemannImageUrl } from "@/lib/landing-assets"

const outcomeItems = ["Dein Haarprofil", "Dein Pflegehebel", "Routine & Produkte"] as const

export function QuizLanding() {
  const goNext = useQuizStore((s) => s.goNext)

  return (
    <main className="relative isolate grid w-full animate-fade-in-up grid-cols-1 items-center text-center lg:grid-cols-[minmax(0,640px)_minmax(390px,460px)] lg:justify-center lg:gap-16 lg:text-left xl:-translate-y-6 xl:gap-24">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 75% 52% at 12% 8%, rgba(var(--brand-plum-rgb), 0.105), transparent 62%), radial-gradient(ellipse 52% 62% at 88% 82%, rgba(var(--brand-coral-rgb), 0.085), transparent 58%), radial-gradient(ellipse 42% 42% at 55% 52%, rgba(var(--brand-plum-light-rgb), 0.08), transparent 64%), hsl(var(--background))",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,rgba(var(--brand-plum-rgb),0.045)_39px,rgba(var(--brand-plum-rgb),0.045)_40px)]"
        aria-hidden="true"
      />

      <div className="flex w-full flex-col items-center lg:items-start">
        <header className="mb-8 flex items-center justify-center gap-2.5 sm:mb-9 lg:mb-9 lg:justify-start">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[var(--brand-plum-darkest)] text-white shadow-[0_10px_24px_rgba(42,24,69,0.16)] lg:h-11 lg:w-11 lg:rounded-xl">
            <Droplet aria-hidden="true" className="h-[19px] w-[19px] stroke-[1.65] lg:h-6 lg:w-6" />
          </span>
          <p className="font-header text-[21px] font-semibold leading-none text-[var(--brand-plum-darkest)] lg:text-[28px]">
            chaarlie
          </p>
        </header>

        <section aria-labelledby="quiz-landing-title" className="space-y-4 lg:space-y-6">
          <h1
            id="quiz-landing-title"
            className="text-balance font-header text-[30px] leading-[1.14] text-[var(--text-heading)] min-[380px]:text-[37px] sm:text-[40px] lg:max-w-[680px] lg:text-[56px] lg:leading-[1.035] lg:[text-wrap:normal] xl:text-[64px]"
          >
            <span className="lg:block">Weißt du, was</span>{" "}
            <span className="lg:block">deine Haare</span>{" "}
            <span className="lg:block">
              <em className="text-[var(--brand-plum)]">wirklich</em> brauchen?
            </span>
          </h1>
          <p className="mx-auto max-w-[350px] text-[15px] leading-[1.62] text-[var(--text-sub)] lg:mx-0 lg:max-w-[520px] lg:text-[18px] lg:leading-[1.7]">
            Ich analysiere dein Haar und zeige dir, was deine Haare tatsächlich brauchen —
            individuell, nicht pauschal.
          </p>
        </section>

        <section
          aria-labelledby="quiz-landing-outcomes"
          className="mt-9 hidden w-full max-w-[620px] lg:block"
        >
          <p
            id="quiz-landing-outcomes"
            className="font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--brand-coral)]"
          >
            Was du bekommst
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {outcomeItems.map((item) => (
              <div
                key={item}
                className="flex min-h-14 w-[196px] flex-none items-center gap-3 rounded-[14px] border border-border bg-white/68 px-4 py-3 shadow-[0_16px_42px_rgba(42,24,69,0.055)] backdrop-blur-[10px]"
              >
                <CheckCircle2
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-[var(--brand-plum)]"
                />
                <p className="text-[15px] font-semibold leading-[1.25] text-[var(--brand-plum-darkest)]">
                  {item}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 flex max-w-[560px] items-center gap-2 text-[14px] leading-relaxed text-[var(--text-sub)]">
            <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--brand-plum)]" />
            Am Ende: deine persönliche Einschätzung plus eine Routine, die du direkt starten kannst.
          </p>
        </section>
      </div>

      <div className="mt-6 flex w-full flex-col items-center sm:mt-7 lg:mt-0 lg:items-stretch lg:justify-self-end">
        <section aria-label="Quiz starten" className="w-full">
          <Button
            onClick={goNext}
            variant="landingCta"
            aria-label="Quiz starten"
            aria-describedby="quiz-landing-cta-detail"
          >
            <span className="flex flex-col items-center leading-tight">
              <span className="text-[17px] font-extrabold tracking-[-0.01em]">Quiz starten</span>
              <span aria-hidden="true" className="mt-1 text-xs font-medium opacity-[0.96]">
                In ca. 2 Minuten · Kostenlos
              </span>
            </span>
            <span id="quiz-landing-cta-detail" className="sr-only">
              In ca. 2 Minuten, kostenlos
            </span>
          </Button>
        </section>

        <figure className="mt-[18px] w-full rounded-[14px] border border-border bg-white/70 p-4 shadow-[0_14px_38px_rgba(42,24,69,0.045)] backdrop-blur-[10px] lg:mt-5 lg:p-5">
          <div className="flex items-center gap-3 text-left lg:gap-4">
            <Image
              src={tomHannemannImageUrl}
              alt="Tom Hannemann"
              width={104}
              height={104}
              className="h-[52px] w-[52px] shrink-0 rounded-full border-2 border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] object-cover object-[52%_18%] lg:h-16 lg:w-16"
              priority
              referrerPolicy="no-referrer"
            />
            <div>
              <blockquote className="font-header text-[13.5px] italic leading-[1.36] text-[var(--brand-plum-darkest)] lg:text-[15px] lg:leading-[1.42]">
                „Ich sage es immer: Ohne Analyse ist jede Produktempfehlung Glücksspiel. Deswegen
                empfehle ich genau das hier.&quot;
              </blockquote>
              <figcaption className="mt-2 font-mono text-[10px] font-medium uppercase leading-[1.35] tracking-[0.075em] text-[var(--text-caption)] lg:text-[11px]">
                <strong className="text-[var(--brand-plum)]">Tom Hannemann</strong> ·
                Friseurmeister, 18 Jahre Erfahrung
              </figcaption>
            </div>
          </div>
        </figure>

        <div className="mt-5 flex w-full flex-col items-center gap-3.5 text-center">
          <div
            className="flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[var(--brand-plum)]"
            aria-label="4,9 von 5 aus ersten Nutzerinnen-Feedbacks"
          >
            <div className="flex justify-center gap-0.5" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} aria-hidden="true" className="h-[13px] w-[13px] fill-current" />
              ))}
            </div>
            <p className="font-mono text-[9.5px] font-medium uppercase leading-tight tracking-[0.055em] text-[var(--text-sub)]">
              <strong className="font-semibold text-[var(--text-body)]">4,9/5</strong> aus ersten
              Nutzerinnen-Feedbacks
            </p>
          </div>

          <p className="inline-flex items-center justify-center gap-2 rounded-full bg-white/55 px-3.5 py-2 font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.11em] text-[var(--brand-coral)] shadow-[0_8px_24px_rgba(var(--brand-coral-rgb),0.06)] backdrop-blur-[8px]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--brand-coral)] shadow-[0_0_0_5px_rgba(var(--brand-coral-rgb),0.11)] motion-safe:animate-pulse"
              aria-hidden="true"
            />
            Starte heute damit
          </p>

          <p className="w-full border-t border-border/70 pt-3 text-[13px] leading-none text-[var(--text-caption)]">
            Du hast bereits ein Konto?{" "}
            <Link
              href="/auth?force=login"
              className="font-semibold text-[var(--brand-plum)] underline-offset-4 transition-colors hover:text-[var(--brand-plum-dark)] hover:underline"
            >
              Anmelden
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
