import type { QuizAnswers, QuizStep } from "./types"

/**
 * The example card a `scan_v1` insert shows on its photo.
 *
 * It is a demo of the scanner, not a recommendation: one fixed drugstore
 * product is held against the answers the quiz already has at that screen, with
 * the same row/verdict vocabulary the real scan result uses. Pure and
 * deterministic — the inserts render it during a client navigation, so it must
 * never reach for time, randomness or the network.
 */

export type ScanExampleStatus = "ok" | "warn" | "bad"

export interface ScanExampleRow {
  label: string
  productValue: string
  targetValue: string
  status: ScanExampleStatus
}

export interface ScanExampleProduct {
  name: string
  category: string
  price: string
  /** Packshot under `public/images/funnels/scan/` — the card shows the real bottle. */
  imageSrc: string
}

export interface ScanExampleCard {
  product: ScanExampleProduct
  verdict: ScanExampleStatus
  headline: string
  deviation: string
  rows: ScanExampleRow[]
}

/** The three `scan_v1` screens that carry an example card. */
export type ScanInsertStep = Extract<QuizStep, 16 | 17 | 18>

/**
 * Catalog `f41badc9-16e3-41c1-ab6c-23541fffade0` ("OGX Renewing Argan Oil of
 * Morocco Renewing Argan Oil of Morocco Shampoo") — the card prints the short
 * shelf name a visitor would read off the bottle.
 */
const PROBLEM_SHAMPOO: ScanExampleProduct = {
  name: "OGX Argan Oil of Morocco Shampoo",
  category: "Shampoo",
  price: "ca. 6,95 €",
  imageSrc: "/images/funnels/scan/example-ogx-argan-oil.webp",
}

/**
 * Catalog `eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d` (dm) — a mild shampoo for a
 * sensitive, dry, itchy scalp, which is what insert 17 is asking about.
 */
const SCALP_SHAMPOO: ScanExampleProduct = {
  name: "Balea Kopfhaut Sensitive Shampoo",
  category: "Shampoo",
  price: "ca. 1,25 €",
  imageSrc: "/images/funnels/scan/example-balea-kopfhaut-sensitive.webp",
}

/**
 * Catalog `1568b623-f411-4ed6-a89f-e797bb1b48f5` ("Alterra Intensiv Repair
 * Haarmaske Feuchtigkeit", Rossmann) — a rich moisture mask for dry and
 * stressed hair; the card prints the short shelf name.
 */
const MASK: ScanExampleProduct = {
  name: "Alterra Feuchtigkeits-Haarmaske",
  category: "Haarmaske",
  price: "ca. 2,79 €",
  imageSrc: "/images/funnels/scan/example-alterra-feuchtigkeits-maske.webp",
}

/** The row label the scalp criterion carries, on the card and in the copy. */
const SCALP_ROW_LABEL = "Kopfhaut"

/** The shampoo is formulated for a sensitive, dry scalp, not for one target. */
const SHAMPOO_SCALP_VALUE = "sensibel, trocken"
const SHAMPOO_SCALP_COVERAGE = new Set(["trocken", "gereizt"])

const THICKNESS_LABELS: Record<string, string> = {
  fine: "fein",
  normal: "mittel",
  coarse: "dick",
}

/** `geringe` · `mittlere` · `hohe` Dichte — the density the quiz asked for in step 13. */
const DENSITY_LABELS: Record<string, string> = {
  low: "geringe Dichte",
  medium: "mittlere Dichte",
  high: "hohe Dichte",
}

const TEXTURE_ADJECTIVES: Record<string, string> = {
  straight: "glattes",
  wavy: "welliges",
  curly: "lockiges",
  coily: "krauses",
}

const SCALP_TYPE_LABELS: Record<string, string> = {
  fettig: "fettig",
  ausgeglichen: "ausgeglichen",
  trocken: "trocken",
}

const SCALP_CONDITION_LABELS: Record<string, string> = {
  schuppen: "Schuppen",
  trockene_schuppen: "trockene Schuppen",
  gereizt: "gereizt",
}

/** Care weight and repair depth are ordered: one step apart is a restriction. */
const CARE_WEIGHT_SCALE = ["leicht", "mittel", "reichhaltig"]
const REPAIR_SCALE = ["mittel", "hoch"]

/** `fein` · `mittel` · `dick` — one step apart from the product is a restriction. */
const THICKNESS_SCALE = ["fein", "mittel", "dick"]

/** The quiz asks no direction question yet, so every profile aims at balance. */
const CARE_DIRECTION_TARGET = "ausgeglichen"

const CARE_WEIGHT_BY_THICKNESS: Record<string, string> = {
  fine: "leicht",
  normal: "mittel",
  coarse: "reichhaltig",
}

/**
 * What the mask itself is: a rich moisture treatment, not a protein-led repair
 * cure. `reichhaltig` is two steps from `leicht`, so fine hair reads as a real
 * mismatch — which is the point of the demo.
 */
const MASK_CARE_WEIGHT = "reichhaltig"
const MASK_CARE_DIRECTION = "Feuchtigkeit"
const MASK_REPAIR = "mittel"

/** Treatments and concerns that ask for more repair than a basic mask gives. */
const REPAIR_TREATMENTS = new Set(["blondiert"])
const REPAIR_CONCERNS = new Set(["hair_damage", "breakage", "split_ends"])

/** `fein` · `mittel` · `dick` — the thickness the quiz asked for in step 3. */
export function getScanInsertThicknessLabel(answers: QuizAnswers): string {
  return THICKNESS_LABELS[answers.thickness ?? ""] ?? "fein"
}

/** `geringe Dichte` · `mittlere Dichte` · `hohe Dichte` — reads as a list item in copy. */
export function getScanInsertDensityLabel(answers: QuizAnswers): string {
  return DENSITY_LABELS[answers.density ?? ""] ?? "mittlere Dichte"
}

/** `glattes` · `welliges` · `lockiges` · `krauses` — reads as "… Haar" in copy. */
export function getScanInsertTextureAdjective(answers: QuizAnswers): string {
  return TEXTURE_ADJECTIVES[answers.structure ?? ""] ?? "welliges"
}

/**
 * The scalp the scanner aims at: a reported complaint is more specific than the
 * type, so it wins. `quiz-scalp-question.tsx` clears the complaint gate and the
 * condition in separate writes, so a condition is only read once the gate says
 * there is one.
 */
export function getScanInsertScalpTarget(answers: QuizAnswers): string {
  if (answers.has_scalp_issue === true) {
    const condition = SCALP_CONDITION_LABELS[answers.scalp_condition ?? ""]
    if (condition) return condition
  }
  return SCALP_TYPE_LABELS[answers.scalp_type ?? ""] ?? "ausgeglichen"
}

function getCleansingTarget(answers: QuizAnswers): string {
  return answers.scalp_type === "fettig" ? "klärend" : "regulär"
}

function getRepairTarget(answers: QuizAnswers): string {
  const bleached = (answers.treatment ?? []).some((value) => REPAIR_TREATMENTS.has(value))
  const damaged = (answers.concerns ?? []).some((value) => REPAIR_CONCERNS.has(value))
  return bleached || damaged ? "hoch" : "mittel"
}

/** Equal hits the target, one step off is a restriction, further off is a miss. */
function scaleStatus(scale: string[], productValue: string, targetValue: string) {
  const productIndex = scale.indexOf(productValue)
  const targetIndex = scale.indexOf(targetValue)
  if (productIndex === -1 || targetIndex === -1) {
    return productValue === targetValue ? "ok" : "bad"
  }
  const distance = Math.abs(productIndex - targetIndex)
  if (distance === 0) return "ok"
  return distance === 1 ? "warn" : "bad"
}

function cleansingRow(answers: QuizAnswers): ScanExampleRow {
  const targetValue = getCleansingTarget(answers)
  return {
    label: "Reinigung",
    productValue: "regulär",
    targetValue,
    status: targetValue === "regulär" ? "ok" : "warn",
  }
}

function scalpRow(answers: QuizAnswers): ScanExampleRow {
  const targetValue = getScanInsertScalpTarget(answers)
  return {
    label: SCALP_ROW_LABEL,
    productValue: SHAMPOO_SCALP_VALUE,
    targetValue,
    status: SHAMPOO_SCALP_COVERAGE.has(targetValue) ? "ok" : "bad",
  }
}

function thicknessRow(answers: QuizAnswers): ScanExampleRow {
  // The shampoo makes no thickness claim, so every answer is inside its range.
  return {
    label: "Haardicke",
    productValue: "jede",
    targetValue: getScanInsertThicknessLabel(answers),
    status: "ok",
  }
}

function problemThicknessRow(answers: QuizAnswers): ScanExampleRow {
  const targetValue = getScanInsertThicknessLabel(answers)
  return {
    label: "Haardicke",
    productValue: "dick",
    targetValue,
    status: scaleStatus(THICKNESS_SCALE, "dick", targetValue),
  }
}

function buildDeviation(rows: ScanExampleRow[]): string {
  const deviations = rows
    .filter((row) => row.status !== "ok")
    .map((row) => `${row.label}: ${row.productValue} statt ${row.targetValue}`)
  if (deviations.length > 0) return deviations.join(" · ")
  // A card that clears every row still has to name why. Where the scalp is one
  // of the criteria, it is the answer the screen just collected — naming it is
  // the only proof on the card that the answer changed anything. It is the
  // user's own target that gets printed, never the product's: the shampoo
  // covers "sensibel, trocken", and someone who answered only "trocken" must
  // not read back that their scalp is sensitive on top.
  const scalpRow = rows.find((row) => row.label === SCALP_ROW_LABEL)
  if (scalpRow) return `${scalpRow.label} ${scalpRow.targetValue} – genau dein Profil.`
  return "Alles im Ziel."
}

function buildVerdict(rows: ScanExampleRow[]): { verdict: ScanExampleStatus; headline: string } {
  const firstBad = rows.find((row) => row.status === "bad")
  if (firstBad) {
    return {
      verdict: "bad",
      headline:
        firstBad.label === SCALP_ROW_LABEL
          ? "Passt nicht zu deiner Kopfhaut"
          : "Passt nicht zu deinem Haar",
    }
  }
  if (rows.some((row) => row.status === "warn")) {
    return { verdict: "warn", headline: "Passt mit Einschränkung" }
  }
  // A card carrying a scalp row judges a scalp product; the negative verdict
  // above already says "Kopfhaut", so the positive one must match it.
  return {
    verdict: "ok",
    headline: rows.some((row) => row.label === SCALP_ROW_LABEL)
      ? "Passt zu deiner Kopfhaut"
      : "Passt zu deinem Haar",
  }
}

/**
 * Insert 16 runs before the scalp question, so its card is deliberately
 * partial: it shows what the quiz already knows, cleansing and thickness only.
 */
function buildProblemExample(answers: QuizAnswers): ScanExampleCard {
  const rows = [cleansingRow({}), problemThicknessRow(answers)]
  return { product: PROBLEM_SHAMPOO, rows, ...buildVerdict(rows), deviation: buildDeviation(rows) }
}

function buildSolutionExample(answers: QuizAnswers): ScanExampleCard {
  const rows = [cleansingRow(answers), scalpRow(answers), thicknessRow(answers)]
  return { product: SCALP_SHAMPOO, rows, ...buildVerdict(rows), deviation: buildDeviation(rows) }
}

function buildHomeExample(answers: QuizAnswers): ScanExampleCard {
  const careWeightTarget = CARE_WEIGHT_BY_THICKNESS[answers.thickness ?? ""] ?? "leicht"
  const repairTarget = getRepairTarget(answers)
  const rows: ScanExampleRow[] = [
    {
      label: "Pflegegewicht",
      productValue: MASK_CARE_WEIGHT,
      targetValue: careWeightTarget,
      status: scaleStatus(CARE_WEIGHT_SCALE, MASK_CARE_WEIGHT, careWeightTarget),
    },
    {
      // The quiz asks no direction question, so every profile still aims at
      // `ausgeglichen`. A moisture mask sits inside a balanced plan, so — like
      // the scalp row — the product value covers the target instead of
      // equalling it, and this row never deviates.
      label: "Pflegerichtung",
      productValue: MASK_CARE_DIRECTION,
      targetValue: CARE_DIRECTION_TARGET,
      status: "ok",
    },
    {
      label: "Repair-Pflege",
      productValue: MASK_REPAIR,
      targetValue: repairTarget,
      status: scaleStatus(REPAIR_SCALE, MASK_REPAIR, repairTarget),
    },
  ]
  return { product: MASK, rows, ...buildVerdict(rows), deviation: buildDeviation(rows) }
}

/**
 * The criteria the scanner holds a product against, as the offer lists them.
 *
 * Same targets the example cards compare with — the offer only names them, so
 * the chips and the card rows can never drift apart.
 */
export interface ScanCriterion {
  label: string
  value: string
}

export function getScanCriteria(answers: QuizAnswers): ScanCriterion[] {
  return [
    { label: "Haardicke", value: getScanInsertThicknessLabel(answers) },
    { label: "Kopfhaut", value: getScanInsertScalpTarget(answers) },
    { label: "Reinigung", value: getCleansingTarget(answers) },
    {
      label: "Pflegegewicht",
      value: CARE_WEIGHT_BY_THICKNESS[answers.thickness ?? ""] ?? "leicht",
    },
    { label: "Richtung", value: CARE_DIRECTION_TARGET },
  ]
}

/** The example card the given insert screen shows for these quiz answers. */
export function getScanInsertExample(step: ScanInsertStep, answers: QuizAnswers): ScanExampleCard {
  if (step === 16) return buildProblemExample(answers)
  if (step === 17) return buildSolutionExample(answers)
  return buildHomeExample(answers)
}
