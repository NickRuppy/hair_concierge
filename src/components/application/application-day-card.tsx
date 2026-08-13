import type { ApplicationDayView } from "./application-types"
import Link from "next/link"
import { Clock3, ImageIcon, Moon, PackageOpen } from "lucide-react"

const SHELF_SLOT_HEIGHTS = ["h-[104px]", "h-[92px]", "h-[80px]", "h-[88px]"] as const

function formatPartialFact(day: ApplicationDayView) {
  return [
    day.provisionalProductCount > 0
      ? `${day.provisionalProductCount} ${
          day.provisionalProductCount === 1 ? "Produkt" : "Produkte"
        } vorläufig`
      : null,
    day.unresolvedProductCount > 0
      ? `${day.unresolvedProductCount} ${
          day.unresolvedProductCount === 1 ? "Detail" : "Details"
        } offen`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

function formatDayFact(day: ApplicationDayView) {
  if (day.isPartial) return formatPartialFact(day)
  if (day.steps.length === 0) return "Keine Produkte nötig"
  if (day.cadenceDe) return day.cadenceDe
  return `${day.steps.length} ${day.steps.length === 1 ? "Schritt" : "Schritte"}`
}

function Shelf({ day }: { day: ApplicationDayView }) {
  const shelf = day.shelf ?? []
  return (
    <span
      data-application-shelf-scene="true"
      className="relative mt-3 flex h-36 w-full items-end justify-center gap-2 overflow-hidden rounded-md border border-border bg-[linear-gradient(180deg,#fffdfb_0%,#f7efe7_100%)] px-3 pb-6 pt-4"
      aria-label={
        shelf.length
          ? `${shelf.length} Plätze im virtuellen Regal`
          : `${day.labelDe}: keine Produkte im virtuellen Regal`
      }
    >
      <span
        className="absolute inset-x-5 bottom-4 h-2 rounded-full bg-[#d9b99c] shadow-[0_10px_18px_-12px_rgba(61,43,72,0.75)]"
        aria-hidden="true"
      />
      <span
        className="absolute inset-x-10 bottom-6 h-4 rounded-[50%] bg-[rgba(44,23,72,0.12)] blur-md"
        aria-hidden="true"
      />
      {!shelf.length ? (
        <span
          data-application-rest-day-visual="true"
          className="relative z-10 grid h-24 w-24 place-items-center rounded-full border border-[#e4d8cc] bg-white/70 text-[var(--brand-plum)]"
          aria-label="Keine Produkte nötig"
        >
          <Moon className="h-12 w-12" aria-hidden="true" />
        </span>
      ) : null}
      {shelf.map((slot, index) =>
        slot.kind === "open" ? (
          <span
            key={`open:${index}`}
            data-application-shelf-slot="open"
            className="relative z-10 grid h-[88px] w-[58px] shrink-0 place-items-center rounded-md border-2 border-dashed border-[var(--brand-plum-light)] bg-white/65 text-[var(--brand-plum)]"
            aria-label={`${slot.categoryLabelDe}: Produkt noch offen`}
          >
            <PackageOpen className="h-6 w-6" aria-hidden="true" />
            <span className="absolute -right-1.5 -top-2 rounded-full bg-[var(--brand-plum-ice)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-plum)]">
              Offen
            </span>
          </span>
        ) : slot.imageUrl ? (
          <span
            key={`${slot.productId}:${index}`}
            data-application-shelf-slot={slot.status}
            className={`relative z-10 grid ${
              SHELF_SLOT_HEIGHTS[index % SHELF_SLOT_HEIGHTS.length]
            } w-[58px] shrink-0 place-items-end rounded-md bg-white p-1.5 shadow-[0_14px_26px_-24px_rgba(44,23,72,0.9)] ${
              slot.status === "provisional" ? "border-2 border-dashed border-[#c58b50]" : ""
            }`}
            aria-label={
              slot.status === "provisional"
                ? `${slot.productName}: vorläufig`
                : `${slot.productName}: bestätigt`
            }
          >
            {slot.status === "provisional" ? (
              <span className="absolute -right-1.5 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#fff6e9] text-[#9b642c]">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            ) : null}
            {/* Catalog sources may be owner-submitted and are not all Next image hosts. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.imageUrl} alt="" className="h-full w-full object-contain" />
          </span>
        ) : (
          <span
            key={`${slot.productId}:${index}`}
            data-application-shelf-slot="fallback"
            className={`relative z-10 grid h-[88px] w-[58px] shrink-0 place-items-center rounded-md bg-white/80 text-[var(--text-caption)] shadow-[0_14px_26px_-24px_rgba(44,23,72,0.9)] ${
              slot.status === "provisional" ? "border-2 border-dashed border-[#c58b50]" : ""
            }`}
            aria-label={`${slot.productName}: Bild nicht verfügbar`}
          >
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
          </span>
        ),
      )}
    </span>
  )
}

export function ApplicationDayCard({ day }: { day: ApplicationDayView }) {
  const fact = formatDayFact(day)

  return (
    <li className="w-[82vw] min-w-[270px] max-w-[360px] shrink-0 snap-start md:w-auto md:max-w-none">
      <Link
        href={`/anwendung/${day.dayType}`}
        className="flex h-full w-full flex-col rounded-md border border-border bg-card p-3 text-left shadow-[0_12px_34px_-30px_rgba(var(--brand-plum-rgb),0.7)] transition-colors hover:border-[var(--brand-plum)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${day.labelDe}: ${day.summaryDe}${fact ? `. ${fact}` : ""}`}
      >
        <Shelf day={day} />
        <span className="mt-3 flex w-full items-start justify-between gap-3">
          <span className="type-h3 text-[var(--text-heading)]">{day.labelDe}</span>
          {day.isPartial ? (
            <span
              data-application-day-status="partial"
              className="type-caption shrink-0 rounded-full bg-[#fff0f1] px-2 py-1 text-[#a4404a]"
            >
              Teilweise bereit
            </span>
          ) : null}
        </span>
        {fact ? <span className="type-caption mt-2 text-[var(--text-caption)]">{fact}</span> : null}
      </Link>
    </li>
  )
}
