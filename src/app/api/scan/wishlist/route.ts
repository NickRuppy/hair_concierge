import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import { presentCatalogCommerce } from "@/lib/personal-plan/routine/commerce"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type ScanWishlistEntry = {
  productId: string
  name: string
  brand: string | null
  imageUrl: string | null
  priceLabel: string | null
  purchaseUrl: string | null
}

type WishlistRow = {
  product_id: string
  products: {
    name: string
    brand: string | null
    image_url: string | null
    price_eur: number | null
    currency: string | null
    affiliate_link: string | null
    purchase_link_status: "available" | "unavailable" | null
    price_checked_at: string | null
  } | null
}

export type ScanWishlistRouteDeps = {
  getUserId: () => Promise<string | null>
  createAdminClient: typeof createAdminClient
  listWishlist: (client: SupabaseClient, userId: string) => Promise<ScanWishlistEntry[]>
}

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } })

export function createScanWishlistRouteHandler(deps: ScanWishlistRouteDeps) {
  return async function GET() {
    const userId = await deps.getUserId()
    if (!userId) return fail("unauthorized", 401)

    try {
      const client = deps.createAdminClient()
      const entries = await deps.listWishlist(client, userId)
      return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      console.error("[scan] wishlist list failed", error)
      return fail("temporarily_unavailable", 503)
    }
  }
}

export async function listScanWishlist(
  client: SupabaseClient,
  userId: string,
): Promise<ScanWishlistEntry[]> {
  const { data, error } = await client
    .from("scan_wishlist")
    .select(
      "product_id, products(name, brand, image_url, price_eur, currency, affiliate_link, purchase_link_status, price_checked_at)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw new Error("scan_wishlist_list_failed")

  const rows = (data ?? []) as unknown as WishlistRow[]
  return rows
    .filter((row): row is WishlistRow & { products: NonNullable<WishlistRow["products"]> } =>
      Boolean(row.products),
    )
    .map((row) => {
      const commerce = presentCatalogCommerce({
        priceEur: row.products.price_eur,
        currency: row.products.currency,
        affiliateLink: row.products.affiliate_link,
        purchaseLinkStatus: row.products.purchase_link_status,
        updatedAt: row.products.price_checked_at,
      })
      return {
        productId: row.product_id,
        name: row.products.name,
        brand: row.products.brand,
        imageUrl: row.products.image_url,
        priceLabel: commerce.priceLabel,
        purchaseUrl: commerce.productUrl,
      }
    })
}

export const GET = createScanWishlistRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  createAdminClient,
  listWishlist: listScanWishlist,
})
