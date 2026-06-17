import { createSupabaseClientFromEnv, flag, flagBool, flagInt, hashUserId, parseArgs } from "./cli"

const ACTIONABLE_STATUSES = [
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
] as const

type QueueRow = {
  id: string
  created_at: string
  user_id: string
  source: string
  category: string
  brand_text: string | null
  product_name_text: string | null
  front_image_path: string | null
  barcode_image_path: string | null
  status: string
}

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", 50)
  const statusFilter = flag(args, "status")
  const includeClosed = flagBool(args, "include-closed")

  let query = supabase
    .from("product_submissions")
    .select(
      [
        "id",
        "created_at",
        "user_id",
        "source",
        "category",
        "brand_text",
        "product_name_text",
        "front_image_path",
        "barcode_image_path",
        "status",
      ].join(", "),
    )
    .order("created_at", { ascending: true })
    .limit(limit)

  if (statusFilter) {
    query = query.eq("status", statusFilter)
  } else if (!includeClosed) {
    query = query.in("status", [...ACTIONABLE_STATUSES])
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`load product intake queue: ${error.message}`)
  }

  const rows = (data ?? []) as QueueRow[]
  if (rows.length === 0) {
    console.log("No product intake submissions found.")
    return
  }

  console.table(
    rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      user: hashUserId(row.user_id),
      source: row.source,
      category: row.category,
      brand: row.brand_text ?? "",
      name: row.product_name_text ?? "",
      front_image: row.front_image_path ? "yes" : "",
      barcode_image: row.barcode_image_path ? "yes" : "",
      status: row.status,
    })),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
