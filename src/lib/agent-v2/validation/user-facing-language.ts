import type { AgentV2TerminalAnswer, AgentV2ValidationError } from "@/lib/agent-v2/contracts"
import { hasAsciiGermanOrthography } from "@/lib/german-orthography/ascii-transliterations"

interface UserFacingLanguageValidationContext {
  latestUserMessage: string
  recentEvidenceText?: string
}

interface UserFacingText {
  path: Array<string | number>
  value: string
}

interface ConversationCloseCandidate {
  path: Array<string | number>
  text: string
  likelyClosingText: string
}

const USER_FACING_PAYLOAD_FIELDS = new Set([
  "user_facing_answer_de",
  "reason_de",
  "usage_de",
  "caveat_de",
  "comparison_notes_de",
  "usage_notes_de",
  "next_step_offer_de",
  "label_de",
  "action_de",
  "frequency_de",
  "key_points_de",
  "question_de",
  "blocking_constraints",
  "safe_alternative_de",
  "boundary_reason_de",
  "next_step_de",
])

const USER_FACING_PAYLOAD_CONTAINERS = new Set(["recommendations", "visible_steps"])

const INTERNAL_LABEL_PATTERN =
  /(?:^|[^\p{L}\p{N}])(?:Goals|goals|problems|deep_dive|next_layer_options|routine_layer|request_interpretation|count_policy|evidence_quote)(?=$|[^\p{L}\p{N}])/u

const CATALOG_METADATA_PATTERN = /\b(?:eingestuft|klassifiziert|im katalog|claim hinterlegt)\b/i
const INTERNAL_RANKING_LANGUAGE_PATTERNS = [
  /\blaut auswahl\b/,
  /\b(?:schwaecherer|schwacher|starker|idealer|guter)\s+treffer\b/,
  /\btreffer\s+mit\b/,
  /\bprodukt\s*fit\b/,
]
const INTERNAL_INSTRUCTION_LEAKAGE_PATTERN =
  /\bich\s+(?:soll|muss)\s+(?:keine?|nicht|nur|erst|immer|laut|gem(?:ae|ä)ss)\b/iu

const BARE_JA_OPENING_PATTERN = /^[\s>*_`#-]*(?:\d+[.)]\s*)?ja\s*(?:[-–—]|,)\s*/iu
const CLOSURE_BLOCK_FINDINGS_ENABLED = true
const DUPLICATE_VISIBLE_PARAGRAPH_FINDINGS_ENABLED = true
const DUPLICATE_PARAGRAPH_MIN_NORMALIZED_LENGTH = 80
const SIMILAR_ADJACENT_PARAGRAPH_MIN_NORMALIZED_LENGTH = 120
const SIMILAR_ADJACENT_PARAGRAPH_TOKEN_OVERLAP = 0.82

export function validateUserFacingLanguage(
  answer: AgentV2TerminalAnswer,
  context: UserFacingLanguageValidationContext,
  findings: AgentV2ValidationError[],
): void {
  const userFacingTexts = collectUserFacingPayloadStrings(answer.payload)

  for (const text of userFacingTexts) {
    if (INTERNAL_LABEL_PATTERN.test(text.value)) {
      findings.push({
        validator_id: "user_facing_internal_labels",
        message:
          "User-facing prose includes raw internal labels; translate routine and reasoning labels into natural German.",
        severity: "block",
        path: text.path,
      })
    }

    if (CATALOG_METADATA_PATTERN.test(text.value)) {
      findings.push({
        validator_id: "user_facing_catalog_metadata_phrasing",
        message:
          "User-facing prose uses catalog or metadata classification phrasing; prefer practical implications in natural German.",
        severity: "warn",
        path: text.path,
      })
    }

    if (hasAsciiGermanOrthography(text.value)) {
      findings.push({
        validator_id: "user_facing_ascii_german_orthography",
        message:
          "User-facing German uses ASCII umlaut transliterations; prefer standard German orthography with umlauts and ß.",
        severity: "warn",
        path: text.path,
      })
    }

    if (hasInternalRankingLanguage(text.value)) {
      findings.push({
        validator_id: "user_facing_internal_ranking_language",
        message:
          "User-facing prose includes internal fit/ranking labels; translate them into practical natural German.",
        severity: "block",
        path: text.path,
      })
    }

    if (INTERNAL_INSTRUCTION_LEAKAGE_PATTERN.test(text.value)) {
      findings.push({
        validator_id: "user_facing_instruction_leakage",
        message:
          "User-facing prose describes internal assistant instructions; phrase the limitation as natural user-facing context.",
        severity: "block",
        path: text.path,
        repair_hint:
          "Replace internal wording like 'Ich soll...' with natural wording such as 'Ich kann das Produkt noch nicht sicher bewerten...'.",
      })
    }
  }

  const opening = userFacingTexts.find((text) => text.path.at(-1) === "user_facing_answer_de")
  if (
    opening &&
    BARE_JA_OPENING_PATTERN.test(opening.value) &&
    !isExplicitConfirmation(context.latestUserMessage)
  ) {
    findings.push({
      validator_id: "user_facing_bare_ja_opening",
      message:
        "User-facing prose starts with a bare Ja opening even though the latest user message was not an explicit confirmation.",
      severity: "block",
      path: opening.path,
    })
  }

  if (opening) {
    analyzeDuplicateVisibleParagraphs(opening.value, opening.path).forEach((finding) =>
      findings.push(finding),
    )
  }

  analyzeConversationClose(answer, context).forEach((finding) => findings.push(finding))
}

function analyzeDuplicateVisibleParagraphs(
  text: string,
  path: Array<string | number>,
): AgentV2ValidationError[] {
  if (!DUPLICATE_VISIBLE_PARAGRAPH_FINDINGS_ENABLED) return []

  const normalizedParagraphs = splitVisibleParagraphs(text)
    .map((paragraph) => normalizeGermanText(paragraph))
    .filter(Boolean)

  const seenLongParagraphs = new Set<string>()
  for (const paragraph of normalizedParagraphs) {
    if (paragraph.length < DUPLICATE_PARAGRAPH_MIN_NORMALIZED_LENGTH) continue
    if (seenLongParagraphs.has(paragraph)) {
      return [duplicateVisibleParagraphFinding(path)]
    }
    seenLongParagraphs.add(paragraph)
  }

  for (let index = 1; index < normalizedParagraphs.length; index += 1) {
    const previous = normalizedParagraphs[index - 1]
    const current = normalizedParagraphs[index]
    if (
      previous.length >= SIMILAR_ADJACENT_PARAGRAPH_MIN_NORMALIZED_LENGTH &&
      current.length >= SIMILAR_ADJACENT_PARAGRAPH_MIN_NORMALIZED_LENGTH &&
      hasHighParagraphOverlap(previous, current)
    ) {
      return [duplicateVisibleParagraphFinding(path)]
    }
  }

  return []
}

function splitVisibleParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function hasHighParagraphOverlap(first: string, second: string): boolean {
  const firstTokens = new Set(first.split(" ").filter(Boolean))
  const secondTokens = new Set(second.split(" ").filter(Boolean))
  if (firstTokens.size === 0 || secondTokens.size === 0) return false

  let shared = 0
  for (const token of firstTokens) {
    if (secondTokens.has(token)) shared += 1
  }

  const smallerParagraphOverlap = shared / Math.min(firstTokens.size, secondTokens.size)
  const unionSize = new Set([...firstTokens, ...secondTokens]).size
  const jaccardOverlap = shared / unionSize

  return (
    smallerParagraphOverlap >= SIMILAR_ADJACENT_PARAGRAPH_TOKEN_OVERLAP &&
    jaccardOverlap >= SIMILAR_ADJACENT_PARAGRAPH_TOKEN_OVERLAP
  )
}

function duplicateVisibleParagraphFinding(path: Array<string | number>): AgentV2ValidationError {
  return {
    validator_id: "user_facing_duplicate_visible_paragraph",
    message:
      "User-facing answer repeats the same medium/long visible paragraph; keep the answer concise and do not duplicate repair or card handoff copy.",
    severity: "warn",
    path,
  }
}

export function analyzeConversationClose(
  answer: AgentV2TerminalAnswer,
  context: UserFacingLanguageValidationContext,
): AgentV2ValidationError[] {
  const findings: AgentV2ValidationError[] = []
  const visibleAnswer = getVisibleAnswerText(answer)

  for (const candidate of getConversationCloseCandidates(answer)) {
    const normalizedClose = normalizeGermanText(candidate.text)
    if (!normalizedClose) continue

    if (hasGenericClose(normalizedClose)) {
      findings.push(
        blockFinding(
          "bad_conversation_close_generic",
          "Conversation close is generic bait instead of a specific useful next move.",
          candidate.path,
        ),
      )
    }

    if (hasInfeasibleClose(normalizedClose)) {
      findings.push(
        blockFinding(
          "bad_conversation_close_infeasible",
          "Conversation close offers an action the current chat/tools cannot actually service.",
          candidate.path,
        ),
      )
    }

    if (hasUnsupportedIngredientLane(normalizedClose)) {
      findings.push(
        blockFinding(
          "bad_conversation_close_unsupported_lane",
          "Conversation close opens unsupported ingredient/INCI-list analysis instead of staying in supported product facts.",
          candidate.path,
        ),
      )
    }

    if (countQuestions(candidate.text) > 1) {
      findings.push(
        blockFinding(
          "bad_conversation_close_multi_question",
          "Conversation close asks multiple questions; ask at most one material question.",
          candidate.path,
        ),
      )
    }

    if (hasRedundantProductOffer(answer, normalizedClose)) {
      findings.push(
        blockFinding(
          "bad_conversation_close_redundant",
          "Conversation close offers the same product recommendation action already completed in this answer.",
          candidate.path,
        ),
      )
    }

    if (
      hasRedundantComparisonClose(
        visibleAnswer,
        candidate.likelyClosingText,
        context,
        normalizedClose,
      )
    ) {
      findings.push(
        blockFinding(
          "bad_conversation_close_redundant_comparison",
          "Conversation close offers to compare categories the answer already compared or resolved.",
          candidate.path,
        ),
      )
    }

    if (
      hasRedundantSourceTriageClose(
        visibleAnswer,
        candidate.likelyClosingText,
        context,
        normalizedClose,
      )
    ) {
      findings.push(
        blockFinding(
          "bad_conversation_close_redundant_source_triage",
          "Conversation close offers to classify a likely cause/source the answer already classified.",
          candidate.path,
        ),
      )
    }

    if (hasWeakButHarmlessClose(normalizedClose)) {
      findings.push({
        validator_id: "conversation_close_weak",
        message:
          "Conversation close is harmless but vague; prefer a specific warm-coach next direction or a clean stop.",
        severity: "warn",
        path: candidate.path,
      })
    }
  }

  return findings
}

function hasInternalRankingLanguage(text: string): boolean {
  const normalized = normalizeGermanText(text)
  return INTERNAL_RANKING_LANGUAGE_PATTERNS.some((pattern) => pattern.test(normalized))
}

function collectUserFacingPayloadStrings(
  payload: AgentV2TerminalAnswer["payload"],
): UserFacingText[] {
  const strings: UserFacingText[] = []
  collectVisiblePayloadNode(payload, ["payload"], strings)
  return strings
}

function collectVisiblePayloadNode(
  value: unknown,
  path: Array<string | number>,
  strings: UserFacingText[],
): void {
  if (!value || typeof value !== "object") return

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key]
    if (USER_FACING_PAYLOAD_FIELDS.has(key)) {
      collectVisibleStringValue(child, childPath, strings)
      continue
    }

    if (USER_FACING_PAYLOAD_CONTAINERS.has(key)) {
      collectVisibleContainer(child, childPath, strings)
    }
  }
}

function collectVisibleContainer(
  value: unknown,
  path: Array<string | number>,
  strings: UserFacingText[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVisibleContainer(item, [...path, index], strings))
    return
  }

  collectVisiblePayloadNode(value, path, strings)
}

function collectVisibleStringValue(
  value: unknown,
  path: Array<string | number>,
  strings: UserFacingText[],
): void {
  if (typeof value === "string") {
    strings.push({ path, value })
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVisibleStringValue(item, [...path, index], strings))
    return
  }

  if (!value || typeof value !== "object") return
  collectVisiblePayloadNode(value, path, strings)
}

function isExplicitConfirmation(message: string): boolean {
  const normalized = normalizeGermanText(message)

  if (!normalized) return false

  return (
    /^(?:ja|jep|genau|ok|okay|passt|stimmt|richtig|klar|gerne|bitte|super|mach das|klingt gut|das passt)$/.test(
      normalized,
    ) ||
    /^(?:ja|jep|genau|ok|okay|passt|klar)\s+(?:bitte|gerne|genau|mach|sag|zeig|erzahl|erzaehl|lass)\b/.test(
      normalized,
    )
  )
}

function getVisibleAnswerText(answer: AgentV2TerminalAnswer): string {
  return typeof answer.payload.user_facing_answer_de === "string"
    ? answer.payload.user_facing_answer_de
    : ""
}

function getNextStepOfferText(answer: AgentV2TerminalAnswer): string {
  if (!("next_step_offer_de" in answer.payload)) return ""
  return typeof answer.payload.next_step_offer_de === "string"
    ? answer.payload.next_step_offer_de
    : ""
}

function getConversationCloseCandidates(
  answer: AgentV2TerminalAnswer,
): ConversationCloseCandidate[] {
  const visibleAnswer = getVisibleAnswerText(answer)
  const explicitOffer = getNextStepOfferText(answer)
  const likelyClosingText = extractLikelyClosingText(visibleAnswer)
  const candidates: ConversationCloseCandidate[] = [
    {
      path: ["payload", "user_facing_answer_de"],
      text: buildConversationCloseText(likelyClosingText, explicitOffer),
      likelyClosingText,
    },
  ]

  for (const field of [
    "question_de",
    "safe_alternative_de",
    "boundary_reason_de",
    "next_step_de",
  ]) {
    const value = (answer.payload as Record<string, unknown>)[field]
    collectCloseCandidateValue(value, ["payload", field], candidates)
  }

  return candidates
}

function collectCloseCandidateValue(
  value: unknown,
  path: Array<string | number>,
  candidates: ConversationCloseCandidate[],
): void {
  if (typeof value === "string") {
    candidates.push({ path, text: value, likelyClosingText: value })
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCloseCandidateValue(item, [...path, index], candidates))
  }
}

function extractLikelyClosingText(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
  return paragraphs.at(-1) ?? text.trim()
}

function buildConversationCloseText(likelyClosingText: string, explicitOffer: string): string {
  if (!likelyClosingText) return explicitOffer
  if (!explicitOffer) return likelyClosingText

  const normalizedClose = normalizeGermanText(likelyClosingText)
  const normalizedOffer = normalizeGermanText(explicitOffer)
  if (normalizedClose.includes(normalizedOffer) || normalizedOffer.includes(normalizedClose)) {
    return likelyClosingText
  }

  return [likelyClosingText, explicitOffer].join("\n")
}

function normalizeGermanText(text: string): string {
  return text
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s?]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function blockFinding(
  validatorId: string,
  message: string,
  path: Array<string | number>,
): AgentV2ValidationError {
  return {
    validator_id: validatorId,
    message,
    severity: CLOSURE_BLOCK_FINDINGS_ENABLED ? "block" : "warn",
    path,
  }
}

function hasGenericClose(text: string): boolean {
  return (
    /\blass es mich wissen\b/.test(text) ||
    /\bmoechtest du\b.{0,60}\b(?:mehr|mehr dazu|mehr wissen|erklaer|tipps?)\b/.test(text) ||
    /\bwenn du (?:moechtest|willst|magst)\b.{0,80}\b(?:mehr|mehr dazu|mehr wissen|weitere? tipps?)\b/.test(
      text,
    )
  )
}

function hasInfeasibleClose(text: string): boolean {
  return (
    /\b(?:schick|sende|send|gib)\b.{0,50}\b(?:foto|bild|link|url|produktseite)\b/.test(text) ||
    /\b(?:foto|bild|link|url|produktseite)\b.{0,70}\b(?:pruef|pruf|check|beurteil|anseh|anschau)\b/.test(
      text,
    )
  )
}

function hasUnsupportedIngredientLane(text: string): boolean {
  const mentionsIngredientList =
    /\b(?:inci|inhaltsstoff(?:e|en)?|ingredient(?:s)?|zutatenliste)\b/.test(text)
  if (!mentionsIngredientList) return false
  if (hasIngredientAnalysisRefusal(text)) return false

  return /\b(?:kopier\w*|schick\w*|sende\w*|send\w*|pruef\w*|pruf\w*|check\w*|analys\w*|beurteil\w*|einschaetz\w*|sag\w*)\b/.test(
    text,
  )
}

function hasIngredientAnalysisRefusal(text: string): boolean {
  const ingredientList = String.raw`\b(?:inci|inhaltsstoff(?:e|en)?|ingredient(?:s)?|zutatenliste)\b`
  const analysisAction = String.raw`\b(?:pruef\w*|pruf\w*|check\w*|analys\w*|beurteil\w*|bewert\w*|einschaetz\w*)\b`

  return (
    new RegExp(
      `${ingredientList}.{0,80}\\b(?:kann|koennen)\\b.{0,50}\\bnicht\\b.{0,80}${analysisAction}`,
    ).test(text) ||
    new RegExp(
      `\\b(?:kann|koennen)\\b.{0,80}${ingredientList}.{0,80}\\bnicht\\b.{0,80}${analysisAction}`,
    ).test(text) ||
    new RegExp(
      `\\b(?:kann|koennen)\\b.{0,80}\\bkeine?n?\\b.{0,80}${ingredientList}.{0,80}${analysisAction}`,
    ).test(text) ||
    /\b(?:nicht unterstuetzt|unterstuetze ich hier nicht|kein unterstuetzter)\b/.test(text)
  )
}

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length
}

function hasRedundantProductOffer(answer: AgentV2TerminalAnswer, text: string): boolean {
  if (
    answer.answer_mode !== "product_recommendation" ||
    answer.payload.recommendations.length === 0
  ) {
    return false
  }

  if (/\b(?:zwischen|entscheiden|vergleich|dosierung|anwendung|nutzen|routine)\b/.test(text)) {
    return false
  }

  return (
    /\b(?:produkt|produkte|produktempfehlung|produktempfehlungen|empfehlung|empfehlungen|option|optionen)\b/.test(
      text,
    ) && /\b(?:empfehlen|zeigen|heraussuchen|raussuchen|vorschlagen|auswaehlen)\b/.test(text)
  )
}

const COMPARISON_CATEGORY_TERMS = [
  { id: "leave_in", patterns: [/\bleave\s*in\b/, /\bleavein\b/] },
  { id: "mask", patterns: [/\bmaske\b/, /\bhaarkur\b/, /\bkur\b/] },
  { id: "oil", patterns: [/\boel\b/, /\bhaaroel\b/] },
  { id: "conditioner", patterns: [/\bconditioner\b/, /\bspuelung\b/] },
  { id: "bondbuilder", patterns: [/\bbondbuilder\b/, /\bbond\s*repair\b/] },
  { id: "deep_cleansing", patterns: [/\btiefenreinigung\b/, /\breset\b/] },
  { id: "shampoo", patterns: [/\bshampoo\b/] },
  { id: "peeling", patterns: [/\bpeeling\b/, /\bkopfhautpeeling\b/] },
]

function hasRedundantComparisonClose(
  visibleAnswer: string,
  likelyClosingText: string,
  context: UserFacingLanguageValidationContext,
  normalizedClose: string,
): boolean {
  if (!offersFutureComparison(normalizedClose)) return false

  const closeCategories = findMentionedComparisonCategories(normalizedClose)
  if (closeCategories.length < 2) return false

  const bodyWithoutClose = removeLikelyClosingText(visibleAnswer, likelyClosingText)
  const priorContext = normalizeGermanText(
    `${bodyWithoutClose}\n${context.recentEvidenceText ?? ""}`,
  )
  if (!hasDecisionLanguage(priorContext)) return false

  const priorCategories = findMentionedComparisonCategories(priorContext)
  const priorCategorySet = new Set(priorCategories)
  return closeCategories.filter((category) => priorCategorySet.has(category)).length >= 2
}

function offersFutureComparison(text: string): boolean {
  return (
    /\b(?:wenn du magst|wenn du moechtest|danach|als naechstes|ich kann|kann ich)\b/.test(text) &&
    /\b(?:ob eher|eher.*oder|oder.*besser|bessere?r naechste?r schritt|vergleich|entscheiden|einordnen)\b/.test(
      text,
    )
  )
}

function findMentionedComparisonCategories(text: string): string[] {
  return COMPARISON_CATEGORY_TERMS.filter((term) =>
    term.patterns.some((pattern) => pattern.test(text)),
  ).map((term) => term.id)
}

function hasDecisionLanguage(text: string): boolean {
  return /\b(?:als erstes|zuerst|erster schritt|zweiter schritt|besser|passender|passt eher|wuerde ich|wurde ich|waere eher|ware eher|statt|sinnvoller|naheliegender|nicht der erste|nicht als basis|eher der)\b/.test(
    text,
  )
}

function removeLikelyClosingText(text: string, likelyClosingText: string): string {
  const closing = likelyClosingText.trim()
  if (!closing) return text

  const index = text.lastIndexOf(closing)
  if (index < 0) return text
  return text.slice(0, index)
}

function hasRedundantSourceTriageClose(
  visibleAnswer: string,
  likelyClosingText: string,
  context: UserFacingLanguageValidationContext,
  normalizedClose: string,
): boolean {
  if (!offersFutureSourceTriage(normalizedClose)) return false

  const bodyWithoutClose = removeLikelyClosingText(visibleAnswer, likelyClosingText)
  const priorContext = normalizeGermanText(
    `${bodyWithoutClose}\n${context.recentEvidenceText ?? ""}`,
  )

  return (
    hasSourceDecisionLanguage(priorContext) && hasSharedSourceSignal(priorContext, normalizedClose)
  )
}

function offersFutureSourceTriage(text: string): boolean {
  return (
    /\b(?:wenn du magst|wenn du moechtest|danach|als naechstes|ich kann|kann ich)\b/.test(text) &&
    /\bob das\b.{0,140}\beher nach\b.{0,140}\bklingt\b/.test(text)
  )
}

function hasSourceDecisionLanguage(text: string): boolean {
  return /\b(?:klingt eher nach|klingt nach|das klingt|am ehesten|haeufigsten ursachen|wahrscheinlich|treiber|ursache)\b/.test(
    text,
  )
}

const SOURCE_TRIAGE_SIGNALS = [
  /\brueckstaend\w*\b/,
  /\bbuild\s*up\b/,
  /\bzu schwere?r? pflege\b/,
  /\bschwere produkte?\b/,
  /\bzu mild(?:e[msnr]?)? shampoo\b/,
  /\bfettige?r? kopfhaut\b/,
  /\bnachfett\w*\b/,
  /\bzu wenig wasch\w*\b/,
]

function hasSharedSourceSignal(priorContext: string, normalizedClose: string): boolean {
  return SOURCE_TRIAGE_SIGNALS.some(
    (pattern) => pattern.test(priorContext) && pattern.test(normalizedClose),
  )
}

function hasWeakButHarmlessClose(text: string): boolean {
  return /\b(?:dann schauen wir weiter|ich kann dir helfen|kann ich dir helfen)\b/.test(text)
}
