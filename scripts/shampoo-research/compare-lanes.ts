/**
 * Shampoo v1.6 lane comparator (runbook step 5, standard Section 14).
 *
 * Compares two sealed lanes' final records, product by product: the seven judgment
 * properties plus the mechanical `dandruffSupport`, the sorted secondary focus, the three
 * thickness fits, `weight`, primary and secondary scalp target, cleansing intensity,
 * `deepCleanserListing` and, as a research judgment, `researchCombinationTargets`.
 *
 * The historical v1.6 comparators (data/research/shampoo-inci/v1.6/calibration/*\/compare.py)
 * predate `researchCombinationTargets`; this script replaces them for new runs. A record set
 * where neither lane carries the field (rounds 1 and 2) does not count it; a field present in
 * only one lane counts as a disagreement.
 *
 * Usage: npx tsx scripts/shampoo-research/compare-lanes.ts <lane-a-records-dir> <lane-b-records-dir>
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

type LaneRecord = { directProperties: Record<string, unknown>; projection: Record<string, unknown> }

export type Disagreement = {
  id: string
  field: string
  a: string
  b: string
  direction: "tier" | "weight" | "extra_target" | "research_only" | ""
}

const JUDGED_DIRECT = [
  "cleansingStrength",
  "conditioningLevel",
  "weightPotential",
  "focusPrimary",
  "usageRole",
  "scalpComfortTarget",
  "dandruffSupport",
] as const

const valueOf = (x: unknown) =>
  x !== null && typeof x === "object" && !Array.isArray(x) && "value" in x
    ? (x as { value: unknown }).value
    : x
const targetOf = (x: unknown) =>
  x !== null && typeof x === "object" && "target" in x
    ? (x as { target: unknown }).target
    : (x ?? null)
const sortedList = (x: unknown) =>
  JSON.stringify([...((x as string[] | null | undefined) ?? [])].sort())
const str = (x: unknown) => JSON.stringify(x ?? null)

/** One record's compared decisions, each serialized so equality is exact. */
export function comparisonFields(record: LaneRecord): Record<string, string> {
  const dp = record.directProperties
  const pj = record.projection
  const fit = pj.thicknessFit as Record<string, unknown>
  const scalp = (pj.scalpTargets ?? {}) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of JUDGED_DIRECT) out[key] = str(valueOf(dp[key]))
  out.focusSecondary = sortedList(valueOf(dp.focusSecondary))
  for (const thickness of ["fine", "normal", "coarse"])
    out[`fit.${thickness}`] = str(fit[thickness])
  out.weight = str(pj.weight)
  out["target.primary"] = str(targetOf(scalp.primary))
  out["target.secondary"] = str(targetOf(scalp.secondary))
  out.cleansingIntensity = str(pj.cleansingIntensity)
  out.deepCleanserListing = str(pj.deepCleanserListing)
  if ("researchCombinationTargets" in pj)
    out.researchCombinationTargets = sortedList(pj.researchCombinationTargets)
  return out
}

function direction(field: string, a: string, b: string): Disagreement["direction"] {
  if (field.startsWith("fit.")) return "tier"
  if (field === "weight") return "weight"
  if (field === "target.secondary") return (a === "null") !== (b === "null") ? "extra_target" : ""
  // Section 14: reported and counted, but never toward_recommending (no row, target or live value).
  if (field === "researchCombinationTargets") return "research_only"
  return ""
}

const recordIds = (dir: string) =>
  readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort()

const readRecord = (dir: string, id: string) =>
  JSON.parse(readFileSync(path.join(dir, `${id}.json`), "utf8")) as LaneRecord

export function compareLaneDirs(laneADir: string, laneBDir: string) {
  const ids = recordIds(laneADir)
  const idsB = recordIds(laneBDir)
  if (JSON.stringify(ids) !== JSON.stringify(idsB))
    throw new Error(`lane record sets differ: A=${ids.join(",")} B=${idsB.join(",")}`)
  let total = 0
  let agree = 0
  const disagreements: Disagreement[] = []
  for (const id of ids) {
    const a = comparisonFields(readRecord(laneADir, id))
    const b = comparisonFields(readRecord(laneBDir, id))
    for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
      const va = a[field] ?? "absent"
      const vb = b[field] ?? "absent"
      total += 1
      if (va === vb) agree += 1
      else disagreements.push({ id, field, a: va, b: vb, direction: direction(field, va, vb) })
    }
  }
  return { products: ids.length, total, agree, disagreements }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [laneA, laneB] = process.argv.slice(2)
  if (!laneA || !laneB) {
    console.error("usage: compare-lanes.ts <lane-a-records-dir> <lane-b-records-dir>")
    process.exit(2)
  }
  const result = compareLaneDirs(laneA, laneB)
  console.log(
    `agreement ${result.agree}/${result.total} = ${((result.agree / result.total) * 100).toFixed(1)}% over ${result.products} products`,
  )
  for (const d of result.disagreements) console.log("DIFF", d.id, d.field, d.a, d.b, d.direction)
}
