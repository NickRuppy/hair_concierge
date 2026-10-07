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
 * verdict's „Repair" product can be quoted (G1 exception). One sentence-level exception (G1b,
 * R22): a supplement or drug active may be named factually in a sentence that hands the
 * decision to a doctor and neither recommends it nor names a care product (`MEDICAL_MENTION_IDS`).
 *
 * Not linted (left to the prompt and Nick's edit pass): whether a product is offered as an
 * answer to hair loss (G2), honest time windows (G3), language register (G6 beyond archaic
 * imperatives), and brands outside `CONSULT_MARKET_BRANDS`.
 */

export type ConsultLintRule =
  | "forbidden_phrase"
  | "score_promise"
  | "verdict_contradiction"
  | "unknown_product"
  | "unknown_swap_key"
  | "swap_reason_priority"
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

/** Like `stem`, and also inside a compound („Haarreparatur", „ausheilen"). */
function infix(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\d])\\p{L}*(?:${source})\\p{L}*`, "iu")
}

/**
 * Every text is normalized before any matching: NFC, soft hyphens and zero-width characters
 * removed — otherwise „repa\u00adriert" or a decomposed umlaut slips past every rule.
 */
export function normalizeConsultText(text: string): string {
  return text.normalize("NFC").replace(/[\u00ad\u200b-\u200f\u2060-\u2064\ufeff]/g, "")
}

/** Brand comparison only: accents folded, apostrophes unified („L'Oreal" = „L’Oréal"). */
function foldBrand(text: string): string {
  return normalizeConsultText(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘´`ʼ]/g, "'")
}

/** Spelled-out score numbers as whole words („der Acht", not „beachten"). */
const SPELLED_NUMBER =
  "(?<!\\p{L})(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)(?!\\p{L})"

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
  phrase("repair", "G1", "repariert", infix("reparier|reparatur")),
  // „Heiligenschein" (frizz halo) is not healing.
  phrase("heal", "G1", "heilt", infix("heil(?!ig)")),
  phrase("as_new", "G1", "wie neu", words("wie neu")),
  phrase("as_before", "G1", "wie früher", words("wie früher")),
  phrase("undo", "G1", "macht rückgängig", stem("rückgängig")),
  phrase("regenerate", "G1", "regeneriert", infix("regenerier|regenerat")),
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
  phrase("guaranteed", "G1", "garantiert", infix("garant")),
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
    "kommst du auf 8",
    words("komm(?:st|t) (?:du |sie )?(?:sicher |dann )?auf (?:eine )?\\d+"),
    "score_promise",
  ),
  phrase(
    "score_rises",
    "G1",
    "Score-Zahlen, Zielwerte und Deltas",
    words("score (?:steigt|klettert|geht (?:hoch|rauf))"),
    "score_promise",
  ),
  phrase("score_delta", "G1", "Deltas", /\+\s?\d+(?:[.,]\d+)?\s?punkt/iu, "score_promise"),
  // Any score figure in the text: the numbers live in `hebel.points` only (R13, G1). A digit
  // before „Score" counts within its own clause only — a time window ahead of a semicolon is
  // not a score figure (guardrails' own „2–4 Wochen; wie weit der Score mitgeht").
  phrase(
    "score_figure",
    "G1",
    "Score-Zahlen",
    words(
      `score[^.!?]{0,40}(?:\\d|${SPELLED_NUMBER})|(?:\\d|${SPELLED_NUMBER})[^.!?;]{0,40}score\\p{L}*|ziel[^.!?]{0,40}${SPELLED_NUMBER}|ziel\\p{L}* (?:ist|liegt|wäre) (?:eine |bei |die |auf )?\\d`,
    ),
    "score_promise",
  ),
  phrase(
    "points_better",
    "G1",
    "Deltas",
    words(
      "punkte? (?:besser|höher)|verbesser\\p{L}* (?:sich )?um (?:\\d|ein|zwei|drei)|um (?:\\d+(?:[.,]\\d+)?|einen|zwei|drei) punkte?",
    ),
    "score_promise",
  ),
  // G3: the target is never 10.
  phrase(
    "target_ten",
    "G1",
    "eine 10 wird nie in Aussicht gestellt",
    words(
      "(?:ziel|score)[^.!?]{0,30}(?<!\\d)10(?![\\d,.]\\d)|(?<![\\d,.])10(?!\\d)[^.!?]{0,30}(?:ziel|score)",
    ),
    "score_promise",
  ),
  phrase(
    "score_more_points",
    "G1",
    "Deltas",
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
  // G1b — supplements and drug actives: never recommended or dosed; a factual mention is allowed
  // only per sentence with a doctor handoff (R22, `MEDICAL_MENTION_IDS`). Brands and doses never.
  phrase("biotin", "G1b", "Biotin", infix("biotin")),
  phrase(
    "supplements",
    "G1b",
    "Nahrungsergänzungsmittel",
    infix("nahrungsergänz|haarvitamin|vitaminpräparat|vitamintablette"),
  ),
  // Hair-loss drugs and supplement brands (G1b, not the market-brand list: never recommendable).
  phrase("hair_loss_brands", "G1b", "Bezugsquellen", words("regaine|pantovigar|priorin")),
  phrase("finasteride", "G1b", "Arzneiwirkstoffe", stem("finasterid")),
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
  // A negated doctor sentence („muss nicht ärztlich abgeklärt werden") softens the line.
  phrase(
    "boundary_negated",
    "G2",
    "nie relativiert",
    words(
      "(?:nicht|kein\\p{L}*|unnötig)[^.!?,;:]{0,40}ärztlich\\p{L}*|ärztlich\\p{L}*[^.!?,;:]{0,20}(?:nicht|unnötig)|kein\\p{L}* (?:grund|anlass|bedarf|notwendigkeit)[^.!?]{0,40}(?:ärztlich\\p{L}*|\\p{L}*ärzt\\p{L}*|\\p{L}*arzt\\p{L}*|untersuch\\p{L}*)|(?:\\p{L}*arzt\\p{L}*|\\p{L}*ärzt\\p{L}*|untersuch\\p{L}*)[^.!?,;:]{0,30}(?:nicht|unnötig)|(?:nicht|kein\\p{L}*|unnötig)[^.!?,;:]{0,40}(?:hautarzt|hautärzt\\p{L}*|untersuchen (?:zu )?lassen)",
    ),
  ),
  // G5 — uncertainty stays internal
  phrase("evidence_grade", "G5", "moderate Evidenz", stem("evidenz")),
  phrase("study_situation", "G5", "Studienlage schwach", stem("studienlage")),
  phrase("percent", "G5", "Prozentwerte", words(`${PERCENT}|prozent\\p{L}*`)),
  phrase("confidence", "G5", "Confidence", stem("konfidenz|confidence")),
  // G6 — no archaic imperatives
  phrase("wisse", "G6", "Wisse", words("wisse")),
  phrase("bedenke", "G6", "Bedenke", words("bedenke")),
]

// --- R22: factual medical mention with a doctor handoff ---------------------------------------

/**
 * Substances (G1b, ruling R22 — Nick 2026-09-29, loosened): naming a supplement or drug
 * active factually is allowed anywhere; forbidden stays the sentence that recommends,
 * doses/schedules, turns the handoff around or mixes it with a care product. `dose`,
 * `hair_loss_brands` and `percent` are NOT here: brands and dosing never appear.
 */
export const MEDICAL_MENTION_IDS: ReadonlySet<string> = new Set([
  "biotin",
  "supplements",
  "zinc",
  "iron",
  "minoxidil",
  "cortisone",
  "ketoconazole",
  "finasteride",
])

/**
 * Efficacy-against-hair-loss claims: allowed only in a medically framed sentence (a doctor
 * token or a named drug active) — as care claims they stay G1 promises.
 */
export const LOSS_CLAIM_IDS: ReadonlySet<string> = new Set(["against_loss", "stop_loss"])

const DRUG_TOKEN = new RegExp(
  ["minoxidil", "finasterid\\p{L}*", "[kc]ortison\\p{L}*", "ketoconazol\\p{L}*"].join("|"),
  "iu",
)

/** ärztlich, Arzt/Ärztin/Ärzte (incl. Hausarzt, Hautärztin), dermatologisch — not „geschwärzt". */
const DOCTOR_TOKEN = new RegExp(
  "(?<![\\p{L}\\d])\\p{L}*(?<!schw)(?:ärzt|arzt)\\p{L}*|(?<![\\p{L}\\d])dermatolog\\p{L}*",
  "iu",
)

/**
 * The sentence reads as a recommendation of the substance — the handoff does not excuse it.
 * Advice markers („solltest") and application schedules („täglich anwenden") count as
 * recommendation/dosing (G1b bans Anwendungsschemata); the descriptive „solange man sie
 * anwendet" carries none of these markers and stays allowed.
 */
const RECOMMEND_CUE = new RegExp(
  [
    stem("probier|versuch|empfehl|empfiehl|empfohl|besorg|kauf").source,
    words(
      "nimm|nehmen|einnehmen|start\\p{L}* mit|fang\\p{L}* [^.!?]{0,40}an mit|fang\\p{L}* mit [^.!?]{0,40}an",
    ).source,
    // „wende … an" (anwenden imperative), but not „wende dich an deine Ärztin" — that is the handoff.
    words(
      "sollte\\p{L}*|musst|müsst\\p{L}*|am besten|wende (?!dich|sich|euch)[^.!?]{0,20}an(?!\\p{L})|trag\\p{L}* [^.!?]{0,20}auf",
    ).source,
    words("täglich|wöchentlich|morgens|abends|\\d+\\s?× (?:täglich|pro tag|pro woche)").source,
  ].join("|"),
  "iu",
)

/** A care product category in the same sentence: cosmetic and medical never mix (G6). */
const CARE_CATEGORY = new RegExp(
  [
    infix("shampoo|spülung|conditioner|serum|seren|tonikum|haarwasser|ampulle|leave-in").source,
    words("kur|kuren|maske\\p{L}*|haaröl\\p{L}*|öl|öle").source,
  ].join("|"),
  "iu",
)

/**
 * Sentences for the R22 check. Unlike `sentences`, an abbreviation („z. B.", „ggf.") does not
 * end a sentence — otherwise „beim Hautarzt, z. B. wegen Minoxidil?" loses its handoff.
 */
function medicalSentences(text: string): string[] {
  return text
    .split(
      /(?<=[.!?;])(?<!(?:^|[\s(])\p{L}\.)(?<!(?:^|\s)(?:bzw|ca|evtl|ggf|inkl|usw|etc|vgl|Dr)\.)\s+/iu,
    )
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/** A handoff turned around: „ohne Arzt", „statt zur Hautärztin", „kein Arzttermin nötig". */
const NEGATED_HANDOFF = words(
  "(?:ohne|statt|anstatt|kein\\p{L}*|nicht)(?: \\p{L}+){0,2} \\p{L}*(?:ärzt|arzt|dermatolog)\\p{L}*",
)

function medicalMentionAllowed(sentence: string): boolean {
  return (
    !NEGATED_HANDOFF.test(sentence) &&
    !RECOMMEND_CUE.test(sentence) &&
    !CARE_CATEGORY.test(sentence)
  )
}

/** A loss claim needs medical framing on top: a doctor token or a named drug active. */
function lossClaimAllowed(sentence: string): boolean {
  return (
    (DOCTOR_TOKEN.test(sentence) || DRUG_TOKEN.test(sentence)) && medicalMentionAllowed(sentence)
  )
}

/** The first offending match of one phrase rule in a normalized text, or null. */
function matchPhrase(entry: ConsultForbiddenPhrase, text: string): RegExpExecArray | null {
  const perSentence = MEDICAL_MENTION_IDS.has(entry.id)
    ? medicalMentionAllowed
    : LOSS_CLAIM_IDS.has(entry.id)
      ? lossClaimAllowed
      : null
  if (!perSentence) return entry.pattern.exec(text)
  for (const sentence of medicalSentences(text)) {
    const match = entry.pattern.exec(sentence)
    if (match && !perSentence(sentence)) return match
  }
  return null
}

/** The forbidden phrases in one text (no product-name exemption — see `lintConsultBrief`). */
export function findForbiddenPhrases(text: string): ConsultForbiddenPhrase[] {
  const normalized = normalizeConsultText(text)
  return CONSULT_FORBIDDEN_PHRASES.filter((entry) => matchPhrase(entry, normalized) !== null)
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

/**
 * `hyphenJoins`: a hyphen continues the word — used ONLY for a bare category-label alias, so
 * „Shampoo" is not named in „Shampoo-Ansatz". Brand and name aliases keep plain letter
 * boundaries, so „Frischkraft-Shampoo" still names Frischkraft.
 */
function nameMatcher(names: readonly string[], hyphenJoins = false): RegExp | null {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  if (cleaned.length === 0) return null
  // Longest first, so a full label wins over its shorter alias.
  cleaned.sort((left, right) => right.length - left.length)
  const edge = hyphenJoins ? "[\\p{L}\\d-]" : "[\\p{L}\\d]"
  return new RegExp(`(?<!${edge})(?:${cleaned.map(escape).join("|")})(?!${edge})`, "giu")
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
  "behalten|behält|bleib(?:t|en)|kann bleiben|weiter (?:nutzen|benutzen|verwenden|nehmen)|weiter(?:nutzen|benutzen|verwenden)|weiterhin (?:\\p{L}+ )?(?:nutzen|benutzen|verwenden|nehmen)",
)
/**
 * „passt … nicht" as a negation: „nicht" within four plain words after „passt" („passt dafür
 * nicht", „passt bei feinem Haar ebenfalls nicht" — the T5 evals needed four). The window never crosses punctuation („passt — nicht
 * ohne Grund" stays praise), never spans a conjunction or a praise word („passt gut und nicht
 * zu schwer" stays praise), and „nicht nur" is no negation („passt nicht nur gut").
 */
const PASST_WINDOW_TOKEN =
  "(?!(?:und|aber|sondern|oder|doch|gut|super|perfekt|prima|toll|genau|bestens|ideal)(?!\\p{L}))[^\\s.,;:!?()–—-]+"
// One connective directly after „passt" is still the same negation („passt aber nicht");
// the window's conjunction ban only guards against praise carried across clauses.
const PASST_NEGATION_TAIL = `(?:\\s+(?:aber|jedoch|doch|allerdings)(?!\\p{L}))?(?:\\s+${PASST_WINDOW_TOKEN}){0,4}\\s+nicht(?!\\p{L})(?!\\s+(?:nur|selten|zuletzt|ohne)(?!\\p{L}))`
const PASST_NEGATED = `passt${PASST_NEGATION_TAIL}`

/** Praise, incl. a bare „passt" (a negated „passt … nicht" excluded). */
const PRAISE_CUE = words(
  `passt(?!${PASST_NEGATION_TAIL})|` +
    "(?<!nicht\\s)geeignet|funktioniert (?:gut|super|prima|toll|bestens)|klappt (?:gut|super|prima)|ideal|perfekt|top",
)
const VERDICT_NAMED = words(PASST_NEGATED)
const DISCOURAGE_CUE = words(
  "weglassen|lass\\p{L}*[^.!?]{0,30} weg|absetzen|nicht mehr (?:nutzen|benutzen|verwenden|nehmen)|austauschen|tauschen|ersetzen|aussortieren|rausnehmen|raus nehmen|rausschmeißen|rauswerfen|wegwerfen|streichen|verzichten|abraten|abgeraten|brauch\\p{L}*(?: \\p{L}+)? (?:nicht|kein\\p{L}*)|" +
    PASST_NEGATED,
)

function sentences(text: string): string[] {
  return (
    text
      // A semicolon joins two independent main clauses: each is its own sentence for G4.
      .split(/(?<=[.!?;])\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
}

function clauses(sentence: string): string[] {
  return sentence
    .split(/[,;:]|\s[–—-]\s/)
    .map((entry) => entry.trim())
    .filter(Boolean)
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

/** Whether `scope` (a text about `product`) contradicts its verdict. Per product (1d). */
function contradicts(product: ConsultProduct, scope: string): boolean {
  const side = verdictSide(product)
  if (side === "passt_nicht") {
    return PRAISE_CUE.test(scope) || (KEEP_CUE.test(scope) && !VERDICT_NAMED.test(scope))
  }
  if (side === "passt") return !decidedAway(product) && DISCOURAGE_CUE.test(scope)
  return false
}

/**
 * How the brief may name one checked product: its aliases, brand + a word of its name or
 * category („Glanzwerk Shampoo"), the bare brand when no other checked product shares it,
 * and the bare category label when it is her only checked product in that category („ihr
 * Shampoo"). A mention is matched with every OTHER known name cut out first, so „das Sanftwerk
 * Mild Shampoo" is never read as „ihr Shampoo".
 */
type ProductMention = {
  product: ConsultProduct
  own: RegExp
  /** The bare category label (hyphen-joined compounds excluded); null when not an alias. */
  category: RegExp | null
  others: RegExp | null
}

function productMentions(
  input: ConsultInput,
  checked: readonly ConsultProduct[],
): ProductMention[] {
  const fold = (value: string) => foldBrand(value).toLowerCase()
  return checked.flatMap((product) => {
    const aliases = new Set(product.aliases.length > 0 ? product.aliases : [product.name])
    aliases.add(product.name)
    const brand = product.brand?.trim()
    if (brand) {
      const tokens = product.name
        .split(/\s+/)
        .filter((token) => token.length >= 4 && fold(token) !== fold(brand))
      for (const token of tokens) {
        aliases.add(`${brand} ${token}`)
        aliases.add(`${brand}-${token}`)
      }
      if (product.categoryLabel) {
        aliases.add(`${brand} ${product.categoryLabel}`)
        // „Frischkraft-Shampoo", „K18-Maske"
        aliases.add(`${brand}-${product.categoryLabel}`)
      }
      if (
        checked.filter((other) => other.brand && fold(other.brand) === fold(brand)).length === 1
      ) {
        aliases.add(brand)
      }
    }
    const label = product.categoryLabel
    const categoryAlias =
      label && checked.filter((other) => other.categoryLabel === label).length === 1
        ? nameMatcher([normalizeConsultText(label)], true)
        : null
    const own = nameMatcher([...aliases].map(normalizeConsultText))
    if (!own) return []
    const others = nameMatcher(
      knownNames(input)
        .filter((name) => !aliases.has(name) && name !== label)
        .map(normalizeConsultText),
    )
    return [
      {
        product,
        own: new RegExp(own.source, "iu"),
        category: categoryAlias ? new RegExp(categoryAlias.source, "iu") : null,
        others,
      },
    ]
  })
}

/**
 * „das gewählte/empfohlene/neue Shampoo" names the plan's pick, never her product — a bare
 * category with one of these attributes is cut out before the category fallback matches
 * (iteration 4: the deepened technique notes talk about the incoming product this way).
 */
const RECOMMENDED_ATTRIBUTE = "(?<!\\p{L})(?:gewählte|empfohlene|neue|künftige)\\p{L}*"

function mentioned(text: string, mention: ProductMention): boolean {
  const rest = mention.others ? text.replace(mention.others, " ") : text
  if (mention.own.test(rest)) return true
  if (!mention.category) return false
  const withoutPicks = rest.replace(
    new RegExp(`${RECOMMENDED_ATTRIBUTE}\\s+(?:${mention.category.source})`, "giu"),
    " ",
  )
  return mention.category.test(withoutPicks)
}

// --- the lint ------------------------------------------------------------------------------------

type BriefText = { location: string; text: string; swapKey?: string }

function briefTexts(brief: DiscoveryCallSheetBriefSections): BriefText[] {
  return [
    { location: "mechanik", text: brief.mechanik },
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
    ...brief.callFragen.map((text, index) => ({ location: `callFragen[${index}]`, text })),
    ...brief.erwartungen.map((text, index) => ({ location: `erwartungen[${index}]`, text })),
  ]
}

/** Whitespace-normalized, for the verbatim boundary check. */
function squash(text: string): string {
  return normalizeConsultText(text).replace(/\s+/g, " ").trim()
}

/**
 * Category-priority talk inside a swap reason (iteration 4, R34-adjacent): a reason argues
 * the proposed move behind its key, never where the category ranks — that belongs in hebel
 * or callFragen, and next to the swap UI it reads as second-guessing the engine's decision.
 * Deliberately narrow (bare „zuerst" stays legal: „zuerst aufbrauchen" is sequencing, not
 * category priority).
 */
const SWAP_REASON_PRIORITY = words(
  "nachrangig|erste[rnm]? schritt|zweite[rnm]? schritt|nicht zuerst",
)

export function lintConsultBrief(
  brief: DiscoveryCallSheetBriefSections,
  input: ConsultInput,
): ConsultLintFinding[] {
  const findings: ConsultLintFinding[] = []
  const texts = briefTexts(brief).map((entry) => ({
    ...entry,
    text: normalizeConsultText(entry.text),
  }))
  const names = knownNames(input).map(normalizeConsultText)
  const productNames = nameMatcher(names)
  const checked = input.products.filter((product) => verdictSide(product) !== null)
  const productMentionList = productMentions(input, checked)
  const foldedNames = names.map(foldBrand)
  const decisionKeys = new Set(input.products.flatMap((product) => product.decisionKey ?? []))

  for (const { location, text, swapKey } of texts) {
    // G1–G6 phrases, with her product names cut out (G1 exception for quoted names).
    const unnamed = productNames ? text.replace(productNames, " ") : text
    for (const entry of CONSULT_FORBIDDEN_PHRASES) {
      const match = matchPhrase(entry, unnamed)
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

    // Priority talk in a swap reason — the prompt forbids it, this pins it.
    if (swapKey !== undefined) {
      const match = SWAP_REASON_PRIORITY.exec(text)
      if (match) {
        findings.push({
          rule: "swap_reason_priority",
          guardrail: "G4",
          location,
          excerpt:
            sentences(text).find((sentence) => SWAP_REASON_PRIORITY.test(sentence)) ?? match[0],
        })
      }
    }

    // G4 — invented products: a market brand none of her products carries.
    const foldedText = foldBrand(text)
    for (const brand of CONSULT_MARKET_BRANDS) {
      const brandPattern = words(escape(foldBrand(brand)))
      const match = brandPattern.exec(foldedText)
      if (match && !foldedNames.some((name) => brandPattern.test(name))) {
        findings.push({
          rule: "unknown_product",
          guardrail: "G4",
          location,
          excerpt:
            sentences(text).find((sentence) => brandPattern.test(foldBrand(sentence))) ?? match[0],
          detail: brand,
        })
      }
    }

    // G4 — verdict contradictions, per named product: the whole sentence when it names one
    // checked product, else the clauses that name it.
    const flagged = new Set<ConsultProduct>()
    for (const sentence of sentences(text)) {
      const named = productMentionList.filter((mention) => mentioned(sentence, mention))
      for (const mention of named) {
        if (flagged.has(mention.product)) continue
        const all = clauses(sentence)
        const own = all.filter((clause) => mentioned(clause, mention))
        // Its own clause states „passt … nicht": praise elsewhere in the sentence is about
        // another subject („… passt ein milderer Ansatz besser: X passt nicht").
        const verdictStated =
          verdictSide(mention.product) === "passt_nicht" &&
          own.some((clause) => VERDICT_NAMED.test(clause))
        const scopes = named.length === 1 && !verdictStated ? [sentence] : own
        // One product, verdict stated: the clauses AFTER its own that name nothing else
        // continue about it („X passt nicht, ist aber trotzdem ideal") — praise there is the
        // model contradicting itself. Clauses before it are preamble about another subject.
        const continuation =
          named.length === 1 && verdictStated
            ? all
                .slice(all.findIndex((clause) => mentioned(clause, mention)) + 1)
                .filter(
                  (clause) =>
                    !mentioned(clause, mention) &&
                    !(mention.others && new RegExp(mention.others.source, "iu").test(clause)),
                )
            : []
        if (
          scopes.some((scope) => contradicts(mention.product, scope)) ||
          continuation.some((clause) => PRAISE_CUE.test(clause))
        ) {
          flagged.add(mention.product)
          findings.push(verdictFinding(location, mention.product, sentence))
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
      const otherPattern = otherNames ? new RegExp(otherNames.source.normalize("NFC"), "iu") : null
      for (const sentence of sentences(text)) {
        // No other product named: the whole sentence is about hers; else only the clauses
        // that name no other product.
        const about =
          !otherPattern || !otherPattern.test(sentence)
            ? [sentence]
            : clauses(sentence).filter((clause) => !otherPattern.test(clause))
        if (about.some((scope) => owners.some((product) => contradicts(product, scope)))) {
          findings.push(verdictFinding(location, owner, sentence))
          break
        }
      }
    }
  }

  // G2 — the boundary line, verbatim, in `erwartungen` of every brief (ruling: deterministic
  // beats judgment; Nick rephrases live in the call).
  const boundaryLine = squash(CONSULT_BOUNDARY_LINE)
  if (!brief.erwartungen.some((line) => squash(line).includes(boundaryLine))) {
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
