import type { AgentV2TerminalAnswer, AgentV2ValidationError } from "@/lib/agent-v2/contracts"

interface UserFacingLanguageValidationContext {
  latestUserMessage: string
  recentEvidenceText?: string
}

interface UserFacingText {
  path: Array<string | number>
  value: string
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

const BARE_JA_OPENING_PATTERN = /^[\s>*_`#-]*(?:\d+[.)]\s*)?ja\s*(?:[-–—]|,)\s*/iu
const CLOSURE_BLOCK_FINDINGS_ENABLED = true

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

  analyzeConversationClose(answer, context).forEach((finding) => findings.push(finding))
}

export function analyzeConversationClose(
  answer: AgentV2TerminalAnswer,
  _context: UserFacingLanguageValidationContext,
): AgentV2ValidationError[] {
  const findings: AgentV2ValidationError[] = []
  const visibleAnswer = getVisibleAnswerText(answer)
  const explicitOffer = getNextStepOfferText(answer)
  const closeText = [extractLikelyClosingText(visibleAnswer), explicitOffer]
    .filter(Boolean)
    .join("\n")
  const normalizedClose = normalizeGermanText(closeText)
  const path = ["payload", "user_facing_answer_de"]

  if (!normalizedClose) return findings

  if (hasGenericClose(normalizedClose)) {
    findings.push(
      blockFinding(
        "bad_conversation_close_generic",
        "Conversation close is generic bait instead of a specific useful next move.",
        path,
      ),
    )
  }

  if (hasInfeasibleClose(normalizedClose)) {
    findings.push(
      blockFinding(
        "bad_conversation_close_infeasible",
        "Conversation close offers an action the current chat/tools cannot actually service.",
        path,
      ),
    )
  }

  if (hasUnsupportedIngredientLane(normalizedClose)) {
    findings.push(
      blockFinding(
        "bad_conversation_close_unsupported_lane",
        "Conversation close opens unsupported ingredient/INCI-list analysis instead of staying in supported product facts.",
        path,
      ),
    )
  }

  if (countQuestions(closeText) > 1) {
    findings.push(
      blockFinding(
        "bad_conversation_close_multi_question",
        "Conversation close asks multiple questions; ask at most one material question.",
        path,
      ),
    )
  }

  if (hasRedundantProductOffer(answer, normalizedClose)) {
    findings.push(
      blockFinding(
        "bad_conversation_close_redundant",
        "Conversation close offers the same product recommendation action already completed in this answer.",
        path,
      ),
    )
  }

  if (hasWeakButHarmlessClose(normalizedClose)) {
    findings.push({
      validator_id: "conversation_close_weak",
      message:
        "Conversation close is harmless but vague; prefer a specific warm-coach next direction or a clean stop.",
      severity: "warn",
      path,
    })
  }

  return findings
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

function extractLikelyClosingText(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
  return paragraphs.at(-1) ?? text.trim()
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

function hasWeakButHarmlessClose(text: string): boolean {
  return /\b(?:dann schauen wir weiter|ich kann dir helfen|kann ich dir helfen)\b/.test(text)
}
