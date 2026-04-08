import { createAdminClient } from "@/lib/supabase/admin"
import type { Product, UserMemoryEntry, UserMemoryKind } from "@/lib/types"

const MEMORY_HARD_CAP = 2000

export const USER_MEMORY_KINDS: UserMemoryKind[] = [
  "preference",
  "routine",
  "product_experience",
  "hair_history",
  "progress",
  "sensitivity",
  "medical_context",
  "legacy_summary",
  "other",
]

export interface UserMemoryContext {
  enabled: boolean
  entries: UserMemoryEntry[]
  promptContext: string | null
  dislikedProductNames: string[]
}

export interface ExtractedMemoryCandidate {
  kind: UserMemoryKind
  memory_key?: string | null
  content: string
  evidence?: string | null
  confidence?: number | null
  product_names?: string[] | null
  sentiment?: "positive" | "negative" | "neutral" | null
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>

function hasMissingMemoryTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "42703" ||
        error.message?.includes("user_memory_") ||
        error.message?.includes("conversation_memory") ||
        error.message?.includes("memory_extracted_at_count"))
  )
}

export function normalizeMemoryToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function normalizeProductName(value: string): string {
  return normalizeMemoryToken(value).replace(/_/g, "")
}

export function normalizeMemoryKey(memory: Pick<ExtractedMemoryCandidate, "kind" | "content" | "memory_key" | "product_names">): string {
  const productName = memory.product_names?.find((name) => name.trim().length > 0)
  const keySource = memory.memory_key?.trim() || productName || memory.content
  return `${memory.kind}:${normalizeMemoryToken(keySource).slice(0, 120)}`
}

export function isValidMemoryKind(kind: string): kind is UserMemoryKind {
  return USER_MEMORY_KINDS.includes(kind as UserMemoryKind)
}

export function sanitizeMemoryCandidate(candidate: ExtractedMemoryCandidate): ExtractedMemoryCandidate | null {
  const content = candidate.content.trim().replace(/\s+/g, " ")
  const confidence = candidate.confidence ?? null

  if (!isValidMemoryKind(candidate.kind)) return null
  if (content.length < 8 || content.length > 500) return null
  if (confidence != null && (confidence < 0 || confidence > 1)) return null
  if (confidence != null && confidence < 0.72) return null

  return {
    ...candidate,
    content,
    evidence: candidate.evidence?.trim() || null,
    confidence,
    product_names: (candidate.product_names ?? [])
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 5),
    sentiment: candidate.sentiment ?? null,
  }
}

export function buildMemoryPromptContext(entries: UserMemoryEntry[]): string | null {
  const activeEntries = entries.filter((entry) => entry.status === "active" && entry.content.trim())
  if (activeEntries.length === 0) return null

  return activeEntries
    .map((entry) => `- ${entry.content.trim()}`)
    .join("\n")
    .slice(0, MEMORY_HARD_CAP)
}

export function extractDislikedProductNames(entries: UserMemoryEntry[]): string[] {
  const names = new Set<string>()

  for (const entry of entries) {
    if (entry.status !== "active" || entry.kind !== "product_experience") continue
    if (entry.metadata?.sentiment !== "negative") continue

    const productNames = Array.isArray(entry.metadata.product_names)
      ? entry.metadata.product_names
      : []

    for (const productName of productNames) {
      if (typeof productName === "string" && productName.trim()) {
        names.add(productName.trim())
      }
    }
  }

  return [...names]
}

function productMatchesMemoryName(product: Product, dislikedProductName: string): boolean {
  const productName = normalizeProductName(product.name)
  const memoryName = normalizeProductName(dislikedProductName)

  if (!productName || !memoryName) return false
  return productName === memoryName
}

export function applyProductMemoryConstraints<T extends Product>(
  products: T[],
  memoryContext: Pick<UserMemoryContext, "enabled" | "dislikedProductNames">
): T[] {
  if (!memoryContext.enabled || memoryContext.dislikedProductNames.length === 0) {
    return products
  }

  const disliked = memoryContext.dislikedProductNames
  const neutralProducts: T[] = []
  const dislikedProducts: T[] = []

  for (const product of products) {
    if (disliked.some((name) => productMatchesMemoryName(product, name))) {
      dislikedProducts.push(product)
    } else {
      neutralProducts.push(product)
    }
  }

  return [...neutralProducts, ...dislikedProducts]
}

export async function ensureUserMemorySettings(
  userId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<boolean> {
  const { data: existing, error: loadError } = await supabase
    .from("user_memory_settings")
    .select("memory_enabled")
    .eq("user_id", userId)
    .maybeSingle()

  if (loadError) {
    if (!hasMissingMemoryTable(loadError)) {
      console.error("Failed to load user memory settings:", loadError)
    }
    return true
  }

  if (existing) return existing.memory_enabled ?? true

  const { data, error } = await supabase
    .from("user_memory_settings")
    .insert({ user_id: userId, memory_enabled: true })
    .select("memory_enabled")
    .single()

  if (error) {
    if (!hasMissingMemoryTable(error)) {
      console.error("Failed to ensure user memory settings:", error)
    }
    return true
  }

  return data?.memory_enabled ?? true
}

export async function getUserMemoryEnabled(
  userId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_memory_settings")
    .select("memory_enabled")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (!hasMissingMemoryTable(error)) {
      console.error("Failed to load memory settings:", error)
    }
    return true
  }

  return data?.memory_enabled ?? true
}

export async function listUserMemoryEntries(
  userId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<UserMemoryEntry[]> {
  const { data, error } = await supabase
    .from("user_memory_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })

  if (error) {
    if (!hasMissingMemoryTable(error)) {
      console.error("Failed to load memory entries:", error)
    }
    return []
  }

  return (data ?? []) as UserMemoryEntry[]
}

export async function loadUserMemoryContext(
  userId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<UserMemoryContext> {
  const enabled = await getUserMemoryEnabled(userId, supabase)
  if (!enabled) {
    return {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    }
  }

  const entries = await listUserMemoryEntries(userId, supabase)

  return {
    enabled,
    entries,
    promptContext: buildMemoryPromptContext(entries),
    dislikedProductNames: extractDislikedProductNames(entries),
  }
}

export async function backfillLegacyConversationMemory(
  userId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<void> {
  const { data: existingEntries, error: entryError } = await supabase
    .from("user_memory_entries")
    .select("id")
    .eq("user_id", userId)
    .limit(1)

  if (entryError) {
    if (!hasMissingMemoryTable(entryError)) {
      console.error("Failed to check legacy memory backfill:", entryError)
    }
    return
  }

  if ((existingEntries ?? []).length > 0) return

  const { data: profile, error: profileError } = await supabase
    .from("hair_profiles")
    .select("conversation_memory")
    .eq("user_id", userId)
    .maybeSingle()

  if (profileError) {
    if (!hasMissingMemoryTable(profileError)) {
      console.error("Failed to load legacy memory:", profileError)
    }
    return
  }

  const legacyMemory = profile?.conversation_memory?.trim()
  if (!legacyMemory) return

  await supabase.from("user_memory_entries").insert({
    user_id: userId,
    kind: "legacy_summary",
    content: legacyMemory.slice(0, 500),
    normalized_key: "legacy_summary:conversation_memory",
    source: "legacy",
    confidence: null,
    metadata: {},
  })
}

export async function rebuildConversationMemoryCache(
  userId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<void> {
  const entries = await listUserMemoryEntries(userId, supabase)
  const cache = buildMemoryPromptContext(entries)

  const { error } = await supabase
    .from("hair_profiles")
    .update({ conversation_memory: cache })
    .eq("user_id", userId)

  if (error && !hasMissingMemoryTable(error)) {
    console.error("Failed to rebuild conversation memory cache:", error)
  }
}

export async function insertExtractedMemories(
  userId: string,
  conversationId: string,
  candidates: ExtractedMemoryCandidate[],
  supabase: SupabaseAdmin = createAdminClient()
): Promise<void> {
  for (const rawCandidate of candidates) {
    const candidate = sanitizeMemoryCandidate(rawCandidate)
    if (!candidate) continue

    const normalizedKey = normalizeMemoryKey(candidate)

    const { data: existing, error: existingError } = await supabase
      .from("user_memory_entries")
      .select("id, content")
      .eq("user_id", userId)
      .eq("normalized_key", normalizedKey)
      .eq("status", "active")
      .maybeSingle()

    if (existingError) {
      if (!hasMissingMemoryTable(existingError)) {
        console.error("Failed to load matching memory:", existingError)
      }
      continue
    }

    if (existing?.content?.trim() === candidate.content) {
      continue
    }

    if (existing?.id) {
      const { error: archiveBeforeInsertError } = await supabase
        .from("user_memory_entries")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", userId)

      if (archiveBeforeInsertError) {
        if (!hasMissingMemoryTable(archiveBeforeInsertError)) {
          console.error("Failed to archive previous memory:", archiveBeforeInsertError)
        }
        continue
      }
    }

    const metadata = {
      product_names: candidate.product_names ?? [],
      sentiment: candidate.sentiment ?? null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from("user_memory_entries")
      .insert({
        user_id: userId,
        kind: candidate.kind,
        content: candidate.content,
        normalized_key: normalizedKey,
        source: "chat",
        source_conversation_id: conversationId,
        evidence: candidate.evidence,
        confidence: candidate.confidence,
        metadata,
      })
      .select("id")
      .single()

    if (insertError) {
      if (!hasMissingMemoryTable(insertError)) {
        console.error("Failed to insert memory:", insertError)
      }
      if (existing?.id) {
        await supabase
          .from("user_memory_entries")
          .update({ status: "active", archived_at: null })
          .eq("id", existing.id)
          .eq("user_id", userId)
      }
      continue
    }

    if (existing?.id && inserted?.id) {
      const { error: archiveError } = await supabase
        .from("user_memory_entries")
        .update({
          superseded_by: inserted.id,
        })
        .eq("id", existing.id)
        .eq("user_id", userId)

      if (archiveError && !hasMissingMemoryTable(archiveError)) {
        console.error("Failed to archive superseded memory:", archiveError)
      }
    }
  }

  await rebuildConversationMemoryCache(userId, supabase)
}

export async function updateUserMemoryEntry(
  userId: string,
  memoryId: string,
  content: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<UserMemoryEntry | null> {
  const nextContent = content.trim().replace(/\s+/g, " ")
  if (!nextContent) return null

  const { data: current, error: currentError } = await supabase
    .from("user_memory_entries")
    .select("kind")
    .eq("id", memoryId)
    .eq("user_id", userId)
    .single()

  if (currentError || !current) {
    if (currentError && !hasMissingMemoryTable(currentError)) {
      console.error("Failed to load memory before update:", currentError)
    }
    return null
  }

  const normalizedKey = normalizeMemoryKey({
    kind: current.kind as UserMemoryKind,
    content: nextContent,
  })

  const { data: collision } = await supabase
    .from("user_memory_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("normalized_key", normalizedKey)
    .eq("status", "active")
    .neq("id", memoryId)
    .maybeSingle()

  if (collision) {
    return null
  }

  const { data, error } = await supabase
    .from("user_memory_entries")
    .update({
      content: nextContent,
      normalized_key: normalizedKey,
      source: "manual",
      source_conversation_id: null,
      evidence: null,
      metadata: {},
    })
    .eq("id", memoryId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error) {
    if (!hasMissingMemoryTable(error)) {
      console.error("Failed to update memory:", error)
    }
    return null
  }

  await rebuildConversationMemoryCache(userId, supabase)
  return data as UserMemoryEntry
}

export async function deleteUserMemoryEntry(
  userId: string,
  memoryId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<boolean> {
  const { error } = await supabase
    .from("user_memory_entries")
    .delete()
    .eq("id", memoryId)
    .eq("user_id", userId)

  if (error) {
    if (!hasMissingMemoryTable(error)) {
      console.error("Failed to delete memory:", error)
    }
    return false
  }

  await rebuildConversationMemoryCache(userId, supabase)
  return true
}

export async function deleteConversationSourcedMemories(
  userId: string,
  conversationId: string,
  supabase: SupabaseAdmin = createAdminClient()
): Promise<void> {
  const { error } = await supabase
    .from("user_memory_entries")
    .delete()
    .eq("user_id", userId)
    .eq("source", "chat")
    .eq("source_conversation_id", conversationId)

  if (error && !hasMissingMemoryTable(error)) {
    console.error("Failed to delete conversation-sourced memories:", error)
  }

  await rebuildConversationMemoryCache(userId, supabase)
}
