import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import {
  LEAVE_IN_APPLICATION_STAGES,
  LEAVE_IN_CARE_BENEFITS,
  LEAVE_IN_FORMATS,
  LEAVE_IN_INGREDIENT_FLAGS,
  LEAVE_IN_ROLES,
  LEAVE_IN_WEIGHTS,
  isLeaveInCategory,
  type LeaveInApplicationStage,
  type LeaveInCareBenefit,
  type LeaveInFormat,
  type LeaveInIngredientFlag,
  type LeaveInRole,
  type LeaveInWeight,
} from "../src/lib/leave-in/constants"

type Confidence = "high" | "medium" | "low" | "unknown"

interface DbProduct {
  id: string
  name: string
  brand: string | null
  category: string | null
  suitable_thicknesses: string[] | null
  suitable_concerns: string[] | null
  is_active: boolean
}

interface SourceProduct {
  name: string
  brand?: string
  category?: string
  suitable_hair_textures?: string[]
  suitable_concerns?: string[]
  tags?: string[]
}

interface DraftSpec {
  format: LeaveInFormat | null
  weight: LeaveInWeight | null
  roles: LeaveInRole[]
  provides_heat_protection: boolean | null
  heat_protection_max_c: number | null
  heat_activation_required: boolean | null
  care_benefits: LeaveInCareBenefit[]
  ingredient_flags: LeaveInIngredientFlag[]
  application_stage: LeaveInApplicationStage[]
}

interface DraftRecord {
  product_id: string
  product_name: string
  brand: string | null
  category: string | null
  source_signals: {
    suitable_thicknesses: string[]
    suitable_concerns: string[]
    matched_catalog_name: string | null
  }
  draft: DraftSpec
  confidence: Record<keyof DraftSpec, Confidence>
  evidence: string[]
  needs_review: string[]
  upsert_ready: boolean
  suggested_upsert: {
    format: LeaveInFormat
    weight: LeaveInWeight
    roles: LeaveInRole[]
    provides_heat_protection: boolean
    heat_protection_max_c: number | null
    heat_activation_required: boolean
    care_benefits: LeaveInCareBenefit[]
    ingredient_flags: LeaveInIngredientFlag[]
    application_stage: LeaveInApplicationStage[]
  }
}

const LEAVE_IN_FORMAT_SET = new Set<string>(LEAVE_IN_FORMATS)
const LEAVE_IN_WEIGHT_SET = new Set<string>(LEAVE_IN_WEIGHTS)
const LEAVE_IN_ROLE_SET = new Set<string>(LEAVE_IN_ROLES)
const LEAVE_IN_CARE_SET = new Set<string>(LEAVE_IN_CARE_BENEFITS)
const LEAVE_IN_INGREDIENT_SET = new Set<string>(LEAVE_IN_INGREDIENT_FLAGS)
const LEAVE_IN_STAGE_SET = new Set<string>(LEAVE_IN_APPLICATION_STAGES)

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return

  for (const rawLine of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const match = line.match(/^([^=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeProductName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function dedupeAllowed<T extends string>(values: T[], allowed: Set<string>): T[] {
  return [...new Set(values.filter((value) => allowed.has(value)))]
}

function inferFormat(normalizedName: string): { value: LeaveInFormat | null; confidence: Confidence; evidence?: string } {
  if (/\bspray\b|\bmist\b|spruh|sprueh/.test(normalizedName)) {
    return { value: "spray", confidence: "high", evidence: "Product name contains spray/mist keyword." }
  }
  if (/\bmilk\b/.test(normalizedName)) {
    return { value: "milk", confidence: "high", evidence: "Product name contains milk keyword." }
  }
  if (/\bserum\b/.test(normalizedName)) {
    return { value: "serum", confidence: "high", evidence: "Product name contains serum keyword." }
  }
  if (/\bcream\b|\bcreme\b/.test(normalizedName)) {
    return { value: "cream", confidence: "high", evidence: "Product name contains cream keyword." }
  }
  if (/\blotion\b/.test(normalizedName)) {
    return { value: "lotion", confidence: "high", evidence: "Product name contains lotion keyword." }
  }
  if (/\bconditioner\b|\bleave in\b/.test(normalizedName)) {
    return { value: "lotion", confidence: "low", evidence: "Fallback format for leave-in/conditioner naming." }
  }
  return { value: null, confidence: "unknown" }
}

function inferWeight(thicknesses: string[], normalizedName: string): { value: LeaveInWeight | null; confidence: Confidence; evidence?: string } {
  if (/\blite\b|\blight\b|\bweightless\b/.test(normalizedName)) {
    return { value: "light", confidence: "high", evidence: "Product name contains light/lite/weightless keyword." }
  }
  if (/\brich\b|\bintense\b/.test(normalizedName)) {
    return { value: "rich", confidence: "medium", evidence: "Product name contains rich/intense keyword." }
  }

  if (thicknesses.length === 1 && thicknesses[0] === "fine") {
    return { value: "light", confidence: "medium", evidence: "Mapped from suitable_thicknesses=fine." }
  }
  if (thicknesses.length === 1 && thicknesses[0] === "coarse") {
    return { value: "rich", confidence: "medium", evidence: "Mapped from suitable_thicknesses=coarse." }
  }
  if (thicknesses.includes("normal")) {
    return { value: "medium", confidence: "medium", evidence: "Mapped from suitable_thicknesses including normal." }
  }

  return { value: null, confidence: "unknown" }
}

function inferRoles(normalizedName: string): { value: LeaveInRole[]; confidence: Confidence; evidence: string[] } {
  const roles: LeaveInRole[] = []
  const evidence: string[] = []

  if (/\bleave in\b|\bconditioner\b/.test(normalizedName)) {
    roles.push("extension_conditioner")
    evidence.push("Name includes leave-in/conditioner keyword.")
  }

  if (/\ball in one\b|\b10 in 1\b|\b10in1\b|\b7in1\b|\b5 in 1\b|\b5in1\b|\bmultitasking\b/.test(normalizedName)) {
    roles.push("replacement_conditioner", "extension_conditioner", "styling_prep")
    evidence.push("Multi-benefit naming suggests replacement + extension + styling prep.")
  }

  if (/\bserum\b|\boil\b|\bol\b/.test(normalizedName)) {
    roles.push("oil_replacement")
    evidence.push("Name includes serum/oil keyword.")
  }

  if (/\bstyle\b|\bstyling\b|\bblow dry\b|\bfohn\b|\bfoehn\b|\bheat\b|\bhitz\b/.test(normalizedName)) {
    roles.push("styling_prep")
    evidence.push("Styling/heat keyword found.")
  }

  const deduped = dedupeAllowed(roles, LEAVE_IN_ROLE_SET)

  return {
    value: deduped,
    confidence: deduped.length > 0 ? "medium" : "unknown",
    evidence,
  }
}

function inferHeat(normalizedName: string): {
  provides_heat_protection: boolean | null
  heat_activation_required: boolean | null
  confidence: { provides: Confidence; activation: Confidence }
  evidence: string[]
} {
  const evidence: string[] = []
  const hasExplicitHeat = /\bheat\b|\bhitz\b|\bthermo\b|\bthermal\b/.test(normalizedName)
  const hasHeatActivation = /\bheat activated\b|\bblow dry\b|\bfohn\b|\bfoehn\b/.test(normalizedName)

  if (hasExplicitHeat) evidence.push("Explicit heat keyword found in name.")
  if (hasHeatActivation) evidence.push("Explicit heat-activation keyword found in name.")

  return {
    provides_heat_protection: hasExplicitHeat ? true : null,
    heat_activation_required: hasHeatActivation ? true : null,
    confidence: {
      provides: hasExplicitHeat ? "high" : "unknown",
      activation: hasHeatActivation ? "high" : "unknown",
    },
    evidence,
  }
}

function inferCareBenefits(concerns: string[], normalizedName: string): {
  value: LeaveInCareBenefit[]
  confidence: Confidence
  evidence: string[]
} {
  const benefits: LeaveInCareBenefit[] = []
  const evidence: string[] = []

  if (concerns.includes("protein")) {
    benefits.push("protein", "repair")
    evidence.push("Mapped from suitable_concerns=protein.")
  }
  if (concerns.includes("feuchtigkeit")) {
    benefits.push("moisture")
    evidence.push("Mapped from suitable_concerns=feuchtigkeit.")
  }
  if (concerns.includes("performance")) {
    benefits.push("anti_frizz", "shine")
    evidence.push("Mapped from suitable_concerns=performance.")
  }
  if (/\bcurl\b/.test(normalizedName)) {
    benefits.push("curl_definition")
    evidence.push("Name contains curl keyword.")
  }
  if (/\bdetangle\b|\bdetangl\b/.test(normalizedName)) {
    benefits.push("detangling")
    evidence.push("Name contains detangling keyword.")
  }
  if (/\bvolume\b/.test(normalizedName)) {
    benefits.push("volume")
    evidence.push("Name contains volume keyword.")
  }

  const value = dedupeAllowed(benefits, LEAVE_IN_CARE_SET)
  return {
    value,
    confidence: value.length > 0 ? "medium" : "unknown",
    evidence,
  }
}

function inferIngredientFlags(normalizedName: string): {
  value: LeaveInIngredientFlag[]
  confidence: Confidence
  evidence: string[]
} {
  const flags: LeaveInIngredientFlag[] = []
  const evidence: string[] = []

  if (/\bsilikone\b|\bsilicone\b/.test(normalizedName)) {
    flags.push("silicones")
    evidence.push("Name includes silicone/silikone marker.")
  }
  if (/\bkokos\b|\bcoconut\b|\boil\b|\bol\b|\bmacadamia\b|\bargan\b/.test(normalizedName)) {
    flags.push("oils")
    evidence.push("Name includes oil/coconut marker.")
  }
  if (/\bhyaluron\b|\bglycerin\b|\baloe\b/.test(normalizedName)) {
    flags.push("humectants")
    evidence.push("Name includes humectant marker (hyaluron/glycerin/aloe).")
  }
  if (/\bprotein\b|\bkeratin\b|\bamino\b|\bpeptide\b/.test(normalizedName)) {
    flags.push("proteins")
    evidence.push("Name includes protein/keratin marker.")
  }

  const value = dedupeAllowed(flags, LEAVE_IN_INGREDIENT_SET)
  return {
    value,
    confidence: value.length > 0 ? "high" : "unknown",
    evidence,
  }
}

function inferApplicationStage(
  format: LeaveInFormat | null,
  roles: LeaveInRole[],
  providesHeatProtection: boolean | null
): { value: LeaveInApplicationStage[]; confidence: Confidence; evidence: string[] } {
  const stages: LeaveInApplicationStage[] = []
  const evidence: string[] = []

  if (format !== null) {
    stages.push("towel_dry")
    evidence.push("Default leave-in stage inferred as towel_dry.")
  }
  if (format === "serum") {
    stages.push("dry_hair", "post_style")
    evidence.push("Serum format often used on dry hair/post style.")
  }
  if (providesHeatProtection === true || roles.includes("styling_prep")) {
    stages.push("pre_heat")
    evidence.push("Heat/styling role implies pre_heat stage.")
  }

  const value = dedupeAllowed(stages, LEAVE_IN_STAGE_SET)
  return {
    value,
    confidence: value.length > 0 ? "medium" : "unknown",
    evidence,
  }
}

function buildSuggestedUpsert(draft: DraftSpec): DraftRecord["suggested_upsert"] {
  const format = draft.format ?? "lotion"
  const weight = draft.weight ?? "medium"
  const roles = dedupeAllowed(draft.roles, LEAVE_IN_ROLE_SET)
  const provides_heat_protection = draft.provides_heat_protection ?? false
  const heat_activation_required = draft.heat_activation_required ?? false
  const heat_protection_max_c = provides_heat_protection ? draft.heat_protection_max_c : null
  const care_benefits = dedupeAllowed(draft.care_benefits, LEAVE_IN_CARE_SET)
  const ingredient_flags = dedupeAllowed(draft.ingredient_flags, LEAVE_IN_INGREDIENT_SET)
  const application_stage =
    dedupeAllowed(draft.application_stage, LEAVE_IN_STAGE_SET).length > 0
      ? dedupeAllowed(draft.application_stage, LEAVE_IN_STAGE_SET)
      : ["towel_dry"]

  const normalizedRoles = heat_activation_required && !roles.includes("styling_prep")
    ? [...roles, "styling_prep"]
    : roles

  return {
    format: LEAVE_IN_FORMAT_SET.has(format) ? (format as LeaveInFormat) : "lotion",
    weight: LEAVE_IN_WEIGHT_SET.has(weight) ? (weight as LeaveInWeight) : "medium",
    roles: normalizedRoles,
    provides_heat_protection,
    heat_protection_max_c,
    heat_activation_required,
    care_benefits,
    ingredient_flags,
    application_stage,
  }
}

function summarize(records: DraftRecord[]) {
  const total = records.length
  const fields: (keyof DraftSpec)[] = [
    "format",
    "weight",
    "roles",
    "provides_heat_protection",
    "heat_protection_max_c",
    "heat_activation_required",
    "care_benefits",
    "ingredient_flags",
    "application_stage",
  ]

  const fieldCoverage: Record<string, { populated: number; empty: number; pct: number }> = {}
  for (const field of fields) {
    let populated = 0
    for (const record of records) {
      const value = record.draft[field]
      const isPopulated = Array.isArray(value)
        ? value.length > 0
        : value !== null
      if (isPopulated) populated += 1
    }
    fieldCoverage[field] = {
      populated,
      empty: total - populated,
      pct: total === 0 ? 0 : Number(((populated / total) * 100).toFixed(1)),
    }
  }

  const confidenceTotals: Record<Confidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  }
  for (const record of records) {
    for (const value of Object.values(record.confidence)) {
      confidenceTotals[value] += 1
    }
  }

  return {
    generated_at: new Date().toISOString(),
    total_products: total,
    upsert_ready_count: records.filter((record) => record.upsert_ready).length,
    needs_review_count: records.filter((record) => record.needs_review.length > 0).length,
    field_coverage: fieldCoverage,
    confidence_totals: confidenceTotals,
  }
}

async function main() {
  loadEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const sourcePath = path.join(process.cwd(), "data", "products-from-excel", "leave-in.json")
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`)
  }

  const sourceProducts = JSON.parse(fs.readFileSync(sourcePath, "utf-8")) as SourceProduct[]
  const sourceByNormalizedName = new Map<string, SourceProduct>()
  for (const source of sourceProducts) {
    sourceByNormalizedName.set(normalizeProductName(source.name), source)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase
    .from("products")
    .select("id,name,brand,category,suitable_thicknesses,suitable_concerns,is_active")
    .eq("is_active", true)
    .limit(5000)

  if (error) {
    throw new Error(error.message)
  }

  const products = ((data ?? []) as DbProduct[])
    .filter((product) => isLeaveInCategory(product.category))
    .sort((a, b) => a.name.localeCompare(b.name))

  const records: DraftRecord[] = products.map((product) => {
    const normalizedName = normalizeProductName(product.name)
    const sourceMatch = sourceByNormalizedName.get(normalizedName)
    const thicknesses = [...(product.suitable_thicknesses ?? sourceMatch?.suitable_hair_textures ?? [])]
    const concerns = [...(product.suitable_concerns ?? sourceMatch?.suitable_concerns ?? [])]

    const formatInference = inferFormat(normalizedName)
    const weightInference = inferWeight(thicknesses, normalizedName)
    const roleInference = inferRoles(normalizedName)
    const heatInference = inferHeat(normalizedName)
    const careInference = inferCareBenefits(concerns, normalizedName)
    const ingredientInference = inferIngredientFlags(normalizedName)
    let formatValue = formatInference.value
    let formatConfidence = formatInference.confidence
    let rolesValue = roleInference.value
    let rolesConfidence = roleInference.confidence
    const fallbackEvidence: string[] = []

    if (formatValue === null) {
      formatValue = "lotion"
      formatConfidence = "low"
      fallbackEvidence.push("Fallback format=lotion based on leave-in category.")
    }
    if (rolesValue.length === 0) {
      rolesValue = ["extension_conditioner"]
      rolesConfidence = "low"
      fallbackEvidence.push("Fallback role=extension_conditioner based on leave-in category.")
    }

    const stageFromAdjustedInputs = inferApplicationStage(
      formatValue,
      rolesValue,
      heatInference.provides_heat_protection
    )

    const draft: DraftSpec = {
      format: formatValue,
      weight: weightInference.value,
      roles: rolesValue,
      provides_heat_protection: heatInference.provides_heat_protection,
      heat_protection_max_c: null,
      heat_activation_required: heatInference.heat_activation_required,
      care_benefits: careInference.value,
      ingredient_flags: ingredientInference.value,
      application_stage: stageFromAdjustedInputs.value,
    }

    const confidence: Record<keyof DraftSpec, Confidence> = {
      format: formatConfidence,
      weight: weightInference.confidence,
      roles: rolesConfidence,
      provides_heat_protection: heatInference.confidence.provides,
      heat_protection_max_c: "unknown",
      heat_activation_required: heatInference.confidence.activation,
      care_benefits: careInference.confidence,
      ingredient_flags: ingredientInference.confidence,
      application_stage: stageFromAdjustedInputs.confidence,
    }

    const evidence = [
      ...(formatInference.evidence ? [formatInference.evidence] : []),
      ...(weightInference.evidence ? [weightInference.evidence] : []),
      ...roleInference.evidence,
      ...heatInference.evidence,
      ...careInference.evidence,
      ...ingredientInference.evidence,
      ...stageFromAdjustedInputs.evidence,
      ...fallbackEvidence,
    ]

    const needs_review = (Object.keys(draft) as (keyof DraftSpec)[])
      .filter((field) => {
        const value = draft[field]
        if (Array.isArray(value)) return value.length === 0
        return value === null
      })
      .sort()

    const upsert_ready = draft.format !== null && draft.weight !== null
    const suggested_upsert = buildSuggestedUpsert(draft)

    return {
      product_id: product.id,
      product_name: product.name,
      brand: product.brand,
      category: product.category,
      source_signals: {
        suitable_thicknesses: thicknesses,
        suitable_concerns: concerns,
        matched_catalog_name: sourceMatch?.name ?? null,
      },
      draft,
      confidence,
      evidence,
      needs_review,
      upsert_ready,
      suggested_upsert,
    }
  })

  const outDir = path.join(process.cwd(), "data", "research")
  fs.mkdirSync(outDir, { recursive: true })

  const outDraft = path.join(outDir, "leave-in-specs-draft.json")
  const outSummary = path.join(outDir, "leave-in-specs-draft-summary.json")
  const outUpsert = path.join(outDir, "leave-in-specs-upsert-candidates.json")

  fs.writeFileSync(outDraft, JSON.stringify(records, null, 2))
  fs.writeFileSync(outSummary, JSON.stringify(summarize(records), null, 2))
  fs.writeFileSync(
    outUpsert,
    JSON.stringify(
      records.map((record) => ({
        product_id: record.product_id,
        product_name: record.product_name,
        ...record.suggested_upsert,
      })),
      null,
      2
    )
  )

  console.log(`Wrote ${records.length} records:`)
  console.log(`- ${path.relative(process.cwd(), outDraft)}`)
  console.log(`- ${path.relative(process.cwd(), outSummary)}`)
  console.log(`- ${path.relative(process.cwd(), outUpsert)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
