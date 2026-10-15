import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { productReviewId } from "@/lib/product-intake/admin-review-http"
import { loadAdminProductReviewDetail } from "@/lib/product-intake/admin-review-repository"
import {
  ProductReviewDetailView,
  ProductReviewUnavailable,
} from "@/components/product-intake/admin-review"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Produkt prüfen",
  robots: { index: false, follow: false },
}

export default async function ProductReviewDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>
}) {
  const auth = await requireAdmin()
  if ("response" in auth) notFound()
  const { submissionId } = await params
  if (!productReviewId.safeParse(submissionId).success) notFound()
  let detail
  try {
    detail = await loadAdminProductReviewDetail(createAdminClient(), submissionId)
  } catch {
    return <ProductReviewUnavailable href={`/admin/produkt-intake/${submissionId}`} />
  }
  if (!detail) notFound()
  return <ProductReviewDetailView detail={detail} />
}
