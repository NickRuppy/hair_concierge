import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { loadUserFacts } from "@/lib/user-facts/read"

import { withStage1ToolCards, type ToolFactsSource } from "./read-view"

/**
 * The facts read behind every read-time Tool view (Stage 1, Routine): the member's
 * `care_habits` and their per-field provenance, straight from `hair_profiles`. One query; a
 * member without a facts row reads as empty facts (every Tool need unverified).
 */
export async function loadToolFactsSource(
  admin: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<ToolFactsSource> {
  const facts = await loadUserFacts(admin as SupabaseClient, userId)
  return {
    careHabits: facts?.careHabits ?? null,
    fieldProvenance: facts?.provenance.care_habits?.fields,
  }
}

/**
 * Stage 1 (route and `/plan-start` loader): the snapshot handed to the Idealplan adapter with the
 * read-time Tool cards. A failed facts read means no cards; the Idealplan is never affected.
 * `hasOptionalPage` comes from the adapter (`planStartHasOptionalPage`), so the cards land on the
 * page the care products land on.
 */
export async function withReadTimeStage1ToolCards(
  snapshot: unknown,
  input: { loadFacts: () => Promise<ToolFactsSource>; hasOptionalPage: boolean },
): Promise<unknown> {
  let facts: ToolFactsSource
  try {
    facts = await input.loadFacts()
  } catch {
    return snapshot
  }
  return withStage1ToolCards(snapshot, { facts, hasOptionalPage: input.hasOptionalPage })
}
