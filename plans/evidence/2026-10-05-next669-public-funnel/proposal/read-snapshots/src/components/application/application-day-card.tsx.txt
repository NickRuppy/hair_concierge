import type { MouseEvent } from "react"
import Link from "next/link"
import { ImageIcon, Moon, PackageOpen } from "lucide-react"

import type { PersonalPlanCategory } from "@/lib/routines/personal-plan/application/contracts"

import type { ApplicationDayView, ApplicationShelfSlotView } from "./application-types"

const CATALOG_IMAGE_CANVAS = "#f3f0e8"
const STANDARD_PRODUCT_IMAGE_PATH = "/storage/v1/object/public/product-images/"
const SHELF_SLOTS_PER_ROW = 5

type SilhouetteImageBounds = {
  x: number
  y: number
  width: number
  height: number
}

const SILHOUETTES: Partial<
  Record<PersonalPlanCategory, { path: string; color: string; image: SilhouetteImageBounds }>
> = {
  shampoo: {
    path: "M2 178V76Q2 59 19 53L34 48V31H86V48L101 53Q118 59 118 76V178Z",
    color: "#d0a43c",
    image: { x: -5, y: 20, width: 130, height: 160 },
  },
  conditioner: {
    path: "M20 178L13 49Q12 31 30 25H90Q108 31 107 49L100 178Z",
    color: "#67abc4",
    image: { x: -4, y: 17, width: 128, height: 164 },
  },
  leave_in: {
    path: "M28 178V73Q28 58 43 58H48V42H43V23H78L112 34L104 50H76L69 58H80Q94 58 94 73V178Z",
    color: "#68ad88",
    image: { x: 4, y: 16, width: 112, height: 166 },
  },
  heat_protectant: {
    path: "M24 178L33 101Q28 70 45 54V31H75V54Q92 70 87 101L96 178Z",
    color: "#d98271",
    image: { x: 16, y: 24, width: 88, height: 158 },
  },
  oil: {
    path: "M24 178V88Q24 70 43 62V49L36 22Q35 9 50 8H70Q85 9 84 22L77 49V62Q96 70 96 88V178Z",
    color: "#bc914e",
    image: { x: 3, y: 4, width: 114, height: 176 },
  },
  mask: {
    path: "M10 178L17 91H23V72H97V91H103L110 178Z",
    color: "#b47fbd",
    image: { x: 14, y: 72, width: 92, height: 102 },
  },
  scalp_care: {
    path: "M31 178V76Q31 61 46 61H50V46H48V28H69L92 10L101 18L78 49V61H84Q98 61 98 76V178Z",
    color: "#788fc1",
    image: { x: 16, y: 8, width: 88, height: 170 },
  },
  dry_shampoo: {
    path: "M28 178V42Q28 27 45 21V10H75V21Q92 27 92 42V178Z",
    color: "#78a8a2",
    image: { x: 18, y: 4, width: 84, height: 174 },
  },
  bondbuilder: {
    path: "M18 25H102L94 148Q92 163 80 166V178H40V166Q28 163 26 148Z",
    color: "#987bc3",
    image: { x: 8, y: 12, width: 104, height: 168 },
  },
  deep_cleansing_shampoo: {
    path: "M23 178V73Q23 58 38 58H46V41H58V25H96L110 31L103 45H74V58H84Q98 58 98 73V178Z",
    color: "#708da2",
    image: { x: 13, y: 18, width: 94, height: 160 },
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
  return day.unresolvedProductCount > 0
    ? `${day.unresolvedProductCount} ${day.unresolvedProductCount === 1 ? "Detail" : "Details"} offen`
    : ""
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
      // A demoted confirmed product is unavailable, not an open decision.
      if (slot.kind === "open")
        return slot.reason === "catalog_unavailable"
          ? `${slot.categoryLabelDe}: Produkt gerade nicht verfügbar`
          : `${slot.categoryLabelDe}: Produkt noch offen`
      return `${CATEGORY_LABELS_DE[slot.category] ?? slot.category}: ${slot.productName}`
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
        className="relative z-10 grid h-32 min-w-0 flex-1 max-w-24 place-items-center overflow-hidden rounded-[18px] bg-[#f3f0e8] text-[var(--text-caption)] shadow-[0_14px_26px_-24px_rgba(44,23,72,0.9)]"
      >
        {slot.imageUrl ? (
          // Owner imagery stays uncropped because its canvas and safe area are unknown.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.imageUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
        )}
      </span>
    )
  }

  const clipId = `shelf-${dayType}-${slot.productId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}-${index}`
  return (
    <span
      data-application-shelf-slot={slot.status}
      data-application-silhouette={slot.category}
      data-application-image-treatment="standardized"
      className="relative z-10 h-32 min-w-0 flex-1 max-w-24"
    >
      <svg viewBox="0 0 120 180" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d={silhouette.path} />
          </clipPath>
        </defs>
        <path d={silhouette.path} fill={CATALOG_IMAGE_CANVAS} />
        <image
          data-application-silhouette-image={slot.category}
          href={slot.imageUrl}
          x={silhouette.image.x}
          y={silhouette.image.y}
          width={silhouette.image.width}
          height={silhouette.image.height}
          preserveAspectRatio="xMidYMid meet"
          clipPath={`url(#${clipId})`}
        />
        <path d={silhouette.path} fill="none" stroke={silhouette.color} strokeWidth="2.5" />
      </svg>
    </span>
  )
}

function OpenSilhouette({ slot }: { slot: Extract<ApplicationShelfSlotView, { kind: "open" }> }) {
  const silhouette = SILHOUETTES[slot.category]
  // Keep the sighted badge and the shelf aria-label telling the same story.
  const catalogUnavailable = slot.reason === "catalog_unavailable"
  return (
    <span
      data-application-shelf-slot="open"
      data-application-silhouette={silhouette ? slot.category : "fallback"}
      className="relative z-10 grid h-32 min-w-0 flex-1 max-w-24 place-items-center text-[var(--brand-plum)]"
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
      <span
        className={`absolute -right-0.5 -top-2 whitespace-nowrap rounded-full bg-[var(--brand-plum-ice)] px-1.5 py-0.5 font-bold text-[var(--brand-plum)] ${
          catalogUnavailable ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {catalogUnavailable ? "Nicht verfügbar" : "Offen"}
      </span>
    </span>
  )
}

function chunkShelfSlots(shelf: ApplicationShelfSlotView[]) {
  const rows: ApplicationShelfSlotView[][] = []
  for (let index = 0; index < shelf.length; index += SHELF_SLOTS_PER_ROW) {
    rows.push(shelf.slice(index, index + SHELF_SLOTS_PER_ROW))
  }
  return rows
}

function ShelfRail() {
  return (
    <>
      <span
        className="absolute inset-x-4 bottom-4 h-2 rounded-full bg-[#d9b99c] shadow-[0_10px_18px_-12px_rgba(61,43,72,0.75)] sm:inset-x-6"
        aria-hidden="true"
      />
      <span
        className="absolute inset-x-8 bottom-6 h-4 rounded-[50%] bg-[rgba(44,23,72,0.12)] blur-md sm:inset-x-12"
        aria-hidden="true"
      />
    </>
  )
}

function ShelfRow({
  slots,
  day,
  offset,
}: {
  slots: ApplicationShelfSlotView[]
  day: ApplicationDayView
  offset: number
}) {
  return (
    <span
      data-application-shelf-row="true"
      className="relative flex h-40 w-full items-end justify-center gap-0 overflow-visible px-1 pb-6 pt-4 sm:px-2"
    >
      <ShelfRail />
      {slots.map((slot, rowIndex) => {
        const index = offset + rowIndex
        return slot.kind === "open" ? (
          <OpenSilhouette key={`open:${slot.category}:${index}`} slot={slot} />
        ) : (
          <ProductSilhouette
            key={`${slot.productId}:${index}`}
            slot={slot}
            dayType={day.dayType}
            index={index}
          />
        )
      })}
    </span>
  )
}

function Shelf({ day }: { day: ApplicationDayView }) {
  const shelf = day.shelf
  if (!shelf.length) {
    return (
      <span
        data-application-shelf-scene="true"
        className="relative mt-1 flex h-40 w-full items-end justify-center overflow-hidden rounded-[18px] border border-border bg-[#e9e3ed] px-2 pb-6 pt-4"
        aria-hidden="true"
      >
        <ShelfRail />
        <span
          data-application-rest-day-visual="true"
          className="relative z-10 grid h-24 w-24 place-items-center rounded-full border border-[#e4d8cc] bg-[#f3f0e8] text-[var(--brand-plum)]"
        >
          <Moon className="h-11 w-11" aria-hidden="true" />
        </span>
      </span>
    )
  }

  const rows = chunkShelfSlots(shelf)
  return (
    <span
      data-application-shelf-scene="true"
      className="relative mt-1 grid w-full gap-2 rounded-[18px] border border-border bg-[#e9e3ed] px-1 py-2 sm:px-2"
      aria-hidden="true"
    >
      {rows.map((slots, rowIndex) => (
        <ShelfRow
          key={`shelf-row:${rowIndex}`}
          slots={slots}
          day={day}
          offset={rowIndex * SHELF_SLOTS_PER_ROW}
        />
      ))}
    </span>
  )
}

export function ApplicationDayCard({
  day,
  onOpenDay,
  navigationBasePath = "/anwendung",
}: {
  day: ApplicationDayView
  onOpenDay?: (event: MouseEvent<HTMLAnchorElement>, dayType: ApplicationDayView["dayType"]) => void
  navigationBasePath?: string
}) {
  const fact = formatDayFact(day)
  const shelfSummary = shelfStatusSummary(day)
  const summary = day.summaryDe.replace(/[.!?]+$/, "")

  return (
    <li className="w-full">
      <Link
        href={`${navigationBasePath}/${day.dayType}`}
        prefetch={false}
        data-application-navigation="day"
        onClick={(event) => onOpenDay?.(event, day.dayType)}
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
