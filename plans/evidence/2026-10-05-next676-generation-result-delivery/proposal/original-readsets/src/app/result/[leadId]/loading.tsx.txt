/**
 * Loading shell for the result segment (Follow-up B, founder sign-off
 * 02.09.2026): renders the reveal's held exit line on the identical cream
 * ground, so both entries stay seamless — reveal → offer continues the exact
 * pixels the exit beat painted, and quiz → reveal shows this instead of a
 * frozen quiz screen. Deliberately not a neutral grey shell: this segment is
 * a journey moment, like the plan-opening frames.
 */
import { RevealOpeningDots } from "@/components/quiz/reveal-opening-dots"

export default function ResultLoading() {
  return (
    <main
      aria-label="Deine Auswertung wird geladen"
      aria-live="polite"
      className="relative grid min-h-[100svh] overflow-x-hidden bg-[#fcfaf7] px-6 py-6 text-[var(--brand-plum-darkest)]"
      data-loading-shell="result-loading-shell"
      role="status"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(var(--brand-plum-rgb),0.09),transparent_42%)]"
      />
      <section className="relative mx-auto flex w-full max-w-[34rem] items-center justify-center text-center">
        <h1 className="font-serif text-[2.65rem] leading-[1.06] tracking-[-0.04em] sm:text-6xl">
          Deine Auswertung wird geöffnet <RevealOpeningDots />
        </h1>
      </section>
    </main>
  )
}
