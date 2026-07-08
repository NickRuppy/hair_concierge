import Link from "next/link"

export function StickyQuizCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[rgba(253,251,249,0.92)] px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[10px] md:hidden">
      <Link
        href="/quiz"
        prefetch={false}
        className="mx-auto block max-w-[560px] rounded-[12px] bg-[var(--brand-coral)] py-3 text-center font-bold text-[15.5px] text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)]"
      >
        Kostenlose Haaranalyse starten
        <span className="block text-[11.5px] font-normal text-white/85">
          2 Minuten · ohne Anmeldung
        </span>
      </Link>
    </div>
  )
}
