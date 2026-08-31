import { ArrowRight } from "lucide-react"

type BeforeAfterFigureProps = {
  className?: string
}

export function BeforeAfterFigure({ className = "" }: BeforeAfterFigureProps) {
  return (
    <figure
      className={`overflow-hidden rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white shadow-[0_24px_54px_-42px_rgba(var(--brand-plum-rgb),0.7)] sm:rounded-[1.75rem] ${className}`}
    >
      <div className="relative grid grid-cols-2 gap-2 bg-white p-2 sm:gap-4 sm:p-4">
        {[
          ["Heute", "left center", "bg-white/92 text-[var(--brand-plum-darkest)]"],
          ["Dein Ziel", "right center", "bg-white/92 text-[#255f40]"],
        ].map(([label, position, labelClass]) => (
          <div
            className="relative aspect-[3/4] overflow-hidden rounded-[1rem] sm:aspect-[2/3] sm:rounded-[1.15rem] [@media(min-width:640px)_and_(max-height:700px)]:aspect-[16/9]"
            key={label}
          >
            <div
              aria-label={
                label === "Heute" ? "Symbolische heutige Haarsituation" : "Symbolisches Haarziel"
              }
              className="absolute inset-0 bg-no-repeat"
              role="img"
              style={{
                backgroundImage:
                  "url('/images/funnels/personal-plan-offer/before-after-generic.webp')",
                backgroundPosition: position,
                backgroundSize: "200% auto",
              }}
            />
            <span
              className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-xs ${labelClass}`}
            >
              {label}
            </span>
          </div>
        ))}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[var(--brand-plum)] text-white shadow-lg sm:h-12 sm:w-12 sm:border-[6px]"
        >
          <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
        </span>
      </div>
      <figcaption className="border-t border-[rgba(var(--brand-plum-rgb),0.08)] px-4 py-2.5 text-center text-xs text-[rgba(var(--brand-plum-rgb),0.58)]">
        Symbolbild · Ergebnisse sind individuell
      </figcaption>
    </figure>
  )
}
