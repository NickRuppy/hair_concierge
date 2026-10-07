import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { z } from "zod"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { filterScanEligibleProductIds } from "@/lib/scan/catalog-eligibility"
import { lookupCatalogProductByIdentifier, validateEanInput } from "@/lib/scan/identifier-lookup"

import {
  discoveryIntakeError,
  discoveryIntakeJson,
  guardDiscoveryIntakeRequest,
  readJsonBody,
  type DiscoveryIntakeRouteDependencies,
} from "../intake/shared"

/**
 * `POST /api/beratung/identify` — the checklist scanner's IDENTITY lookup.
 *
 * Deliberately thin, and deliberately NOT `/api/scan/resolve`: a participant
 * capturing what sits in their bathroom must not be told whether it suits them.
 * The call is still hours away and the whole point of the discovery call is that
 * Nick does that part live. So this returns nothing but identity — no verdict, no
 * alternatives, no commerce — and the same three steps `/api/scan/resolve` opens
 * with: `validateEanInput` -> `lookupCatalogProductByIdentifier` ->
 * `filterScanEligibleProductIds`.
 *
 * `name`/`brand` come with it because the checklist stores the participant's own
 * words for every item (`brand_text` / `product_name_text`), including the ones
 * that resolved to a catalog row.
 */

const bodySchema = z.object({ identifier: z.string().trim().min(1) }).strict()

export type DiscoveryIdentifyResponse =
  | {
      kind: "catalog"
      productId: string
      category: PersonalPlanCategory
      name: string
      brand: string | null
    }
  | { kind: "unknown" }

export type DiscoveryProductIdentityRow = { name: string; brand: string | null } | null

export async function loadDiscoveryProductIdentity(
  client: SupabaseClient,
  productId: string,
): Promise<DiscoveryProductIdentityRow> {
  const { data, error } = await client
    .from("products")
    .select("name, brand")
    .eq("id", productId)
    .maybeSingle()
  if (error) throw new Error("discovery_identify_product_lookup_failed")
  return (data as DiscoveryProductIdentityRow) ?? null
}

export type DiscoveryIdentifyRouteDependencies = DiscoveryIntakeRouteDependencies & {
  validateEanInput?: typeof validateEanInput
  lookupCatalogProductByIdentifier?: typeof lookupCatalogProductByIdentifier
  filterScanEligibleProductIds?: typeof filterScanEligibleProductIds
  loadProductIdentity?: typeof loadDiscoveryProductIdentity
}

export function createDiscoveryIdentifyHandler(overrides: DiscoveryIdentifyRouteDependencies = {}) {
  const {
    validateEanInput: validate,
    lookupCatalogProductByIdentifier: lookup,
    filterScanEligibleProductIds: filterEligible,
    loadProductIdentity,
    ...guardOverrides
  } = overrides
  const validateEan = validate ?? validateEanInput
  const lookupCatalog = lookup ?? lookupCatalogProductByIdentifier
  const filter = filterEligible ?? filterScanEligibleProductIds
  const loadIdentity = loadProductIdentity ?? loadDiscoveryProductIdentity

  return async function POST(request: NextRequest) {
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response

    const parsed = bodySchema.safeParse(await readJsonBody(request))
    if (!parsed.success) return discoveryIntakeError("invalid_body", 400)

    const validated = validateEan(parsed.data.identifier)
    if (!validated.ok) return discoveryIntakeError("invalid_identifier", 400)

    const admin = guard.context.admin as unknown as SupabaseClient
    try {
      const match = await lookupCatalog(admin, { type: "ean", value: validated.value })
      if (!match)
        return discoveryIntakeJson({ kind: "unknown" } satisfies DiscoveryIdentifyResponse)

      // Same eligibility gate scan enforces: a quarantined or deactivated row is
      // not something we put in front of the participant as „dein Produkt".
      const eligible = await filter(admin, [match.productId])
      if (!eligible.has(match.productId)) {
        return discoveryIntakeJson({ kind: "unknown" } satisfies DiscoveryIdentifyResponse)
      }

      const identity = await loadIdentity(admin, match.productId)
      if (!identity)
        return discoveryIntakeJson({ kind: "unknown" } satisfies DiscoveryIdentifyResponse)

      return discoveryIntakeJson({
        kind: "catalog",
        productId: match.productId,
        category: match.category,
        name: identity.name,
        brand: identity.brand,
      } satisfies DiscoveryIdentifyResponse)
    } catch (error) {
      console.error("[discovery] identify failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryIdentifyHandler()
