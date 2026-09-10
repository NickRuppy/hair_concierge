import { notFound } from "next/navigation"

import { GatedPreview } from "@/components/gated-preview/gated-preview"

/**
 * Dev-only harness for `GatedPreview` (T11, freemium-scanner-first PR3).
 *
 * The real gated pages need a signed-in free account (T12 wires them), so this is the
 * cheapest honest way to review the one frame in a browser at a real mobile viewport:
 * the wrapper reproduces the authenticated shell's geometry — the sticky 3.5rem header
 * and the fixed mobile bottom nav, both as inert placeholders — so the frame here is
 * exactly as tall as it will be in the app.
 *
 * Content is placeholder German, deliberately taller than the frame so the in-frame
 * scroll is visible. The final example content is T12's.
 *
 * Same guard as every other `/labs` page (`labs/scan/page.tsx`): a production build 404s.
 */
export default function GatedPreviewLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <div className="min-h-dvh [--personal-plan-shell-bottom-padding:calc(4.5rem+env(safe-area-inset-bottom))] [--personal-plan-shell-header-offset:3.5rem]">
      {/* Inert stand-in for the app header (same 3.5rem / h-14 as the real one). */}
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur">
        <span className="font-header text-2xl tracking-wide text-[var(--text-heading)]">
          chaarlie
        </span>
      </header>

      <div className="pb-[var(--personal-plan-shell-bottom-padding)] md:pb-0">
        <GatedPreview
          feature="routine"
          source="labs:gated-preview"
          exampleLabel="Beispiel · eine Chaarlie-Routine"
          benefit="Vier geprüfte Bausteine, die zusammenpassen."
          cta="Routine freischalten"
        >
          <PlaceholderRoutine />
        </GatedPreview>
      </div>

      {/* Inert stand-in for the mobile bottom nav. */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-50 min-h-[calc(4.5rem+env(safe-area-inset-bottom))] border-t border-border bg-background/95 backdrop-blur md:hidden"
      />
    </div>
  )
}

const PLACEHOLDER_STEPS = [
  { title: "Shampoo", body: "Sanft reinigen, 2× pro Woche. Kopfhaut zuerst." },
  { title: "Conditioner", body: "Nach jeder Wäsche in die Längen. 2 Minuten einwirken." },
  { title: "Maske", body: "1× pro Woche statt Conditioner. Längen und Spitzen." },
  { title: "Leave-in", body: "Ins handtuchtrockene Haar. Vor dem Föhnen." },
  { title: "Öl", body: "Nur die Spitzen. Sparsam, sonst beschwert es." },
  { title: "Hitzeschutz", body: "Immer vor Föhn oder Glätteisen." },
]

function PlaceholderRoutine() {
  return (
    <div className="flex flex-col gap-2.5">
      {PLACEHOLDER_STEPS.map((step) => (
        <section
          key={step.title}
          className="rounded-[14px] border border-border bg-card px-4 py-3.5"
        >
          <p className="text-[13px] font-bold text-foreground">{step.title}</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{step.body}</p>
        </section>
      ))}
    </div>
  )
}
