import type { AgentV2CareCategory } from "./contracts"

export interface AgentV2NamedProductContext {
  display_name: string
  category: AgentV2CareCategory
  plausible_exact_name: boolean
  named_product_intent?: AgentV2NamedProductIntent
}

export type AgentV2NamedProductIntent =
  | "evaluation"
  | "routine_add"
  | "current_use_product_question"
  | "background"

type SupportedCategoryConfig = {
  category: AgentV2CareCategory
  displayLabel: string
  matchSource: string
}

const SUPPORTED_CATEGORY_CONFIGS: SupportedCategoryConfig[] = [
  {
    category: "deep_cleansing_shampoo",
    displayLabel: "Tiefenreinigungsshampoo",
    matchSource:
      "tiefenreinigung(?:s)?shampoo|tiefenreinigungs\\s+shampoo|clarifying\\s+shampoo|deep\\s+cleansing\\s+shampoo",
  },
  {
    category: "dry_shampoo",
    displayLabel: "Trockenshampoo",
    matchSource: "trockenshampoo|trocken\\s*shampoo|dry\\s+shampoo",
  },
  {
    category: "leave_in",
    displayLabel: "Leave-in",
    matchSource: "leave[\\s-]?in(?:\\s+conditioner)?",
  },
  {
    category: "bondbuilder",
    displayLabel: "Bondbuilder",
    matchSource:
      "bond\\s*builder|bondbuilder|bonding\\s+treatment|(?<![\\p{L}\\p{N}])plex(?![\\p{L}\\p{N}])",
  },
  {
    category: "conditioner",
    displayLabel: "Conditioner",
    matchSource: "conditioner|sp(?:ue|ü)lung",
  },
  {
    category: "shampoo",
    displayLabel: "Shampoo",
    matchSource: "shampoo",
  },
  {
    category: "mask",
    displayLabel: "Maske",
    matchSource: "haar\\s*maske|haarmaske|maske|mask",
  },
  {
    category: "oil",
    displayLabel: "Oil",
    matchSource: "(?<![\\p{L}\\p{N}])(?:haar\\s*)?(?:oel|öl|oil)(?![\\p{L}\\p{N}])",
  },
  {
    category: "peeling",
    displayLabel: "Peeling",
    matchSource: "kopfhaut\\s*peeling|scalp\\s+scrub|peeling",
  },
]

const CURRENT_USE_PHRASE =
  /\bich\s+(?:nutze|benutze|verwende|habe|nehme)\b|\b(?:nutze|benutze|verwende|nehme)\s+ich\b/iu

const PRODUCT_EVALUATION_PHRASE =
  /\bwas\s+h(?:ae|ä)ltst\s+du\s+vo(?:n|m|r)\b|\bwas\s+haelst\s+du\s+vo(?:n|m|r)\b|\bwas\s+du\s+vo(?:n|m|r)\b[\s\S]{0,120}\bh(?:ae|ä)ltst\b|\bwas\s+du\s+vo(?:n|m|r)\b[\s\S]{0,120}\bhaelst\b|\b(?:bewerten|beurteilen|einsch(?:ae|ä)tzen|einschaetzen)\b/iu

const CURRENT_USE_PRODUCT_QUESTION_PHRASE =
  /\bpasst\s+(?:das|dieses(?:\s+produkt)?|der|die|er|sie|es)\b[\s\S]{0,80}\b(?:zu\s+mir|f(?:ue|ü)r\s+mich)\b|\bist\s+(?:das|dieses(?:\s+produkt)?|der|die|er|sie|es)\b[\s\S]{0,40}\b(?:gut|geeignet|okay|ok|empfehlenswert)\b|\b(?:kann|soll|sollte)\s+ich\s+(?:das|dieses(?:\s+produkt)?|ihn|sie|es)\b[\s\S]{0,80}\b(?:weiter\s*)?(?:verwenden|nutzen|benutzen|nehmen|behalten)\b/iu

const PRODUCT_ROUTINE_ADD_PHRASE =
  /\b(?:f(?:ue|ü)ge|packe|nimm|bau(?:e)?|integrier(?:e)?|erg(?:ae|ä)nz(?:e)?|m(?:oe|ö)chte)\b[\s\S]{0,120}\b(?:routine|routinen|pflege|plan)\b[\s\S]{0,80}\b(?:hinzu|aufnehmen|hinzuf(?:ue|ü)gen|einbauen|integrieren|erg(?:ae|ä)nzen)?\b|\b(?:routine|routinen|pflege|plan)\b[\s\S]{0,120}\b(?:hinzu|aufnehmen|hinzuf(?:ue|ü)gen|einbauen|integrieren|erg(?:ae|ä)nzen)\b/iu

const GENERIC_CATEGORY_QUESTION =
  /\bwelch(?:er|en|es|e)\b|\bkannst\s+du\s+mir\b.*\bempfehlen\b|\bempfiehlst\s+du\b|\bempfehlung(?:en)?\b/iu

const QUOTED_PRODUCT_NAME = /["“”]([^"“”]{2,80})["“”]/u

const BRAND_AFTER_VON =
  /\bvon\s+([A-ZÄÖÜ0-9][\p{L}\p{M}\p{N}&'.-]*(?:\s+[A-ZÄÖÜ0-9][\p{L}\p{M}\p{N}&'.-]*){0,4})/u

const WORD_TOKEN = /[\p{L}\p{M}\p{N}&'.-]+/gu

const CATEGORY_STOPWORDS = new Set([
  "bondbuilder",
  "conditioner",
  "deep",
  "dry",
  "haar",
  "haarmaske",
  "leave",
  "maske",
  "mask",
  "oel",
  "oil",
  "peeling",
  "plex",
  "scalp",
  "scrub",
  "shampoo",
  "spuelung",
  "tiefenreinigungsshampoo",
  "trockenshampoo",
])

const QUESTION_WORDS = new Set(["welche", "welchen", "welcher", "welches"])

const LEADING_COMMAND_WORDS = new Set([
  "baue",
  "bau",
  "erganze",
  "ergaenze",
  "fuge",
  "fuege",
  "integriere",
  "nimm",
  "packe",
])

const LOOSE_NAME_BOUNDARY_WORDS = new Set([
  "aber",
  "aktuell",
  "benutze",
  "bewerten",
  "beurteilen",
  "bitte",
  "das",
  "dem",
  "den",
  "der",
  "die",
  "dies",
  "diese",
  "diesem",
  "diesen",
  "dieser",
  "dieses",
  "du",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "fuer",
  "für",
  "gerade",
  "haeltst",
  "haelst",
  "hältst",
  "habe",
  "ich",
  "ist",
  "kann",
  "kannst",
  "mein",
  "meine",
  "meinem",
  "meinen",
  "meiner",
  "mir",
  "mit",
  "nehme",
  "nutze",
  "oder",
  "passt",
  "pflege",
  "plan",
  "routine",
  "routinen",
  "sag",
  "sagen",
  "soll",
  "sollte",
  "und",
  "verwende",
  "vom",
  "von",
  "was",
  "zu",
])

const LOOSE_NAME_MIN_TOKENS = 2

const NAMED_PRODUCT_CATEGORY_REFERENCE_TERMS: Partial<
  Record<AgentV2CareCategory, readonly string[]>
> = {
  shampoo: ["shampoo"],
  conditioner: ["conditioner", "spulung"],
  mask: ["maske", "haarmaske", "mask"],
  leave_in: ["leave in", "leave in conditioner"],
  oil: ["ol", "oel", "oil"],
  bondbuilder: ["bondbuilder", "bond builder"],
  deep_cleansing_shampoo: ["tiefenreinigungsshampoo", "deep cleansing shampoo"],
  dry_shampoo: ["trockenshampoo", "dry shampoo"],
  peeling: ["peeling", "kopfhaut peeling", "scalp scrub"],
}

export function normalizeNamedProductForComparison(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/(^|[^\p{L}\p{N}])von(?=$|[^\p{L}\p{N}])/gu, "$1 ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getAgentV2NamedProductCategoryReferenceTerms(
  category: AgentV2CareCategory,
): readonly string[] {
  return NAMED_PRODUCT_CATEGORY_REFERENCE_TERMS[category] ?? []
}

export function buildAgentV2NamedProductContext(params: {
  latestMessage: string
  recentMessages: unknown[]
}): AgentV2NamedProductContext | null {
  void params.recentMessages

  const latestMessage = params.latestMessage.trim()
  if (latestMessage.length === 0) return null

  const category = inferCategory(latestMessage)
  if (category === null) return null

  const brand = extractBrandAfterVon(latestMessage, category)
  const quotedProductName = extractQuotedProductName(latestMessage)
  const hasCurrentUse = hasCurrentUsePhrasing(latestMessage)
  const hasProductEvaluation = hasProductEvaluationPhrasing(latestMessage)
  const hasCurrentUseProductQuestion = hasCurrentUseProductQuestionPhrasing(latestMessage)
  const hasRoutineAdd = hasProductRoutineAddPhrasing(latestMessage)

  if (isGenericCategoryQuestion(latestMessage) && !brand && !quotedProductName && !hasCurrentUse) {
    return null
  }
  if (
    !hasPositiveNamedProductSignal({
      brand,
      quotedProductName,
      hasCurrentUse,
      hasProductEvaluation,
      hasCurrentUseProductQuestion,
      hasRoutineAdd,
    })
  ) {
    return null
  }

  const messageWithoutBrand = brand
    ? latestMessage.replace(new RegExp(`\\bvon\\s+${escapeRegExp(brand)}`, "u"), " ")
    : latestMessage
  const rawProductName =
    quotedProductName ??
    extractCategoryAdjacentProductName(messageWithoutBrand, category, {
      allowLooseName:
        hasCurrentUse || hasProductEvaluation || hasCurrentUseProductQuestion || hasRoutineAdd,
    })
  if (rawProductName === null) return null

  const productName = ensureCategoryLabel(cleanupProductName(rawProductName), category)
  if (!isPlausibleExactProductName(productName, category)) return null

  return {
    display_name: buildDisplayName({ brand, productName, category }),
    category,
    plausible_exact_name: true,
    named_product_intent: inferNamedProductIntent({
      hasCurrentUse,
      hasProductEvaluation,
      hasCurrentUseProductQuestion,
      hasRoutineAdd,
    }),
  }
}

function inferCategory(message: string): AgentV2CareCategory | null {
  for (const config of SUPPORTED_CATEGORY_CONFIGS) {
    if (new RegExp(config.matchSource, "iu").test(message)) return config.category
  }
  return null
}

function extractBrandAfterVon(message: string, category: AgentV2CareCategory): string | null {
  const match = BRAND_AFTER_VON.exec(message)
  if (!match?.[1]) return null

  const candidate = cleanupDisplayText(match[1])
  const config = getCategoryConfig(category)
  if (config !== null && new RegExp(config.matchSource, "iu").test(candidate)) return null

  return candidate
}

function extractQuotedProductName(message: string): string | null {
  const match = QUOTED_PRODUCT_NAME.exec(message)
  return match?.[1] ? cleanupDisplayText(match[1]) : null
}

function hasCurrentUsePhrasing(message: string): boolean {
  return CURRENT_USE_PHRASE.test(message)
}

function hasProductEvaluationPhrasing(message: string): boolean {
  return PRODUCT_EVALUATION_PHRASE.test(message)
}

function hasCurrentUseProductQuestionPhrasing(message: string): boolean {
  return CURRENT_USE_PRODUCT_QUESTION_PHRASE.test(message)
}

function hasProductRoutineAddPhrasing(message: string): boolean {
  return PRODUCT_ROUTINE_ADD_PHRASE.test(message)
}

function hasPositiveNamedProductSignal(params: {
  brand: string | null
  quotedProductName: string | null
  hasCurrentUse: boolean
  hasProductEvaluation: boolean
  hasCurrentUseProductQuestion: boolean
  hasRoutineAdd: boolean
}): boolean {
  return (
    params.brand !== null ||
    params.quotedProductName !== null ||
    params.hasCurrentUse ||
    params.hasProductEvaluation ||
    params.hasCurrentUseProductQuestion ||
    params.hasRoutineAdd
  )
}

function inferNamedProductIntent(params: {
  hasCurrentUse: boolean
  hasProductEvaluation: boolean
  hasCurrentUseProductQuestion: boolean
  hasRoutineAdd: boolean
}): AgentV2NamedProductIntent {
  if (params.hasRoutineAdd) return "routine_add"
  if (params.hasCurrentUse && params.hasCurrentUseProductQuestion) {
    return "current_use_product_question"
  }
  if (params.hasProductEvaluation) return "evaluation"
  return "background"
}

function isGenericCategoryQuestion(message: string): boolean {
  return GENERIC_CATEGORY_QUESTION.test(message)
}

function extractCategoryAdjacentProductName(
  messageWithoutBrand: string,
  category: AgentV2CareCategory,
  options: { allowLooseName?: boolean } = {},
): string | null {
  const config = getCategoryConfig(category)
  if (config === null) return null

  const match = new RegExp(config.matchSource, "iu").exec(messageWithoutBrand)
  if (!match) return null

  const beforeCategory = messageWithoutBrand.slice(0, match.index)
  const afterCategory = messageWithoutBrand.slice(match.index + match[0].length)
  const nameBeforeCategory =
    getCapitalizedNameTail(beforeCategory) ??
    (options.allowLooseName ? getLooseNameTail(beforeCategory) : null)
  if (nameBeforeCategory !== null) return `${nameBeforeCategory} ${config.displayLabel}`

  const nameAfterCategory =
    getCapitalizedNameHead(afterCategory) ??
    (options.allowLooseName ? getLooseNameHead(afterCategory) : null)
  if (nameAfterCategory !== null) return `${config.displayLabel} ${nameAfterCategory}`

  return null
}

function getCapitalizedNameTail(value: string): string | null {
  const tokens = getTokens(value)
  const nameTokens: string[] = []
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index]
    if (!isNameToken(token)) break
    nameTokens.unshift(token)
  }
  if (nameTokens.some((token) => QUESTION_WORDS.has(normalizeNamedProductForComparison(token)))) {
    return null
  }
  const productTokens = dropLeadingCommandWords(nameTokens)
  return productTokens.length > 0 ? productTokens.join(" ") : null
}

function getCapitalizedNameHead(value: string): string | null {
  const firstClause = value.split(/[,.!?;:]/u)[0] ?? ""
  const tokens = getTokens(firstClause)
  const nameTokens: string[] = []
  for (const token of tokens) {
    if (!isNameToken(token)) break
    nameTokens.push(token)
  }
  const productTokens = dropLeadingCommandWords(nameTokens)
  return productTokens.length > 0 ? productTokens.join(" ") : null
}

function getLooseNameTail(value: string): string | null {
  const tokens = getTokens(value)
  const nameTokens: string[] = []
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index]
    if (isLooseNameBoundaryToken(token)) break
    nameTokens.unshift(token)
    if (nameTokens.length >= 8) break
  }
  return cleanupLooseNameTokens(nameTokens)
}

function getLooseNameHead(value: string): string | null {
  const firstClause = value.split(/[,.!?;:]/u)[0] ?? ""
  const tokens = getTokens(firstClause)
  const nameTokens: string[] = []
  for (const token of tokens) {
    if (isLooseNameBoundaryToken(token)) break
    nameTokens.push(token)
    if (nameTokens.length >= 8) break
  }
  return cleanupLooseNameTokens(dropLeadingCommandWords(nameTokens))
}

function cleanupLooseNameTokens(tokens: string[]): string | null {
  const productTokens = tokens.filter((token) => token !== "&" && token !== "+")
  if (productTokens.length < LOOSE_NAME_MIN_TOKENS && !tokens.some(hasNameAnchorCharacter)) {
    return null
  }
  if (tokens.some((token) => QUESTION_WORDS.has(normalizeNamedProductForComparison(token)))) {
    return null
  }
  return tokens.length > 0 ? cleanupDisplayText(tokens.join(" ")) : null
}

function getTokens(value: string): string[] {
  return value.match(WORD_TOKEN) ?? []
}

function isLooseNameBoundaryToken(token: string): boolean {
  return LOOSE_NAME_BOUNDARY_WORDS.has(normalizeLooseNameBoundaryToken(token))
}

function hasNameAnchorCharacter(token: string): boolean {
  return /[0-9&+'.-]/u.test(token)
}

function normalizeLooseNameBoundaryToken(token: string): string {
  return token
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isNameToken(token: string): boolean {
  if (token === "&" || token === "+") return true

  const firstCharacter = token[0]
  if (!firstCharacter) return false
  if (/\p{N}/u.test(firstCharacter)) return true
  return (
    firstCharacter === firstCharacter.toLocaleUpperCase("de-DE") &&
    firstCharacter !== firstCharacter.toLocaleLowerCase("de-DE")
  )
}

function dropLeadingCommandWords(tokens: string[]): string[] {
  let firstProductTokenIndex = 0
  while (
    firstProductTokenIndex < tokens.length &&
    LEADING_COMMAND_WORDS.has(
      normalizeNamedProductForComparison(tokens[firstProductTokenIndex] ?? ""),
    )
  ) {
    firstProductTokenIndex += 1
  }
  return tokens.slice(firstProductTokenIndex)
}

function cleanupProductName(value: string): string {
  return cleanupDisplayText(value.replace(/["“”]/gu, " "))
}

function cleanupDisplayText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,.:;!?-]+|[\s,.:;!?-]+$/gu, "")
}

function isPlausibleExactProductName(productName: string, category: AgentV2CareCategory): boolean {
  const normalized = normalizeNamedProductForComparison(productName)
  if (normalized.length === 0) return false

  const categoryConfig = getCategoryConfig(category)
  const categoryLabel = categoryConfig
    ? normalizeNamedProductForComparison(categoryConfig.displayLabel)
    : category

  const detailTokens = normalized
    .split(" ")
    .filter((token) => token !== categoryLabel)
    .filter((token) => !isCategoryStopword(token))

  return detailTokens.length > 0
}

function buildDisplayName(params: {
  brand: string | null
  productName: string
  category: AgentV2CareCategory
}): string {
  const productName = params.brand
    ? cleanupDisplayText(
        params.productName.replace(new RegExp(`\\b${escapeRegExp(params.brand)}\\b`, "iu"), " "),
      )
    : params.productName

  return cleanupDisplayText(
    [params.brand, moveCategoryLabelToEnd(productName, params.category)].filter(Boolean).join(" "),
  )
}

function moveCategoryLabelToEnd(productName: string, category: AgentV2CareCategory): string {
  const config = getCategoryConfig(category)
  if (config === null) return cleanupDisplayText(productName)

  const productWithoutCategory = cleanupDisplayText(
    productName.replace(new RegExp(`(?:^|\\s)(?:${config.matchSource})(?=\\s|$)`, "giu"), " "),
  )
  if (productWithoutCategory.length === 0) return config.displayLabel

  return cleanupDisplayText(`${productWithoutCategory} ${config.displayLabel}`)
}

function ensureCategoryLabel(productName: string, category: AgentV2CareCategory): string {
  return moveCategoryLabelToEnd(productName, category)
}

function isCategoryStopword(value: string): boolean {
  return CATEGORY_STOPWORDS.has(value)
}

function getCategoryConfig(category: AgentV2CareCategory): SupportedCategoryConfig | null {
  return SUPPORTED_CATEGORY_CONFIGS.find((config) => config.category === category) ?? null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
