import { notFound } from "next/navigation"

import {
  ShampooV14PilotReviewError,
  loadShampooV14PilotReviewItems,
  resolveShampooV14ReviewDataset,
} from "@/lib/labs/shampoo-v14-pilot-review"
import { ShampooV14PilotClient } from "./shampoo-v14-pilot-client"

function isDevelopment() {
  return process.env.NODE_ENV === "development"
}

export default async function ShampooResearchLabPage({
  searchParams,
}: {
  searchParams: Promise<{ dataset?: string | string[] }>
}) {
  if (!isDevelopment()) notFound()

  const rawDataset = (await searchParams).dataset
  if (Array.isArray(rawDataset)) notFound()
  let dataset: ReturnType<typeof resolveShampooV14ReviewDataset>
  let items: ReturnType<typeof loadShampooV14PilotReviewItems>
  try {
    dataset = resolveShampooV14ReviewDataset(rawDataset)
    items = loadShampooV14PilotReviewItems(dataset.options)
  } catch (error) {
    if (error instanceof ShampooV14PilotReviewError && error.status === 404) notFound()
    throw error
  }
  const initialItem =
    items.find(
      (item) => item.integrity.status === "ready" && item.review.product.status !== "approved",
    ) ??
    items.find((item) => item.integrity.status === "ready") ??
    items[0] ??
    null

  return (
    <ShampooV14PilotClient
      datasetId={dataset.id}
      initialItems={items}
      initialItemId={initialItem?.id ?? null}
    />
  )
}
