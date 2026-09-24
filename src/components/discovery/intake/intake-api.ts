import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import type {
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
 * Adds one product once her usage answer is in. The server opens research itself (from the
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

/** Changes how she uses a product (pill tap); `productType` only answers „Was ist das?". */
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

/** „Stimmt so – abschicken": the empty categories become „benutzt sie nicht", then submit. */
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
