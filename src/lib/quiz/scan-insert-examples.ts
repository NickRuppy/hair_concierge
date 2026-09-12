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

const SHAMPOO: ScanExampleProduct = {
  name: "Alverde Balance Shampoo Melisse",
  category: "Shampoo",
  price: "ca. 1,95 €",
}

const PROBLEM_SHAMPOO: ScanExampleProduct = {
  name: "OGX Argan Oil of Morocco Shampoo",
  category: "Shampoo",
  price: "ca. 6,95 €",
}

const MASK: ScanExampleProduct = {
  name: "Balea Professional Repair Kur",
  category: "Haarmaske",
  price: "ca. 1,95 €",
}

/** The shampoo is formulated for a dry or irritated scalp, not for one target. */
const SHAMPOO_SCALP_VALUE = "trocken, gereizt"
const SHAMPOO_SCALP_COVERAGE = new Set(["trocken", "gereizt"])

const THICKNESS_LABELS: Record<string, string> = {
  fine: "fein",
  normal: "mittel",
  coarse: "dick",
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

/** Treatments and concerns that ask for more repair than a basic mask gives. */
const REPAIR_TREATMENTS = new Set(["blondiert"])
const REPAIR_CONCERNS = new Set(["hair_damage", "breakage", "split_ends"])

/** `fein` · `mittel` · `dick` — the thickness the quiz asked for in step 3. */
export function getScanInsertThicknessLabel(answers: QuizAnswers): string {
  return THICKNESS_LABELS[answers.thickness ?? ""] ?? "fein"
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
    label: "Kopfhaut",
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
  return deviations.length > 0 ? deviations.join(" · ") : "Alles im Ziel."
}

function buildVerdict(rows: ScanExampleRow[]): { verdict: ScanExampleStatus; headline: string } {
  const firstBad = rows.find((row) => row.status === "bad")
  if (firstBad) {
    return {
      verdict: "bad",
      headline:
        firstBad.label === "Kopfhaut"
          ? "Passt nicht zu deiner Kopfhaut"
          : "Passt nicht zu deinem Haar",
    }
  }
  if (rows.some((row) => row.status === "warn")) {
    return { verdict: "warn", headline: "Passt mit Einschränkung" }
  }
  return { verdict: "ok", headline: "Passt zu deinem Haar" }
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
  return { product: SHAMPOO, rows, ...buildVerdict(rows), deviation: buildDeviation(rows) }
}

function buildHomeExample(answers: QuizAnswers): ScanExampleCard {
  const careWeightTarget = CARE_WEIGHT_BY_THICKNESS[answers.thickness ?? ""] ?? "leicht"
  const repairTarget = getRepairTarget(answers)
  const rows: ScanExampleRow[] = [
    {
      label: "Pflegegewicht",
      productValue: "mittel",
      targetValue: careWeightTarget,
      status: scaleStatus(CARE_WEIGHT_SCALE, "mittel", careWeightTarget),
    },
    {
      label: "Pflegerichtung",
      productValue: CARE_DIRECTION_TARGET,
      targetValue: CARE_DIRECTION_TARGET,
      status: "ok",
    },
    {
      label: "Repair-Pflege",
      productValue: "mittel",
      targetValue: repairTarget,
      status: scaleStatus(REPAIR_SCALE, "mittel", repairTarget),
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
