import type { ShoppingBudget } from "@/lib/user-facts/schema"

/**
 * Outcome of one budget save. `conflict` is the facts revision guard (409 `profile_conflict`);
 * everything else that did not save is `unavailable`, and the caller keeps the user's answer.
 */
export type Stage3BudgetSaveResult =
  | { status: "saved"; budget: ShoppingBudget }
  | { status: "conflict" }
  | { status: "unavailable" }

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** `POST /api/profile/shopping-preferences` with the strict `{ budget }` body. */
export async function saveStage3ShoppingBudget(
  budget: ShoppingBudget,
  fetcher: FetchLike = fetch,
): Promise<Stage3BudgetSaveResult> {
  let response: Response
  try {
    response = await fetcher("/api/profile/shopping-preferences", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ budget }),
      cache: "no-store",
    })
  } catch {
    return { status: "unavailable" }
  }
  const body = (await response.json().catch(() => null)) as unknown
  if (response.status === 409 && isRecord(body) && body.error === "profile_conflict") {
    return { status: "conflict" }
  }
  if (!response.ok || !isRecord(body)) return { status: "unavailable" }
  const saved = parseShoppingBudget(body.budget)
  return saved ? { status: "saved", budget: saved } : { status: "unavailable" }
}

/** Client-side shape check of a budget the server echoed; anything else is not trusted. */
export function parseShoppingBudget(value: unknown): ShoppingBudget | null {
  if (!isRecord(value)) return null
  if (value.kind === "uncapped") return { kind: "uncapped" }
  if (
    value.kind === "capped" &&
    (value.limitEur === 5 || value.limitEur === 15) &&
    typeof value.allowExceptions === "boolean"
  ) {
    return { kind: "capped", limitEur: value.limitEur, allowExceptions: value.allowExceptions }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
