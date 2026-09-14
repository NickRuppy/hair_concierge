import {
  SHAMPOO_V14_PILOT_PROPERTY_KEYS,
  ShampooV14PilotReviewError,
  applyShampooV14PilotReviewAction,
  loadShampooV14PilotReviewItems,
  resolveShampooV14ReviewDataset,
  type ReviewOptions,
  type ShampooV14PilotReviewActionInput,
} from "@/lib/labs/shampoo-v14-pilot-review"
import { NextResponse } from "next/server"
import { z } from "zod"

const propertySchema = z.enum(SHAMPOO_V14_PILOT_PROPERTY_KEYS)
const actionSchema = z
  .object({
    action: z.enum([
      "approve_formula",
      "approve_property",
      "approve_projection",
      "request_rework",
      "approve_product",
    ]),
    productId: z.string().trim().min(1),
    expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
    datasetId: z.string().trim().min(1).max(40).optional(),
    property: propertySchema.optional(),
    scope: z.union([z.literal("formula"), z.literal("projection"), propertySchema]).optional(),
    comment: z.string().max(4_000).optional(),
  })
  .strict()

type ReviewActionResult = ReturnType<typeof applyShampooV14PilotReviewAction>

export interface ShampooV14PilotReviewRouteDeps {
  applyAction: (
    input: ShampooV14PilotReviewActionInput,
    options: ReviewOptions,
  ) => ReviewActionResult
  loadItems: (options: ReviewOptions) => ReturnType<typeof loadShampooV14PilotReviewItems>
}

export type ShampooV14PilotReviewRouteOptions = {
  environment?: string
  reviewOptions?: ReviewOptions
  deps?: ShampooV14PilotReviewRouteDeps
}

const defaultDeps: ShampooV14PilotReviewRouteDeps = {
  applyAction: applyShampooV14PilotReviewAction,
  loadItems: loadShampooV14PilotReviewItems,
}

function developmentOnlyResponse() {
  return NextResponse.json({ error: "Nur lokal in development verfuegbar." }, { status: 404 })
}

function reviewSummary(items: ReturnType<typeof loadShampooV14PilotReviewItems>) {
  return {
    total: items.length,
    ready: items.filter((item) => item.integrity.status === "ready").length,
    blocked: items.filter((item) => item.integrity.status === "blocked").length,
    approved: items.filter((item) => item.review.product.status === "approved").length,
  }
}

export function handleShampooV14PilotReviewRequest(
  body: unknown,
  options: ShampooV14PilotReviewRouteOptions = {},
) {
  if ((options.environment ?? process.env.NODE_ENV) !== "development") {
    return developmentOnlyResponse()
  }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Review-Anfrage", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const deps = options.deps ?? defaultDeps
  let reviewOptions: ReviewOptions | undefined = options.reviewOptions
  try {
    reviewOptions ??= resolveShampooV14ReviewDataset(parsed.data.datasetId).options
    const action = { ...parsed.data }
    delete action.datasetId
    const result = deps.applyAction(action, reviewOptions)
    const items = deps.loadItems(reviewOptions)
    const item = items.find((candidate) => candidate.id === result.item.id) ?? result.item
    return NextResponse.json({ item, items, summary: reviewSummary(items) })
  } catch (error) {
    if (error instanceof ShampooV14PilotReviewError) {
      if (error.status === 409 && reviewOptions) {
        const items = deps.loadItems(reviewOptions)
        return NextResponse.json(
          { error: error.message, items, summary: reviewSummary(items) },
          { status: error.status },
        )
      }
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lokaler Review-Fehler" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungueltige Review-Anfrage" }, { status: 400 })
  }
  return handleShampooV14PilotReviewRequest(body)
}
