import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadAdminProductReviewQueue } from "@/lib/product-intake/admin-review-repository"
import {
  PRODUCT_REVIEW_GROUPS,
  type ProductReviewGroup,
} from "@/lib/product-intake/admin-review-model"
import {
  ProductReviewQueue,
  ProductReviewUnavailable,
} from "@/components/product-intake/admin-review"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Produktprüfung",
  robots: { index: false, follow: false },
}

export default async function ProductReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ gruppe?: string }>
}) {
  const auth = await requireAdmin()
  if ("response" in auth) notFound()
  const { gruppe } = await searchParams
  const group: ProductReviewGroup = PRODUCT_REVIEW_GROUPS.includes(gruppe as ProductReviewGroup)
    ? (gruppe as ProductReviewGroup)
    : "ready"
  let entries
  try {
    entries = await loadAdminProductReviewQueue(createAdminClient())
  } catch {
    return <ProductReviewUnavailable />
  }
  return <ProductReviewQueue entries={entries} group={group} />
}
