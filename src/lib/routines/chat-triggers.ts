export const ROUTINE_TRIGGER_STORAGE_PREFIX = "routine-trigger"

export type RoutineChatTriggerType = "onboard_category" | "discuss_product" | "alternatives"

export type RoutineChatTriggerInput = {
  type: RoutineChatTriggerType
  cardId?: string | null
  usageId?: string | null
  productId?: string | null
  category?: string | null
  categoryLabel?: string | null
  productName?: string | null
  brand?: string | null
  currentFrequency?: string | null
  targetFrequency?: string | null
  reason?: string | null
}

type RoutineTriggerStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

export type RoutineChatTriggerResponse = {
  conversationId: string
  seedMessage: string
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function joinProductName(input: RoutineChatTriggerInput): string | null {
  const brand = clean(input.brand)
  const productName = clean(input.productName)
  if (brand && productName) {
    // Display names often already carry the brand ("Syoss Intense Fullness
    // Shampoo") — don't prepend it twice.
    const alreadyBranded = productName
      .toLocaleLowerCase("de")
      .startsWith(brand.toLocaleLowerCase("de"))
    return alreadyBranded ? productName : `${brand} ${productName}`
  }
  return productName ?? brand
}

function categoryText(input: RoutineChatTriggerInput): string {
  return clean(input.categoryLabel) ?? clean(input.category) ?? "Routine-Kategorie"
}

function contextSentence(input: RoutineChatTriggerInput): string {
  const parts: string[] = []
  const currentFrequency = clean(input.currentFrequency)
  const targetFrequency = clean(input.targetFrequency)
  const reason = clean(input.reason)

  if (currentFrequency) parts.push(`aktuell nutze ich es ${currentFrequency}`)
  if (targetFrequency) parts.push(`Chaarlies Ziel wäre ${targetFrequency}`)
  if (reason) parts.push(`der Grund ist: ${reason}`)

  return parts.length > 0 ? ` ${parts.join("; ")}.` : ""
}

export function buildRoutineChatSeedMessage(input: RoutineChatTriggerInput): string {
  const category = categoryText(input)
  const product = joinProductName(input)
  const context = contextSentence(input)

  if (input.type === "onboard_category") {
    const subject = product ? `${product} als ${category}` : `die Kategorie ${category}`
    return `Ich möchte ${subject} sinnvoll in meine Routine einordnen.${context} Bitte erklär mir profilbezogen, warum diese Kategorie für mich sinnvoll sein könnte, wie ich sie grundsätzlich nutze und worauf ich achten sollte. Bitte noch keine konkreten Produktempfehlungen.`
  }

  if (input.type === "discuss_product") {
    const productPart = product
      ? `${product} als ${category}`
      : `ein Produkt aus der Kategorie ${category}`
    return `Ich benutze aktuell ${productPart}.${context} Bitte hilf mir einzuschätzen, ob das zu meiner Routine passt und ob ich etwas ändern sollte.`
  }

  const productPart = product ? `zu ${product}` : `für ${category}`
  return `Ich suche passende Alternativen ${productPart} in meiner Routine.${context} Bitte schlag mir Optionen oder klare Kriterien vor, nach denen ich auswählen sollte.`
}

export function createRoutineTriggerStorageKey(conversationId: string): string {
  return `${ROUTINE_TRIGGER_STORAGE_PREFIX}:${conversationId}`
}

export function persistRoutineTriggerSeed(
  conversationId: string,
  seedMessage: string,
  storage: Pick<RoutineTriggerStorage, "setItem">,
): void {
  storage.setItem(createRoutineTriggerStorageKey(conversationId), seedMessage)
}

export function readRoutineTriggerSeed(
  conversationId: string,
  storage: Pick<RoutineTriggerStorage, "getItem">,
): string | null {
  return clean(storage.getItem(createRoutineTriggerStorageKey(conversationId)))
}

export function clearRoutineTriggerSeed(
  conversationId: string,
  storage: Pick<RoutineTriggerStorage, "removeItem">,
): void {
  storage.removeItem(createRoutineTriggerStorageKey(conversationId))
}

export function consumeRoutineTriggerSeed(
  conversationId: string,
  storage: Pick<RoutineTriggerStorage, "getItem" | "removeItem">,
): string | null {
  const key = createRoutineTriggerStorageKey(conversationId)
  const seed = storage.getItem(key)
  if (seed !== null) {
    storage.removeItem(key)
  }
  return clean(seed)
}

export async function launchRoutineChatTrigger(
  input: RoutineChatTriggerInput,
  deps: {
    fetch?: typeof fetch
    storage?: Pick<RoutineTriggerStorage, "setItem">
    navigate: (href: string) => void
  },
): Promise<RoutineChatTriggerResponse> {
  const fetchImpl = deps.fetch ?? fetch
  const storage = deps.storage ?? (typeof window !== "undefined" ? window.sessionStorage : null)

  if (!storage) {
    throw new Error("Routine-Trigger kann nicht ohne lokalen Speicher gestartet werden.")
  }

  const response = await fetchImpl("/api/chat/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error("Routine-Chat konnte nicht gestartet werden.")
  }

  const body = (await response.json()) as Partial<RoutineChatTriggerResponse>
  if (!body.conversationId || !body.seedMessage) {
    throw new Error("Routine-Chat-Antwort war unvollständig.")
  }

  persistRoutineTriggerSeed(body.conversationId, body.seedMessage, storage)
  deps.navigate(`/chat/${body.conversationId}`)
  return { conversationId: body.conversationId, seedMessage: body.seedMessage }
}
