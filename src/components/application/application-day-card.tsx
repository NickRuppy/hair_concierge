import Link from "next/link"
import { Clock3, ImageIcon, Moon, PackageOpen } from "lucide-react"

import type { PersonalPlanCategory } from "@/lib/routines/personal-plan/application/contracts"
import { cn } from "@/lib/utils"

import type { ApplicationDayView, ApplicationShelfSlotView } from "./application-types"

const CATALOG_IMAGE_CANVAS = "#f3f0e8"
const STANDARD_PRODUCT_IMAGE_PATH = "/storage/v1/object/public/product-images/"

const SILHOUETTES: Partial<
  Record<PersonalPlanCategory, { path: string; color: string; label: string }>
> = {
  shampoo: {
    path: "M25 17Q60 5 95 17L104 132Q103 146 88 151H80V170Q80 175 75 175H45Q40 175 40 170V151H32Q17 146 16 132Z",
    color: "#d4ae51",
    label: "Kopfstandtube",
  },
  conditioner: {
    path: "M9 74Q9 57 26 57H47V39H58V26H100Q110 26 110 35H69V57H94Q111 57 111 74V157Q111 169 99 169H21Q9 169 9 157Z",
    color: "#76b8ce",
    label: "breite Pumpflasche",
  },
  leave_in: {
    path: "M28 72Q28 58 42 58H47V42H43V20H86L112 30L104 43H74L69 54H72V58H81Q94 58 94 72V160Q94 170 84 170H38Q28 170 28 160Z",
    color: "#73b78f",
    label: "Trigger-Spray",
  },
  heat_protectant: {
    path: "M54 8H66V17H69V37C86 45 97 76 89 109L98 157Q60 174 22 157L31 109C23 76 34 45 51 37V17H54Z",
    color: "#dd836e",
    label: "Teardrop-Atomiser",
  },
  oil: {
    path: "M53 9H67Q78 9 78 20L72 49H73V72H74Q93 76 93 95V155Q93 171 77 171H43Q27 171 27 155V95Q27 76 46 70H47V49H48L42 20Q42 9 53 9Z",
    color: "#c8a35f",
    label: "Pipettenvial",
  },
  mask: {
    path: "M12 66H108Q115 66 115 73V94H111L102 158Q100 171 87 171H33Q20 171 18 158L9 94H5V73Q5 66 12 66Z",
    color: "#bd83c7",
    label: "niedriger Tiegel",
  },
  scalp_care: {
    path: "M78 10L88 17L68 51H69V71H83Q95 71 95 82V160Q95 171 84 171H36Q25 171 25 160V82Q25 70 37 70H45V51H47Z",
    color: "#839ecb",
    label: "Winkelapplikator",
  },
  dry_shampoo: {
    path: "M45 8H75V18Q83 18 83 31V166H37V31Q37 18 45 18Z",
    color: "#8eb9b3",
    label: "Aerosoldose",
  },
  bondbuilder: {
    path: "M17 16H103L94 132Q92 145 79 149H80V169Q80 175 74 175H46Q40 175 40 169V149H41Q28 145 26 132Z",
    color: "#a98ed0",
    label: "Behandlungstube",
  },
  deep_cleansing_shampoo: {
    path: "M23 24H58V42H70V65H98V165Q98 173 90 173H30Q22 173 22 165V65H47V34H12Q12 24 23 24Z",
    color: "#7f9eb3",
    label: "Apotheker-Pumpe",
  },
}

const CATEGORY_LABELS_DE: Partial<Record<PersonalPlanCategory, string>> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  heat_protectant: "Hitzeschutz",
  oil: "Öl",
  mask: "Maske",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigendes Shampoo",
}

function formatPartialFact(day: ApplicationDayView) {
  return [
    day.provisionalProductCount > 0
      ? `${day.provisionalProductCount} ${day.provisionalProductCount === 1 ? "Produkt" : "Produkte"} vorläufig`
      : null,
    day.unresolvedProductCount > 0
      ? `${day.unresolvedProductCount} ${day.unresolvedProductCount === 1 ? "Detail" : "Details"} offen`
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

function shelfStatusSummary(day: ApplicationDayView) {
  if (day.shelf.length === 0) return "Keine Produkte nötig"

  return day.shelf
    .map((slot) => {
      if (slot.kind === "open") return `${slot.categoryLabelDe}: Produkt noch offen`
      const status = slot.status === "provisional" ? "vorläufig" : "bestätigt"
      return `${CATEGORY_LABELS_DE[slot.category] ?? slot.category}: ${slot.productName} (${status})`
    })
    .join("; ")
}

function isStandardizedCatalogImage(imageUrl: string | null): imageUrl is string {
  if (!imageUrl) return false
  try {
    const url = new URL(imageUrl)
    return url.protocol === "https:" && url.pathname.includes(STANDARD_PRODUCT_IMAGE_PATH)
  } catch {
    return false
  }
}

function ProductSilhouette({
  slot,
  dayType,
  index,
}: {
  slot: Extract<ApplicationShelfSlotView, { kind: "product" }>
  dayType: ApplicationDayView["dayType"]
  index: number
}) {
  const silhouette = SILHOUETTES[slot.category]
  const standardized = Boolean(silhouette && isStandardizedCatalogImage(slot.imageUrl))

  if (!standardized || !silhouette || !slot.imageUrl) {
    return (
      <span
        data-application-shelf-slot={slot.status}
        data-application-image-treatment="fallback"
        className={cn(
          "relative z-10 grid h-28 min-w-0 flex-1 max-w-20 place-items-center overflow-hidden rounded-[18px] bg-[#f3f0e8] text-[var(--text-caption)] shadow-[0_14px_26px_-24px_rgba(44,23,72,0.9)]",
          slot.status === "provisional" && "border-2 border-dashed border-[#c58b50]",
        )}
      >
        {slot.imageUrl ? (
          // Owner imagery stays uncropped because its canvas and safe area are unknown.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.imageUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
        )}
        {slot.status === "provisional" ? <ProvisionalMark /> : null}
      </span>
    )
  }

  const clipId = `shelf-${dayType}-${slot.productId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}-${index}`
  return (
    <span
      data-application-shelf-slot={slot.status}
      data-application-silhouette={slot.category}
      className={cn(
        "relative z-10 h-28 min-w-0 flex-1 max-w-20",
        slot.status === "provisional" && "rounded-xl border-2 border-dashed border-[#c58b50]",
      )}
    >
      <svg viewBox="0 0 120 180" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d={silhouette.path} />
          </clipPath>
        </defs>
        <path d={silhouette.path} fill={CATALOG_IMAGE_CANVAS} />
        <image
          href={slot.imageUrl}
          x="0"
          y="0"
          width="120"
          height="180"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
        <path d={silhouette.path} fill="none" stroke={silhouette.color} strokeWidth="2.5" />
      </svg>
      {slot.status === "provisional" ? <ProvisionalMark /> : null}
    </span>
  )
}

function ProvisionalMark() {
  return (
    <span className="absolute -right-0.5 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#fff6e9] text-[#9b642c]">
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  )
}

function OpenSilhouette({ slot }: { slot: Extract<ApplicationShelfSlotView, { kind: "open" }> }) {
  const silhouette = SILHOUETTES[slot.category]
  return (
    <span
      data-application-shelf-slot="open"
      data-application-silhouette={silhouette ? slot.category : "fallback"}
      className="relative z-10 grid h-28 min-w-0 flex-1 max-w-20 place-items-center text-[var(--brand-plum)]"
    >
      {silhouette ? (
        <svg viewBox="0 0 120 180" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path
            d={silhouette.path}
            fill={CATALOG_IMAGE_CANVAS}
            fillOpacity="0.55"
            stroke={silhouette.color}
            strokeWidth="3"
            strokeDasharray="7 6"
          />
        </svg>
      ) : (
        <span className="absolute inset-0 rounded-[18px] border-2 border-dashed border-[var(--brand-plum-light)] bg-white/65" />
      )}
      <PackageOpen className="relative h-6 w-6" aria-hidden="true" />
      <span className="absolute -right-0.5 -top-2 rounded-full bg-[var(--brand-plum-ice)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-plum)]">
        Offen
      </span>
    </span>
  )
}

function Shelf({ day }: { day: ApplicationDayView }) {
  const shelf = day.shelf
  return (
    <span
      data-application-shelf-scene="true"
      className="relative mt-1 flex h-40 w-full items-end justify-center gap-1.5 overflow-hidden rounded-[18px] border border-border bg-[linear-gradient(180deg,#fffdfb_0%,#f7efe7_100%)] px-2 pb-6 pt-4 sm:gap-3 sm:px-4"
      aria-hidden="true"
    >
      <span
        className="absolute inset-x-6 bottom-4 h-2 rounded-full bg-[#d9b99c] shadow-[0_10px_18px_-12px_rgba(61,43,72,0.75)]"
        aria-hidden="true"
      />
      <span
        className="absolute inset-x-12 bottom-6 h-4 rounded-[50%] bg-[rgba(44,23,72,0.12)] blur-md"
        aria-hidden="true"
      />
      {!shelf.length ? (
        <span
          data-application-rest-day-visual="true"
          className="relative z-10 grid h-24 w-24 place-items-center rounded-full border border-[#e4d8cc] bg-[#f3f0e8] text-[var(--brand-plum)]"
        >
          <Moon className="h-11 w-11" aria-hidden="true" />
        </span>
      ) : null}
      {shelf.map((slot, index) =>
        slot.kind === "open" ? (
          <OpenSilhouette key={`open:${slot.category}:${index}`} slot={slot} />
        ) : (
          <ProductSilhouette
            key={`${slot.productId}:${index}`}
            slot={slot}
            dayType={day.dayType}
            index={index}
          />
        ),
      )}
    </span>
  )
}

export function ApplicationDayCard({ day }: { day: ApplicationDayView }) {
  const fact = formatDayFact(day)
  const shelfSummary = shelfStatusSummary(day)
  const summary = day.summaryDe.replace(/[.!?]+$/, "")

  return (
    <li className="w-full">
      <Link
        href={`/anwendung/${day.dayType}`}
        className="flex w-full flex-col rounded-[20px] border border-border bg-card p-3 text-left shadow-[0_12px_34px_-30px_rgba(var(--brand-plum-rgb),0.7)] transition-colors hover:border-[var(--brand-plum)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-4"
        aria-label={`${day.labelDe}: ${summary}${fact ? `. ${fact}` : ""}. Regal: ${shelfSummary}`}
      >
        <Shelf day={day} />
        <span className="mt-3 flex w-full items-start justify-between gap-3">
          <span className="type-h3 text-[var(--text-heading)]">{day.labelDe}</span>
          {day.isPartial ? (
            <span
              data-application-day-status="partial"
              className="type-caption shrink-0 font-semibold text-[#a4404a]"
            >
              Teilweise bereit
            </span>
          ) : null}
        </span>
        {fact ? <span className="type-caption mt-1 text-[var(--text-caption)]">{fact}</span> : null}
      </Link>
    </li>
  )
}
