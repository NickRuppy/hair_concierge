import { CONSULT_KNOWLEDGE_ENTRY_SOURCES } from "./knowledge-sources"

/**
 * The consult knowledge base as the brief generator reads it (consult-agent T2). Pure.
 *
 * Contract: `docs/research/consult-knowledge/README.md` — frontmatter with exactly `id`,
 * `category`, `conditions`, `evidence`; body `## Einsicht`, `## Im Call`, optional `## Frage`.
 * An entry that does not match is an error at load time, never silently skipped.
 *
 * Conditions are CNF: top-level elements AND, a nested list OR (one level deep), `[]` always.
 * Flags are abstract; `deriveConsultFlags` maps profile, intake and plan facts onto them, each
 * with the README's reliability. `evidence` steers the selection only — it never leaves this
 * module (G5): a fired entry carries `cautious` instead.
 */

export const CONSULT_FLAGS = [
  "bleached",
  "colored",
  "permed",
  "chemically_straightened",
  "fine_hair",
  "dry_scalp_dry_flakes",
  "hot_tool",
  "mask_in_routine",
  "oil_on_wet",
  "oil_in_routine",
  "protein_or_bond_care",
  "breakage_signal",
  "volume_concern",
  "styling_goal_hold",
  "wash_frequency_change",
  "oily_scalp",
  "oily_scalp_flakes",
  "irritated_scalp",
  "frizz_concern",
  "shine_concern",
  "dry_lengths_concern",
  "tangling_concern",
  "curly_or_coily",
  "wavy_hair",
] as const

export type ConsultFlag = (typeof CONSULT_FLAGS)[number]

export type ConsultFlagReliability = "hoch" | "niedrig"

/**
 * The README's „Verlässlichkeit" column (a test pins it). `volume_concern` reads „hoch
 * (Anliegen) / niedrig (Notiz)": only the concern is derived here, so it is `hoch`.
 */
export const CONSULT_FLAG_RELIABILITY: Readonly<Record<ConsultFlag, ConsultFlagReliability>> = {
  bleached: "hoch",
  colored: "hoch",
  permed: "hoch",
  chemically_straightened: "hoch",
  fine_hair: "hoch",
  dry_scalp_dry_flakes: "hoch",
  hot_tool: "hoch",
  mask_in_routine: "niedrig",
  oil_on_wet: "niedrig",
  oil_in_routine: "niedrig",
  protein_or_bond_care: "hoch",
  breakage_signal: "hoch",
  volume_concern: "hoch",
  styling_goal_hold: "hoch",
  wash_frequency_change: "hoch",
  oily_scalp: "hoch",
  // Legacy „schuppen" reaches the snapshot as `oily_dandruff` without the flake kind; those
  // quizzes are few, and Nick accepts the ambiguity (2026-09-29) — the field counts as defined.
  oily_scalp_flakes: "hoch",
  irritated_scalp: "hoch",
  frizz_concern: "hoch",
  shine_concern: "hoch",
  dry_lengths_concern: "hoch",
  tangling_concern: "hoch",
  curly_or_coily: "hoch",
  wavy_hair: "hoch",
}

/**
 * Flags with no structured source today: they are never derived, so an entry that needs one
 * of them only fires through another member of its OR group. `oil_on_wet` lives in call
 * notes only — the intake's oil roles (`leave_on_fibre_conditioning`, `dry_finish`, …) say
 * neither the amount nor whether the hair is wet.
 */
export const UNSOURCED_CONSULT_FLAGS: readonly ConsultFlag[] = ["oil_on_wet"]

export const CONSULT_KNOWLEDGE_CATEGORIES = [
  "mechanism",
  "lever",
  "question",
  "expectation",
  "phrasing",
] as const
export type ConsultKnowledgeCategory = (typeof CONSULT_KNOWLEDGE_CATEGORIES)[number]

const EVIDENCE_LEVELS = ["strong", "moderate", "practice"] as const
type ConsultKnowledgeEvidence = (typeof EVIDENCE_LEVELS)[number]

/** One CNF element: a flag (must hold) or a group (one of them must hold). */
export type ConsultCondition = ConsultFlag | ConsultFlag[]

export type ConsultKnowledgeEntry = {
  id: string
  category: ConsultKnowledgeCategory
  conditions: ConsultCondition[]
  /** Internal only (G5): steers how cautiously the brief phrases, never shown. */
  evidence: ConsultKnowledgeEvidence
  einsicht: string
  /** The „Im Call" wording, blockquote markers stripped; variant intro lines kept. */
  imCall: string
  fragen: string[]
}

const FRONTMATTER_KEYS = ["id", "category", "conditions", "evidence"] as const

export function parseConsultKnowledgeEntry(
  fileName: string,
  markdown: string,
): ConsultKnowledgeEntry {
  const fail = (reason: string): never => {
    throw new Error(`consult knowledge ${fileName}: ${reason}`)
  }
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(markdown)
  if (!match) return fail("missing frontmatter")
  const fields = new Map<string, string>()
  for (const line of match[1]!.split("\n")) {
    const pair = /^([a-z_]+):\s*(.*)$/.exec(line.trim())
    if (!pair) return fail(`unreadable frontmatter line „${line}"`)
    fields.set(pair[1]!, pair[2]!.trim())
  }
  const keys = [...fields.keys()].sort()
  if (keys.join(",") !== [...FRONTMATTER_KEYS].sort().join(",")) {
    return fail(`frontmatter must have exactly ${FRONTMATTER_KEYS.join(", ")}`)
  }

  const id = fields.get("id")!
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || `${id}.md` !== fileName) {
    return fail(`id „${id}" must be kebab-case and equal the file name`)
  }
  const category = fields.get("category")!
  if (!(CONSULT_KNOWLEDGE_CATEGORIES as readonly string[]).includes(category)) {
    return fail(`unknown category „${category}"`)
  }
  const evidence = fields.get("evidence")!
  if (!(EVIDENCE_LEVELS as readonly string[]).includes(evidence)) {
    return fail(`unknown evidence „${evidence}"`)
  }
  const conditions = parseConditions(fields.get("conditions")!, fail)

  const sections = new Map<string, string>()
  for (const part of match[2]!.split(/^## /m).slice(1)) {
    const newline = part.indexOf("\n")
    sections.set(part.slice(0, newline).trim(), part.slice(newline + 1).trim())
  }
  const einsicht = sections.get("Einsicht")
  const imCall = sections.get("Im Call")
  if (!einsicht) return fail("missing ## Einsicht")
  if (!imCall) return fail("missing ## Im Call")
  const frage = sections.get("Frage")

  return {
    id,
    category: category as ConsultKnowledgeCategory,
    conditions,
    evidence: evidence as ConsultKnowledgeEvidence,
    einsicht,
    imCall: imCall
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    fragen: frage
      ? frage
          .split("\n")
          .filter((line) => line.startsWith("- "))
          .map((line) => line.slice(2).trim())
      : [],
  }
}

function parseConditions(raw: string, fail: (reason: string) => never): ConsultCondition[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/[a-z_]+/g, (token) => `"${token}"`))
  } catch {
    return fail(`unreadable conditions ${raw}`)
  }
  if (!Array.isArray(parsed)) return fail("conditions must be a list")
  const flag = (value: unknown): ConsultFlag => {
    if (typeof value === "string" && (CONSULT_FLAGS as readonly string[]).includes(value)) {
      return value as ConsultFlag
    }
    if (Array.isArray(value)) return fail("conditions nest only one level deep")
    return fail(`unknown flag ${String(value)}`)
  }
  return parsed.map((element) => (Array.isArray(element) ? element.map(flag) : flag(element)))
}

/** Every entry, in file-name order. Throws at import on an invalid entry (README contract). */
export const CONSULT_KNOWLEDGE_ENTRIES: readonly ConsultKnowledgeEntry[] = Object.keys(
  CONSULT_KNOWLEDGE_ENTRY_SOURCES,
)
  .sort()
  .map((file) => parseConsultKnowledgeEntry(file, CONSULT_KNOWLEDGE_ENTRY_SOURCES[file]!))

// --- conditions ---------------------------------------------------------------------------

/** The flags that hold for her, each with the reliability of its source. */
export type ConsultFlagSet = ReadonlyMap<ConsultFlag, ConsultFlagReliability>

/**
 * CNF evaluation plus the README's „Frage zuerst" rule: the entry is question-first when an
 * AND element holds only through a `niedrig` flag, or an OR group is met only by `niedrig`
 * flags. Unknown facts derive no flag, so they never match.
 */
export function evaluateConsultConditions(
  conditions: readonly ConsultCondition[],
  flags: ConsultFlagSet,
): { fires: boolean; questionFirst: boolean } {
  let questionFirst = false
  for (const element of conditions) {
    const members = Array.isArray(element) ? element : [element]
    const held = members.filter((flag) => flags.has(flag))
    if (held.length === 0) return { fires: false, questionFirst: false }
    if (held.every((flag) => flags.get(flag) === "niedrig")) questionFirst = true
  }
  return { fires: true, questionFirst }
}

// --- flag derivation ------------------------------------------------------------------------

/**
 * Her facts as the flags read them; `null` = unknown (derives nothing).
 *
 * - `chemicalTreatments`: any stored vocabulary (`hair_profiles`, Idealplan snapshot, raw quiz).
 * - `hairTexture` / `scalpType`: the snapshot's `profile.hair.texture` / `profile.scalp.oiliness`
 *   (`concernProfileFacts`). A legacy quiz reaches the snapshot through
 *   `adaptLegacyQuizAnswersForAssessment`: `structure` keeps its values
 *   (straight/wavy/curly/coily), `scalp_type` `fettig` becomes `oily`.
 * - `scalpConcerns`: the snapshot's `profile.scalp.concerns` (`dry_dandruff` = the legacy
 *   `scalp_condition` `dry_flakes`, which is accepted too; `oily_dandruff`; `irritated`, the
 *   same value in `hair_profiles`). The unspecified `hair_profiles` `dandruff` says nothing
 *   about the kind of flakes and derives no flake flag. Caveat: the plan's legacy adapter
 *   already turns the legacy quiz's unspecified `schuppen` into `oily_dandruff`.
 * - `intakeHeatTools`: the intake's `heat_styling.additionalHeatTools`; `null` = not asked.
 * - `profileHeatTools`: the snapshot's heat-event tools — read only when the intake did not ask.
 * - `ownedCategories`: usage categories and product types of her captured products.
 * - `planCategories`: the Idealroutine's step categories.
 * - `concerns`: her quiz concerns (`DiagnosticConcern`).
 * - `washFrequency`: today's shampoo frequency vs the Idealplan's wash target.
 */
export type ConsultFlagFacts = {
  chemicalTreatments: readonly string[] | null
  hairTexture: string | null
  thickness: string | null
  scalpType: string | null
  scalpConcerns: readonly string[] | null
  intakeHeatTools: readonly string[] | null
  profileHeatTools: readonly string[] | null
  ownedCategories: readonly string[]
  planCategories: readonly string[]
  elasticity: string | null
  concerns: readonly string[]
  washFrequency: { current: string | null; ideal: string | null }
}

const BLEACHED = new Set(["bleached", "lightened", "blondiert"])
const COLORED = new Set(["colored", "gefaerbt"])
const PERMED = new Set(["permed"])
const STRAIGHTENED = new Set(["chemically_straightened"])
const DRY_FLAKES = new Set(["dry_dandruff", "dry_flakes"])
/** Contact heat only: the intake's tools plus the profile's legacy `styling_tools` values. */
const HOT_TOOLS = new Set([
  "straightener",
  "curling_or_wave_iron",
  "curling_iron",
  "flat_iron",
  "wave_iron",
])
const OILY_FLAKES = new Set(["oily_dandruff"])
const IRRITATED = new Set(["irritated"])
const BREAKAGE_CONCERNS = new Set(["breakage", "hair_damage"])
const CURLY_OR_COILY = new Set(["curly", "coily"])
/** „Weiß ich nicht" and no answer are not a frequency. */
const NOT_A_FREQUENCY = new Set(["unknown"])

export function deriveConsultFlags(
  facts: ConsultFlagFacts,
): Map<ConsultFlag, ConsultFlagReliability> {
  const flags = new Map<ConsultFlag, ConsultFlagReliability>()
  const set = (flag: ConsultFlag, holds: boolean) => {
    if (holds) flags.set(flag, CONSULT_FLAG_RELIABILITY[flag])
  }
  const any = (values: readonly string[] | null, allowed: ReadonlySet<string>) =>
    (values ?? []).some((value) => allowed.has(value))

  set("bleached", any(facts.chemicalTreatments, BLEACHED))
  set("colored", any(facts.chemicalTreatments, COLORED))
  set("permed", any(facts.chemicalTreatments, PERMED))
  set("chemically_straightened", any(facts.chemicalTreatments, STRAIGHTENED))
  set("fine_hair", facts.thickness === "fine")
  set("curly_or_coily", facts.hairTexture !== null && CURLY_OR_COILY.has(facts.hairTexture))
  set("wavy_hair", facts.hairTexture === "wavy")
  set("oily_scalp", facts.scalpType === "oily")
  set("dry_scalp_dry_flakes", any(facts.scalpConcerns, DRY_FLAKES))
  set("oily_scalp_flakes", any(facts.scalpConcerns, OILY_FLAKES))
  set("irritated_scalp", any(facts.scalpConcerns, IRRITATED))
  set(
    "hot_tool",
    facts.intakeHeatTools !== null
      ? any(facts.intakeHeatTools, HOT_TOOLS)
      : any(facts.profileHeatTools, HOT_TOOLS),
  )
  set("mask_in_routine", facts.ownedCategories.includes("mask"))
  set("oil_in_routine", facts.ownedCategories.includes("oil"))
  set(
    "protein_or_bond_care",
    facts.ownedCategories.includes("bondbuilder") || facts.planCategories.includes("bondbuilder"),
  )
  set("breakage_signal", facts.elasticity === "snaps" || any(facts.concerns, BREAKAGE_CONCERNS))
  set("volume_concern", facts.concerns.includes("low_volume_or_weighed_down"))
  set("styling_goal_hold", facts.concerns.includes("lost_shape"))
  // `concerns` is already `DiagnosticConcern`: the legacy aliases `frizz` / `dryness` are
  // resolved upstream (`resolveVisibleDiagnosticConcerns`, the plan input's legacy map).
  set("frizz_concern", facts.concerns.includes("frizz_flyaways"))
  set("shine_concern", facts.concerns.includes("low_shine"))
  set("dry_lengths_concern", facts.concerns.includes("dry_lengths"))
  set("tangling_concern", facts.concerns.includes("tangling"))
  const { current, ideal } = facts.washFrequency
  set(
    "wash_frequency_change",
    current !== null &&
      ideal !== null &&
      !NOT_A_FREQUENCY.has(current) &&
      !NOT_A_FREQUENCY.has(ideal) &&
      current !== ideal,
  )
  return flags
}

// --- selection --------------------------------------------------------------------------------

/** README „Stärkere Variante gewinnt": when both fire, only the winner goes into the brief. */
export const CONSULT_KNOWLEDGE_PRECEDENCE: ReadonlyArray<{ winner: string; loser: string }> = [
  { winner: "ongoing-damage-first", loser: "heat-on-colored-hair" },
]

/**
 * README „Überschneidungen zusammenführen": when both fire, `fold` becomes part of `keep` — one
 * point (amount and placement), not two. `keep` carries the reference in `mergedFrom`.
 */
export const CONSULT_KNOWLEDGE_MERGES: ReadonlyArray<{ keep: string; fold: string }> = [
  { keep: "heavy-care-paradox-fine-hair", fold: "oil-as-finish" },
  { keep: "heavy-care-paradox-fine-hair", fold: "fine-hair-buildup-layering" },
  { keep: "oily-roots-dry-lengths", fold: "dry-lengths-softness" },
]

export type FiredConsultKnowledge = {
  id: string
  category: ConsultKnowledgeCategory
  /** Lead with the `fragen`; phrase the insight as „falls ja, dann …", never as a finding. */
  questionFirst: boolean
  /** Evidence below `strong`: „kann helfen", „einen Versuch wert" — no grade in the text. */
  cautious: boolean
  einsicht: string
  imCall: string
  fragen: string[]
  /** Entries folded into this one (README merge rule). */
  mergedFrom: string[]
}

export function selectConsultKnowledge(
  flags: ConsultFlagSet,
  entries: readonly ConsultKnowledgeEntry[] = CONSULT_KNOWLEDGE_ENTRIES,
): FiredConsultKnowledge[] {
  const fired = new Map<string, FiredConsultKnowledge>()
  for (const entry of entries) {
    const { fires, questionFirst } = evaluateConsultConditions(entry.conditions, flags)
    if (!fires) continue
    fired.set(entry.id, {
      id: entry.id,
      category: entry.category,
      questionFirst,
      cautious: entry.evidence !== "strong",
      einsicht: entry.einsicht,
      imCall: entry.imCall,
      fragen: entry.fragen,
      mergedFrom: [],
    })
  }
  for (const { winner, loser } of CONSULT_KNOWLEDGE_PRECEDENCE) {
    if (fired.has(winner)) fired.delete(loser)
  }
  for (const { keep, fold } of CONSULT_KNOWLEDGE_MERGES) {
    const kept = fired.get(keep)
    const folded = fired.get(fold)
    if (kept && folded) {
      // One topic stays ONE point in the brief, but nothing is dropped (Nick 2026-09-29):
      // the folded entry's insight, phrasing and questions travel with the kept one.
      fired.delete(fold)
      kept.mergedFrom.push(fold)
      kept.einsicht = `${kept.einsicht}\n\n${folded.einsicht}`
      if (folded.imCall) kept.imCall = `${kept.imCall}\n\n${folded.imCall}`
      kept.fragen = [...kept.fragen, ...folded.fragen.filter((q) => !kept.fragen.includes(q))]
      kept.questionFirst = kept.questionFirst || folded.questionFirst
      kept.cautious = kept.cautious || folded.cautious
    }
  }
  return [...fired.values()]
}
