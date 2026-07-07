const DISMISSAL_WINDOW_DAYS = 14
const DISMISSAL_WINDOW_MS = DISMISSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000

export type DismissedSuggestionRow = {
  id: string
  user_id: string
  category: string
  dismissed_at: string
  reappear_at: string
}

type SupabaseErrorLike = {
  message?: string
}

type DismissedSuggestionInsert = {
  user_id: string
  category: string
  dismissed_at: string
  reappear_at: string
}

type DismissalReadClient = {
  from(table: "dismissed_suggestions"): {
    select(columns: "category"): {
      eq(
        column: "user_id",
        value: string,
      ): {
        gt(
          column: "reappear_at",
          value: string,
        ): Promise<{
          data: Array<Pick<DismissedSuggestionRow, "category">> | null
          error: SupabaseErrorLike | null
        }>
      }
    }
  }
}

type DismissalWriteClient = {
  from(table: "dismissed_suggestions"): {
    upsert(
      row: DismissedSuggestionInsert,
      options: { onConflict: "user_id,category" },
    ): {
      select(columns: "*"): {
        single(): Promise<{
          data: DismissedSuggestionRow | null
          error: SupabaseErrorLike | null
        }>
      }
    }
  }
}

export async function loadActiveDismissedSuggestionCategories({
  client,
  userId,
  now = new Date(),
}: {
  client: DismissalReadClient
  userId: string
  now?: Date
}): Promise<Set<string>> {
  const { data, error } = await client
    .from("dismissed_suggestions")
    .select("category")
    .eq("user_id", userId)
    .gt("reappear_at", now.toISOString())

  if (error) {
    throw new Error(`load dismissed suggestions: ${error.message ?? "unknown error"}`)
  }

  return new Set((data ?? []).map((row) => row.category))
}

export async function createDismissal({
  client,
  userId,
  category,
  now = new Date(),
}: {
  client: DismissalWriteClient
  userId: string
  category: string
  now?: Date
}): Promise<DismissedSuggestionRow> {
  const dismissedAt = now.toISOString()
  const reappearAt = new Date(now.getTime() + DISMISSAL_WINDOW_MS).toISOString()

  const { data, error } = await client
    .from("dismissed_suggestions")
    .upsert(
      {
        user_id: userId,
        category,
        dismissed_at: dismissedAt,
        reappear_at: reappearAt,
      },
      { onConflict: "user_id,category" },
    )
    .select("*")
    .single()

  if (error) {
    throw new Error(`create dismissed suggestion: ${error.message ?? "unknown error"}`)
  }
  if (!data) {
    throw new Error("create dismissed suggestion: no data returned")
  }

  return data
}
