import type { DiscoveryCallSheetBriefSections } from "../../src/lib/discovery/call-sheet"
import type { ConsultInput } from "../../src/lib/discovery/consult-brief/input"
import {
  CONSULT_BOUNDARY_LINE,
  lintConsultBrief,
  normalizeConsultText,
} from "../../src/lib/discovery/consult-brief/lint"
import { consultBriefSectionsSchema } from "../../src/lib/discovery/consult-brief/prompt"

/**
 * The consult brief eval's per-run assertions (consult-agent T5). Pure: the live lane
 * (`run.ts`) and the recorded-fixture test (`tests/discovery-consult-eval.test.ts`) run the
 * same checks over a raw model answer.
 *
 * Deliberately independent of `generateConsultBrief`'s own early returns, so a lint failure
 * still shows every other finding of the same answer.
 */

export type ConsultEvalCheck =
  | "json"
  | "schema"
  | "lint"
  | "boundary_line"
  | "hebel_shape"
  | "product_outside_input"
  | "hair_loss_product"
  | "language"

export type ConsultEvalFinding = { check: ConsultEvalCheck; detail: string }

export type ConsultEvalResult = {
  brief: DiscoveryCallSheetBriefSections | null
  findings: ConsultEvalFinding[]
  /** How the raw answer arrived: a bare JSON object is what JSON mode promises. */
  jsonShape: "bare_object" | "wrapped" | "unparseable"
}

export function evaluateConsultBriefAnswer(raw: string, input: ConsultInput): ConsultEvalResult {
  const findings: ConsultEvalFinding[] = []

  let json: unknown
  let jsonShape: ConsultEvalResult["jsonShape"] = "bare_object"
  try {
    json = JSON.parse(raw)
    if (!raw.trim().startsWith("{")) jsonShape = "wrapped"
  } catch (error) {
    findings.push({ check: "json", detail: `kein gültiges JSON: ${(error as Error).message}` })
    return { brief: null, findings, jsonShape: "unparseable" }
  }

  const parsed = consultBriefSectionsSchema.safeParse(json)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push({
        check: "schema",
        detail: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      })
    }
    return { brief: null, findings, jsonShape }
  }
  const brief = parsed.data

  for (const finding of lintConsultBrief(brief, input)) {
    findings.push({
      check: "lint",
      detail: `${finding.rule} (${finding.guardrail}) @ ${finding.location}: „${finding.excerpt}"${
        finding.detail ? ` — ${finding.detail}` : ""
      }`,
    })
  }

  findings.push(...boundaryLineFindings(brief))
  findings.push(...hebelFindings(brief))
  findings.push(...productOutsideInputFindings(brief, input))
  findings.push(...hairLossProductFindings(brief, input))
  findings.push(...languageFindings(brief))

  return { brief, findings, jsonShape }
}

/** Every text of the brief, with its location. */
export function consultBriefTexts(
  brief: DiscoveryCallSheetBriefSections,
): Array<{ location: string; text: string }> {
  return [
    { location: "diagnose", text: brief.diagnose },
    ...brief.hebel.flatMap((hebel, index) => [
      { location: `hebel[${index}].title`, text: hebel.title },
      { location: `hebel[${index}].note`, text: hebel.note },
    ]),
    ...Object.entries(brief.swapReasons).map(([key, text]) => ({
      location: `swapReasons.${key}`,
      text,
    })),
    ...brief.zielLuecken.map((text, index) => ({ location: `zielLuecken[${index}]`, text })),
    ...brief.callFragen.map((text, index) => ({ location: `callFragen[${index}]`, text })),
    ...brief.erwartungen.map((text, index) => ({ location: `erwartungen[${index}]`, text })),
  ]
}

function squash(text: string): string {
  return normalizeConsultText(text).replace(/\s+/g, " ").trim()
}

/** G2: the last `erwartungen` entry carries the boundary line verbatim (prompt contract). */
function boundaryLineFindings(brief: DiscoveryCallSheetBriefSections): ConsultEvalFinding[] {
  const last = brief.erwartungen.at(-1)
  if (last && squash(last).includes(squash(CONSULT_BOUNDARY_LINE))) return []
  return [
    {
      check: "boundary_line",
      detail: last
        ? `letzter erwartungen-Eintrag ist nicht die Grenz-Zeile: „${last}"`
        : "erwartungen ist leer",
    },
  ]
}

/** 1–5 levers, each titled and explained; points null or within the prompt's 0,5–2. */
function hebelFindings(brief: DiscoveryCallSheetBriefSections): ConsultEvalFinding[] {
  const findings: ConsultEvalFinding[] = []
  if (brief.hebel.length < 1 || brief.hebel.length > 5) {
    findings.push({ check: "hebel_shape", detail: `${brief.hebel.length} Hebel (erwartet 1–5)` })
  }
  brief.hebel.forEach((hebel, index) => {
    if (!hebel.title.trim())
      findings.push({ check: "hebel_shape", detail: `hebel[${index}]: leerer Titel` })
    if (!hebel.note.trim())
      findings.push({ check: "hebel_shape", detail: `hebel[${index}]: leere Notiz` })
    if (hebel.points !== null && !(hebel.points >= 0.5 && hebel.points <= 2)) {
      findings.push({
        check: "hebel_shape",
        detail: `hebel[${index}].points = ${hebel.points} (erwartet null oder 0,5–2)`,
      })
    }
  })
  return findings
}

const PRODUCT_NOUNS =
  "Shampoo|Spülung|Conditioner|Maske|Kur|Haarkur|Öl|Haaröl|Spray|Serum|Leave-in|Leave-In|Balsam|Fluid|Creme"

/** Articles, pronouns and quantifiers that precede a generic category noun. */
const GENERIC_PRECEDERS = new Set([
  "das",
  "die",
  "der",
  "dem",
  "den",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "kein",
  "keine",
  "keinen",
  "ihr",
  "ihre",
  "ihren",
  "ihrem",
  "ihrer",
  "dein",
  "deine",
  "deinen",
  "deinem",
  "dieses",
  "diese",
  "diesen",
  "jedes",
  "jede",
  "welches",
  "welche",
  "mehr",
  "weniger",
  "statt",
  "als",
  "vom",
  "zum",
  "zur",
  "beim",
  "im",
  "am",
  "mit",
  "ohne",
  "nur",
  "auch",
])

/**
 * A heuristic for named products the input does not carry: a capitalized word directly before
 * a product noun („Xyz Shampoo") that is neither one of her product tokens nor a generic
 * article/adjective. Real market brands are the lint's job (closed list); this catches the
 * rest, at the cost of occasional false positives — each finding names the phrase for review.
 */
function productOutsideInputFindings(
  brief: DiscoveryCallSheetBriefSections,
  input: ConsultInput,
): ConsultEvalFinding[] {
  const knownNames = input.products.flatMap((product) => [
    product.name,
    ...product.aliases,
    ...product.swapOptions,
    ...(product.swapTarget ? [product.swapTarget] : []),
    ...(product.brand ? [product.brand] : []),
  ])
  const knownTokens = new Set(
    knownNames.flatMap((name) => normalizeConsultText(name).toLowerCase().split(/\s+/)),
  )
  const pattern = new RegExp(
    `(?<![\\p{L}-])(\\p{Lu}[\\p{L}'’-]*)\\s+(?:${PRODUCT_NOUNS})(?![\\p{L}])`,
    "gu",
  )

  const findings: ConsultEvalFinding[] = []
  for (const { location, text } of consultBriefTexts(brief)) {
    for (const match of normalizeConsultText(text).matchAll(pattern)) {
      const word = match[1]!
      const lower = word.toLowerCase()
      if (knownTokens.has(lower)) continue
      if (GENERIC_PRECEDERS.has(lower)) continue
      // Declined adjectives („Mildes Shampoo", „Leichte Spülung") are category talk, not names.
      if (/(e|es|er|en|em)$/u.test(lower)) continue
      findings.push({
        check: "product_outside_input",
        detail: `${location}: „${match[0]}" ist kein Produkt aus dem Input (Heuristik)`,
      })
    }
  }
  return findings
}

/**
 * G2 / prompt rule 7: with a hair-loss trigger, no sentence about the loss names one of her
 * products or a swap option as its answer. The verbatim boundary line is exempt.
 */
function hairLossProductFindings(
  brief: DiscoveryCallSheetBriefSections,
  input: ConsultInput,
): ConsultEvalFinding[] {
  if (input.boundaryTriggers.length === 0) return []
  const names = [
    ...new Set(
      input.products.flatMap((product) => [
        product.name,
        ...product.aliases,
        ...product.swapOptions,
        ...(product.swapTarget ? [product.swapTarget] : []),
      ]),
    ),
  ].filter((name) => name.trim().length > 0)
  const boundary = squash(CONSULT_BOUNDARY_LINE)

  const findings: ConsultEvalFinding[] = []
  for (const { location, text } of consultBriefTexts(brief)) {
    const sentences = squash(text)
      .replace(boundary, "")
      .split(/(?<=[.!?])\s+/)
    for (const sentence of sentences) {
      if (!/ausfall|haarverlust|lichter|dünner werd/iu.test(sentence)) continue
      const named = names.find((name) => sentence.toLowerCase().includes(name.toLowerCase()))
      if (named) {
        findings.push({
          check: "hair_loss_product",
          detail: `${location}: Ausfall-Satz nennt „${named}": „${sentence}"`,
        })
      }
    }
  }
  return findings
}

const GERMAN_MARKERS = new Set(
  "der die das und nicht sie ist mit ein eine zu auf für im den dem bei oder wenn als auch nur ihre ihr du dein deine wie noch sich statt weil dass".split(
    " ",
  ),
)
const ENGLISH_MARKERS = new Set(
  "the and is with of to for this that her she you your it are not because".split(" "),
)

/** A function-word ratio: enough German markers and far fewer English ones. */
function languageFindings(brief: DiscoveryCallSheetBriefSections): ConsultEvalFinding[] {
  const tokens = consultBriefTexts(brief)
    .map((entry) => entry.text)
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
  const german = tokens.filter((token) => GERMAN_MARKERS.has(token)).length
  const english = tokens.filter((token) => ENGLISH_MARKERS.has(token)).length
  if (german >= 10 && german >= english * 3) return []
  return [
    {
      check: "language",
      detail: `Sprach-Heuristik: ${german} deutsche vs. ${english} englische Funktionswörter`,
    },
  ]
}

/** The brief as readable Markdown for Nick's review. */
export function consultBriefMarkdown(
  brief: DiscoveryCallSheetBriefSections,
  input: ConsultInput,
): string {
  const productName = (key: string) =>
    input.products.find((product) => product.decisionKey === key)?.name ?? key
  const lines = [
    "## Diagnose",
    "",
    brief.diagnose,
    "",
    "## Hebel",
    "",
    ...brief.hebel.map(
      (hebel, index) =>
        `${index + 1}. **${hebel.title}**${hebel.points === null ? "" : ` _(${hebel.points} P.)_`} — ${hebel.note}`,
    ),
    "",
    "## Tausch-Begründungen",
    "",
    ...(Object.keys(brief.swapReasons).length === 0
      ? ["_keine_"]
      : Object.entries(brief.swapReasons).map(
          ([key, reason]) => `- **${productName(key)}** (\`${key}\`): ${reason}`,
        )),
    "",
    "## Ziel-Lücken",
    "",
    ...(brief.zielLuecken.length === 0
      ? ["_keine_"]
      : brief.zielLuecken.map((entry) => `- ${entry}`)),
    "",
    "## Call-Fragen",
    "",
    ...brief.callFragen.map((entry) => `- ${entry}`),
    "",
    "## Erwartungen",
    "",
    ...brief.erwartungen.map((entry) => `- ${entry}`),
    "",
  ]
  return lines.join("\n")
}
