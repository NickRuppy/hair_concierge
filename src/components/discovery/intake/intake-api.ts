import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import type { DiscoveryIntakeCaptureInput, DiscoveryIntakeItemView } from "./types"

/**
 * The checklist's calls. Kept together (and free of React) so the entry
 * component stays about the screen, not about transport.
 *
 * `submitProductForResearch` is the caller the plan asks for: it speaks to the
 * EXISTING `POST /api/scan/submit` and reads BOTH of its outcomes —
 * `200 {kind:"already_in_catalog", productId}` and
 * `202 {kind:"pending_submission", submissionId}` — because the checklist stores
 * either one as the item's identity.
 */

export type DiscoveryIdentifyOutcome =
  | {
      kind: "catalog"
      productId: string
      category: PersonalPlanCategory
      name: string
      brand: string | null
    }
  | { kind: "unknown" }

export type DiscoveryResearchOutcome =
  | { kind: "already_in_catalog"; productId: string }
  | { kind: "pending_submission"; submissionId: string }

export class DiscoveryIntakeRequestError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
    this.name = "DiscoveryIntakeRequestError"
  }
}

async function failure(response: Response): Promise<DiscoveryIntakeRequestError> {
  try {
    const body = (await response.json()) as { code?: unknown }
    return new DiscoveryIntakeRequestError(
      typeof body?.code === "string" ? body.code : `http_${response.status}`,
    )
  } catch {
    return new DiscoveryIntakeRequestError(`http_${response.status}`)
  }
}

export async function identifyBarcode(identifier: string): Promise<DiscoveryIdentifyOutcome> {
  const response = await fetch("/api/beratung/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  })
  if (!response.ok) throw await failure(response)
  return (await response.json()) as DiscoveryIdentifyOutcome
}

export async function submitProductForResearch(input: {
  category: PersonalPlanCategory
  identifier?: string
  brandText?: string
  productNameText?: string
}): Promise<DiscoveryResearchOutcome> {
  const response = await fetch("/api/scan/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: input.category,
      ...(input.identifier ? { identifier: { type: "ean", value: input.identifier } } : {}),
      ...(input.brandText ? { brandText: input.brandText } : {}),
      ...(input.productNameText ? { productNameText: input.productNameText } : {}),
    }),
  })
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as
    | { kind: "already_in_catalog"; productId: string }
    | { kind: "pending_submission"; submissionId: string; headline: string }
  return body.kind === "already_in_catalog"
    ? { kind: "already_in_catalog", productId: body.productId }
    : { kind: "pending_submission", submissionId: body.submissionId }
}

export async function addIntakeItem(
  category: PersonalPlanCategory,
  capture: DiscoveryIntakeCaptureInput,
): Promise<DiscoveryIntakeItemView> {
  const response = await fetch("/api/beratung/intake/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, capture }),
  })
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as { item: DiscoveryIntakeItemView }
  return body.item
}

export async function removeIntakeItem(itemId: string): Promise<void> {
  const response = await fetch(`/api/beratung/intake/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  })
  if (!response.ok) throw await failure(response)
}

export async function submitIntake(): Promise<void> {
  const response = await fetch("/api/beratung/intake/submit", { method: "POST" })
  if (!response.ok) throw await failure(response)
}
