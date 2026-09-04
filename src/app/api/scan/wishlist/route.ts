import type { SupabaseClient } from "@supabase/supabase-js"

import { presentCatalogCommerce } from "@/lib/personal-plan/routine/commerce"
import { checkRateLimit } from "@/lib/rate-limit"
import { loadQuarantinedProductIdsAmong } from "@/lib/scan/catalog-eligibility"
import { captureScanException } from "@/lib/observability/scan"
import { createScanRoute, scanOk } from "@/lib/scan/route"
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
    is_active: boolean | null
    lifecycle_status: string | null
    price_eur: number | null
    currency: string | null
    affiliate_link: string | null
    purchase_link_status: "available" | "unavailable" | null
    price_checked_at: string | null
  } | null
}

export type ScanWishlistRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  listWishlist: (client: SupabaseClient, userId: string) => Promise<ScanWishlistEntry[]>
  captureScanException?: typeof captureScanException
}

export function createScanWishlistRouteHandler(deps: ScanWishlistRouteDeps) {
  return createScanRoute<undefined>({
    route: "wishlist",
    deps,
    parse: async () => ({ ok: true, body: undefined }),
    failureReason: "wishlist_list_failed",
    handler: async (ctx) => {
      const client = deps.createAdminClient()
      const entries = await deps.listWishlist(client, ctx.userId)
      return scanOk({ entries })
    },
  })
}

export async function listScanWishlist(
  client: SupabaseClient,
  userId: string,
): Promise<ScanWishlistEntry[]> {
  const { data, error } = await client
    .from("scan_wishlist")
    .select(
      "product_id, products(name, brand, image_url, is_active, lifecycle_status, price_eur, currency, affiliate_link, purchase_link_status, price_checked_at)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw new Error("scan_wishlist_list_failed")

  const rows = (data ?? []) as unknown as WishlistRow[]
  // A Merkliste entry is a "buy this later" pointer, so it has to pass the same catalog
  // gate as everything else scan surfaces (ruling R7 + the lifecycle predicate): a product
  // retired, discontinued or quarantined after it was saved must not keep offering a buy
  // link. v1 drops such rows from the listing silently — the stored row stays, so the
  // entry reappears if the product becomes eligible again.
  const withProduct = rows.filter(
    (row): row is WishlistRow & { products: NonNullable<WishlistRow["products"]> } =>
      Boolean(row.products) &&
      row.products?.is_active === true &&
      row.products?.lifecycle_status === "active",
  )
  const quarantined = await loadQuarantinedProductIdsAmong(
    client,
    withProduct.map((row) => row.product_id),
  )

  return withProduct
    .filter((row) => !quarantined.has(row.product_id))
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
  checkRateLimit,
  createAdminClient,
  listWishlist: listScanWishlist,
})
