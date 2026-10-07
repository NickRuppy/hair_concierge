import { notFound } from "next/navigation"

import { TrialOfferLabClient } from "./trial-offer-lab-client"

const VIEWPORT_WIDTHS = [360, 390] as const

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function TrialOfferLabPage({
  searchParams,
}: {
  searchParams: Promise<{ width?: string | string[]; launchCoupon?: string | string[] }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()

  const params = await searchParams
  const widthValue = firstValue(params.width) ?? "390"
  const width = VIEWPORT_WIDTHS.find((candidate) => candidate === Number(widthValue))
  const launchCoupon = firstValue(params.launchCoupon) ?? "on"

  if (width === undefined || !["on", "off"].includes(launchCoupon)) notFound()

  return <TrialOfferLabClient launchCoupon={launchCoupon === "on"} width={width} />
}
