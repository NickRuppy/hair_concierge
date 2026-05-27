import type { AgentV2TerminalAnswer, AgentV2ValidationError } from "@/lib/agent-v2/contracts"

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

export function validateUserFacingLanguage(
  answer: AgentV2TerminalAnswer,
  latestUserMessage: string,
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
    !isExplicitConfirmation(latestUserMessage)
  ) {
    findings.push({
      validator_id: "user_facing_bare_ja_opening",
      message:
        "User-facing prose starts with a bare Ja opening even though the latest user message was not an explicit confirmation.",
      severity: "block",
      path: opening.path,
    })
  }
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
  const normalized = message
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

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
