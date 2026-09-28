import type { DiscoveryCallSheetBriefSections } from "../call-sheet"
import type { ConsultInput, ConsultProduct } from "./input"

/**
 * The deterministic guardrail lint over a generated consult brief (consult-agent T2). Pure.
 * Contract: `docs/research/consult-knowledge/guardrails.md` — the phrase list below mirrors its
 * G1–G6 wording, and `tests/discovery-consult-lint.test.ts` fails when a forbidden quote there
 * is not caught here (or an allowed one is). An empty result = pass.
 *
 * The lint checks phrases, not sentence logic (guardrails G1): a negated forbidden phrase is
 * still a finding. Product names from the input are cut out before the phrase check, so a
 * verdict's „Repair" product can be quoted (G1 exception).
 *
 * Not linted (left to the prompt and Nick's edit pass): whether a product is offered as an
 * answer to hair loss (G2), honest time windows (G3), language register (G6 beyond archaic
 * imperatives), and brands outside `CONSULT_MARKET_BRANDS`.
 */

export type ConsultLintRule =
  | "forbidden_phrase"
  | "score_promise"
  | "score_target_cap"
  | "verdict_contradiction"
  | "unknown_product"
  | "unknown_swap_key"
  | "boundary_line_missing"

export type ConsultGuardrail = "G1" | "G1a" | "G1b" | "G1c" | "G2" | "G3" | "G4" | "G5" | "G6"

export type ConsultLintFinding = {
  rule: ConsultLintRule
  guardrail: ConsultGuardrail
  /** Where in the brief: `diagnose`, `hebel[1].note`, `swapReasons.<key>`, `erwartungen[0]` … */
  location: string
  excerpt: string
  detail?: string
}

/** The G2 boundary line, verbatim from guardrails.md (a test pins it). */
export const CONSULT_BOUNDARY_LINE =
  "Vermehrter Ausfall mit Wurzel, lichter werdendes Haar oder eine starke Kopfhautreaktion (anhaltendes Jucken, Rötung, Brennen, Schmerzen, nässende oder verkrustete Stellen) gehört ärztlich abgeklärt, dermatologisch oder hausärztlich."

/** The highest score target the brief may imply (G3: never 10). */
export const CONSULT_SCORE_TARGET_CAP = 9

// --- phrases -----------------------------------------------------------------------------------

export type ConsultForbiddenPhrase = {
  id: string
  guardrail: ConsultGuardrail
  rule: "forbidden_phrase" | "score_promise"
  /** Text that exists verbatim in guardrails.md — where the rule comes from (test-pinned). */
  anchor: string
  pattern: RegExp
}

/** A letter-aware word match (JS `\b` does not know umlauts), case-insensitive. */
function words(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\d])(?:${source})(?![\\p{L}\\d])`, "iu")
}

/** Like `words`, but the match may run on into a longer word („Reparaturkur"). */
function stem(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\d])(?:${source})\\p{L}*`, "iu")
}

const PERCENT = "\\d+(?:[.,]\\d+)?[\\s\\u00a0\\u202f]?%"

function phrase(
  id: string,
  guardrail: ConsultGuardrail,
  anchor: string,
  pattern: RegExp,
  rule: ConsultForbiddenPhrase["rule"] = "forbidden_phrase",
): ConsultForbiddenPhrase {
  return { id, guardrail, rule, anchor, pattern }
}

export const CONSULT_FORBIDDEN_PHRASES: readonly ConsultForbiddenPhrase[] = [
  // G1 — healing and repair promises
  phrase("repair", "G1", "reparieren", stem("reparier|reparatur")),
  phrase("heal", "G1", "heilt", words("heil(?:t|en|ung|st|te|ten|e)?")),
  phrase("as_new", "G1", "wie neu", words("wie neu")),
  phrase("as_before", "G1", "wie früher", words("wie früher")),
  phrase("undo", "G1", "rückgängig machen", stem("rückgängig")),
  phrase("regenerate", "G1", "regeneriert", stem("regenerier")),
  phrase(
    "rebuild",
    "G1",
    "baut das Haar wieder auf",
    words("baut[^.!?]{0,40}wieder auf|wieder ?aufbau\\p{L}*|wieder aufbauen"),
  ),
  phrase(
    "restore",
    "G1",
    "stellt wieder her",
    words("stell\\p{L}*[^.!?]{0,40}wieder her|wieder ?herstell\\p{L}*"),
  ),
  phrase(
    "regrow",
    "G1",
    "lässt Haare wachsen",
    words("lässt (?:die |deine |ihre )?haare? (?:wieder |nach)?wachsen|haare? wachsen nach"),
  ),
  phrase("stop_loss", "G1", "stoppt Haarausfall", words("stopp\\p{L}* (?:den )?haarausfall")),
  phrase("against_loss", "G1", "gegen Haarausfall", words("gegen (?:den )?haarausfall")),
  phrase(
    "seal_split_ends",
    "G1",
    "versiegelt Spliss",
    words("(?:verschließt|versiegelt|verklebt|repariert) (?:den )?spliss"),
  ),
  phrase("split_ends_gone", "G1", "Spliss weg", words("spliss (?:ist )?weg")),
  phrase("thickens", "G1", "verdickt das Haar", words("verdick\\p{L}* (?:das |dein |ihr )?haar")),
  // „Mehr Haare" as a promise — not her description of shedding („mir fallen mehr Haare aus").
  phrase(
    "more_hair",
    "G1",
    "mehr Haare",
    words("(?<!(?:fall|verlier|geh)\\p{L}* )mehr haare(?!\\s+(?:aus|auf|verlier))"),
  ),
  phrase("root", "G1", "stärkt die Wurzel", words("stärk\\p{L}* (?:die )?(?:haar)?wurzel\\p{L}*")),
  phrase(
    "full_protection",
    "G1",
    "Hitzeschutz schützt komplett",
    words(
      "schützt[^.!?]{0,20}(?:komplett|vollständig|zu 100)|(?:komplett|vollständig) geschützt|vollständige[nrs]? schutz",
    ),
  ),
  // G1 — absolute negative claims
  phrase(
    "no_care_keeps_up",
    "G1",
    "keine Pflege kommt hinterher",
    words("keine pflege kommt[^.!?]{0,10}hinterher|kommt keine pflege (?:mehr )?hinterher"),
  ),
  phrase(
    "nothing_helps",
    "G1",
    "da hilft nichts",
    words("(?:da )?hilft (?:gar |überhaupt )?nichts"),
  ),
  phrase("brings_nothing", "G1", "bringt gar nichts", words("bringt (?:gar |überhaupt )?nichts")),
  // G1 — guarantees
  phrase("guaranteed", "G1", "garantiert", stem("garantier")),
  phrase("definitely", "G1", "auf jeden Fall", words("auf jeden fall")),
  phrase("hundred_percent", "G1", "100 %", words(`100[\\s\\u00a0\\u202f]?(?:%|prozent)`)),
  phrase("surely_gone", "G1", "sicher weg", words("sicher weg")),
  phrase("never_again", "G1", "nie wieder", words("nie wieder")),
  phrase(
    "frizz_free",
    "G1",
    "komplett frizzfrei",
    words("(?:komplett |völlig |ganz )?frizz-?frei"),
  ),
  phrase("forever", "G1", "für immer", words("für immer")),
  // G1 — the score as a promise
  phrase(
    "score_target_promise",
    "G1",
    "du kommst auf 8",
    words("komm(?:st|t) (?:du |sie )?(?:sicher |dann )?auf (?:eine )?\\d+"),
    "score_promise",
  ),
  phrase(
    "score_rises",
    "G1",
    "dein Score steigt auf",
    words("score (?:steigt|klettert|geht (?:hoch|rauf))"),
    "score_promise",
  ),
  phrase("score_delta", "G1", "+2 Punkte", /\+\s?\d+(?:[.,]\d+)?\s?punkt/iu, "score_promise"),
  phrase(
    "score_more_points",
    "G1",
    "zwei Punkte mehr",
    words("(?:\\d+(?:[.,]\\d+)?|ein(?:en)?|zwei|drei|vier|fünf|sechs) punkte? mehr"),
    "score_promise",
  ),
  // G1a — no diagnosis by inference
  phrase("sounds_like", "G1a", "klingt nach", words("klingt (?:stark |sehr |eher )?nach")),
  phrase("typical_for", "G1a", "typisch für", words("typisch für")),
  phrase("surely_only", "G1a", "ist bestimmt nur", words("bestimmt nur")),
  phrase("that_is_surely", "G1a", "das ist sicher", words("das ist (?:sicher|bestimmt|eindeutig)")),
  phrase(
    "causal_scalp",
    "G1a",
    "deine Schuppen kommen vom Shampoo",
    words(
      "(?:schuppen|juckreiz|jucken|rötung\\p{L}*|haarausfall|ausfall)[^.!?]{0,40}komm(?:t|en) (?:vo[mn]|durch)",
    ),
  ),
  phrase(
    "fungus",
    "G1a",
    "das ist ein Pilz",
    words("(?:das|es) (?:ist|sind) (?:ein |eine )?pilz\\p{L}*"),
  ),
  phrase(
    "hormones",
    "G1a",
    "das sind Hormone",
    words("(?:das|es) (?:sind|ist|liegt an den|kommt von den) hormon\\p{L}*|hormonell bedingt"),
  ),
  // G1b — no supplements, no drug actives, no doses
  phrase("biotin", "G1b", "Biotin", words("biotin")),
  phrase("zinc", "G1b", "Zink", words("zink")),
  phrase("iron", "G1b", "Eisen", words("eisen(?:präparat\\p{L}*|tablette\\p{L}*)?")),
  phrase("minoxidil", "G1b", "Minoxidil", words("minoxidil")),
  phrase("cortisone", "G1b", "Kortison", words("[kc]ortison\\p{L}*")),
  phrase("ketoconazole", "G1b", "Ketoconazol", words("ketoconazol\\p{L}*")),
  phrase("dose", "G1b", "Dosierungen", words("\\d+(?:[.,]\\d+)?\\s?(?:mg|µg|mcg)")),
  // G1c — ingredient myths
  phrase(
    "silicone_suffocates",
    "G1c",
    "Silikone ersticken das Haar",
    words("silikone? (?:ersticken|erstickt|verstopfen|verstopft)"),
  ),
  phrase(
    "silicone_harmful",
    "G1c",
    "Silikone sind schädlich",
    words("silikone? (?:sind|ist) (?:schädlich|schlecht|gefährlich)"),
  ),
  phrase("sulfate_toxic", "G1c", "Sulfate sind giftig", words("sulfate? (?:sind|ist) giftig")),
  phrase("chemical_free", "G1c", "chemiefrei", words("chemie-?frei|ohne chemie")),
  phrase("detox", "G1c", "Detox", stem("detox")),
  phrase("float_test", "G1c", "Schwimmtest", stem("schwimmtest|wasserglas")),
  // G2 — the boundary is never softened
  phrase(
    "probably_harmless",
    "G2",
    "wahrscheinlich harmlos",
    words("(?:wahrscheinlich|bestimmt|sicher) harmlos"),
  ),
  phrase("wait_first", "G2", "erst mal abwarten", words("erst ?mal abwarten")),
  phrase("try_first", "G2", "probier vorher", words("probier\\p{L}* (?:vorher|erst|zuerst)")),
  // G5 — uncertainty stays internal
  phrase("evidence_grade", "G5", "moderate Evidenz", stem("evidenz")),
  phrase("study_situation", "G5", "Studienlage schwach", stem("studienlage")),
  phrase("percent", "G5", "Prozentwerte", words(`${PERCENT}|prozent\\p{L}*`)),
  phrase("confidence", "G5", "Confidence", stem("konfidenz|confidence")),
  // G6 — no archaic imperatives
  phrase("wisse", "G6", "Wisse", words("wisse")),
  phrase("bedenke", "G6", "Bedenke", words("bedenke")),
]

/** The forbidden phrases in one text (no product-name exemption — see `lintConsultBrief`). */
export function findForbiddenPhrases(text: string): ConsultForbiddenPhrase[] {
  return CONSULT_FORBIDDEN_PHRASES.filter((entry) => entry.pattern.test(text))
}

// --- products --------------------------------------------------------------------------------

/**
 * Brands from the German drugstore and salon market. A brand named in the brief that none of
 * her products, swap targets or options carries is an invented product (G4). Deliberately a
 * closed list: an unknown brand outside it is not caught here (Nick's edit pass is).
 */
export const CONSULT_MARKET_BRANDS: readonly string[] = [
  "Alpecin",
  "Alterra",
  "Alverde",
  "Aussie",
  "Aveda",
  "Balea",
  "Batiste",
  "Briogeo",
  "Bumble and bumble",
  "Cantu",
  "Davines",
  "Dove",
  "Dyson",
  "Elseve",
  "Elvital",
  "Fructis",
  "Garnier",
  "GHD",
  "Gliss",
  "Guhl",
  "Head & Shoulders",
  "Herbal Essences",
  "Isana",
  "John Frieda",
  "K18",
  "Kérastase",
  "Langhaarmädchen",
  "Lavera",
  "Living Proof",
  "Logona",
  "L'Oréal",
  "Mielle",
  "Moroccanoil",
  "Neqi",
  "Nivea",
  "OGX",
  "Olaplex",
  "Pantene",
  "Paul Mitchell",
  "Plantur",
  "Redken",
  "Sante",
  "Schauma",
  "Schwarzkopf",
  "Sebamed",
  "Syoss",
  "Tresemmé",
  "Weleda",
  "Wella",
]

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function nameMatcher(names: readonly string[]): RegExp | null {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  if (cleaned.length === 0) return null
  // Longest first, so a full label wins over its shorter alias.
  cleaned.sort((left, right) => right.length - left.length)
  return new RegExp(`(?<![\\p{L}\\d])(?:${cleaned.map(escape).join("|")})(?![\\p{L}\\d])`, "giu")
}

function knownNames(input: ConsultInput): string[] {
  return input.products.flatMap((product) => [
    product.name,
    ...product.aliases,
    ...(product.swapTarget ? [product.swapTarget] : []),
    ...product.swapOptions,
  ])
}

// --- verdict cues (G4) --------------------------------------------------------------------------

const KEEP_CUE = words(
  "behalten|behält|bleib(?:t|en)|kann bleiben|weiter (?:nutzen|benutzen|verwenden|nehmen)|weiter(?:nutzen|verwenden)",
)
const PRAISE_CUE = words("passt (?:gut|super|perfekt|prima|toll|genau)|ideal|perfekt|top")
const VERDICT_NAMED = words("passt (?:eigentlich |leider )?nicht")
const DISCOURAGE_CUE = words(
  "weglassen|lass\\p{L}*[^.!?]{0,30} weg|absetzen|nicht mehr (?:nutzen|benutzen|verwenden|nehmen)|austauschen|tauschen|ersetzen|aussortieren|verzichten|abraten|abgeraten|passt (?:eigentlich |leider )?nicht",
)

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function clauses(sentence: string): string[] {
  return sentence
    .split(/[,;:]|\s[–—-]\s/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function mentions(text: string, product: ConsultProduct): boolean {
  const matcher = nameMatcher(product.aliases.length > 0 ? product.aliases : [product.name])
  return matcher ? new RegExp(matcher.source, "iu").test(text) : false
}

type VerdictSide = "passt" | "passt_nicht"

/** Only products with a settled fit are checked (not `neu`, not unclear, not in research). */
function verdictSide(product: ConsultProduct): VerdictSide | null {
  return product.verdict === "passt" || product.verdict === "passt_nicht" ? product.verdict : null
}

/** A decided swap or drop of a „passt" product may be discussed as such. */
function decidedAway(product: ConsultProduct): boolean {
  return product.decision === "swap" || product.decision === "drop"
}

/** Whether `clause` (about `product`) contradicts its verdict; `sentence` holds the context. */
function contradicts(product: ConsultProduct, clause: string, sentence: string): boolean {
  const side = verdictSide(product)
  if (side === "passt_nicht") {
    return PRAISE_CUE.test(clause) || (KEEP_CUE.test(clause) && !VERDICT_NAMED.test(sentence))
  }
  if (side === "passt") return !decidedAway(product) && DISCOURAGE_CUE.test(clause)
  return false
}

// --- the lint ------------------------------------------------------------------------------------

type BriefText = { location: string; text: string; swapKey?: string }

function briefTexts(brief: DiscoveryCallSheetBriefSections): BriefText[] {
  return [
    { location: "diagnose", text: brief.diagnose },
    ...brief.hebel.flatMap((entry, index) => [
      { location: `hebel[${index}].title`, text: entry.title },
      { location: `hebel[${index}].note`, text: entry.note },
    ]),
    ...Object.entries(brief.swapReasons).map(([key, text]) => ({
      location: `swapReasons.${key}`,
      text,
      swapKey: key,
    })),
    ...brief.zielLuecken.map((text, index) => ({ location: `zielLuecken[${index}]`, text })),
    ...brief.callFragen.map((text, index) => ({ location: `callFragen[${index}]`, text })),
    ...brief.erwartungen.map((text, index) => ({ location: `erwartungen[${index}]`, text })),
  ]
}

const BOUNDARY_SENTENCE = /ärztlich/iu
const BOUNDARY_ACTION = /abklär|abgeklärt|anschauen|ansehen|untersuchen/iu

export function lintConsultBrief(
  brief: DiscoveryCallSheetBriefSections,
  input: ConsultInput,
): ConsultLintFinding[] {
  const findings: ConsultLintFinding[] = []
  const texts = briefTexts(brief)
  const names = knownNames(input)
  const productNames = nameMatcher(names)
  const checked = input.products.filter((product) => verdictSide(product) !== null)
  const decisionKeys = new Set(input.products.flatMap((product) => product.decisionKey ?? []))

  for (const { location, text, swapKey } of texts) {
    // G1–G6 phrases, with her product names cut out (G1 exception for quoted names).
    const unnamed = productNames ? text.replace(productNames, " ") : text
    for (const entry of CONSULT_FORBIDDEN_PHRASES) {
      const match = entry.pattern.exec(unnamed)
      if (match) {
        findings.push({
          rule: entry.rule,
          guardrail: entry.guardrail,
          location,
          excerpt: match[0],
          detail: entry.id,
        })
      }
    }

    // G4 — invented products: a market brand none of her products carries.
    for (const brand of CONSULT_MARKET_BRANDS) {
      const brandPattern = words(escape(brand))
      const match = brandPattern.exec(text)
      if (match && !names.some((name) => brandPattern.test(name))) {
        findings.push({
          rule: "unknown_product",
          guardrail: "G4",
          location,
          excerpt: sentences(text).find((sentence) => brandPattern.test(sentence)) ?? match[0],
          detail: brand,
        })
      }
    }

    // G4 — verdict contradictions, per named product and clause.
    const flagged = new Set<ConsultProduct>()
    for (const sentence of sentences(text)) {
      for (const clause of clauses(sentence)) {
        for (const product of checked) {
          if (flagged.has(product) || !mentions(clause, product)) continue
          if (contradicts(product, clause, sentence)) {
            flagged.add(product)
            findings.push(verdictFinding(location, product, sentence))
          }
        }
      }
    }

    // G4 — a swap reason is about its own step's product, named or not.
    if (swapKey !== undefined) {
      if (!decisionKeys.has(swapKey)) {
        findings.push({
          rule: "unknown_swap_key",
          guardrail: "G4",
          location,
          excerpt: swapKey,
        })
        continue
      }
      const owners = checked.filter((product) => product.decisionKey === swapKey)
      const sides = new Set(owners.map(verdictSide))
      const owner = owners[0]
      // Several of her products in one step with different verdicts: no single subject.
      if (!owner || sides.size !== 1 || flagged.has(owner)) continue
      if (owners.some((product) => product !== owner && flagged.has(product))) continue
      const others = input.products.filter((product) => product.decisionKey !== swapKey)
      const otherNames = nameMatcher(
        others
          .flatMap((product) => [product.name, ...product.aliases])
          .concat(
            owners.flatMap((product) => [
              ...(product.swapTarget ? [product.swapTarget] : []),
              ...product.swapOptions,
            ]),
          ),
      )
      for (const sentence of sentences(text)) {
        const about = clauses(sentence).filter(
          (clause) => !otherNames || !new RegExp(otherNames.source, "iu").test(clause),
        )
        if (about.some((clause) => owners.some((product) => contradicts(product, clause, text)))) {
          findings.push(verdictFinding(location, owner, sentence))
          break
        }
      }
    }
  }

  // G2 — the boundary line, in every brief.
  if (!texts.some(({ text }) => BOUNDARY_SENTENCE.test(text) && BOUNDARY_ACTION.test(text))) {
    findings.push({
      rule: "boundary_line_missing",
      guardrail: "G2",
      location: "erwartungen",
      excerpt: "",
      detail:
        input.boundaryTriggers.length > 0
          ? `Pflicht, Auslöser im Profil: ${input.boundaryTriggers.join(", ")}`
          : "Pflicht in jedem Brief",
    })
  }

  // G3 — the target the Hebel points imply stays at 9 or below.
  if (input.baselineScore !== null) {
    const target =
      input.baselineScore +
      brief.hebel.reduce((sum, entry) => sum + Math.max(0, entry.points ?? 0), 0)
    if (target > CONSULT_SCORE_TARGET_CAP) {
      findings.push({
        rule: "score_target_cap",
        guardrail: "G3",
        location: "hebel",
        excerpt: String(target),
        detail: `Baseline ${input.baselineScore} + Hebel-Punkte = ${target} > ${CONSULT_SCORE_TARGET_CAP}`,
      })
    }
  }

  return findings
}

function verdictFinding(
  location: string,
  product: ConsultProduct,
  sentence: string,
): ConsultLintFinding {
  return {
    rule: "verdict_contradiction",
    guardrail: "G4",
    location,
    excerpt: sentence,
    detail: `${product.name}: ${product.verdict}`,
  }
}
