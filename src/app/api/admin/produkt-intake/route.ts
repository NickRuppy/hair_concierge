import { createProductReviewReadHandlers } from "@/lib/product-intake/admin-review-http"

export const dynamic = "force-dynamic"
export const GET = createProductReviewReadHandlers().queue
