import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import type { DiscoveryHeatStylingV1 } from "@/lib/discovery/heat-styling"

import type {
  DiscoveryIntakeHeatStylingBody,
  DiscoveryIntakeItemView,
  DiscoveryIntakeProductBody,
  DiscoveryIntakeUsagePatchBody,
} from "./types"

/**
 * The checklist's calls. Kept together (and free of React) so the screens stay about the
 * screen, not about transport. The flat checklist never calls `/api/scan/submit`: the
 * server opens research itself from the product type (batch 5, F1).
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

export async function removeIntakeItem(itemId: string): Promise<void> {
  const response = await fetch(`/api/beratung/intake/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  })
  if (!response.ok) throw await failure(response)
}

// --- Flat checklist (batch 5) ------------------------------------------------------

/**
 * Adds one product once her frequency answer is in (batch 7: the flow's last tap). The server opens research itself (from the
 * product type) — the flat checklist never calls `/api/scan/submit`.
 */
export async function addIntakeProduct(
  body: DiscoveryIntakeProductBody,
): Promise<DiscoveryIntakeItemView> {
  const response = await fetch("/api/beratung/intake/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await failure(response)
  return ((await response.json()) as { item: DiscoveryIntakeItemView }).item
}

/**
 * Edits a product (card tap): usage, frequency — or only the frequency („Wie oft?" on a draft
 * from the old checklist). `productType` only answers „Was ist das?" on a type-open item.
 */
export async function updateIntakeItemUsage(
  itemId: string,
  body: DiscoveryIntakeUsagePatchBody,
): Promise<DiscoveryIntakeItemView> {
  const response = await fetch(`/api/beratung/intake/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await failure(response)
  return ((await response.json()) as { item: DiscoveryIntakeItemView }).item
}

/** „Hitze & Styling" (batch 7): always the whole object; the route validates it. */
export async function saveIntakeHeatStyling(
  body: DiscoveryIntakeHeatStylingBody,
): Promise<DiscoveryHeatStylingV1> {
  const response = await fetch("/api/beratung/intake/heat-styling", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await failure(response)
  return ((await response.json()) as { heatStyling: DiscoveryHeatStylingV1 }).heatStyling
}

/** „Abschicken": the empty categories become „benutzt sie nicht", then submit. */
export async function submitIntakeConfirmingNone(): Promise<{
  submittedAt: string
  confirmedNone: PersonalPlanCategory[]
}> {
  const response = await fetch("/api/beratung/intake/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmNoneForMissing: true }),
  })
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as {
    submittedAt: string
    confirmedNone: PersonalPlanCategory[]
  }
  return { submittedAt: body.submittedAt, confirmedNone: body.confirmedNone }
}
