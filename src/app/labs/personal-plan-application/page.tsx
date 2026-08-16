import { notFound } from "next/navigation"

import { RouteAwareApplicationPage } from "@/components/application/application-page"
import type { ApplicationDayView } from "@/components/application/application-types"

const longWashDaySteps = Array.from({ length: 12 }, (_, index) => ({
  kind: "transition" as const,
  stepKey: `wash-day-transition-${index + 1}`,
  copyDe: `Sanfter Anwendungsschritt ${index + 1}.`,
}))

const supportingDays: ApplicationDayView[] = [
  ["intensive_care_day", "Intensivpflegetag"],
  ["bond_repair_day", "Bond-Repair-Tag"],
  ["clarifying_wash_day", "Tiefenreinigungstag"],
  ["refresh_day", "Refresh-Tag"],
  ["between_wash_care_day", "Pflege zwischen Wäschen"],
  ["styling_day", "Stylingtag"],
].map(([dayType, labelDe], index) => ({
  dayType: dayType as ApplicationDayView["dayType"],
  sortOrder: 20 + index * 10,
  labelDe,
  summaryDe: "Deine bereits vorbereitete Anleitung für diesen Tag.",
  cadenceDe: "Nach Bedarf",
  steps: [],
  isPartial: false,
  provisionalProductCount: 0,
  unresolvedProductCount: 0,
  shelf: [],
}))

const days: ApplicationDayView[] = [
  {
    dayType: "wash_day",
    sortOrder: 10,
    labelDe: "Waschtag",
    summaryDe: "Waschen, pflegen und sanft trocknen.",
    cadenceDe: "Nach deinem Rhythmus",
    steps: longWashDaySteps,
    isPartial: false,
    provisionalProductCount: 0,
    unresolvedProductCount: 0,
    shelf: [],
  },
  ...supportingDays,
  {
    dayType: "rest_day",
    sortOrder: 80,
    labelDe: "Pausentag",
    summaryDe: "Heute ist keine Anwendung nötig.",
    cadenceDe: null,
    steps: [],
    isPartial: false,
    provisionalProductCount: 0,
    unresolvedProductCount: 0,
    shelf: [],
  },
]

export default function PersonalPlanApplicationLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <RouteAwareApplicationPage
      view={{ state: "ready", days }}
      navigationBasePath="/labs/personal-plan-application"
      routineBackHref="/labs/personal-plan-routine-editor"
    />
  )
}
